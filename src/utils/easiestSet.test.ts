import { describe, it, expect } from 'vitest'
import { computeSetCompletion } from './easiestSet'
import type { RarityGroupFlags } from './easiestSet'

const ALL: RarityGroupFlags = { diamond: true, star12: true, shiny: true, hard: true, packPoints: true }
const NO_PP: RarityGroupFlags = { ...ALL, packPoints: false }

// Helper: card entry shorthand
function card(id: string, rate: number, rarity: Parameters<typeof computeSetCompletion>[0][number]['rarity']) {
  return { id, rate, rarity }
}

describe('computeSetCompletion', () => {

  // ── Null / empty cases ──────────────────────────────────────────────────────

  it('returns null when card list is empty', () => {
    expect(computeSetCompletion([], 0.5, ALL)).toBeNull()
  })

  it('returns null when all cards are filtered out by rarity flags', () => {
    const cards = [card('c1', 0.2, 'C'), card('ar1', 0.01, 'AR')]
    const noFlags: RarityGroupFlags = { diamond: false, star12: false, shiny: false, hard: false, packPoints: false }
    expect(computeSetCompletion(cards, 0.5, noFlags)).toBeNull()
  })

  // ── Deduplication ───────────────────────────────────────────────────────────

  it('counts a card appearing in multiple packs only once', () => {
    const cards = [card('c1', 0.1, 'C'), card('c1', 0.2, 'C')]
    const result = computeSetCompletion(cards, 0.5, ALL)
    expect(result?.cardsLeft).toBe(1)
  })

  it('uses the highest rate when a card appears in multiple packs', () => {
    // With rate 0.5 the card takes 1 pack; with rate 0.1 it takes 7 packs.
    const low  = computeSetCompletion([card('c1', 0.1, 'C')], 0.5, NO_PP)
    const high = computeSetCompletion([card('c1', 0.5, 'C'), card('c1', 0.1, 'C')], 0.5, NO_PP)
    expect(high!.packsNeeded).toBeLessThan(low!.packsNeeded)
  })

  // ── Rarity filtering ────────────────────────────────────────────────────────

  it('diamond flag keeps C / U / R / RR and excludes others', () => {
    const cards = [card('c1', 0.2, 'C'), card('ar1', 0.05, 'AR'), card('s1', 0.01, 'S')]
    const result = computeSetCompletion(cards, 0.5, { ...ALL, star12: false, shiny: false, hard: false })
    expect(result?.cardsLeft).toBe(1)
  })

  it('star12 flag keeps AR / SR and excludes others', () => {
    const cards = [card('c1', 0.2, 'C'), card('ar1', 0.05, 'AR'), card('sr1', 0.02, 'SR')]
    const result = computeSetCompletion(cards, 0.5, { ...ALL, diamond: false, shiny: false, hard: false })
    expect(result?.cardsLeft).toBe(2)
  })

  it('hard flag keeps IM / UR and excludes others', () => {
    const cards = [card('c1', 0.2, 'C'), card('im1', 0.001, 'IM'), card('ur1', 0.001, 'UR')]
    const result = computeSetCompletion(cards, 0.5, { ...ALL, diamond: false, star12: false, shiny: false })
    expect(result?.cardsLeft).toBe(2)
  })

  it('star12 flag includes SAR (Special Art Rare) alongside AR and SR', () => {
    const cards = [card('ar1', 0.05, 'AR'), card('sr1', 0.02, 'SR'), card('sar1', 0.005, 'SAR'), card('im1', 0.001, 'IM')]
    const result = computeSetCompletion(cards, 0.5, { ...ALL, diamond: false, shiny: false, hard: false })
    expect(result?.cardsLeft).toBe(3) // AR + SR + SAR, not IM
  })

  it('shiny flag keeps S / SSR', () => {
    const cards = [card('s1', 0.01, 'S'), card('ssr1', 0.003, 'SSR'), card('c1', 0.2, 'C')]
    const result = computeSetCompletion(cards, 0.5, { ...ALL, diamond: false, star12: false, hard: false })
    expect(result?.cardsLeft).toBe(2)
  })

  it('multiple flags can be combined', () => {
    const cards = [card('c1', 0.2, 'C'), card('ar1', 0.05, 'AR'), card('ur1', 0.001, 'UR')]
    const result = computeSetCompletion(cards, 0.5, { ...ALL, shiny: false, hard: false })
    expect(result?.cardsLeft).toBe(2) // C + AR
  })

  // ── Pack points: routing ─────────────────────────────────────────────────────

  it('routes card to pack points when pointPacks < pullPacks', () => {
    // R card: pointPacks = ceil(150/5) = 30.
    // At target 50%, rate 0.01 → pullPacks = ceil(log(0.5)/log(0.99)) = 69. 30 < 69 → pack points.
    // No pull-rate cards → pullN = 0, pointN = 30 → pointN > pullN → pointCost shown.
    const result = computeSetCompletion([card('r1', 0.01, 'R')], 0.5, ALL)
    expect(result?.pointCost).toBe(150)
    expect(result?.packsNeeded).toBe(30)
  })

  it('routes card to pullRates when pointPacks >= pullPacks', () => {
    // C card: pointPacks = ceil(35/5) = 7.
    // At target 50%, rate 0.15 → pullPacks = ceil(log(0.5)/log(0.85)) = 5. 7 < 5 is false → pullRates.
    const result = computeSetCompletion([card('c1', 0.15, 'C')], 0.5, ALL)
    expect(result?.pointCost).toBe(0)
    expect(result?.packsNeeded).toBeGreaterThan(0)
    expect(result?.packsNeeded).toBeLessThan(7)
  })

  it('always routes to pullRates when pack points are disabled', () => {
    // Same R card that would be pack-pointed when pts enabled.
    const withPP    = computeSetCompletion([card('r1', 0.01, 'R')], 0.5, ALL)
    const withoutPP = computeSetCompletion([card('r1', 0.01, 'R')], 0.5, NO_PP)
    expect(withPP?.pointCost).toBe(150)
    expect(withoutPP?.pointCost).toBe(0)
    expect(withoutPP!.packsNeeded).toBeGreaterThan(withPP!.packsNeeded)
  })

  // ── Pack points: absorbed vs bottleneck ──────────────────────────────────────

  it('shows pointCost when pack points are the bottleneck (pointN > pullN)', () => {
    // R card → pack points (pointN = 30). No pull-rate cards → pullN = 0.
    // 30 > 0 → pointCost shown.
    const result = computeSetCompletion([card('r1', 0.01, 'R')], 0.5, ALL)
    expect(result?.pointCost).toBeGreaterThan(0)
  })

  it('hides pointCost when pack points are absorbed by pull packs (pointN <= pullN)', () => {
    // AR card: pointPacks = ceil(500/5) = 100.
    // rate ≈ 0.006931 → pullPacks = 100 exactly → NOT pack-pointed (100 < 100 is false) → pullRates.
    // R card: rate 0.01 → pointPacks = 30, pullPacks = 69 → pack-pointed.
    // pullN = packsToComplete([0.006931], 0.5) = 100. pointN = 30. 30 <= 100 → absorbed.
    const cards = [
      card('ar1', 0.006931, 'AR'),  // → pullRates, drives pullN to 100
      card('r1',  0.01,     'R'),   // → pack points, pointN = 30
    ]
    const result = computeSetCompletion(cards, 0.5, ALL)
    expect(result?.pointCost).toBe(0)
    expect(result?.packsNeeded).toBe(100)
  })

  // ── Infinite / zero rates ───────────────────────────────────────────────────

  it('returns Infinity packs when a pull-rate card has rate 0', () => {
    const result = computeSetCompletion([card('c1', 0, 'C')], 0.5, NO_PP)
    expect(result?.packsNeeded).toBe(Infinity)
  })

  it('routes zero-rate card to pullRates (not pack points) even with pts enabled', () => {
    // rate 0 → pullPacks = Infinity → isFinite check fails → pullRates
    const result = computeSetCompletion([card('c1', 0, 'C')], 0.5, ALL)
    expect(result?.packsNeeded).toBe(Infinity)
    expect(result?.pointCost).toBe(0)
  })

  // ── packsNeeded monotonicity ─────────────────────────────────────────────────

  it('needs more packs at higher probability targets', () => {
    const cards = [card('r1', 0.01, 'R')]
    const at50 = computeSetCompletion(cards, 0.5, NO_PP)
    const at90 = computeSetCompletion(cards, 0.9, NO_PP)
    expect(at90!.packsNeeded).toBeGreaterThan(at50!.packsNeeded)
  })

  it('needs more packs with more remaining cards', () => {
    const one  = computeSetCompletion([card('c1', 0.1, 'C')], 0.5, NO_PP)
    const two  = computeSetCompletion([card('c1', 0.1, 'C'), card('c2', 0.1, 'C')], 0.5, NO_PP)
    expect(two!.packsNeeded).toBeGreaterThan(one!.packsNeeded)
  })

  // ── Pack points can only help, never hurt ────────────────────────────────────
  //
  // Enabling pts gives the player an additional option (buy with pts instead of
  // pulling). That option can be taken or ignored, so packsNeeded with pts ≤
  // packsNeeded without pts. Violation of this invariant was the reported bug:
  // disabling pts made the pack count go DOWN.

  it('enabling pack points never increases packs needed (1 card)', () => {
    // Single R card: pts clearly cheaper (pointPacks 30 < pullPacks 69).
    const cards = [card('r1', 0.01, 'R')]
    const withPP    = computeSetCompletion(cards, 0.5, ALL)
    const withoutPP = computeSetCompletion(cards, 0.5, NO_PP)
    expect(withPP!.packsNeeded).toBeLessThanOrEqual(withoutPP!.packsNeeded)
  })

  it('enabling pack points never increases packs needed (many cards — regression)', () => {
    // 20 R cards (rate 0.01). Each individually: pointPacks=30 < pullPacks=69, so
    // the greedy routes ALL of them to pts → pointN = 600. But pulling all 20 via
    // joint probability only needs ~337 packs. The greedy allocation was worse than
    // all-pull, causing "disabling pts lowers the count" — the reported bug.
    const cards = Array.from({ length: 20 }, (_, i) => card(`r${i}`, 0.01, 'R'))
    const withPP    = computeSetCompletion(cards, 0.5, ALL)
    const withoutPP = computeSetCompletion(cards, 0.5, NO_PP)
    // Must hold: pts-on ≤ pts-off (pts are an option, not a burden).
    expect(withPP!.packsNeeded).toBeLessThanOrEqual(withoutPP!.packsNeeded)
    // The greedy would have given 600; the correct answer is ~337 (all-pull fallback).
    expect(withPP!.packsNeeded).toBeLessThan(600)
    // When greedy pts is suboptimal, pointCost must be 0 (pts not used).
    expect(withPP!.pointCost).toBe(0)
  })

  it('uses pts when they genuinely reduce packs (few cards)', () => {
    // 1 R card: pts save 69 − 30 = 39 packs. Must be reflected in the result.
    const withPP    = computeSetCompletion([card('r1', 0.01, 'R')], 0.5, ALL)
    const withoutPP = computeSetCompletion([card('r1', 0.01, 'R')], 0.5, NO_PP)
    expect(withPP!.packsNeeded).toBeLessThan(withoutPP!.packsNeeded)
    expect(withPP!.pointCost).toBeGreaterThan(0)
  })
})
