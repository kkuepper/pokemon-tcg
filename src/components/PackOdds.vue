<script setup lang="ts">
import { computed } from 'vue'
import type { Card } from '../types/card'
import { formatPct } from '../utils/odds'

const props = defineProps<{ card: Card }>()

const slot4Pct = computed(() => formatPct(props.card.slot4Rate))
const slot5Pct = computed(() => formatPct(props.card.slot5Rate))
const perPackPct = computed(() => formatPct(props.card.perPackRate))
const rarePct = computed(() => formatPct(props.card.rarePackContrib))
const hasRarePack = computed(() => props.card.rarePackContrib > 0)
const isCommon = computed(() => props.card.rarity === 'C')
const isShinySlot6 = computed(() => props.card.slot4Rate === 0 && props.card.slot5Rate === 0 && props.card.perPackRate > 0)
</script>

<template>
  <div class="space-y-4">
    <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Per-Pack Probability</h3>

    <!-- Big number -->
    <div class="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 text-center">
      <p class="text-4xl font-bold text-blue-700 tabular-nums">{{ perPackPct }}</p>
      <p class="text-sm text-gray-500 mt-1">chance per pack opening</p>
    </div>

    <!-- Slot breakdown -->
    <div class="space-y-2">
      <template v-if="isCommon">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">Slots 1–3 (C pool)</span>
          <span class="font-mono font-medium">{{ perPackPct }}</span>
        </div>
      </template>

      <template v-else-if="isShinySlot6">
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">Slot 6 (Regular Pack +1)</span>
          <span class="font-mono font-medium">via +1 bonus pack</span>
        </div>
        <p class="text-xs text-gray-400">Appears only in the bonus 6th card slot when you're lucky to receive a +1 pack.</p>
      </template>

      <template v-else>
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">Slot 4</span>
          <span class="font-mono font-medium">{{ slot4Pct }}</span>
        </div>
        <div class="flex justify-between text-sm">
          <span class="text-gray-600">Slot 5</span>
          <span class="font-mono font-medium">{{ slot5Pct }}</span>
        </div>
      </template>

      <template v-if="hasRarePack">
        <div class="border-t border-gray-100 pt-2 flex justify-between text-sm">
          <span class="text-gray-600">Rare (god) Pack contribution <span class="text-xs text-gray-400">(0.05%)</span></span>
          <span class="font-mono font-medium text-amber-600">+{{ rarePct }}</span>
        </div>
      </template>
    </div>

    <p v-if="card.perPackRate === 0" class="text-xs text-gray-400 italic">
      This card is not obtainable through regular pack pulls.
    </p>
  </div>
</template>
