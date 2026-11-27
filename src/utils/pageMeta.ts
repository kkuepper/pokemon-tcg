// Client-side copy of the page titles/descriptions that scripts/prerender.js
// bakes into the static HTML (source: scripts/seoMeta.js). Keep both in sync —
// scripts/prerender.test.js fails when they drift.
import { isMissionReward, type Card } from '../types/card'
import { cardToSlug } from './slug'

export const SITE_URL = 'https://kkuepper.github.io/pokemon-tcg'

export interface PageMeta {
  path: string
  title: string
  description: string
}

export const HOME_META: PageMeta = {
  path: '/',
  title: 'Pokémon TCG Pocket Odds — Pack Odds & Pull Rate Calculator',
  description:
    'Pokémon TCG Pocket odds for every card: exact pack odds and pull rates for all sets, packs and rarities, plus how many packs you need to open.',
}

export const META_DECKS_META: PageMeta = {
  path: '/meta-decks',
  title: 'Pokémon TCG Pocket Meta Decks — Win Rates & Matchups',
  description:
    'The current Pokémon TCG Pocket meta decks from recent Limitless Play tournaments, with win rates, matchups and the cards each deck runs.',
}

export const TRACKER_META: PageMeta = {
  path: '/tracker',
  title: 'Pokémon TCG Pocket Collection Tracker — Track Your Cards',
  description:
    'Track which Pokémon TCG Pocket cards you have pulled, see your set completion, and find the best pack to open for the cards you are still missing.',
}

export const PRIVACY_META: PageMeta = {
  path: '/privacy',
  title: 'Privacy — Pokémon TCG Pocket Tracker & Odds Calculator',
  description:
    'Privacy information for the Pokémon TCG Pocket tracker and odds calculator: which analytics are collected and how your tracked cards are stored.',
}

function formatPct(rate: number): string {
  const pct = rate * 100
  const str = pct >= 1 ? pct.toFixed(2) : pct.toFixed(4)
  return str.replace(/\.?0+$/, '') + '%'
}

export function cardMeta(card: Card): PageMeta {
  const mission = isMissionReward(card)
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

export function pageUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}

function setMeta(attr: string, key: string, content: string) {
  document.querySelector(`meta[${attr}="${key}"]`)?.setAttribute('content', content)
}

/** Update document title, description, canonical and Open Graph tags after client-side navigation. */
export function applyPageMeta(meta: PageMeta) {
  const url = pageUrl(meta.path)
  document.title = meta.title
  setMeta('name', 'description', meta.description)
  setMeta('property', 'og:title', meta.title)
  setMeta('property', 'og:description', meta.description)
  setMeta('property', 'og:url', url)
  document.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
}
