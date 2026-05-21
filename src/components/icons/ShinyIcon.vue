<script setup lang="ts">
defineProps<{ size?: number }>()
</script>

<template>
  <svg :width="size ?? 12" :height="size ?? 12" viewBox="0 0 10 10" aria-hidden="true">
    <defs>
      <radialGradient id="shiny-icon-grad" cx="40%" cy="35%" r="60%">
        <stop offset="0%" stop-color="#fda4af"/>
        <stop offset="100%" stop-color="#7c3aed"/>
      </radialGradient>
    </defs>
    <polygon
      points="5,0 6.15,2.23 8.54,1.46 7.77,3.85 10,5 7.77,6.15 8.54,8.54 6.15,7.77 5,10 3.85,7.77 1.46,8.54 2.23,6.15 0,5 2.23,3.85 1.46,1.46 3.85,2.23"
      fill="url(#shiny-icon-grad)" stroke="#4a1272" stroke-width="0.6" stroke-linejoin="round"
    />
  </svg>
</template>
