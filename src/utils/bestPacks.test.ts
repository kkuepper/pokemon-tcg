import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rankBestPacks, type BestPackCard } from './bestPacks'

function card(partial: Partial<BestPackCard> & Pick<BestPackCard, 'id'>): BestPackCard {
  return {
    set: 'S',
    setName: 'Set',
    pack: 'Only',
    rarity: 'C',
    perPackRate: 0.1,
    ...partial,
  }
}

describe('rankBestPacks', () => {
  it('keeps the per-card product: 1 - (1-r1)(1-r2)', () => {
    const cards = [
      card({ id: 'owned', perPackRate: 0.5 }),
      card({ id: 'a', perPackRate: 0.1 }),
      card({ id: 'b', perPackRate: 0.25 }),
    ]
    const ranked = rankBestPacks(cards, id => id === 'owned')
    // Owned card drops out. Two misses: 1 - 0.9 * 0.75 = 0.325.
    expect(ranked).toHaveLength(1)
    expect(ranked[0].label).toBe('Set')
    expect(ranked[0].prob).toBeCloseTo(0.325, 12)
  })

  it('leaves out a set with nothing collected', () => {
    const cards = [card({ id: 'a', perPackRate: 0.4 })]
    expect(rankBestPacks(cards, () => false)).toEqual([])
  })

  it('the tracker still calls this for Best Pack and not the ★★ allowlist', () => {
    const view = readFileSync(resolve('src/views/TrackerView.vue'), 'utf8')
    const start = view.indexOf('const bestPacks')
    const end = view.indexOf('// Guaranteed-')
    const block = view.slice(start, end)
    expect(block).toContain('rankBestPacks')
    expect(block).not.toContain('GUARANTEED_TWO_STAR')
    expect(block).not.toContain('TWO_STAR')
  })
})
