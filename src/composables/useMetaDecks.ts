import { ref, shallowRef } from 'vue'
import type { MetaDecksPayload } from '../types/metaDeck'

const payload = shallowRef<MetaDecksPayload | null>(null)
const loading = ref(true)
const loadError = ref<string | null>(null)
let loadPromise: Promise<void> | null = null

async function fetchMetaDecks() {
  if (loadPromise) return loadPromise
  loadPromise = (async () => {
    loading.value = true
    loadError.value = null
    try {
      const base = import.meta.env.BASE_URL
      const res = await fetch(`${base}meta-decks.json`)
      if (!res.ok) throw new Error(`Failed to load meta decks (${res.status})`)
      payload.value = (await res.json()) as MetaDecksPayload
    } catch (e) {
      loadError.value = e instanceof Error ? e.message : 'Failed to load meta decks'
      payload.value = null
    } finally {
      loading.value = false
    }
  })()
  return loadPromise
}

export function useMetaDecks() {
  if (!payload.value && loading.value) void fetchMetaDecks()
  return { payload, loading, loadError, refresh: fetchMetaDecks }
}
