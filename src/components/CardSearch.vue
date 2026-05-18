<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useCardDb } from '../composables/useCardDb'
import type { Card } from '../types/card'
import RarityBadge from './RarityBadge.vue'

const ITEMS_PER_PAGE = 10

const props = defineProps<{ selectedId?: string }>()

const emit = defineEmits<{
  select: [card: Card]
}>()

const { loading, error, search, setFilter, packFilter, sets, setNames, packsForSet, filteredCards, cards } = useCardDb()

const rarestCards = computed(() =>
  [...cards.value].sort((a, b) => a.perPackRate - b.perPackRate).slice(0, 10)
)

const currentPage = ref(1)

// Show results when there's a meaningful query, or a set/pack is selected
const showResults = computed(() =>
  search.value.trim().length >= 2 || setFilter.value !== '' || packFilter.value !== ''
)

const totalPages = computed(() => Math.ceil(filteredCards.value.length / ITEMS_PER_PAGE))

const pagedCards = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE
  return filteredCards.value.slice(start, start + ITEMS_PER_PAGE)
})

// Reset to page 1 whenever results change
watch(filteredCards, () => { currentPage.value = 1 })

let debounceTimer: ReturnType<typeof setTimeout>

function onInput(e: Event) {
  clearTimeout(debounceTimer)
  const val = (e.target as HTMLInputElement).value
  debounceTimer = setTimeout(() => { search.value = val }, 150)
}

function onSetChange(e: Event) {
  setFilter.value = (e.target as HTMLSelectElement).value
  packFilter.value = ''
  search.value = ''
}

function onPackChange(e: Event) {
  packFilter.value = (e.target as HTMLSelectElement).value
  search.value = ''
}
</script>

<template>
  <div class="space-y-4">
    <!-- Filters row -->
    <div class="grid grid-cols-3 gap-2">
      <select
        :value="setFilter"
        @change="onSetChange"
        class="col-span-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
      >
        <option value="">All sets</option>
        <option v-for="s in sets" :key="s" :value="s">
          {{ setNames[s] }} ({{ s }})
        </option>
      </select>

      <select
        :value="packFilter"
        @change="onPackChange"
        :disabled="!setFilter"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40"
      >
        <option value="">All packs</option>
        <option v-for="p in packsForSet" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <!-- Name search -->
    <div class="relative">
      <input
        type="text"
        :value="search"
        @input="onInput"
        placeholder="Search card name…"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />
      <div v-if="loading" class="absolute inset-y-0 right-3 flex items-center">
        <span class="text-xs text-gray-400">Loading…</span>
      </div>
      <div v-else-if="error" class="absolute inset-y-0 right-3 flex items-center">
        <span class="text-xs text-red-500">{{ error }}</span>
      </div>
    </div>

    <!-- Inline results -->
    <template v-if="showResults">
      <div v-if="filteredCards.length === 0 && !loading" class="text-sm text-gray-400 text-center py-4">
        No cards found
      </div>

      <template v-else-if="filteredCards.length > 0">
        <!-- Result rows -->
        <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          <li
            v-for="card in pagedCards"
            :key="card.id"
            @click="emit('select', card)"
            class="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer transition-colors"
            :class="card.id === props.selectedId
              ? 'bg-blue-50 border-l-4 border-blue-400'
              : 'bg-white hover:bg-gray-50 border-l-4 border-transparent'"
          >
            <RarityBadge :rarity="card.rarity" class="shrink-0" />
            <span class="font-medium truncate">{{ card.name }}</span>
            <span class="ml-auto shrink-0 text-xs text-gray-400">{{ card.set }} · {{ card.pack }}</span>
          </li>
        </ul>

        <!-- Pagination -->
        <div class="flex items-center justify-between text-sm text-gray-500">
          <span class="text-xs">
            {{ filteredCards.length.toLocaleString() }} result{{ filteredCards.length !== 1 ? 's' : '' }}
          </span>

          <div v-if="totalPages > 1" class="flex items-center gap-1">
            <button
              @click="currentPage--"
              :disabled="currentPage === 1"
              class="px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              ←
            </button>
            <span class="px-2 text-xs tabular-nums">{{ currentPage }} / {{ totalPages }}</span>
            <button
              @click="currentPage++"
              :disabled="currentPage === totalPages"
              class="px-2 py-1 rounded border border-gray-200 text-xs hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              →
            </button>
          </div>
        </div>
      </template>
    </template>

    <template v-else>
      <p class="text-xs text-gray-400">
        Type at least 2 characters, or select a set to browse cards.
      </p>
      <template v-if="rarestCards.length > 0">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hardest to pull</p>
        <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          <li
            v-for="card in rarestCards"
            :key="card.id"
            @click="emit('select', card)"
            class="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer transition-colors"
            :class="card.id === props.selectedId
              ? 'bg-blue-50 border-l-4 border-blue-400'
              : 'bg-white hover:bg-gray-50 border-l-4 border-transparent'"
          >
            <RarityBadge :rarity="card.rarity" class="shrink-0" />
            <span class="font-medium truncate">{{ card.name }}</span>
            <span class="ml-auto shrink-0 text-xs text-gray-400">{{ card.set }} · {{ card.pack }}</span>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
