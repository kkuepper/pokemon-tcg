<script setup lang="ts">
import type { Card } from '../types/card'
import { RARITY_LABELS, RARITY_COLORS } from '../types/card'

defineProps<{ card: Card }>()
</script>

<template>
  <div class="flex items-start gap-4">
    <div class="shrink-0 w-20 h-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
      <img
        v-if="card.image"
        :src="`https://static.dotgg.gg/pokepocket/card/${card.image.replace('.webp', '.webp')}`"
        :alt="card.name"
        class="w-full h-full object-cover"
        loading="lazy"
        @error="(e) => (e.target as HTMLImageElement).style.display = 'none'"
      />
      <span v-else class="text-xs text-gray-400 text-center px-1">No image</span>
    </div>

    <div class="min-w-0">
      <h2 class="text-lg font-bold text-gray-900 leading-tight">{{ card.name }}</h2>
      <p class="text-sm text-gray-500 mt-0.5">{{ card.setName }} · {{ card.pack }} pack</p>
      <span
        class="mt-2 inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="RARITY_COLORS[card.rarity]"
      >
        {{ RARITY_LABELS[card.rarity] }}
      </span>
      <p class="mt-1 text-xs text-gray-400">Pool size: {{ card.poolSize }} cards at this rarity</p>
    </div>
  </div>
</template>
