<script setup lang="ts">
import { computed } from 'vue'
import type { CardRarity } from '../types/card'
import DiamondIcon from './icons/DiamondIcon.vue'
import StarIcon from './icons/StarIcon.vue'
import ShinyIcon from './icons/ShinyIcon.vue'
import CrownIcon from './icons/CrownIcon.vue'

const props = defineProps<{ rarity: CardRarity }>()

type Shape = 'diamond' | 'star' | 'crown' | 'shiny'

interface Config {
  shape: Shape
  count: number
  color: string
  label: string
}

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
  <span class="inline-flex items-center gap-[2px]" :title="cfg.label" :aria-label="cfg.label">
    <template v-for="(_, i) in icons" :key="i">
      <DiamondIcon v-if="cfg.shape === 'diamond'" :size="10" :color="cfg.color" />
      <StarIcon    v-else-if="cfg.shape === 'star'"    :size="15" :color="cfg.color" />
      <CrownIcon   v-else-if="cfg.shape === 'crown'"   :color="cfg.color" />
      <ShinyIcon   v-else-if="cfg.shape === 'shiny'"   :size="12" />
    </template>
  </span>
</template>
