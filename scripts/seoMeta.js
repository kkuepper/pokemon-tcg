// Shared SEO data for the build scripts (sitemap in buildCardDb.js, static
// pages in prerender.js). The in-app copy of these strings lives in
// src/utils/pageMeta.ts; scripts/prerender.test.js checks that both agree.

export const SITE_URL = 'https://kkuepper.github.io/pokemon-tcg'

/** Same rule as src/utils/slug.ts. */
export function cardToSlug(card) {
  const name = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${name}-${card.id.toLowerCase()}`
}

/** Absolute URL for an app path ('/' or '/meta-decks'). No trailing slash except the root. */
export function pageUrl(path) {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}

export const HOME_META = {
  path: '/',
  title: 'Pokémon TCG Pocket Odds — Pack Odds & Pull Rate Calculator',
  description:
    'Pokémon TCG Pocket odds for every card: exact pack odds and pull rates for all sets, packs and rarities, plus how many packs you need to open.',
}

/** Routes with their own view in src/router.ts (not the home/card route). */
export const STATIC_PAGES = [
  {
    path: '/meta-decks',
    title: 'Pokémon TCG Pocket Meta Decks — Win Rates & Matchups',
    description:
      'The current Pokémon TCG Pocket meta decks from recent Limitless Play tournaments, with win rates, matchups and the cards each deck runs.',
  },
  {
    path: '/tracker',
    title: 'Pokémon TCG Pocket Collection Tracker — Track Your Cards',
    description:
      'Track which Pokémon TCG Pocket cards you have pulled, see your set completion, and find the best pack to open for the cards you are still missing.',
  },
  {
    path: '/privacy',
    title: 'Privacy — Pokémon TCG Pocket Tracker & Odds Calculator',
    description:
      'Privacy information for the Pokémon TCG Pocket tracker and odds calculator: which analytics are collected and how your tracked cards are stored.',
  },
]

function formatPct(rate) {
  const pct = rate * 100
  const str = pct >= 1 ? pct.toFixed(2) : pct.toFixed(4)
  return str.replace(/\.?0+$/, '') + '%'
}

export function cardMeta(card) {
  const mission = card.obtainable === 'mission'
  return {
    path: `/${cardToSlug(card)}`,
    title: mission
      ? `${card.name} (${card.id}) — Mission reward | Pokémon TCG Pocket`
      : `${card.name} (${card.id}) — Pack Odds | Pokémon TCG Pocket`,
    description: mission
      ? `${card.name} is a mission reward in ${card.setName}, not pulled from a booster pack.`
      : `Pull rate for ${card.name} from ${card.setName}: ${formatPct(card.perPackRate)} per pack. Find pack odds for every card in Pokémon TCG Pocket.`,
  }
}

/**
 * cards.json lists a card once per pack it appears in. Keep the first entry
 * per id — the same one App.vue resolves from a slug.
 */
export function uniqueCards(cards) {
  const seen = new Set()
  return cards.filter((card) => {
    if (seen.has(card.id)) return false
    seen.add(card.id)
    return true
  })
}
