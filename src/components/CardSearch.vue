<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useCardDb } from '../composables/useCardDb'
import type { Card, CardRarity } from '../types/card'
import { RARITY_LABELS } from '../types/card'
import RarityBadge from './RarityBadge.vue'
import { packsToComplete, formatPacks } from '../utils/odds'
import posthog from 'posthog-js'

const ITEMS_PER_PAGE = 10

const ALL_RARITIES: CardRarity[] = ['C', 'U', 'R', 'RR', 'AR', 'SR', 'SAR', 'IM', 'UR', 'S', 'SSR']

const props = defineProps<{ selectedId?: string }>()

const emit = defineEmits<{
  select: [card: Card]
}>()

const { loading, error, search, setFilter, packFilter, rarityFilter, sets, setNames, packsForSet, filteredCards, cards } = useCardDb()

const rarityOpen = ref(false)
const rarityDropdownEl = ref<HTMLElement | null>(null)

function onDocumentClick(e: MouseEvent) {
  if (rarityDropdownEl.value && !rarityDropdownEl.value.contains(e.target as Node)) {
    rarityOpen.value = false
  }
}
onMounted(() => document.addEventListener('mousedown', onDocumentClick))
onUnmounted(() => document.removeEventListener('mousedown', onDocumentClick))

function toggleRarity(r: CardRarity) {
  const idx = rarityFilter.value.indexOf(r)
  if (idx === -1) rarityFilter.value = [...rarityFilter.value, r]
  else rarityFilter.value = rarityFilter.value.filter(x => x !== r)
  posthog.capture('rarity_filter_applied', {
    rarity: r,
    action: idx === -1 ? 'added' : 'removed',
    active_rarities: rarityFilter.value,
  })
}

const DIAMOND_RARITIES = new Set(['C', 'U', 'R', 'RR'])

interface SetCompletion {
  set: string
  setName: string
  packs: string[]
  packsNeeded: number
  diamondPacksNeeded: number
}

const hardestToComplete = computed<SetCompletion[]>(() => {
  // Group by set; for each card ID keep the best (highest) perPackRate across packs
  const setGroups = new Map<string, { setName: string; packs: Set<string>; bestRates: Map<string, number>; bestDiamondRates: Map<string, number> }>()
  for (const card of cards.value) {
    if (!setGroups.has(card.set)) setGroups.set(card.set, { setName: card.setName, packs: new Set(), bestRates: new Map(), bestDiamondRates: new Map() })
    const group = setGroups.get(card.set)!
    group.packs.add(card.pack)
    const prev = group.bestRates.get(card.id) ?? 0
    if (card.perPackRate > prev) group.bestRates.set(card.id, card.perPackRate)
    if (DIAMOND_RARITIES.has(card.rarity)) {
      const prevD = group.bestDiamondRates.get(card.id) ?? 0
      if (card.perPackRate > prevD) group.bestDiamondRates.set(card.id, card.perPackRate)
    }
  }

  const results: SetCompletion[] = []
  for (const [set, { setName, packs, bestRates, bestDiamondRates }] of setGroups) {
    const packsNeeded = packsToComplete(Array.from(bestRates.values()), 0.5)
    const diamondPacksNeeded = packsToComplete(Array.from(bestDiamondRates.values()), 0.5)
    results.push({ set, setName, packs: Array.from(packs), packsNeeded, diamondPacksNeeded })
  }

  return results
    .sort((a, b) => (b.packsNeeded === Infinity ? 1 : 0) - (a.packsNeeded === Infinity ? 1 : 0)
      || b.packsNeeded - a.packsNeeded)
    .slice(0, 10)
})

const rarestCards = computed(() => {
  const seen = new Set<string>()
  const deduped = cards.value.filter(c => {
    if (seen.has(c.id)) return false
    seen.add(c.id)
    return true
  })
  const filtered = rarityFilter.value.length
    ? deduped.filter(c => rarityFilter.value.includes(c.rarity))
    : deduped
  return filtered.sort((a, b) => a.perPackRate - b.perPackRate).slice(0, 10)
})

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
  debounceTimer = setTimeout(() => {
    search.value = val
    if (val.trim().length >= 2) {
      posthog.capture('card_searched', { query: val.trim() })
    }
  }, 150)
}

function onSetChange(e: Event) {
  setFilter.value = (e.target as HTMLSelectElement).value
  packFilter.value = ''
  if (setFilter.value) {
    posthog.capture('set_filter_applied', { set: setFilter.value })
  }
}

function onPackChange(e: Event) {
  packFilter.value = (e.target as HTMLSelectElement).value
  if (packFilter.value) {
    posthog.capture('pack_filter_applied', { set: setFilter.value, pack: packFilter.value })
  }
}

function onCardSelect(card: Card) {
  emit('select', card)
  posthog.capture('card_selected', {
    card_id: card.id,
    card_name: card.name,
    rarity: card.rarity,
    set: card.set,
    pack: card.pack,
    per_pack_rate: card.perPackRate,
  })
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

    <!-- Rarity filter multi-select -->
    <div class="relative" ref="rarityDropdownEl">
      <div class="flex gap-1">
        <button
          type="button"
          @click="rarityOpen = !rarityOpen"
          class="flex-1 flex items-center justify-between rounded-lg border border-gray-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
        >
          <span v-if="rarityFilter.length === 0" class="text-gray-400">All rarities</span>
          <span v-else class="inline-flex flex-wrap gap-1.5 items-center">
            <RarityBadge v-for="r in rarityFilter" :key="r" :rarity="r" />
          </span>
          <span class="ml-2 text-gray-400 shrink-0">{{ rarityOpen ? '▴' : '▾' }}</span>
        </button>
        <button
          v-if="rarityFilter.length > 0"
          type="button"
          @click="rarityFilter = []"
          class="px-2 rounded-lg border border-gray-300 text-gray-400 hover:text-gray-600 hover:bg-gray-50 text-sm"
          title="Clear rarity filter"
        >✕</button>
      </div>

      <div
        v-if="rarityOpen"
        class="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-64 overflow-y-auto"
      >
        <label
          v-for="r in ALL_RARITIES"
          :key="r"
          class="flex items-center gap-2.5 px-3 py-1.5 cursor-pointer hover:bg-gray-50"
        >
          <input
            type="checkbox"
            :checked="rarityFilter.includes(r)"
            @change="toggleRarity(r)"
            class="rounded"
          />
          <RarityBadge :rarity="r" />
          <span class="text-sm text-gray-700">{{ RARITY_LABELS[r] }}</span>
        </label>
      </div>
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
            @click="onCardSelect(card)"
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
            @click="onCardSelect(card)"
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

      <template v-if="hardestToComplete.length > 0">
        <p class="text-xs font-semibold text-gray-500 uppercase tracking-wide">Hardest to complete set</p>
        <ul class="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
          <li
            v-for="item in hardestToComplete"
            :key="item.set"
            @click="setFilter = item.set; packFilter = ''"
            class="flex items-center gap-3 px-3 py-2.5 text-sm cursor-pointer bg-white hover:bg-gray-50 transition-colors"
          >
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate">{{ item.setName }}</p>
              <p class="text-xs text-gray-400 truncate">{{ item.set }} · {{ item.packs.join(', ') }}</p>
            </div>
            <div class="shrink-0 text-right">
              <p class="text-sm font-bold text-blue-700 tabular-nums">{{ formatPacks(item.packsNeeded) }}</p>
              <p class="text-xs text-gray-400 tabular-nums inline-flex items-center gap-1">
                <svg width="8" height="8" viewBox="0 0 10 10" fill="#94a3b8" aria-hidden="true"><polygon points="5,0 10,5 5,10 0,5"/></svg>
                {{ formatPacks(item.diamondPacksNeeded) }}
              </p>
            </div>
          </li>
        </ul>
        <p class="text-xs text-gray-400">Packs to complete at 50% probability</p>
      </template>
    </template>
  </div>
</template>
