<script setup lang="ts">
import { ref, watch } from 'vue'
import { useCardDb } from '../composables/useCardDb'
import type { Card } from '../types/card'
import { RARITY_COLORS } from '../types/card'

const emit = defineEmits<{
  select: [card: Card]
}>()

const { loading, error, search, setFilter, packFilter, sets, setNames, packsForSet, filteredCards } = useCardDb()

const showDropdown = ref(false)
let debounceTimer: ReturnType<typeof setTimeout>

function onInput(e: Event) {
  clearTimeout(debounceTimer)
  const val = (e.target as HTMLInputElement).value
  debounceTimer = setTimeout(() => {
    search.value = val
    showDropdown.value = true
  }, 150)
}

function selectCard(card: Card) {
  emit('select', card)
  search.value = card.name
  showDropdown.value = false
}

function onSetChange(e: Event) {
  setFilter.value = (e.target as HTMLSelectElement).value
  packFilter.value = ''
  search.value = ''
  showDropdown.value = false
}

function onPackChange(e: Event) {
  packFilter.value = (e.target as HTMLSelectElement).value
  search.value = ''
  showDropdown.value = false
}

// Close dropdown when clicking outside
function onBlur() {
  setTimeout(() => { showDropdown.value = false }, 150)
}

watch([setFilter, packFilter], () => {
  showDropdown.value = false
})
</script>

<template>
  <div class="space-y-3">
    <!-- Set picker -->
    <div class="flex gap-2">
      <select
        :value="setFilter"
        @change="onSetChange"
        class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
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
        class="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40"
      >
        <option value="">All packs</option>
        <option v-for="p in packsForSet" :key="p" :value="p">{{ p }}</option>
      </select>
    </div>

    <!-- Search input -->
    <div class="relative">
      <input
        type="text"
        :value="search"
        @input="onInput"
        @focus="showDropdown = true"
        @blur="onBlur"
        placeholder="Search card name…"
        class="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
      />

      <!-- Loading / error state -->
      <div v-if="loading" class="absolute inset-y-0 right-3 flex items-center">
        <span class="text-xs text-gray-400">Loading…</span>
      </div>
      <div v-else-if="error" class="absolute inset-y-0 right-3 flex items-center">
        <span class="text-xs text-red-400">{{ error }}</span>
      </div>

      <!-- Dropdown results -->
      <ul
        v-if="showDropdown && filteredCards.length > 0"
        class="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg"
      >
        <li
          v-for="card in filteredCards.slice(0, 60)"
          :key="card.id"
          @mousedown.prevent="selectCard(card)"
          class="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-blue-50"
        >
          <span
            class="shrink-0 rounded px-1.5 py-0.5 text-xs font-medium"
            :class="RARITY_COLORS[card.rarity]"
          >
            {{ card.rarity }}
          </span>
          <span class="font-medium">{{ card.name }}</span>
          <span class="ml-auto text-xs text-gray-400">{{ card.set }} · {{ card.pack }}</span>
        </li>
        <li v-if="filteredCards.length > 60" class="px-3 py-2 text-xs text-gray-400 text-center">
          {{ filteredCards.length - 60 }} more — refine your search
        </li>
      </ul>

      <div
        v-else-if="showDropdown && !loading && search.length > 0 && filteredCards.length === 0"
        class="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white px-3 py-4 text-sm text-center text-gray-400 shadow-lg"
      >
        No cards found
      </div>
    </div>

    <p class="text-xs text-gray-400">
      {{ filteredCards.length.toLocaleString() }} cards
      <template v-if="setFilter"> in {{ setNames[setFilter] }}</template>
      <template v-if="packFilter"> · {{ packFilter }} pack</template>
    </p>
  </div>
</template>
