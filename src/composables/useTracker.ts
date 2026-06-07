import { ref, shallowRef, triggerRef, watch } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'ptcgp-tracker-owned'

const ownedIds = shallowRef<Set<string>>(
  new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
)
const syncLoading = ref(false)
let _uid: string | null = null
let _writeTimer: ReturnType<typeof setTimeout> | null = null
let _lsTimer: ReturnType<typeof setTimeout> | null = null

// Defer off the render critical path so it doesn't block visual updates
watch(ownedIds, () => {
  if (_lsTimer) clearTimeout(_lsTimer)
  _lsTimer = setTimeout(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ownedIds.value]))
    _lsTimer = null
  }, 300)
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
    }
    triggerRef(ownedIds)
  }

  function setOwned(cardId: string, owned: boolean) {
    if (ownedIds.value.has(cardId) === owned) return
    if (owned) ownedIds.value.add(cardId)
    else ownedIds.value.delete(cardId)
    triggerRef(ownedIds)
  }

  function isOwned(cardId: string): boolean {
    return ownedIds.value.has(cardId)
  }

  return { ownedIds, toggle, setOwned, isOwned, syncLoading }
}
