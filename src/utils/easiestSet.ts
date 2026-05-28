import type { CardRarity } from '../types/card'
import { packsToComplete, packsForProbability } from './odds'
import { PACK_POINT_COST, PACK_POINTS_PER_PACK } from './packPoints'

export const DIAMOND_RARITIES = new Set<CardRarity>(['C', 'U', 'R', 'RR'])
export const STAR_RARITIES    = new Set<CardRarity>(['AR', 'SR', 'SAR', 'IM', 'UR'])
export const SHINY_RARITIES   = new Set<CardRarity>(['S', 'SSR'])
export const STAR12_RARITIES  = new Set<CardRarity>(['AR', 'SR', 'SAR'])
export const HARD_RARITIES    = new Set<CardRarity>(['IM', 'UR'])

export interface RarityGroupFlags {
  diamond: boolean
  star12: boolean
  shiny: boolean
  hard: boolean
  packPoints: boolean
}

export interface SetCompletionResult {
  packsNeeded: number
  pointCost: number
  cardsLeft: number
}

/**
 * Computes the packs needed to finish a set given a list of unowned cards.
 *
 * Cards may appear multiple times (once per pack) — the highest perPackRate is
 * used. Returns null when no unowned cards survive the rarity-group filter.
 *
 * Pack points are used for a card only when they are cheaper than pulling AND
 * they end up as the binding constraint; otherwise they are treated as free
 * (earned from packs opened for harder cards) and pointCost is 0.
 */
export function computeSetCompletion(
  cards: { id: string; rate: number; rarity: CardRarity }[],
  target: number,
  flags: RarityGroupFlags,
): SetCompletionResult | null {
  // Deduplicate: keep highest per-pack rate per card id.
  const bestRate = new Map<string, { rate: number; rarity: CardRarity }>()
  for (const card of cards) {
    const existing = bestRate.get(card.id)
    if (!existing || card.rate > existing.rate) {
      bestRate.set(card.id, { rate: card.rate, rarity: card.rarity })
    }
  }

  // Apply rarity-group filter.
  const filtered: { rate: number; rarity: CardRarity }[] = []
  for (const [, entry] of bestRate) {
    const included =
      (flags.diamond && DIAMOND_RARITIES.has(entry.rarity)) ||
      (flags.star12  && STAR12_RARITIES.has(entry.rarity))  ||
      (flags.shiny   && SHINY_RARITIES.has(entry.rarity))   ||
      (flags.hard    && HARD_RARITIES.has(entry.rarity))
    if (included) filtered.push(entry)
  }

  if (filtered.length === 0) return null

  // All-pull baseline: the cost when pts are not used at all.
  // Always computed because pts can only help, never hurt — if the greedy pts
  // allocation comes out worse than all-pull, we fall back to all-pull.
  const allRates = filtered.map(c => c.rate)
  const allPullN = packsToComplete(allRates, target)

  if (!flags.packPoints) {
    return { packsNeeded: allPullN, pointCost: 0, cardsLeft: filtered.length }
  }

  // Greedy pts allocation: route each card to pts when individually cheaper.
  // This per-card comparison ignores joint probability — multiple cards each
  // individually cheaper via pts can collectively cost more than pulling them
  // all together (because packsToComplete benefits from joint probability while
  // pack-point costs are purely additive). The allPullN comparison below guards
  // against this failure mode.
  const pullRates: number[] = []
  let totalPointCost = 0

  for (const { rate, rarity } of filtered) {
    const pointPacks = Math.ceil(PACK_POINT_COST[rarity] / PACK_POINTS_PER_PACK)
    const pullPacks  = packsForProbability(rate, target)
    if (isFinite(pullPacks) && pointPacks < pullPacks) {
      totalPointCost += PACK_POINT_COST[rarity]
    } else {
      pullRates.push(rate)
    }
  }

  const pullN = packsToComplete(pullRates, target)
  const pointN = Math.ceil(totalPointCost / PACK_POINTS_PER_PACK)
  const packsWithPts = Math.max(pullN, pointN)

  // Fall back to all-pull when the greedy pts allocation is no better.
  if (packsWithPts >= allPullN) {
    return { packsNeeded: allPullN, pointCost: 0, cardsLeft: filtered.length }
  }

  return {
    packsNeeded: packsWithPts,
    pointCost: pointN > pullN ? totalPointCost : 0,
    cardsLeft: filtered.length,
  }
}
