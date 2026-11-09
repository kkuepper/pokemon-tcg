import { describe, expect, it } from 'vitest'
import { buildCardEntries } from './buildCardDb.js'
import { ESTIMATED_PULL_RATES } from './estimatedPullRates.js'

function c1(number, name, rarity, packs) {
  const card = { set: 'C1', number, name, rarity, image: 'c.webp' }
  if (packs) card.packs = packs
  return card
}

const setsData = {
  series: [
    {
      code: 'C1',
      name: { en: 'Dual Fusion' },
      packs: ['Dual Fusion Mega Mewtwo X', 'Dual Fusion Pikachu'],
    },
    {
      code: 'A1',
      name: { en: 'Genetic Apex' },
      packs: ['Mewtwo', 'Pikachu'],
    },
  ],
}

// One immersive slot, same 0.222% / 0.889% totals the real C1 table uses.
const a1Rates = {
  'Regular Pack': {
    appearance_rate: 100,
    cards: 5,
    slots: {
      1: { C: 100 },
      2: { C: 100 },
      3: { C: 100 },
      4: { IM: 0.222 },
      5: { IM: 0.889 },
    },
  },
}

const cards = [
  c1(152, 'Sweet Honey', 'AR'),
  c1(183, 'Pikachu ex', 'IM'),
  c1(185, 'Mega Mewtwo X ex', 'IM'),
  c1(186, 'Umbreon', 'IM', ['Dual Fusion Mega Mewtwo X']),
  { set: 'A1', number: 4, name: 'Other', rarity: 'IM', image: 'a.webp', packs: ['Mewtwo'] },
  { set: 'A1', number: 283, name: 'Mew', rarity: 'IM', image: 'm.webp' },
]

function umbreon(entries) {
  return entries.find(c => c.id === 'C1-186')
}

describe('mission cards after C1 rates are no longer estimated', () => {
  it('keeps the three mission cards and Umbreon rates when upstream ships C1', () => {
    const estimated = buildCardEntries(cards, { A1: a1Rates }, setsData)
    const shipped = buildCardEntries(
      cards,
      { A1: a1Rates, C1: ESTIMATED_PULL_RATES.C1 },
      setsData,
    )

    for (const entries of [estimated, shipped]) {
      const mission = entries.filter(c => c.obtainable === 'mission')
      expect(mission.map(c => c.id).sort()).toEqual(['C1-152', 'C1-183', 'C1-185'])
      expect(mission.every(c => c.perPackRate === 0 && c.pack === '')).toBe(true)
    }

    const before = umbreon(estimated)
    const after = umbreon(shipped)
    expect(before.poolSize).toBe(1)
    expect(after.poolSize).toBe(1)
    expect(after.slot4Rate).toBe(before.slot4Rate)
    expect(after.slot5Rate).toBe(before.slot5Rate)
    expect(after.perPackRate).toBe(before.perPackRate)
    expect(after.slot4Rate).toBeCloseTo(0.00222, 8)
    expect(after.slot5Rate).toBeCloseTo(0.00889, 8)
    // Upstream table means the set is no longer flagged estimated.
    expect(before.ratesEstimated).toBe(true)
    expect(after.ratesEstimated).toBeUndefined()
  })

  it('still folds A1 Mew into the Genetic Apex packs', () => {
    const entries = buildCardEntries(
      cards,
      { A1: a1Rates, C1: ESTIMATED_PULL_RATES.C1 },
      setsData,
    )
    const mew = entries.filter(c => c.id === 'A1-283')
    expect(mew.map(c => c.pack).sort()).toEqual(['Mewtwo', 'Pikachu'])
    expect(mew.every(c => c.obtainable !== 'mission')).toBe(true)
    const other = entries.find(c => c.id === 'A1-004')
    // Mewtwo pack IM pool is Other + Mew. 0.222% / 2.
    expect(other.poolSize).toBe(2)
    expect(other.slot4Rate).toBeCloseTo(0.00111, 8)
  })
})
