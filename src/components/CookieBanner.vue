<script setup lang="ts">
import { ref } from 'vue'
import { acceptAnalytics, declineAnalytics, hasAnalyticsConsent } from '../analytics'

const visible = ref(!hasAnalyticsConsent())

function accept() {
  acceptAnalytics()
  visible.value = false
}

function decline() {
  declineAnalytics()
  visible.value = false
}
</script>

<template>
  <div
    v-if="visible"
    class="fixed inset-x-0 bottom-0 z-50 flex flex-wrap items-center justify-center gap-3 border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-800 shadow-lg"
    role="region"
    aria-label="Cookies"
  >
    <p>This site uses analytics cookies to understand visits. An analytics session marker is stored in this tab. After you accept, a visitor id is stored in this browser to count unique visitors.</p>
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
