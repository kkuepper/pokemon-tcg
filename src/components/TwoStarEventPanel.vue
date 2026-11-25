<script setup lang="ts">
import BestPackPanel from './BestPackPanel.vue'

defineProps<{
  entries: { label: string; prob: number }[]
}>()
</script>

<template>
  <BestPackPanel
    :entries="entries"
    title="Best pack for a new ★★ card (event)"
    subtitle="Every pack guarantees one ★★ card. Each ★★ card in a pack is treated as equally likely."
    subtitle-detail="Super Rare and Special Art Rare both count as ★★. Card data has no per-card odds for this guaranteed slot, so each ★★ card a pack can contain counts equally."
  />
</template>
