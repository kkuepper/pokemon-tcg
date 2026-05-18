<script setup lang="ts">
import { ref } from 'vue'
import type { Card } from './types/card'
import CardSearch from './components/CardSearch.vue'
import CardDetail from './components/CardDetail.vue'
import PackOdds from './components/PackOdds.vue'
import MultiPackSimulator from './components/MultiPackSimulator.vue'

const selectedCard = ref<Card | null>(null)

function onSelect(card: Card) {
  selectedCard.value = card
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-4xl mx-auto px-4 py-4">
        <h1 class="text-xl font-bold text-gray-900">
          Pokémon TCG Pocket — Pack Odds Calculator
        </h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Find out how likely you are to pull a specific card from a booster pack.
        </p>
      </div>
    </header>

    <main class="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <!-- Search + detail row -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Card search -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Find a Card</h2>
          <CardSearch @select="onSelect" />
        </div>

        <!-- Card detail -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm flex items-start">
          <div v-if="selectedCard" class="w-full">
            <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Selected Card</h2>
            <CardDetail :card="selectedCard" />
          </div>
          <div v-else class="w-full flex flex-col items-center justify-center text-center py-8 text-gray-400">
            <svg class="w-10 h-10 mb-2 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
                d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
            </svg>
            <p class="text-sm">Search for a card to see its pull odds</p>
          </div>
        </div>
      </div>

      <!-- Odds panels (only shown after selection) -->
      <template v-if="selectedCard">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <PackOdds :card="selectedCard" />
          </div>
          <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <MultiPackSimulator :per-pack-rate="selectedCard.perPackRate" />
          </div>
        </div>
      </template>
    </main>

    <footer class="text-center text-xs text-gray-400 py-6">
      Pull rates sourced from
      <a href="https://github.com/flibustier/pokemon-tcg-pocket-database" target="_blank" rel="noopener"
        class="underline hover:text-gray-600">pokemon-tcg-pocket-database</a>.
      Not affiliated with The Pokémon Company.
    </footer>
  </div>
</template>
