import { ref, shallowRef, triggerRef, watch } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { trackPalmetaEvent } from '../analytics'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'ptcgp-tracker-owned'
/** Ids already included in a card_tracked event from this browser. Not sent. */
const REPORTED_KEY = 'ptcgp-tracked-reported'
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
const pendingTracked = new Set<string>()

function noteTracked(cardId: string) {
  pendingTracked.add(cardId)
}

function loadReported(): Set<string> {
  try {
    const raw = localStorage.getItem(REPORTED_KEY)
    if (!raw) return new Set()
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return new Set()
    return new Set(parsed.filter((id): id is string => typeof id === 'string'))
  } catch {
    return new Set()
  }
}

function saveReported(ids: Set<string>) {
  try {
    localStorage.setItem(REPORTED_KEY, JSON.stringify([...ids]))
  } catch {
    // Private mode can reject storage. The count was already handed to Palmeta.
  }
}

// Runs after the owned-card save debounce. Drops cards a drag put back, and
// cards this browser has already reported. One card_tracked batch per flush, or none.
function flushCardTracked() {
  const stillTracked: string[] = []
  for (const id of pendingTracked) {
    if (ownedIds.value.has(id)) stillTracked.push(id)
  }
  pendingTracked.clear()

  const reported = loadReported()
  const fresh = stillTracked.filter(id => !reported.has(id))
  if (fresh.length === 0) return

  let sent = false
  try {
    sent = trackPalmetaEvent('card_tracked', fresh.length)
  } catch {
    sent = false
  }
  if (!sent) return

  for (const id of fresh) reported.add(id)
  saveReported(reported)
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
