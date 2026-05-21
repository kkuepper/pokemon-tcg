<script setup lang="ts">
defineProps<{ size?: number; color?: string }>()
</script>

<template>
  <svg :width="size ?? 10" :height="size ?? 10" viewBox="0 0 10 10" :fill="color ?? 'currentColor'" aria-hidden="true">
    <polygon points="5,0 10,5 5,10 0,5"/>
  </svg>
</template>
