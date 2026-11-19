<script setup lang="ts">
import { useAnalyticsChoice } from '../composables/useAnalyticsChoice'

const { choice, accept, withdraw } = useAnalyticsChoice()

function toggle() {
  if (choice.value === 'granted') withdraw()
  else accept()
}

function onSuggestFeature() {
  try {
    window.palmetaAnalytics?.('event', { name: 'feedback_click', count: 1 })
  } catch {
    // A missing analytics function must not break the link.
  }
}
</script>

<template>
  <footer class="text-center text-xs text-gray-400 py-6 space-y-2">
    <p>
      <button
        type="button"
        class="underline hover:text-gray-600"
        @click="toggle"
      >
        Analytics: {{ choice === 'granted' ? 'on' : choice === 'declined' ? 'off' : 'not set' }}
      </button>
      <span aria-hidden="true"> · </span>
      <RouterLink to="/privacy" class="underline hover:text-gray-600">Privacy</RouterLink>
      <span aria-hidden="true"> · </span>
      <a
        href="https://github.com/kkuepper/pokemon-tcg/issues/new?template=feedback.yml"
        target="_blank"
        rel="noopener noreferrer"
        class="underline hover:text-gray-600"
        @click="onSuggestFeature"
      >Suggest a feature</a>
    </p>
    <p>
      Pull rates sourced from
      <a href="https://github.com/flibustier/pokemon-tcg-pocket-database" target="_blank" rel="noopener"
        class="underline hover:text-gray-600">pokemon-tcg-pocket-database</a>.
      Not affiliated with The Pokémon Company.
    </p>
  </footer>
</template>
