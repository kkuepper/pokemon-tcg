<script setup lang="ts">
defineProps<{ size?: number; color?: string }>()
</script>

<template>
  <svg :width="size ?? 12" :height="size ?? 12" viewBox="0.5 0.5 9 8.5" :fill="color ?? 'currentColor'" aria-hidden="true">
    <polygon points="5,0.5 6.06,3.54 9.28,3.61 6.71,5.56 7.65,8.64 5,6.8 2.35,8.64 3.29,5.56 0.72,3.61 3.94,3.54"/>
  </svg>
</template>
