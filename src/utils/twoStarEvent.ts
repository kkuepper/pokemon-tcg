import type { CardRarity } from '../types/card'

/**
 * ★★ cards: two gold stars (Super Rare) and two purple stars (Special Art Rare).
 * One star is Art Rare, three stars is Immersive, and the shiny marks are not stars.
 */
export const TWO_STAR_RARITIES: ReadonlySet<CardRarity> = new Set(['SR', 'SAR'])

/**
 * The guaranteed-★★ event ends at the end of 21 December 2026.
 *
 * 25 November 2026 plus 26 days is 21 December 2026. The card stays up through
 * the end of that day and hides at the first instant of 22 December, Ontario
 * time (EST, UTC−5) — the same zone the deluxe-pack cutoffs use.
 *
 * Compared with Date.now() in the tracker. After this instant the event card
 * does not render, and no redeploy is required.
 */
export const GUARANTEED_TWO_STAR_EVENT_ENDS_AT = Date.parse('2026-12-22T00:00:00-05:00')

/** True while `now` is still before {@link GUARANTEED_TWO_STAR_EVENT_ENDS_AT}. */
export function isGuaranteedTwoStarEventActive(now: number = Date.now()): boolean {
  return now < GUARANTEED_TWO_STAR_EVENT_ENDS_AT
}

/**
 * Upper bound for one setTimeout. Browsers clamp delays above 2^31−1 ms,
 * which a wait until 21 December 2026 can exceed.
 */
export const TWO_STAR_EVENT_RECHECK_MAX_MS = 60 * 60 * 1000

/**
 * Milliseconds until the next visibility check, or null once the event is over.
 * The wait is capped so a tab left open across the cutoff still hides the card
 * without overflowing setTimeout.
 */
export function twoStarEventRecheckDelay(
  now: number = Date.now(),
  maxDelay: number = TWO_STAR_EVENT_RECHECK_MAX_MS,
): number | null {
  const remaining = GUARANTEED_TWO_STAR_EVENT_ENDS_AT - now
  if (remaining <= 0) return null
  return Math.min(remaining, maxDelay)
}

/** Card fields the ranking reads. A full `Card` satisfies this. */
export interface TwoStarPackCard {
  id: string
  set: string
  setName: string
  pack: string
  rarity: CardRarity
  perPackRate: number
  obtainable?: 'mission'
}

export interface TwoStarPackRanking {
  label: string
  /** Chance the guaranteed ★★ is a card the collector does not own yet, in [0, 1]. */
  prob: number
}

export interface RankPacksOptions {
  /** Set names that can no longer be opened. Same list the Best Pack card uses. */
  excludedSetNames?: ReadonlySet<string>
  /**
   * Leave out a set the collector has not started. An untouched set is a flat
   * 100% and would fill the list. Matches the Best Pack card. Defaults to true.
   */
  skipUntouchedSets?: boolean
  /** How many packs to return, highest chance first. Defaults to 10. */
  limit?: number
}

/**
 * Rank packs by the chance that a guaranteed ★★ card is one the collector
 * does not own yet.
 *
 * The card database has ordinary slot and per-pack rates. It does not have
 * per-card odds for a slot that is guaranteed to be ★★, so each ★★ card a
 * pack can contain is treated as equally likely:
 *
 *   P(new ★★) = (unowned ★★ cards in the pack) / (★★ cards in the pack)
 *
 * ★★ is Super Rare and Special Art Rare. Packs with none are left out, as are
 * packs whose ★★ cards are all already owned. A card in more than one booster
 * counts in each of those packs. Labels match Best Pack: "Set — Pack" when
 * the set has more than one booster, otherwise the set name.
 */
export function rankPacksForNewTwoStar(
  cards: readonly TwoStarPackCard[],
  isOwned: (id: string) => boolean,
  options?: RankPacksOptions,
): TwoStarPackRanking[] {
  const excluded = options?.excludedSetNames ?? new Set<string>()
  const skipUntouched = options?.skipUntouchedSets ?? true
  const limit = options?.limit ?? 10

  const startedSets = new Set<string>()
  const packsPerSet = new Map<string, Set<string>>()

  for (const card of cards) {
    if (isOwned(card.id)) startedSets.add(card.set)
    if (card.obtainable === 'mission') continue
    let packs = packsPerSet.get(card.set)
    if (!packs) {
      packs = new Set()
      packsPerSet.set(card.set, packs)
    }
    packs.add(card.pack)
  }

  interface Pool {
    set: string
    setName: string
    pack: string
    ids: Set<string>
    unowned: number
  }
  const pools = new Map<string, Pool>()

  for (const card of cards) {
    if (card.obtainable === 'mission') continue
    if (!card.pack) continue
    if (card.perPackRate <= 0) continue
    if (!TWO_STAR_RARITIES.has(card.rarity)) continue
    if (excluded.has(card.setName)) continue
    if (skipUntouched && !startedSets.has(card.set)) continue

    const key = `${card.set}||${card.pack}`
    let pool = pools.get(key)
    if (!pool) {
      pool = { set: card.set, setName: card.setName, pack: card.pack, ids: new Set(), unowned: 0 }
      pools.set(key, pool)
    }
    if (pool.ids.has(card.id)) continue
    pool.ids.add(card.id)
    if (!isOwned(card.id)) pool.unowned += 1
  }

  const ranked: TwoStarPackRanking[] = []
  for (const pool of pools.values()) {
    if (pool.ids.size === 0 || pool.unowned === 0) continue
    const multi = (packsPerSet.get(pool.set)?.size ?? 0) > 1
    const label = multi ? `${pool.setName} — ${pool.pack}` : pool.setName
    ranked.push({ label, prob: pool.unowned / pool.ids.size })
  }

  ranked.sort((a, b) => (b.prob - a.prob) || (a.label < b.label ? -1 : a.label > b.label ? 1 : 0))
  return ranked.slice(0, limit)
}
