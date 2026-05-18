<script setup lang="ts">
import { ref } from 'vue'
import type { Card } from './types/card'
import CardSearch from './components/CardSearch.vue'
import CardDetail from './components/CardDetail.vue'
import PackOdds from './components/PackOdds.vue'
import MultiPackSimulator from './components/MultiPackSimulator.vue'

const selectedCard = ref<Card | null>(null)
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-4">
        <h1 class="text-xl font-bold text-gray-900">
          Pokémon TCG Pocket — Pack Odds Calculator
        </h1>
        <p class="text-sm text-gray-500 mt-0.5">
          Find out how likely you are to pull a specific card from a booster pack.
        </p>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6">
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        <!-- Left column: Search (sticky on large screens) -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm lg:sticky lg:top-6">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Find a Card</h2>
          <CardSearch
            :selected-id="selectedCard?.id"
            @select="selectedCard = $event"
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

        <!-- Right column: Multi-pack simulator -->
        <div v-if="selectedCard" class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
          <MultiPackSimulator :per-pack-rate="selectedCard.perPackRate" />
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
