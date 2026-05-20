<script setup lang="ts">
import { computed } from 'vue'
import { useCardDb } from '../composables/useCardDb'
import { formatPacks, packsToComplete } from '../utils/odds'
import type { Card } from '../types/card'

const DIAMOND_RARITIES = new Set(['C', 'U', 'R', 'RR'])

const props = defineProps<{ set: string; setName: string; targetPct: number }>()

const { cards } = useCardDb()

// All unique cards in the set. For cards that appear in multiple packs,
// use the highest perPackRate so the calculation reflects opening whichever
// pack gives the best odds for each card still needed.
const setCards = computed(() => {
  const best = new Map<string, Card>()
  for (const c of cards.value) {
    if (c.set !== props.set) continue
    const prev = best.get(c.id)
    if (!prev || c.perPackRate > prev.perPackRate) best.set(c.id, c)
  }
  return Array.from(best.values())
})

const diamondCards = computed(() =>
  setCards.value.filter(c => DIAMOND_RARITIES.has(c.rarity))
)

const packsForDiamonds = computed(() =>
  packsToComplete(diamondCards.value.map(c => c.perPackRate), props.targetPct / 100)
)

const packsForAll = computed(() =>
  packsToComplete(setCards.value.map(c => c.perPackRate), props.targetPct / 100)
)
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Complete the Set</h3>
    <p class="text-xs text-gray-500">
      Total packs to collect <span class="font-medium">every card</span> in {{ setName }}
      at {{ targetPct }}% probability, opening whichever pack gives the best odds per card.
    </p>

    <div class="space-y-2">
      <div class="rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700 inline-flex items-center gap-1">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="#94a3b8" aria-hidden="true"><polygon points="5,0 10,5 5,10 0,5"/></svg>
            Diamond cards
          </p>
          <p class="text-xs text-gray-400">{{ diamondCards.length }} cards (C · U · R · RR)</p>
        </div>
        <span class="text-2xl font-bold text-blue-700 tabular-nums">
          {{ packsForDiamonds === Infinity ? '∞' : formatPacks(packsForDiamonds) }}
        </span>
      </div>

      <div class="rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700">All cards</p>
          <p class="text-xs text-gray-400">{{ setCards.length }} cards</p>
        </div>
        <span class="text-2xl font-bold text-blue-700 tabular-nums">
          {{ packsForAll === Infinity ? '∞' : formatPacks(packsForAll) }}
        </span>
      </div>
    </div>
  </div>
</template>
