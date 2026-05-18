import { ref, computed, type Ref } from 'vue'
import Fuse from 'fuse.js'
import type { Card } from '../types/card'
import { normalizeForSearch } from '../utils/search'

interface CardDb {
  cards: Ref<Card[]>
  loading: Ref<boolean>
  error: Ref<string | null>
  search: Ref<string>
  setFilter: Ref<string>
  packFilter: Ref<string>
  sets: Ref<string[]>
  setNames: Ref<Record<string, string>>
  packsForSet: Ref<string[]>
  filteredCards: Ref<Card[]>
}

let instance: CardDb | null = null

export function useCardDb(): CardDb {
  if (instance) return instance

  const cards = ref<Card[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)
  const search = ref('')
  const setFilter = ref('')
  const packFilter = ref('')

  let fuse: Fuse<Card> | null = null

  const base = import.meta.env.BASE_URL

  fetch(`${base}cards.json`)
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      return r.json() as Promise<Card[]>
    })
    .then(data => {
      cards.value = data
      fuse = new Fuse(data, {
        keys: [{ name: 'name', getFn: (c: Card) => normalizeForSearch(c.name) }],
        threshold: 0.4,
        ignoreLocation: true,
        minMatchCharLength: 2,
      })
      loading.value = false
    })
    .catch(err => {
      error.value = String(err)
      loading.value = false
    })

  const sets = computed<string[]>(() => {
    const seen = new Set<string>()
    const result: string[] = []
    for (const c of cards.value) {
      if (!seen.has(c.set)) {
        seen.add(c.set)
        result.push(c.set)
      }
    }
    return result
  })

  const setNames = computed<Record<string, string>>(() => {
    const map: Record<string, string> = {}
    for (const c of cards.value) {
      map[c.set] = c.setName
    }
    return map
  })

  const packsForSet = computed<string[]>(() => {
    if (!setFilter.value) return []
    const seen = new Set<string>()
    const result: string[] = []
    for (const c of cards.value) {
      if (c.set === setFilter.value && !seen.has(c.pack)) {
        seen.add(c.pack)
        result.push(c.pack)
      }
    }
    return result
  })

  const filteredCards = computed<Card[]>(() => {
    const q = normalizeForSearch(search.value.trim())

    // Fuse.js search when query is long enough — results are ranked by relevance
    let base: Card[]
    if (q.length >= 2 && fuse) {
      base = fuse.search(q).map(r => r.item)
    } else {
      base = cards.value
    }

    // Apply set / pack filters (preserves relevance order from Fuse)
    const filtered = base.filter(c => {
      if (setFilter.value && c.set !== setFilter.value) return false
      if (packFilter.value && c.pack !== packFilter.value) return false
      return true
    })

    // When browsing (no search query), sort by card number
    if (q.length < 2) {
      filtered.sort((a, b) => {
        const numA = parseInt(a.id.split('-').pop()!, 10)
        const numB = parseInt(b.id.split('-').pop()!, 10)
        return numA - numB
      })
    }

    return filtered
  })

  instance = { cards, loading, error, search, setFilter, packFilter, sets, setNames, packsForSet, filteredCards }
  return instance
}
