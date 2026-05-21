<script setup lang="ts">
import { ref, watch, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { Card } from './types/card'
import { useCardDb } from './composables/useCardDb'
import { cardToSlug } from './utils/slug'
import CardSearch from './components/CardSearch.vue'
import CardDetail from './components/CardDetail.vue'
import PackOdds from './components/PackOdds.vue'
import MultiPackSimulator from './components/MultiPackSimulator.vue'
import CompleteTheSet from './components/CompleteTheSet.vue'

const route = useRoute()
const router = useRouter()
const selectedCard = ref<Card | null>(null)
const targetPct = ref(50)
const { cards, loading, search, setFilter, packFilter, rarityFilter, setNames } = useCardDb()

function slugToId(slug: string): string {
  const parts = slug.split('-')
  return parts.slice(-2).join('-')
}

// Resolve card from URL once DB is loaded (handles direct URL load)
watch(
  () => loading.value,
  (isLoading) => {
    if (!isLoading && route.params.slug) {
      const id = slugToId(route.params.slug as string)
      selectedCard.value = cards.value.find(c => c.id.toLowerCase() === id) ?? null
    }
  },
  { immediate: true }
)

// Sync selectedCard when user navigates back/forward
watch(
  () => route.params.slug,
  (newSlug) => {
    if (!newSlug) {
      selectedCard.value = null
      search.value = ''
      setFilter.value = ''
      packFilter.value = ''
      rarityFilter.value = []
      return
    }
    const id = slugToId(newSlug as string)
    selectedCard.value = cards.value.find(c => c.id.toLowerCase() === id) ?? null
  }
)

function onCardSelect(card: Card) {
  if (card.id === selectedCard.value?.id) {
    selectedCard.value = null
    router.push('/')
    return
  }
  selectedCard.value = card
  router.push({ params: { slug: cardToSlug(card) } })
}

function setMeta(attr: string, value: string, content: string) {
  document.querySelector(`meta[${attr}="${value}"]`)?.setAttribute('content', content)
}

function formatPct(rate: number): string {
  const pct = rate * 100
  const str = pct >= 1 ? pct.toFixed(2) : pct.toFixed(4)
  return str.replace(/\.?0+$/, '') + '%'
}

watchEffect(() => {
  if (selectedCard.value) {
    const card = selectedCard.value
    const pct = formatPct(card.perPackRate)
    const title = `${card.name} (${card.id}) — Pack Odds | Pokémon TCG Pocket`
    const desc = `Pull rate for ${card.name} from ${card.setName}: ${pct} per pack. Find pack odds for every card in Pokémon TCG Pocket.`
    document.title = title
    setMeta('name', 'description', desc)
    setMeta('property', 'og:title', title)
    setMeta('property', 'og:description', desc)
  } else {
    document.title = 'Pokémon TCG Pocket — Tracker & Odds Calculator'
    setMeta('name', 'description', 'Calculate exact pull rates and pack odds for every card in Pokémon TCG Pocket. See probabilities for all sets and rarities.')
    setMeta('property', 'og:title', 'Pokémon TCG Pocket — Tracker & Odds Calculator')
    setMeta('property', 'og:description', 'Calculate exact pull rates and pack odds for every card in Pokémon TCG Pocket.')
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            <RouterLink to="/" class="hover:text-blue-600 transition-colors">
              Pokémon TCG Pocket — Tracker & Odds Calculator
            </RouterLink>
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Find out how likely you are to pull a specific card from a booster pack.
          </p>
        </div>
        <nav class="flex gap-1 text-sm font-medium shrink-0 mt-1">
          <RouterLink
            to="/tracker"
            class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >Tracker</RouterLink>
          <RouterLink
            to="/"
            class="px-3 py-1.5 rounded-lg bg-blue-600 text-white"
          >Pack Odds</RouterLink>
        </nav>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        <!-- Left column: Search (sticky on large screens) -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm lg:sticky lg:top-6">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Find a Card</h2>
          <CardSearch
            :selected-id="selectedCard?.id"
            @select="onCardSelect"
          />
        </div>

        <!-- Middle column: Card detail + Pack odds -->
        <div class="space-y-4">
          <template v-if="selectedCard">
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Selected Card</h2>
              <CardDetail :card="selectedCard" />
            </div>
            <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <PackOdds :card="selectedCard" />
            </div>
          </template>
          <div v-else class="hidden lg:flex items-center justify-center h-40 rounded-xl border border-dashed border-gray-200 text-gray-400 text-sm">
            ← Select a card to see its odds
          </div>
        </div>

        <!-- Right column: Multi-pack simulator + Complete the Set -->
        <div v-if="selectedCard || setFilter" class="space-y-4">
          <div v-if="selectedCard" class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <MultiPackSimulator
              :per-pack-rate="selectedCard.perPackRate"
              :rarity="selectedCard.rarity"
              v-model:target-pct="targetPct"
            />
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <CompleteTheSet
              :set="selectedCard?.set ?? setFilter"
              :set-name="selectedCard?.setName ?? setNames[setFilter]"
              :target-pct="targetPct"
            />
          </div>
        </div>

      </div>
    </main>

    <footer class="text-center text-xs text-gray-400 py-6">
      Pull rates sourced from
      <a href="https://github.com/flibustier/pokemon-tcg-pocket-database" target="_blank" rel="noopener"
        class="underline hover:text-gray-600">pokemon-tcg-pocket-database</a>.
      Not affiliated with The Pokémon Company.
    </footer>
  </div>
</template>
