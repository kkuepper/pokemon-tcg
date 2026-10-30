<script setup lang="ts">
import { computed, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import AuthButton from '../components/AuthButton.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useMetaDecks } from '../composables/useMetaDecks'
import type { MetaDeck } from '../types/metaDeck'

const { payload, loading, loadError } = useMetaDecks()

const decks = computed(() => payload.value?.decks ?? [])
const displayDecks = computed(() => decks.value.slice(0, 60))
const hasMoreDecks = computed(() => decks.value.length > displayDecks.value.length)
const bannerError = computed(() => payload.value?.error ?? loadError.value)
const totalMatchGames = computed(() => decks.value.reduce((s, d) => s + d.games, 0))

function formatPct(rate: number | null, digits = 1): string {
  if (rate == null || Number.isNaN(rate)) return '—'
  return `${(rate * 100).toFixed(digits).replace(/\.0$/, '')}%`
}

function formatRecord(deck: MetaDeck): string {
  return `${deck.wins}–${deck.losses}${deck.ties ? `–${deck.ties}` : ''}`
}

function formatFetched(iso: string | undefined): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return iso
  }
}

watchEffect(() => {
  document.title = 'Meta Decks — Pokémon TCG Pocket'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-6xl mx-auto px-4 py-4 flex items-start justify-between gap-4">
        <div>
          <h1 class="text-xl font-bold text-gray-900">
            <RouterLink to="/" class="hover:text-blue-600 transition-colors">
              Pokémon TCG Pocket — Tracker & Odds Calculator
            </RouterLink>
          </h1>
          <p class="text-sm text-gray-500 mt-0.5">
            Competitive deck stats from Limitless Play tournaments.
          </p>
        </div>
        <nav class="flex flex-wrap items-center justify-end gap-1 text-sm font-medium shrink-0 mt-1">
          <RouterLink
            to="/tracker"
            class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >Tracker</RouterLink>
          <RouterLink
            to="/meta-decks"
            class="px-3 py-1.5 rounded-lg bg-blue-600 text-white"
          >Meta Decks</RouterLink>
          <RouterLink
            to="/"
            class="px-3 py-1.5 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >Pack Odds</RouterLink>
          <AuthButton />
        </nav>
      </div>
    </header>

    <main class="max-w-6xl mx-auto px-4 py-6 space-y-4">
      <div class="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
        <h2 class="text-lg font-semibold text-gray-900">Meta Decks</h2>
        <p class="text-sm text-gray-600 mt-1">
          Aggregated from recent public
          <a
            href="https://play.limitlesstcg.com/decks?game=pocket"
            target="_blank"
            rel="noopener"
            class="text-blue-600 underline hover:text-blue-800"
          >Pokémon TCG Pocket</a>
          tournaments on
          <a
            href="https://play.limitlesstcg.com/"
            target="_blank"
            rel="noopener"
            class="text-blue-600 underline hover:text-blue-800"
          >Limitless Play</a>.
          Custom-format events are excluded. Data refreshes on each site deploy, not in your browser.
        </p>
        <p
          v-if="payload && !loading"
          class="text-xs text-gray-500 mt-2"
        >
          Sample: {{ payload.tournamentCount }} tournaments ·
          {{ payload.totalDeckEntries }} deck entries ·
          {{ totalMatchGames }} match games · Updated {{ formatFetched(payload.fetchedAt) }}
        </p>
      </div>

      <div
        v-if="bannerError"
        class="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3"
        role="status"
      >
        {{ bannerError }}
      </div>

      <div
        v-if="loading"
        class="text-center text-gray-500 py-16 text-sm"
      >
        Loading meta deck data…
      </div>

      <div
        v-else-if="decks.length === 0"
        class="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500 text-sm"
      >
        No meta deck data available yet. Check back after the next data refresh.
      </div>

      <div v-else class="space-y-4">
        <p v-if="hasMoreDecks" class="text-xs text-gray-500 text-center">
          Showing top {{ displayDecks.length }} of {{ decks.length }} archetypes by play share.
        </p>
        <article
          v-for="deck in displayDecks"
          :key="deck.id"
          class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
        >
          <div class="px-4 py-3 border-b border-gray-100 flex flex-wrap items-baseline justify-between gap-2">
            <h3 class="font-semibold text-gray-900">{{ deck.name }}</h3>
            <span class="text-xs text-gray-500">{{ deck.deckEntries }} lists · {{ deck.games }} games</span>
          </div>

          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px bg-gray-100">
            <div class="bg-white p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Play share</p>
              <p class="text-lg font-semibold text-gray-900 tabular-nums">{{ formatPct(deck.playShare) }}</p>
            </div>
            <div class="bg-white p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Win rate</p>
              <p class="text-lg font-semibold text-gray-900 tabular-nums">{{ formatPct(deck.winRate) }}</p>
              <p class="text-[10px] text-gray-400 mt-0.5">{{ formatRecord(deck) }}</p>
            </div>
            <div class="bg-white p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Consistency</p>
              <p class="text-lg font-semibold text-gray-900 tabular-nums">
                {{ deck.consistencyScore ?? '—' }}<span v-if="deck.consistencyScore != null" class="text-sm font-normal text-gray-500">/100</span>
              </p>
              <p class="text-[10px] text-gray-400 mt-0.5">
                Brick risk {{ deck.brickRiskScore ?? '—' }}<span v-if="deck.brickRiskScore != null">/100</span>
                <span v-if="deck.consistencySample < 2"> · n={{ deck.consistencySample }}</span>
              </p>
            </div>
            <div class="bg-white p-3 col-span-2 sm:col-span-1 lg:col-span-2">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Matchup bias</p>
              <template v-if="deck.matchups.hasData">
                <p class="text-xs text-gray-700 mt-1">
                  <span class="text-green-700 font-medium">Favors:</span>
                  {{ deck.matchups.favorable.map(m => `${m.opponentName} (${formatPct(m.winRate)})`).join(', ') }}
                </p>
                <p class="text-xs text-gray-700 mt-1">
                  <span class="text-red-700 font-medium">Struggles:</span>
                  {{ deck.matchups.unfavorable.map(m => `${m.opponentName} (${formatPct(m.winRate)})`).join(', ') }}
                </p>
              </template>
              <p v-else class="text-sm text-gray-400 mt-1">Not enough paired games (need 5+ per matchup).</p>
            </div>
            <div class="bg-white p-3">
              <p class="text-[10px] font-semibold uppercase tracking-wide text-gray-500">Sample</p>
              <p class="text-lg font-semibold text-gray-900 tabular-nums">{{ deck.games }}</p>
              <p class="text-[10px] text-gray-400 mt-0.5">games · {{ deck.deckEntries }} entries</p>
            </div>
          </div>
        </article>
      </div>

      <p class="text-xs text-center text-gray-400">
        Tournament data ©
        <a href="https://limitlesstcg.com/" target="_blank" rel="noopener" class="underline hover:text-gray-600">Limitless TCG</a>.
        Not affiliated with The Pokémon Company.
      </p>
    </main>

    <SiteFooter />
  </div>
</template>
