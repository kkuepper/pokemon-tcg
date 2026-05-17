<script setup lang="ts">
import { ref, computed } from 'vue'
import { atLeastOneIn, packsForProbability, formatPct, formatPacks } from '../utils/odds'

const props = defineProps<{ perPackRate: number }>()

const targetPct = ref(50) // slider: target probability in %
const customPacks = ref<number | null>(null)

const disabled = computed(() => props.perPackRate <= 0)

const packsNeeded = computed(() => {
  if (disabled.value) return null
  return packsForProbability(props.perPackRate, targetPct.value / 100)
})

const packsNeededDisplay = computed(() => {
  if (packsNeeded.value === null) return '—'
  return formatPacks(packsNeeded.value)
})

const customPacksProb = computed(() => {
  if (!customPacks.value || customPacks.value <= 0 || disabled.value) return null
  return atLeastOneIn(props.perPackRate, customPacks.value)
})

const fillWidth = computed(() => `${targetPct.value}%`)
</script>

<template>
  <div class="space-y-6">
    <h3 class="text-sm font-semibold text-gray-700 uppercase tracking-wide">Multi-Pack Simulator</h3>

    <!-- Target probability slider -->
    <div class="space-y-3">
      <div class="flex justify-between items-center">
        <label class="text-sm text-gray-600">Target probability</label>
        <span class="text-lg font-bold text-gray-800 tabular-nums">{{ targetPct }}%</span>
      </div>

      <input
        type="range"
        min="10"
        max="99"
        step="1"
        v-model.number="targetPct"
        :disabled="disabled"
        class="w-full accent-blue-600 disabled:opacity-40"
      />

      <div class="flex justify-between text-xs text-gray-400">
        <span>10%</span>
        <span>99%</span>
      </div>

      <!-- Result card -->
      <div
        class="relative rounded-xl overflow-hidden border border-gray-200"
        :class="disabled ? 'opacity-40' : ''"
      >
        <!-- fill bar -->
        <div
          class="absolute inset-y-0 left-0 bg-blue-100 transition-all duration-200"
          :style="{ width: fillWidth }"
        ></div>
        <div class="relative px-4 py-3 flex items-center justify-between">
          <span class="text-sm text-gray-600">Packs needed</span>
          <span class="text-2xl font-bold text-blue-700 tabular-nums">{{ packsNeededDisplay }}</span>
        </div>
      </div>
    </div>

    <!-- Custom pack count input -->
    <div class="space-y-2">
      <label class="text-sm text-gray-600">
        Or: enter a pack count to see the probability
      </label>
      <div class="flex gap-2 items-center">
        <input
          type="number"
          min="1"
          max="999999"
          v-model.number="customPacks"
          :disabled="disabled"
          placeholder="e.g. 100"
          class="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:opacity-40"
        />
        <span class="text-sm text-gray-500">packs →</span>
        <span
          v-if="customPacksProb !== null"
          class="text-base font-bold text-green-600 tabular-nums"
        >
          {{ formatPct(customPacksProb) }}
        </span>
        <span v-else class="text-sm text-gray-400">—</span>
      </div>
    </div>

    <p v-if="disabled" class="text-xs text-gray-400 italic">
      Select a card above to run the simulation.
    </p>
  </div>
</template>
