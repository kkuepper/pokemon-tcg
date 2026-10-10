<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <RouterLink to="/" class="text-xl font-bold text-gray-900 hover:text-blue-600">
          Pokémon TCG Pocket
        </RouterLink>
        <nav class="flex items-center gap-1 text-sm font-medium shrink-0">
          <RouterLink to="/tracker" class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">Tracker</RouterLink>
          <RouterLink to="/" class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100">Pack Odds</RouterLink>
        </nav>
      </div>
    </header>

    <main class="max-w-2xl mx-auto px-4 py-8 text-sm text-gray-700 space-y-6 leading-relaxed">
      <h1 class="text-2xl font-bold text-gray-900">Privacy</h1>

      <section class="space-y-2">
        <h2 class="text-base font-semibold text-gray-900">Palmeta</h2>
        <p>
          This site loads analytics from analytics.palmeta.net. A pageview sends the page address without the query string, and the UTC day with no time. The host name is included with that address. The visitor id is not sent.
        </p>
        <p>
          Before you accept, this tab stores an analytics session marker named a.s. It lives in sessionStorage, so it stays in this tab, and it is not sent.
        </p>
        <p>
          After you accept, this browser also stores a visitor id named a.u. The id is random. It is never sent. It is replaced after 400 days. The stored record keeps when the id was created and the last UTC day it was counted. This tab also stores an a.c marker, the UTC day that counted as a consented visit. a.c stays in the tab.
        </p>
        <p>
          Analytics off deletes the visitor id and the a.c marker. The tab session marker can remain. Turning analytics back on grants consent again.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-semibold text-gray-900">Google Analytics</h2>
        <p>
          Google Analytics (G-881GKMN0JQ) loads only after you accept, and it may set _ga cookies. Analytics off removes those _ga cookies and the consent cookie named analytics_consent. Later visits do not load Google Analytics until you turn it on again.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-semibold text-gray-900">PostHog</h2>
        <p>
          PostHog runs on every visit, including when you choose No thanks or turn analytics off. It stores a random id in a cookie and in localStorage. It currently records sessions (a replay of the page and what you do on it, with typed input masked, plus console logs), page views and page leaves with the full URL, page performance timing, errors, and events such as searches, filters, card choices, pack counts, and collection changes. Autocapture and heatmaps are off.
        </p>
      </section>

      <section class="space-y-2">
        <h2 class="text-base font-semibold text-gray-900">Your choice</h2>
        <p>
          The banner and the footer control are the same choice. No thanks, and Analytics off, save a preference in this browser so the banner does not come back. The preference is the word declined, stored in localStorage under analytics_choice. It is not an identifier and it is not sent.
        </p>
      </section>
    </main>

    <SiteFooter />
  </div>
</template>

<script setup lang="ts">
import SiteFooter from '../components/SiteFooter.vue'
</script>
