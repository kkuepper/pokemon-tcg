import { ref, shallowRef, triggerRef, watch } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { cardTrackedAwaitingScript, trackPalmetaEvent } from '../analytics'
import { useAuth } from './useAuth'

/** Where a card was marked owned. Bulk is a drag or hold that changes more than one card. */
export type TrackSource = 'panel' | 'tracker' | 'bulk'

const TRACK_SOURCES: readonly TrackSource[] = ['panel', 'tracker', 'bulk']
const TRACK_SOURCE_EVENT: Record<TrackSource, string> = {
  panel: 'card_tracked_panel',
  tracker: 'card_tracked_tracker',
  bulk: 'card_tracked_bulk',
}

const STORAGE_KEY = 'ptcgp-tracker-owned'
/** Card ids already included in a card_tracked count. The count does not send these ids. */
const REPORTED_KEY = 'ptcgp-tracked-reported'
/**
 * Cards still waiting to be included in a card_tracked count, keyed by id.
 * The value is the source. This count does not send the ids.
 * Older saves are a JSON list of ids; those are read as source 'tracker'.
 */
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
const pendingTracked = new Map<string, TrackSource>(readPending())
let flushHolds = 0
let flushDeferred = false

function noteTracked(cardId: string, source: TrackSource) {
  pendingTracked.set(cardId, source)
}

/**
 * Relabel cards this gesture noted as single taps. Does not add cards, and does
 * not take over a card already waiting under another source.
 */
export function setTrackedSource(cardIds: Iterable<string>, source: TrackSource) {
  for (const id of cardIds) {
    if (pendingTracked.get(id) === 'tracker') pendingTracked.set(id, source)
  }
}

function isTrackSource(value: unknown): value is TrackSource {
  return value === 'panel' || value === 'tracker' || value === 'bulk'
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

function readPending(): Array<[string, TrackSource]> {
  try {
    const raw = localStorage.getItem(PENDING_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const entries: Array<[string, TrackSource]> = []
    // Previous format: ["card-id", ...]. Those saves predate the source split.
    if (Array.isArray(parsed)) {
      for (const id of parsed) {
        if (typeof id === 'string') entries.push([id, 'tracker'])
      }
      return entries
    }
    if (!parsed || typeof parsed !== 'object') return []
    for (const [id, source] of Object.entries(parsed)) {
      entries.push([id, isTrackSource(source) ? source : 'tracker'])
    }
    return entries
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
    else localStorage.setItem(PENDING_KEY, JSON.stringify(Object.fromEntries(pendingTracked)))
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

export function releaseCardTrackedFlush(shouldFlush = true) {
  if (flushHolds === 0) return
  flushHolds--
  if (flushHolds > 0) return
  if (!shouldFlush && !flushDeferred) return
  flushDeferred = false
  flushCardTracked()
}

// Drops cards a drag or scroll put back, and cards this count already included.
// One card_tracked batch per flush, or none. A second flush does not resend.
// The total keeps the card_tracked name. Non-zero panel, tracker, and bulk
// counts go out beside it, through the same Palmeta write.
function flushCardTracked() {
  if (flushHolds > 0) {
    flushDeferred = true
    return
  }
  flushDeferred = false

  for (const id of [...pendingTracked.keys()]) {
    if (!ownedIds.value.has(id)) pendingTracked.delete(id)
  }

  const reported = loadReported()
  for (const id of [...pendingTracked.keys()]) {
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

  const counts: Record<TrackSource, number> = { panel: 0, tracker: 0, bulk: 0 }
  for (const [, source] of fresh) counts[source] += 1
  try {
    for (const source of TRACK_SOURCES) {
      const count = counts[source]
      if (count > 0) trackPalmetaEvent(TRACK_SOURCE_EVENT[source], count)
    }
  } catch {
    // The total was already accepted. A breakdown failure must not resend it.
  }

  for (const [id] of fresh) {
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
  function toggle(cardId: string, source: TrackSource = 'tracker') {
    if (ownedIds.value.has(cardId)) {
      ownedIds.value.delete(cardId)
    } else {
      ownedIds.value.add(cardId)
      noteTracked(cardId, source)
    }
    triggerRef(ownedIds)
  }

  function setOwned(cardId: string, owned: boolean, source: TrackSource = 'tracker') {
    if (ownedIds.value.has(cardId) === owned) return
    if (owned) {
      ownedIds.value.add(cardId)
      noteTracked(cardId, source)
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
