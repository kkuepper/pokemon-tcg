import { ref, shallowRef, triggerRef, watch } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { cardTrackedAwaitingScript, trackPalmetaEvent } from '../analytics'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'ptcgp-tracker-owned'
/** Card ids already included in a card_tracked count. The count does not send these ids. */
const REPORTED_KEY = 'ptcgp-tracked-reported'
/** Card ids still waiting to be included in a card_tracked count. This count does not send them. */
const PENDING_KEY = 'ptcgp-tracked-pending'
const SAVE_DEBOUNCE_MS = 300

const ownedIds = shallowRef<Set<string>>(
  new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
)
const syncLoading = ref(false)
let _uid: string | null = null
let _writeTimer: ReturnType<typeof setTimeout> | null = null
let _lsTimer: ReturnType<typeof setTimeout> | null = null

// Moved from untracked to tracked through toggle or setOwned since the last save.
// Firestore merges and the localStorage load assign ownedIds directly, so they stay out.
// Ids left here are only this count's queue, including ones a blocked a.js has not taken.
const pendingTracked = new Set<string>(readIdList(PENDING_KEY))
let flushHolds = 0

function noteTracked(cardId: string) {
  pendingTracked.add(cardId)
}

function readIdList(key: string): string[] {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is string => typeof id === 'string')
  } catch {
    return []
  }
}

function loadReported(): Set<string> {
  return new Set(readIdList(REPORTED_KEY))
}

function saveReported(ids: Set<string>) {
  try {
    localStorage.setItem(REPORTED_KEY, JSON.stringify([...ids]))
  } catch {
    // Private mode can reject storage. This count was already handed to a.js.
  }
}

function persistPending() {
  try {
    if (pendingTracked.size === 0) localStorage.removeItem(PENDING_KEY)
    else localStorage.setItem(PENDING_KEY, JSON.stringify([...pendingTracked]))
  } catch {
    // Private mode can reject storage. The in-memory queue for this count remains.
  }
}

/**
 * Touch marks stay provisional until touchend or until a scroll cancels them.
 * While held, this count is not flushed.
 */
export function holdCardTrackedFlush() {
  flushHolds++
}

export function releaseCardTrackedFlush() {
  if (flushHolds === 0) return
  flushHolds--
  if (flushHolds === 0) flushCardTracked()
}

// Drops cards a drag or scroll put back, and cards this count already included.
// One card_tracked batch per flush, or none. A second flush does not resend.
function flushCardTracked() {
  if (flushHolds > 0) return

  const stillTracked: string[] = []
  for (const id of pendingTracked) {
    if (ownedIds.value.has(id)) stillTracked.push(id)
  }
  pendingTracked.clear()
  for (const id of stillTracked) pendingTracked.add(id)

  const reported = loadReported()
  for (const id of stillTracked) {
    if (reported.has(id)) pendingTracked.delete(id)
  }
  const fresh = [...pendingTracked]
  if (fresh.length === 0) {
    persistPending()
    return
  }

  let sent = false
  try {
    sent = trackPalmetaEvent('card_tracked', fresh.length)
  } catch {
    sent = false
  }
  if (!sent) {
    // A missing or still-stubbed script keeps this count for a later visit.
    // Reported ids are written only after a.js accepts it. Consent does not drop it.
    if (!cardTrackedAwaitingScript()) pendingTracked.clear()
    persistPending()
    return
  }

  for (const id of fresh) {
    reported.add(id)
    pendingTracked.delete(id)
  }
  saveReported(reported)
  persistPending()
}

function onVisibilityChange() {
  if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
    flushCardTracked()
  }
}

if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
  window.addEventListener('pagehide', flushCardTracked)
  window.addEventListener('visibilitychange', onVisibilityChange)
}

// Defer off the render critical path so it doesn't block visual updates
watch(ownedIds, () => {
  if (_lsTimer) clearTimeout(_lsTimer)
  _lsTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ownedIds.value]))
    _lsTimer = null
    flushCardTracked()
  }, SAVE_DEBOUNCE_MS)
})

watch(ownedIds, () => {
  if (!_uid) return
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(async () => {
    await setDoc(doc(db, 'users', _uid!, 'tracker', 'data'), {
      cardIds: [...ownedIds.value],
      lastUpdated: serverTimestamp(),
    })
  }, 500)
})

const { user } = useAuth()
watch(user, async (newUser, oldUser) => {
  if (!newUser) {
    _uid = null
    return
  }
  if (oldUser?.uid === newUser.uid) return

  _uid = newUser.uid
  syncLoading.value = true
  try {
    const docRef = doc(db, 'users', _uid!, 'tracker', 'data')
    const snap = await getDoc(docRef)
    if (!snap.exists()) {
      await setDoc(docRef, { cardIds: [...ownedIds.value], lastUpdated: serverTimestamp() })
    } else {
      const merged = new Set([...ownedIds.value, ...((snap.data().cardIds as string[]) ?? [])])
      ownedIds.value = merged
    }
  } catch (e) {
    console.error('Firestore sync failed', e)
  } finally {
    syncLoading.value = false
  }
})

export function useTracker() {
  function toggle(cardId: string) {
    if (ownedIds.value.has(cardId)) {
      ownedIds.value.delete(cardId)
    } else {
      ownedIds.value.add(cardId)
      noteTracked(cardId)
    }
    triggerRef(ownedIds)
  }

  function setOwned(cardId: string, owned: boolean) {
    if (ownedIds.value.has(cardId) === owned) return
    if (owned) {
      ownedIds.value.add(cardId)
      noteTracked(cardId)
    } else {
      ownedIds.value.delete(cardId)
    }
    triggerRef(ownedIds)
  }

  function isOwned(cardId: string): boolean {
    return ownedIds.value.has(cardId)
  }

  return { ownedIds, toggle, setOwned, isOwned, syncLoading }
}
