<script setup lang="ts">
import { computed } from 'vue'
import { useCardDb } from '../composables/useCardDb'
import { formatPacks, packsToComplete } from '../utils/odds'
import type { Card } from '../types/card'

const DIAMOND_RARITIES = new Set(['C', 'U', 'R', 'RR'])

const props = defineProps<{ card: Card; targetPct: number }>()

const { cards } = useCardDb()

const packCards = computed(() =>
  cards.value.filter(c => c.set === props.card.set && c.pack === props.card.pack)
)

const diamondCards = computed(() =>
  packCards.value.filter(c => DIAMOND_RARITIES.has(c.rarity))
)

const packsForDiamonds = computed(() =>
  packsToComplete(diamondCards.value.map(c => c.perPackRate), props.targetPct / 100)
)

const packsForAll = computed(() =>
  packsToComplete(packCards.value.map(c => c.perPackRate), props.targetPct / 100)
)
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Complete the Pack</h3>
    <p class="text-xs text-gray-500">
      Packs to pull <span class="font-medium">every card</span> at {{ targetPct }}% probability
      from {{ card.setName }} — {{ card.pack }}.
    </p>

    <div class="space-y-2">
      <div class="rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700">◇ Diamond cards</p>
          <p class="text-xs text-gray-400">{{ diamondCards.length }} cards (C · U · R · RR)</p>
        </div>
        <span class="text-2xl font-bold text-blue-700 tabular-nums">
          {{ packsForDiamonds === Infinity ? '∞' : formatPacks(packsForDiamonds) }}
        </span>
      </div>

      <div class="rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium text-gray-700">All cards</p>
          <p class="text-xs text-gray-400">{{ packCards.length }} cards</p>
        </div>
        <span class="text-2xl font-bold text-blue-700 tabular-nums">
          {{ packsForAll === Infinity ? '∞' : formatPacks(packsForAll) }}
        </span>
      </div>
    </div>
  </div>
</template>
