<script setup lang="ts">
import { ref, watch, watchEffect } from 'vue'
import posthog from 'posthog-js'
import { useRoute, useRouter } from 'vue-router'
import { isMissionReward, type Card } from './types/card'
import { useCardDb } from './composables/useCardDb'
import { useTracker } from './composables/useTracker'
import { cardToSlug } from './utils/slug'
import { applyPageMeta, metaForAppRoute } from './utils/pageMeta'
import CardSearch from './components/CardSearch.vue'
import CardDetail from './components/CardDetail.vue'
import PackOdds from './components/PackOdds.vue'
import MultiPackSimulator from './components/MultiPackSimulator.vue'
import CompleteTheSet from './components/CompleteTheSet.vue'
import AuthButton from './components/AuthButton.vue'
import SiteFooter from './components/SiteFooter.vue'

const route = useRoute()
const router = useRouter()
const selectedCard = ref<Card | null>(null)
const targetPct = ref(50)
const { cards, loading, search, setFilter, packFilter, rarityFilter, setNames } = useCardDb()
const { isOwned, toggle } = useTracker()

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

function toggleFromPanel(card: Card) {
  const newOwned = !isOwned(card.id)
  toggle(card.id, 'panel')
  posthog.capture('card_collected_toggled', { card_id: card.id, owned: newOwned, source: 'panel' })
}

function onCardSelect(card: Card) {
  if (card.id === selectedCard.value?.id) {
    selectedCard.value = null
    router.push('/')
    return
  }
  selectedCard.value = card
  router.push({ params: { slug: cardToSlug(card) } })
}

// On a card URL the prerendered tags already describe that card. While
// cards.json loads (or if it fails) selectedCard is null: leave them alone
// instead of switching to the homepage tags. Only a slug-less route gets HOME_META.
watchEffect(() => {
  const meta = metaForAppRoute({ slug: route.params.slug, selectedCard: selectedCard.value })
  if (meta) applyPageMeta(meta)
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
              Pokémon TCG Pocket Odds — Pack Odds Calculator
            </RouterLink>
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Pack odds and pull rates for every card: find out how likely you are to pull a specific card from a booster pack.
          </p>
        </div>
        <nav class="flex items-center gap-1 text-sm font-medium shrink-0 mt-1">
          <RouterLink
            to="/tracker"
            class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >Tracker</RouterLink>
          <RouterLink
            to="/meta-decks"
            class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >Meta Decks</RouterLink>
          <RouterLink
            to="/"
            class="px-3 py-1.5 rounded-lg bg-blue-600 text-white"
          >Pack Odds</RouterLink>
          <AuthButton />
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
              <CardDetail :card="selectedCard" :collected="isOwned(selectedCard.id)" @toggle-collected="toggleFromPanel(selectedCard)" />
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
              :mission="isMissionReward(selectedCard)"
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

    <SiteFooter />
  </div>
</template>
