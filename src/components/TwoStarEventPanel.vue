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
    subtitle="Every pack guarantees one ★★ card. Super Rare and Special Art Rare both count as ★★, each treated as equally likely because the card list has no separate odds for that slot."
  />
</template>
