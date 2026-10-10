<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyticsChoice } from '../composables/useAnalyticsChoice'

const { choice, accept, decline } = useAnalyticsChoice()
const visible = computed(() => choice.value === 'unknown')
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-lg"
    role="region"
    aria-label="Analytics"
  >
    <p>
      This tab stores an analytics session marker. If you accept, a visitor id is stored in this browser and Google Analytics may set cookies. PostHog runs either way, including session recording.
      <RouterLink to="/privacy" class="font-medium text-blue-700 underline hover:text-blue-800">Privacy</RouterLink>
    </p>
    <button
      type="button"
      class="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
      @click="accept"
    >
      Accept
    </button>
    <button
      type="button"
      class="rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
      @click="decline"
    >
      No thanks
    </button>
  </div>
</template>
