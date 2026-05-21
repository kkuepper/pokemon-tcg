<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useCardDb } from '../composables/useCardDb'
import { useTracker } from '../composables/useTracker'
import CardDetail from '../components/CardDetail.vue'
import PackOdds from '../components/PackOdds.vue'
import type { Card, CardRarity } from '../types/card'

// ── Image / number helpers ────────────────────────────────────────────────────

function cardImageUrl(card: Card): string {
  const [set, paddedNum] = card.id.split('-')
  return `https://cdn.jsdelivr.net/gh/flibustier/pokemon-tcg-exchange@main/public/images/cards-by-set/${set}/${parseInt(paddedNum, 10)}.webp`
}

function cardNumber(card: Card): string {
  return String(parseInt(card.id.split('-')[1], 10))
}

// ── Rarity groups ─────────────────────────────────────────────────────────────

const DIAMOND_RARITIES = new Set<CardRarity>(['C', 'U', 'R', 'RR'])
const STAR_RARITIES    = new Set<CardRarity>(['AR', 'SR', 'SAR', 'IM', 'UR'])
const SHINY_RARITIES   = new Set<CardRarity>(['S', 'SSR'])

// ── Core data ─────────────────────────────────────────────────────────────────

const { cards, loading } = useCardDb()
const { ownedIds, setOwned, isOwned } = useTracker()

const showMissingOnly = ref(false)
const selectedCard = ref<Card | null>(null)

const sets = computed(() => {
  const seen = new Set<string>()
  const result: { code: string; name: string }[] = []
  for (const card of cards.value) {
    if (!seen.has(card.set)) {
      seen.add(card.set)
      result.push({ code: card.set, name: card.setName })
    }
  }
  return result.reverse()
})

const cardsBySet = computed(() => {
  const seen = new Set<string>()
  const groups = new Map<string, Card[]>()
  for (const card of cards.value) {
    if (seen.has(card.id)) continue
    seen.add(card.id)
    if (!groups.has(card.set)) groups.set(card.set, [])
    groups.get(card.set)!.push(card)
  }
  return groups
})

function cardsForSet(setCode: string): Card[] {
  const all = cardsBySet.value.get(setCode) ?? []
  return showMissingOnly.value ? all.filter(c => !isOwned(c.id)) : all
}

interface GroupCount { owned: number; total: number }
interface SetStats { diamonds: GroupCount; stars: GroupCount; shinies: GroupCount }

function statsForSet(setCode: string): SetStats {
  const stats: SetStats = {
    diamonds: { owned: 0, total: 0 },
    stars:    { owned: 0, total: 0 },
    shinies:  { owned: 0, total: 0 },
  }
  for (const card of cardsBySet.value.get(setCode) ?? []) {
    const owned = isOwned(card.id)
    if (DIAMOND_RARITIES.has(card.rarity)) {
      stats.diamonds.total++; if (owned) stats.diamonds.owned++
    } else if (STAR_RARITIES.has(card.rarity)) {
      stats.stars.total++; if (owned) stats.stars.owned++
    } else if (SHINY_RARITIES.has(card.rarity)) {
      stats.shinies.total++; if (owned) stats.shinies.owned++
    }
  }
  return stats
}

// ── Scroll-spy (which set is in view) ────────────────────────────────────────

const activeSetCode = ref('')

let intersectionObserver: IntersectionObserver | null = null

function setupObserver() {
  intersectionObserver?.disconnect()
  intersectionObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          activeSetCode.value = (entry.target as HTMLElement).dataset.setCode ?? ''
        }
      }
    },
    { rootMargin: '0px 0px -80% 0px', threshold: 0 }
  )
  for (const set of sets.value) {
    const el = document.getElementById(`set-${set.code}`)
    if (el) intersectionObserver.observe(el)
  }
}

watch(loading, async (isLoading) => {
  if (!isLoading) {
    await nextTick()
    setupObserver()
    if (sets.value.length) activeSetCode.value = sets.value[0].code
  }
})

function scrollToSet(code: string) {
  document.getElementById(`set-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

onUnmounted(() => intersectionObserver?.disconnect())

// ── Gesture state ─────────────────────────────────────────────────────────────

type GestureState = 'idle' | 'pending' | 'dragging'
const gestureState = ref<GestureState>('idle')

let pendingCard: Card | null = null
let pendingSetCards: Card[] = []
let longPressTimer: ReturnType<typeof setTimeout> | null = null
const LONG_PRESS_MS = 350
let touchStartX = 0
let touchStartY = 0
const TOUCH_MOVE_THRESHOLD = 8

let dragStartIdx = -1
let dragCurrentIdx = -1
let dragTargetState = false
let preDragSnapshot = new Map<string, boolean>()

const dragRangeIds = ref(new Set<string>())
const pendingCardId = ref<string | null>(null)

function cardIndexInSet(setCards: Card[], cardId: string): number {
  return setCards.findIndex(c => c.id === cardId)
}

function applyRange(setCards: Card[], fromIdx: number, toIdx: number) {
  const lo = Math.min(fromIdx, toIdx)
  const hi = Math.max(fromIdx, toIdx)
  const newRange = new Set<string>()
  for (let i = lo; i <= hi; i++) {
    const id = setCards[i].id
    newRange.add(id)
    setOwned(id, dragTargetState)
  }
  for (const id of dragRangeIds.value) {
    if (!newRange.has(id)) setOwned(id, preDragSnapshot.get(id) ?? false)
  }
  dragRangeIds.value = newRange
}

function startLongPress(card: Card, setCards: Card[]) {
  pendingCard = card
  pendingCardId.value = card.id
  pendingSetCards = setCards
  longPressTimer = setTimeout(() => {
    longPressTimer = null
    if (gestureState.value !== 'pending') return
    gestureState.value = 'dragging'
    dragTargetState = !isOwned(card.id)
    dragStartIdx = cardIndexInSet(setCards, card.id)
    dragCurrentIdx = dragStartIdx
    preDragSnapshot = new Map(setCards.map(c => [c.id, isOwned(c.id)]))
    dragRangeIds.value = new Set([card.id])
    setOwned(card.id, dragTargetState)
  }, LONG_PRESS_MS)
}

function cancelLongPress() {
  if (longPressTimer !== null) { clearTimeout(longPressTimer); longPressTimer = null }
}

function endGesture() {
  cancelLongPress()
  gestureState.value = 'idle'
  dragRangeIds.value = new Set()
  pendingCardId.value = null
  dragStartIdx = -1; dragCurrentIdx = -1
  pendingCard = null; pendingSetCards = []
}

// ── Mouse handlers ────────────────────────────────────────────────────────────

function onCardMouseDown(card: Card, setCards: Card[]) {
  if (gestureState.value !== 'idle') return
  gestureState.value = 'pending'
  startLongPress(card, setCards)
}

function onCardMouseEnter(card: Card) {
  if (gestureState.value !== 'dragging') return
  const idx = cardIndexInSet(pendingSetCards, card.id)
  if (idx === -1 || idx === dragCurrentIdx) return
  dragCurrentIdx = idx
  applyRange(pendingSetCards, dragStartIdx, dragCurrentIdx)
}

function onWindowMouseUp() {
  if (gestureState.value === 'pending') {
    cancelLongPress()
    if (pendingCard) selectedCard.value = pendingCard
  }
  endGesture()
}

// ── Touch handlers ────────────────────────────────────────────────────────────

function onCardTouchStart(event: TouchEvent, card: Card, setCards: Card[]) {
  if (gestureState.value !== 'idle') return
  const touch = event.touches[0]
  touchStartX = touch.clientX; touchStartY = touch.clientY
  gestureState.value = 'pending'
  startLongPress(card, setCards)
}

function onGridTouchMove(event: TouchEvent) {
  const touch = event.touches[0]
  if (gestureState.value === 'pending') {
    if (Math.abs(touch.clientX - touchStartX) > TOUCH_MOVE_THRESHOLD ||
        Math.abs(touch.clientY - touchStartY) > TOUCH_MOVE_THRESHOLD) {
      cancelLongPress(); gestureState.value = 'idle'
    }
    return
  }
  if (gestureState.value === 'dragging') {
    event.preventDefault()
    const el = document.elementFromPoint(touch.clientX, touch.clientY)
    const btn = el?.closest<HTMLElement>('[data-card-id]')
    if (!btn?.dataset.cardId) return
    const idx = cardIndexInSet(pendingSetCards, btn.dataset.cardId)
    if (idx === -1 || idx === dragCurrentIdx) return
    dragCurrentIdx = idx
    applyRange(pendingSetCards, dragStartIdx, dragCurrentIdx)
  }
}

function onWindowTouchEnd() {
  if (gestureState.value === 'pending') {
    cancelLongPress()
    if (pendingCard) selectedCard.value = pendingCard
  }
  endGesture()
}

// ── Global listeners ──────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('mouseup', onWindowMouseUp)
  window.addEventListener('touchend', onWindowTouchEnd)
})
onUnmounted(() => {
  window.removeEventListener('mouseup', onWindowMouseUp)
  window.removeEventListener('touchend', onWindowTouchEnd)
  cancelLongPress()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50" :class="{ 'select-none': gestureState !== 'idle' }">

    <!-- Header (identical to Pack Odds) -->
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-gray-900">Pokémon TCG Pocket — Pack Odds Calculator</h1>
          <p class="text-sm text-gray-500 mt-0.5">Track which cards you've already pulled.</p>
        </div>
        <nav class="flex gap-1 text-sm font-medium shrink-0 mt-1">
          <RouterLink to="/" class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors">Pack Odds</RouterLink>
          <RouterLink to="/tracker" class="px-3 py-1.5 rounded-lg bg-blue-600 text-white">Tracker</RouterLink>
        </nav>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6">
      <div v-if="loading" class="flex items-center justify-center h-40 text-gray-400 text-sm">
        Loading cards…
      </div>

      <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        <!-- ── Col 1: Set navigation (sticky) ── -->
        <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
          <h2 class="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Sets</h2>

          <label class="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none mb-3">
            <input type="checkbox" v-model="showMissingOnly" class="rounded accent-blue-600" />
            Missing only
          </label>

          <div class="w-full px-1">
            <table class="text-sm border-separate border-spacing-y-0.5 -mx-4" style="width: calc(100% + 2rem)">
              <tr
                v-for="set in sets"
                :key="set.code"
                @click="scrollToSet(set.code)"
                class="cursor-pointer transition-colors"
                :class="activeSetCode === set.code
                  ? 'bg-blue-600 text-white font-semibold'
                  : 'text-gray-600 hover:bg-gray-100'"
              >
                <!-- Set name: truncates when narrow -->
                <td class="py-1.5 ml-1 pl-3 pr-1 rounded-l-lg max-w-0 w-full overflow-hidden text-ellipsis whitespace-nowrap">
                  {{ set.name }}
                </td>
                <!-- Diamond count -->
                <td class="py-1.5 px-1 whitespace-nowrap text-xs">
                  <span class="flex items-center gap-0.5">
                    <svg width="9" height="9" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><polygon points="5,0 10,5 5,10 0,5"/></svg>
                    {{ statsForSet(set.code).diamonds.owned }}/{{ statsForSet(set.code).diamonds.total }}
                  </span>
                </td>
                <!-- Star count -->
                <td class="py-1.5 px-1 whitespace-nowrap text-xs">
                  <span v-if="statsForSet(set.code).stars.total > 0" class="flex items-center gap-0.5">
                    <svg width="11" height="11" viewBox="0.5 0.5 9 8.5" fill="currentColor" aria-hidden="true"><polygon points="5,0.5 6.06,3.54 9.28,3.61 6.71,5.56 7.65,8.64 5,6.8 2.35,8.64 3.29,5.56 0.72,3.61 3.94,3.54"/></svg>
                    {{ statsForSet(set.code).stars.owned }}/{{ statsForSet(set.code).stars.total }}
                  </span>
                </td>
                <!-- Shiny count -->
                <td class="py-1.5 pl-1 pr-3 rounded-r-lg whitespace-nowrap text-xs">
                  <span v-if="statsForSet(set.code).shinies.total > 0" class="flex items-center gap-0.5">
                    <svg width="11" height="11" viewBox="0 0 10 10" aria-hidden="true">
                      <defs><radialGradient :id="`shiny-nav-${set.code}`" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#fda4af"/><stop offset="100%" stop-color="#7c3aed"/></radialGradient></defs>
                      <polygon points="5,0 6.15,2.23 8.54,1.46 7.77,3.85 10,5 7.77,6.15 8.54,8.54 6.15,7.77 5,10 3.85,7.77 1.46,8.54 2.23,6.15 0,5 2.23,3.85 1.46,1.46 3.85,2.23" :fill="`url(#shiny-nav-${set.code})`" stroke="#4a1272" stroke-width="0.6" stroke-linejoin="round"/>
                    </svg>
                    {{ statsForSet(set.code).shinies.owned }}/{{ statsForSet(set.code).shinies.total }}
                  </span>
                </td>
              </tr>
            </table>
          </div>

          <div class="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-400">
            {{ ownedIds.size }} cards collected
          </div>
        </div>

        <!-- ── Col 2: Card grids ── -->
        <div class="space-y-4">
          <div
            v-for="set in sets"
            :key="set.code"
            :id="`set-${set.code}`"
            :data-set-code="set.code"
            class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden scroll-mt-6"
          >
            <!-- Set header -->
            <div class="px-3 pt-3 pb-2 border-b border-gray-100">
              <h2 class="text-sm font-bold text-gray-800 mb-1.5 text-center">{{ set.name }}</h2>
              <div class="flex items-center justify-center gap-4 text-xs">
                <span class="flex items-center gap-1">
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="#94a3b8" aria-hidden="true"><polygon points="5,0 10,5 5,10 0,5"/></svg>
                  <span :class="statsForSet(set.code).diamonds.owned === statsForSet(set.code).diamonds.total ? 'text-blue-600' : 'text-gray-600'">
                    {{ statsForSet(set.code).diamonds.owned }}/{{ statsForSet(set.code).diamonds.total }}
                  </span>
                </span>
                <span v-if="statsForSet(set.code).stars.total > 0" class="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0.5 0.5 9 8.5" fill="#fbbf24" aria-hidden="true"><polygon points="5,0.5 6.06,3.54 9.28,3.61 6.71,5.56 7.65,8.64 5,6.8 2.35,8.64 3.29,5.56 0.72,3.61 3.94,3.54"/></svg>
                  <span :class="statsForSet(set.code).stars.owned === statsForSet(set.code).stars.total ? 'text-blue-600' : 'text-gray-600'">
                    {{ statsForSet(set.code).stars.owned }}/{{ statsForSet(set.code).stars.total }}
                  </span>
                </span>
                <span v-if="statsForSet(set.code).shinies.total > 0" class="flex items-center gap-1">
                  <svg width="12" height="12" viewBox="0 0 10 10" aria-hidden="true">
                    <defs><radialGradient id="shiny-stat" cx="40%" cy="35%" r="60%"><stop offset="0%" stop-color="#fda4af"/><stop offset="100%" stop-color="#7c3aed"/></radialGradient></defs>
                    <polygon points="5,0 6.15,2.23 8.54,1.46 7.77,3.85 10,5 7.77,6.15 8.54,8.54 6.15,7.77 5,10 3.85,7.77 1.46,8.54 2.23,6.15 0,5 2.23,3.85 1.46,1.46 3.85,2.23" fill="url(#shiny-stat)" stroke="#4a1272" stroke-width="0.6" stroke-linejoin="round"/>
                  </svg>
                  <span :class="statsForSet(set.code).shinies.owned === statsForSet(set.code).shinies.total ? 'text-blue-600' : 'text-gray-600'">
                    {{ statsForSet(set.code).shinies.owned }}/{{ statsForSet(set.code).shinies.total }}
                  </span>
                </span>
              </div>
            </div>

            <p v-if="showMissingOnly && cardsForSet(set.code).length === 0"
               class="text-xs text-green-600 italic px-3 py-3">
              All cards collected!
            </p>

            <!-- Card grid: 5 fixed columns -->
            <div
              v-else
              class="grid grid-cols-5 gap-0.5 p-1"
              @touchmove="onGridTouchMove"
            >
              <div
                v-for="card in cardsForSet(set.code)"
                :key="card.id"
                :data-card-id="card.id"
                :title="`${card.name} — tap to view, hold to mark`"
                class="relative aspect-[2/3] rounded overflow-hidden"
                :class="gestureState === 'idle' ? 'cursor-pointer' : 'cursor-grabbing'"
                @mousedown.prevent="onCardMouseDown(card, cardsForSet(set.code))"
                @mouseenter="onCardMouseEnter(card)"
                @touchstart.prevent="onCardTouchStart($event, card, cardsForSet(set.code))"
              >
                <img
                  v-if="isOwned(card.id)"
                  :src="cardImageUrl(card)"
                  :alt="card.name"
                  loading="lazy"
                  class="w-full h-full object-cover block pointer-events-none"
                />
                <div
                  v-else
                  class="w-full h-full bg-gray-100 border border-gray-200 flex items-center justify-center rounded pointer-events-none"
                >
                  <span class="text-gray-400 font-medium leading-none">{{ cardNumber(card) }}</span>
                </div>

                <!-- Blue ring: drag range or pending -->
                <div
                  v-if="dragRangeIds.has(card.id) || pendingCardId === card.id"
                  class="absolute inset-0 rounded ring-2 ring-blue-500 ring-inset pointer-events-none z-10"
                />
                <!-- Amber ring: selected card -->
                <div
                  v-else-if="selectedCard?.id === card.id"
                  class="absolute inset-0 rounded ring-2 ring-amber-400 ring-inset pointer-events-none z-10"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- ── Col 3: Selected card detail + odds (sticky, identical to Pack Odds middle col) ── -->
        <div class="space-y-4 lg:sticky lg:top-6">
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
            ← Tap a card to see its odds
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
