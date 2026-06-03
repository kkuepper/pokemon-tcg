import { ref, watch } from 'vue'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from './useAuth'

const STORAGE_KEY = 'ptcgp-tracker-owned'

const ownedIds = ref<Set<string>>(
  new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
)
const syncLoading = ref(false)
let _uid: string | null = null
let _writeTimer: ReturnType<typeof setTimeout> | null = null

watch(ownedIds, (set) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
})

watch(ownedIds, (set) => {
  if (!_uid) return
  if (_writeTimer) clearTimeout(_writeTimer)
  _writeTimer = setTimeout(async () => {
    await setDoc(doc(db, 'users', _uid!, 'tracker', 'data'), {
      cardIds: [...set],
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
    const next = new Set(ownedIds.value)
    if (next.has(cardId)) {
      next.delete(cardId)
    } else {
      next.add(cardId)
    }
    ownedIds.value = next
  }

  function setOwned(cardId: string, owned: boolean) {
    if (ownedIds.value.has(cardId) === owned) return
    const next = new Set(ownedIds.value)
    if (owned) next.add(cardId)
    else next.delete(cardId)
    ownedIds.value = next
  }

  function isOwned(cardId: string): boolean {
    return ownedIds.value.has(cardId)
  }

  return { ownedIds, toggle, setOwned, isOwned, syncLoading }
}
