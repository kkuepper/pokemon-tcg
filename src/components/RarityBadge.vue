<script setup lang="ts">
import { computed } from 'vue'
import type { CardRarity } from '../types/card'

const props = defineProps<{ rarity: CardRarity }>()

type Shape = 'diamond' | 'star' | 'crown' | 'shiny'

interface Config {
  shape: Shape
  count: number
  color: string
  label: string
}

// Source of truth from rarities.json: same shape + count, distinctive color per group.
// SAR gets a different color than SR (both are 2 stars) so they're distinguishable.
const CONFIGS: Record<CardRarity, Config> = {
  C:   { shape: 'diamond', count: 1, color: '#94a3b8', label: 'Common' },
  U:   { shape: 'diamond', count: 2, color: '#94a3b8', label: 'Uncommon' },
  R:   { shape: 'diamond', count: 3, color: '#94a3b8', label: 'Rare' },
  RR:  { shape: 'diamond', count: 4, color: '#94a3b8', label: 'Double Rare' },
  AR:  { shape: 'star',    count: 1, color: '#fbbf24', label: 'Art Rare' },
  SR:  { shape: 'star',    count: 2, color: '#fbbf24', label: 'Super Rare' },
  SAR: { shape: 'star',    count: 2, color: '#c084fc', label: 'Special Art Rare' },
  IM:  { shape: 'star',    count: 3, color: '#fbbf24', label: 'Immersive' },
  UR:  { shape: 'crown',   count: 1, color: '#f59e0b', label: 'Crown Rare' },
  S:   { shape: 'shiny',   count: 1, color: '#22d3ee', label: 'Shiny' },
  SSR: { shape: 'shiny',   count: 2, color: '#22d3ee', label: 'Shiny Super Rare' },
}

const cfg = computed(() => CONFIGS[props.rarity])
const icons = computed(() => Array.from({ length: cfg.value.count }))
</script>

<template>
  <span
    class="inline-flex items-center gap-[2px]"
    :title="cfg.label"
    :aria-label="cfg.label"
  >
    <template v-for="(_, i) in icons" :key="i">

      <!-- Diamond (rotated square) -->
      <svg v-if="cfg.shape === 'diamond'"
        width="10" height="10" viewBox="0 0 10 10"
        :fill="cfg.color" aria-hidden="true"
      >
        <polygon points="5,0 10,5 5,10 0,5"/>
      </svg>

      <!-- 5-pointed star: viewBox cropped to actual bounds (x:0.72–9.28, y:0.5–8.64) -->
      <svg v-else-if="cfg.shape === 'star'"
        width="15" height="15" viewBox="0.5 0.5 9 8.5"
        :fill="cfg.color" aria-hidden="true"
      >
        <polygon points="5,0.5 6.06,3.54 9.28,3.61 6.71,5.56 7.65,8.64 5,6.8 2.35,8.64 3.29,5.56 0.72,3.61 3.94,3.54"/>
      </svg>

      <!-- Crown: ♛ unicode character -->
      <span v-else-if="cfg.shape === 'crown'"
        :style="{ color: cfg.color }"
        class="text-[16px] leading-none"
        aria-hidden="true"
      >♛</span>

      <!-- Shiny: 8-tooth gear, dark outline, radial pink→purple gradient -->
      <svg v-else-if="cfg.shape === 'shiny'"
        width="12" height="12" viewBox="0 0 10 10"
        aria-hidden="true"
      >
        <defs>
          <radialGradient id="shiny-grad" cx="40%" cy="35%" r="60%">
            <stop offset="0%" stop-color="#fda4af"/>
            <stop offset="100%" stop-color="#7c3aed"/>
          </radialGradient>
        </defs>
        <!-- 16 vertices: outer r=5 at 0°,45°,90°…, inner r=3 at 22.5°,67.5°,112.5°… -->
        <polygon
          points="5,0 6.15,2.23 8.54,1.46 7.77,3.85 10,5 7.77,6.15 8.54,8.54 6.15,7.77 5,10 3.85,7.77 1.46,8.54 2.23,6.15 0,5 2.23,3.85 1.46,1.46 3.85,2.23"
          fill="url(#shiny-grad)"
          stroke="#4a1272"
          stroke-width="0.6"
          stroke-linejoin="round"
        />
      </svg>

    </template>
  </span>
</template>
