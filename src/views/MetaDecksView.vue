<script setup lang="ts">
import { computed, ref, watchEffect } from 'vue'
import { RouterLink } from 'vue-router'
import AuthButton from '../components/AuthButton.vue'
import SiteFooter from '../components/SiteFooter.vue'
import { useMetaDecks } from '../composables/useMetaDecks'
import type { MetaCardRef, MetaDeck, MetaDeckOtherCard } from '../types/metaDeck'

const { payload, loading, loadError } = useMetaDecks()
const expandedId = ref<string | null>(null)

const decks = computed(() => payload.value?.decks ?? [])
const rankedDecks = computed(() => decks.value.filter((d) => d.meetsSampleGate))
const lowSampleDecks = computed(() => decks.value.filter((d) => !d.meetsSampleGate))
const bannerError = computed(() => payload.value?.error ?? loadError.value)

const rankMinGames = computed(() => payload.value?.rankMinGames ?? 25)
const rankMinEntries = computed(() => payload.value?.rankMinEntries ?? 5)
const windowDays = computed(() => payload.value?.sampleWindowDays ?? 7)

function formatPct(rate: number | null, digits = 1): string {
  if (rate == null || Number.isNaN(rate)) return '—'
  return `${(rate * 100).toFixed(digits).replace(/\.0$/, '')}%`
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

function cardImageUrl(card: MetaCardRef | MetaDeckOtherCard): string | null {
  if (card.imageSet == null || card.imageNum == null) return null
  return `${import.meta.env.BASE_URL}images/cards/${card.imageSet}/${card.imageNum}.webp`
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? null : id
}

function formatMatchupLine(rows: MetaDeck['matchups']['favorable']) {
  return rows
    .map((m) => `${m.opponentName} ${formatPct(m.winRate)} · n=${m.games}`)
    .join(' · ')
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
          Last {{ windowDays }} days of public
          <a
            href="https://play.limitlesstcg.com/decks?game=pocket"
            target="_blank"
            rel="noopener"
            class="text-blue-600 underline hover:text-blue-800"
          >Pokémon TCG Pocket</a>
          events on
          <a
            href="https://play.limitlesstcg.com/"
            target="_blank"
            rel="noopener"
            class="text-blue-600 underline hover:text-blue-800"
          >Limitless Play</a>
          (CUSTOM excluded). Refreshes on deploy — not live in your browser.
        </p>
        <p
          v-if="payload && !loading"
          class="text-xs text-gray-500 mt-2"
        >
          {{ payload.tournamentCount }} tournaments ·
          {{ payload.totalDeckEntries }} lists ·
          {{ payload.totalMatches ?? '—' }} head-to-head matches ·
          Ranked when ≥{{ rankMinGames }} games &amp; ≥{{ rankMinEntries }} lists ·
          Updated {{ formatFetched(payload.fetchedAt) }}
        </p>
      </div>

      <div
        v-if="bannerError"
        class="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 text-sm px-4 py-3"
        role="status"
      >
        {{ bannerError }}
      </div>

      <div v-if="loading" class="text-center text-gray-500 py-16 text-sm">
        Loading meta deck data…
      </div>

      <div
        v-else-if="decks.length === 0"
        class="rounded-xl border border-dashed border-gray-200 bg-white p-8 text-center text-gray-500 text-sm"
      >
        No meta deck data available yet. Check back after the next data refresh.
      </div>

      <template v-else>
        <section class="space-y-2">
          <h3 class="text-sm font-semibold text-gray-700 px-1">Ranked by win rate</h3>
          <div class="space-y-2">
            <article
              v-for="deck in rankedDecks"
              :key="deck.id"
              class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <button
                type="button"
                class="w-full text-left px-3 py-3 sm:px-4 flex gap-3 sm:gap-4 items-center hover:bg-gray-50/80 transition-colors"
                :aria-expanded="expandedId === deck.id"
                @click="toggleExpand(deck.id)"
              >
                <div class="flex gap-1.5 shrink-0">
                  <div
                    v-for="(card, i) in deck.highlightCards.slice(0, 3)"
                    :key="`${deck.id}-${i}`"
                    class="w-12 sm:w-14 rounded-md overflow-hidden border border-gray-200 bg-gray-100 shadow-sm"
                  >
                    <img
                      v-if="cardImageUrl(card)"
                      :src="cardImageUrl(card)!"
                      :alt="card.name"
                      class="w-full aspect-[367/512] object-cover"
                      loading="lazy"
                    />
                    <div
                      v-else
                      class="aspect-[367/512] flex items-center justify-center text-[8px] text-gray-400 px-0.5 text-center leading-tight"
                    >
                      {{ card.name }}
                    </div>
                  </div>
                </div>

                <div class="flex-1 min-w-0">
                  <div class="flex items-start justify-between gap-2">
                    <h4 class="font-semibold text-gray-900 truncate">{{ deck.name }}</h4>
                    <span
                      class="text-gray-400 shrink-0 text-xs"
                      aria-hidden="true"
                    >{{ expandedId === deck.id ? '▲' : '▼' }}</span>
                  </div>
                  <dl class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                    <div>
                      <dt class="text-gray-400 uppercase tracking-wide text-[10px]">Win rate</dt>
                      <dd class="font-semibold text-gray-900 tabular-nums">{{ formatPct(deck.winRate) }}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-400 uppercase tracking-wide text-[10px]">Play share</dt>
                      <dd class="font-semibold text-gray-900 tabular-nums">{{ formatPct(deck.playShare) }}</dd>
                    </div>
                    <div>
                      <dt class="text-gray-400 uppercase tracking-wide text-[10px]">Consistency</dt>
                      <dd class="font-semibold text-gray-900 tabular-nums">
                        {{ deck.consistencyScore ?? '—' }}<span v-if="deck.consistencyScore != null" class="font-normal text-gray-500">/100</span>
                      </dd>
                    </div>
                    <div>
                      <dt class="text-gray-400 uppercase tracking-wide text-[10px]">Sample</dt>
                      <dd class="font-semibold text-gray-900 tabular-nums">{{ deck.games }}g · {{ deck.deckEntries }} lists</dd>
                    </div>
                  </dl>
                </div>
              </button>

              <div
                v-if="expandedId === deck.id"
                class="border-t border-gray-100 px-4 py-4 space-y-4 bg-gray-50/50"
              >
                <p class="text-xs text-gray-500">
                  Brick risk proxy {{ deck.brickRiskScore ?? '—' }}<span v-if="deck.brickRiskScore != null">/100</span>
                  <span v-if="deck.consistencyScore != null"> · {{ deck.consistencySample }} pilots</span>
                </p>

                <div v-if="deck.matchups.hasData">
                  <h5 class="text-xs font-semibold text-gray-700 mb-1">Matchup bias</h5>
                  <p v-if="deck.matchups.favorable.length" class="text-xs text-gray-700">
                    <span class="text-green-700 font-medium">Favors </span>{{ formatMatchupLine(deck.matchups.favorable) }}
                  </p>
                  <p v-if="deck.matchups.unfavorable.length" class="text-xs text-gray-700 mt-1">
                    <span class="text-red-700 font-medium">Struggles </span>{{ formatMatchupLine(deck.matchups.unfavorable) }}
                  </p>
                </div>
                <p v-else class="text-xs text-gray-400">Not enough paired games for matchup bias (5+ per pairing).</p>

                <div v-if="deck.otherCards.length">
                  <h5 class="text-xs font-semibold text-gray-700 mb-2">Other cards in lists</h5>
                  <p class="text-[10px] text-gray-400 mb-2">% of lists that included the card · average copies when present.</p>
                  <ul class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    <li
                      v-for="card in deck.otherCards.slice(0, 16)"
                      :key="`${deck.id}-${card.name}-${card.category}`"
                      class="flex gap-2 items-center bg-white rounded-lg border border-gray-200 p-1.5"
                    >
                      <div class="w-10 shrink-0 rounded overflow-hidden border border-gray-100 bg-gray-100">
                        <img
                          v-if="cardImageUrl(card)"
                          :src="cardImageUrl(card)!"
                          :alt="card.name"
                          class="w-full aspect-[367/512] object-cover"
                          loading="lazy"
                        />
                        <div
                          v-else
                          class="aspect-[367/512] flex items-center justify-center text-[7px] text-gray-400 p-0.5 text-center"
                        >
                          {{ card.name }}
                        </div>
                      </div>
                      <div class="min-w-0 text-[10px] leading-snug">
                        <p class="font-medium text-gray-800 truncate">{{ card.name }}</p>
                        <p class="text-gray-500">{{ Math.round(card.listRate * 100) }}% · ~{{ card.avgCount.toFixed(1) }}</p>
                      </div>
                    </li>
                  </ul>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section v-if="lowSampleDecks.length" class="space-y-2 pt-4">
          <h3 class="text-sm font-semibold text-gray-500 px-1">
            Insufficient sample (&lt;{{ rankMinGames }} games or &lt;{{ rankMinEntries }} lists)
          </h3>
          <div class="space-y-2 opacity-90">
            <article
              v-for="deck in lowSampleDecks"
              :key="deck.id"
              class="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
            >
              <button
                type="button"
                class="w-full text-left px-3 py-2 flex gap-3 items-center hover:bg-gray-50/80"
                @click="toggleExpand(deck.id)"
              >
                <div class="flex gap-1 shrink-0">
                  <div
                    v-for="(card, i) in deck.highlightCards.slice(0, 3)"
                    :key="`${deck.id}-low-${i}`"
                    class="w-10 rounded overflow-hidden border border-gray-200"
                  >
                    <img
                      v-if="cardImageUrl(card)"
                      :src="cardImageUrl(card)!"
                      :alt="card.name"
                      class="w-full aspect-[367/512] object-cover"
                      loading="lazy"
                    />
                  </div>
                </div>
                <div class="flex-1 min-w-0 text-sm">
                  <p class="font-medium text-gray-800 truncate">{{ deck.name }}</p>
                  <p class="text-xs text-gray-500 tabular-nums">
                    {{ formatPct(deck.winRate) }} · {{ deck.games }}g · {{ deck.deckEntries }} lists
                  </p>
                </div>
              </button>
              <div
                v-if="expandedId === deck.id"
                class="border-t border-gray-100 px-4 py-3 text-xs text-gray-600 bg-gray-50/50 space-y-2"
              >
                <div v-if="deck.matchups.hasData">
                  <p v-if="deck.matchups.favorable.length">
                    <span class="text-green-700 font-medium">Favors </span>{{ formatMatchupLine(deck.matchups.favorable) }}
                  </p>
                  <p v-if="deck.matchups.unfavorable.length" class="mt-1">
                    <span class="text-red-700 font-medium">Struggles </span>{{ formatMatchupLine(deck.matchups.unfavorable) }}
                  </p>
                </div>
                <ul v-if="deck.otherCards.length" class="grid grid-cols-2 gap-1 text-[10px]">
                  <li v-for="card in deck.otherCards.slice(0, 8)" :key="card.name">
                    {{ card.name }} ({{ Math.round(card.listRate * 100) }}%)
                  </li>
                </ul>
              </div>
            </article>
          </div>
        </section>
      </template>

      <p class="text-xs text-center text-gray-400">
        Tournament data ©
        <a href="https://limitlesstcg.com/" target="_blank" rel="noopener" class="underline hover:text-gray-600">Limitless TCG</a>.
        Not affiliated with The Pokémon Company.
      </p>
    </main>

    <SiteFooter />
  </div>
</template>
