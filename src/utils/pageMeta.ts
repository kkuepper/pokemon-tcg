// Client-side copy of the page titles/descriptions that scripts/prerender.js
// bakes into the static HTML (source: scripts/seoMeta.js). Keep both in sync —
// scripts/prerender.test.js fails when they drift.
import { isMissionReward, RARITY_LABELS, type Card } from '../types/card'
import { cardToSlug } from './slug'

export const SITE_URL = 'https://kkuepper.github.io/pokemon-tcg'

export interface PageMeta {
  path: string
  title: string
  description: string
  /** Absolute thumbnail URL for og:image / twitter:image (card pages only). */
  image?: string
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

/** Public URL of the card thumbnail: A1-036 → …/images/cards/A1/36.webp (same files as TrackerView). */
export function cardImageUrl(card: Card): string {
  const [set, paddedNum] = card.id.split('-')
  return `${SITE_URL}/images/cards/${set}/${parseInt(paddedNum, 10)}.webp`
}

export function cardMeta(card: Card): PageMeta {
  const mission = isMissionReward(card)
  const label = `${card.id}, ${RARITY_LABELS[card.rarity] ?? card.rarity}`
  return {
    path: `/${cardToSlug(card)}`,
    title: mission ? `${card.name} (${card.id}) — Mission reward` : `${card.name} (${card.id}) — Pack Odds`,
    description: mission
      ? `${card.name} (${label}) is a mission reward in ${card.setName}, not pulled from a booster pack.`
      : `Pull rate for ${card.name} (${label}) from ${card.setName}: ${formatPct(card.perPackRate)} per pack. Find pack odds for every card in Pokémon TCG Pocket.`,
    image: cardImageUrl(card),
  }
}

/**
 * Which meta App.vue should apply for the home/card route. Returns null while
 * a card slug is in the URL but the card is not resolved yet (cards.json still
 * loading, or failed): the prerendered card tags must stay as they are rather
 * than flash to — or get stuck on — the homepage tags.
 */
export function metaForAppRoute({
  slug,
  selectedCard,
}: {
  slug: string | string[] | undefined
  selectedCard: Card | null
}): PageMeta | null {
  if (selectedCard) return cardMeta(selectedCard)
  const hasSlug = Array.isArray(slug) ? slug.length > 0 : !!slug
  return hasSlug ? null : HOME_META
}

export function pageUrl(path: string): string {
  return path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`
}

/** Set a <meta> tag's content, creating it if missing; null removes it. */
function setMeta(doc: Document, attr: 'name' | 'property', key: string, content: string | null) {
  let el = doc.querySelector(`meta[${attr}="${key}"]`)
  if (content === null) {
    el?.remove()
    return
  }
  if (!el) {
    el = doc.createElement('meta')
    el.setAttribute(attr, key)
    doc.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

/**
 * Update document title, description, canonical, Open Graph and Twitter tags
 * after client-side navigation. og:image / twitter:image are removed on pages
 * without an image so a card thumbnail does not linger after leaving a card.
 */
export function applyPageMeta(meta: PageMeta, doc: Document = document) {
  const url = pageUrl(meta.path)
  const image = meta.image ?? null
  doc.title = meta.title
  setMeta(doc, 'name', 'description', meta.description)
  setMeta(doc, 'property', 'og:title', meta.title)
  setMeta(doc, 'property', 'og:description', meta.description)
  setMeta(doc, 'property', 'og:url', url)
  setMeta(doc, 'property', 'og:image', image)
  setMeta(doc, 'name', 'twitter:card', 'summary')
  setMeta(doc, 'name', 'twitter:title', meta.title)
  setMeta(doc, 'name', 'twitter:description', meta.description)
  setMeta(doc, 'name', 'twitter:image', image)
  doc.querySelector('link[rel="canonical"]')?.setAttribute('href', url)
}
