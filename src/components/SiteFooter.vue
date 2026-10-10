<script setup lang="ts">
import { useAnalyticsChoice } from '../composables/useAnalyticsChoice'

const { choice, accept, withdraw } = useAnalyticsChoice()

function toggle() {
  if (choice.value === 'granted') withdraw()
  else accept()
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
    </p>
    <p>
      Pull rates sourced from
      <a href="https://github.com/flibustier/pokemon-tcg-pocket-database" target="_blank" rel="noopener"
        class="underline hover:text-gray-600">pokemon-tcg-pocket-database</a>.
      Not affiliated with The Pokémon Company.
    </p>
  </footer>
</template>
