<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { Card } from '../types/card'
import { RARITY_LABELS, RARITY_COLORS } from '../types/card'
import RarityBadge from './RarityBadge.vue'

const props = defineProps<{ card: Card }>()

// Derive image URL from card id (format: "A1-036" → set=A1, number=36)
const imageUrl = computed(() => {
  const [set, paddedNum] = props.card.id.split('-')
  const number = parseInt(paddedNum, 10)
  return `https://cdn.jsdelivr.net/gh/flibustier/pokemon-tcg-exchange@main/public/images/cards-by-set/${set}/${number}.webp`
})

const showModal = ref(false)
const loaded = ref(false)

watch(() => props.card.id, () => { loaded.value = false })
</script>

<template>
  <div class="flex gap-4">
    <!-- Card image -->
    <div class="relative shrink-0 w-28 rounded-lg overflow-hidden border border-gray-200 bg-gray-100 cursor-zoom-in" @click="showModal = true">
      <div v-if="!loaded" class="absolute inset-0 animate-pulse bg-gray-200" />
      <img
        :src="imageUrl"
        :alt="card.name"
        class="w-full h-auto block transition-opacity duration-200"
        :class="{ 'opacity-0': !loaded }"
        @load="loaded = true"
        @error="(e) => ((e.target as HTMLImageElement).parentElement!.style.display = 'none')"
      />
    </div>

    <!-- Fullsize modal -->
    <Teleport to="body">
      <div
        v-if="showModal"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
        @click="showModal = false"
      >
        <img
          :src="imageUrl"
          :alt="card.name"
          class="max-h-[90vh] max-w-[90vw] rounded-xl shadow-2xl"
          @click.stop
        />
      </div>
    </Teleport>

    <!-- Card info -->
    <div class="min-w-0 flex flex-col justify-center">
      <h2 class="text-lg font-bold text-gray-900 leading-tight">{{ card.name }}</h2>
      <p class="text-sm text-gray-500 mt-0.5">{{ card.setName }} · {{ card.pack }} pack</p>
      <span
        class="mt-2 inline-flex items-center gap-1.5 self-start rounded-full px-2.5 py-0.5 text-xs font-medium"
        :class="RARITY_COLORS[card.rarity]"
      >
        <RarityBadge :rarity="card.rarity" />
        {{ RARITY_LABELS[card.rarity] }}
      </span>
      <p class="mt-1 text-xs text-gray-400">{{ card.poolSize }} cards at this rarity in this pack</p>
    </div>
  </div>
</template>
