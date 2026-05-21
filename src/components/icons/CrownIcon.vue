<script setup lang="ts">
defineProps<{ color?: string }>()
</script>

<template>
  <span :style="{ color: color ?? '#f59e0b' }" class="text-[16px] leading-none" aria-hidden="true">♛</span>
</template>
