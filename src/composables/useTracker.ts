import { ref, watch } from 'vue'

const STORAGE_KEY = 'ptcgp-tracker-owned'

const ownedIds = ref<Set<string>>(
  new Set(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') as string[])
)

watch(ownedIds, (set) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
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

  return { ownedIds, toggle, setOwned, isOwned }
}
