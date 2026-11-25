import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { Card } from '../types/card'
import { formatPct } from './odds'
import {
  GUARANTEED_TWO_STAR_EVENT_ENDS_AT,
  TWO_STAR_EVENT_RECHECK_MAX_MS,
  TWO_STAR_RARITIES,
  isGuaranteedTwoStarEventActive,
  rankPacksForNewTwoStar,
  twoStarEventRecheckDelay,
  type TwoStarPackCard,
} from './twoStarEvent'

const DURING_EVENT = Date.parse('2026-11-25T12:00:00-05:00')
const END_OF_DEC_21 = Date.parse('2026-12-21T23:59:59.999-05:00')
const AFTER_EVENT = Date.parse('2026-12-22T00:00:00-05:00')

function card(partial: Partial<TwoStarPackCard> & Pick<TwoStarPackCard, 'id'>): TwoStarPackCard {
  return {
    set: 'S',
    setName: 'Set',
    pack: 'Only',
    rarity: 'SR',
    perPackRate: 0.01,
    ...partial,
  }
}

describe('GUARANTEED_TWO_STAR_EVENT_ENDS_AT', () => {
  it('is the end of 21 December 2026, 26 days after 25 November, Ontario time', () => {
    const nov25 = Date.parse('2026-11-25T00:00:00-05:00')
    const dec21 = Date.parse('2026-12-21T00:00:00-05:00')
    const day = 24 * 60 * 60 * 1000
    expect(dec21 - nov25).toBe(26 * day)
    // Visible through the end of that day; hidden from the next midnight.
    expect(GUARANTEED_TWO_STAR_EVENT_ENDS_AT).toBe(dec21 + day)
    expect(GUARANTEED_TWO_STAR_EVENT_ENDS_AT).toBe(Date.parse('2026-12-22T00:00:00-05:00'))
  })

  it('stays active on 25 November and through the end of 21 December', () => {
    expect(isGuaranteedTwoStarEventActive(DURING_EVENT)).toBe(true)
    expect(isGuaranteedTwoStarEventActive(END_OF_DEC_21)).toBe(true)
  })

  it('is inactive at the first instant of 22 December Ontario time', () => {
    expect(isGuaranteedTwoStarEventActive(AFTER_EVENT)).toBe(false)
    expect(isGuaranteedTwoStarEventActive(Date.parse('2026-12-22T00:00:01-05:00'))).toBe(false)
  })

  it('caps the recheck delay so a long-lived tab still hides the card', () => {
    const hour = 60 * 60 * 1000
    expect(TWO_STAR_EVENT_RECHECK_MAX_MS).toBe(hour)
    expect(TWO_STAR_EVENT_RECHECK_MAX_MS).toBeLessThan(2 ** 31 - 1)
    expect(twoStarEventRecheckDelay(DURING_EVENT)).toBe(hour)
    expect(twoStarEventRecheckDelay(END_OF_DEC_21)).toBe(1)
    expect(twoStarEventRecheckDelay(AFTER_EVENT)).toBeNull()
    const tenMinutesBefore = GUARANTEED_TWO_STAR_EVENT_ENDS_AT - 10 * 60 * 1000
    expect(twoStarEventRecheckDelay(tenMinutesBefore)).toBe(10 * 60 * 1000)
  })
})

describe('rankPacksForNewTwoStar', () => {
  it('treats every ★★ card in a pack as equally likely, ignoring ordinary pull rates', () => {
    // Ordinary per-pack rates differ. A guaranteed ★★ slot has no such odds,
    // so the missing low-rate card is still half the pool, not 0.01 / 0.06.
    const cards = [
      card({ id: 'sr-common', rarity: 'SR', perPackRate: 0.05 }),
      card({ id: 'sar-rare', rarity: 'SAR', perPackRate: 0.01 }),
      card({ id: 'bulk', rarity: 'C', perPackRate: 0.2 }),
    ]
    const owned = new Set(['sr-common', 'bulk'])
    const ranked = rankPacksForNewTwoStar(cards, id => owned.has(id))
    expect(ranked).toEqual([{ label: 'Set', prob: 1 / 2 }])
  })

  it('counts Super Rare and Special Art Rare, and leaves other rarities out', () => {
    const cards = [
      card({ id: 'sr', rarity: 'SR' }),
      card({ id: 'sar', rarity: 'SAR' }),
      card({ id: 'ar', rarity: 'AR' }),
      card({ id: 'im', rarity: 'IM' }),
      card({ id: 'ur', rarity: 'UR' }),
      card({ id: 'ssr', rarity: 'SSR' }),
      card({ id: 'owned-anchor', rarity: 'C' }),
    ]
    const owned = new Set(['owned-anchor', 'sr'])
    const ranked = rankPacksForNewTwoStar(cards, id => owned.has(id))
    expect(ranked).toEqual([{ label: 'Set', prob: 1 / 2 }])
    expect(TWO_STAR_RARITIES.has('SR')).toBe(true)
    expect(TWO_STAR_RARITIES.has('SAR')).toBe(true)
    expect(TWO_STAR_RARITIES.has('AR')).toBe(false)
  })

  it('leaves out a pack with no ★★ cards, a pack whose ★★ cards are all owned, and an unpullable ★★', () => {
    const cards = [
      card({ id: 'no-star', rarity: 'RR', pack: 'Plain', set: 'A', setName: 'Alpha' }),
      card({ id: 'anchor-a', rarity: 'C', pack: 'Plain', set: 'A', setName: 'Alpha' }),
      card({ id: 'done', rarity: 'SR', pack: 'Finished', set: 'A', setName: 'Alpha' }),
      card({ id: 'zero', rarity: 'SR', perPackRate: 0, pack: 'Empty', set: 'A', setName: 'Alpha' }),
      card({ id: 'mission', rarity: 'SAR', obtainable: 'mission', pack: '', perPackRate: 0, set: 'A', setName: 'Alpha' }),
      card({ id: 'open', rarity: 'SR', pack: 'Open', set: 'A', setName: 'Alpha' }),
      card({ id: 'open-2', rarity: 'SAR', pack: 'Open', set: 'A', setName: 'Alpha' }),
    ]
    const owned = new Set(['anchor-a', 'done', 'mission'])
    const ranked = rankPacksForNewTwoStar(cards, id => owned.has(id))
    expect(ranked).toEqual([{ label: 'Alpha — Open', prob: 1 }])
  })

  it('counts one card once when the row is duplicated, and in each pack it can appear in', () => {
    const cards = [
      card({ id: 'shared', pack: 'Left', set: 'M', setName: 'Multi' }),
      card({ id: 'shared', pack: 'Left', set: 'M', setName: 'Multi' }),
      card({ id: 'shared', pack: 'Right', set: 'M', setName: 'Multi' }),
      card({ id: 'only-left', pack: 'Left', set: 'M', setName: 'Multi' }),
      card({ id: 'anchor', rarity: 'C', pack: 'Left', set: 'M', setName: 'Multi' }),
    ]
    const owned = new Set(['anchor', 'only-left'])
    const ranked = rankPacksForNewTwoStar(cards, id => owned.has(id))
    expect(ranked).toEqual([
      { label: 'Multi — Right', prob: 1 },
      { label: 'Multi — Left', prob: 1 / 2 },
    ])
  })

  it('skips a set the collector has not started, and an excluded set name', () => {
    const cards = [
      card({ id: 'fresh', rarity: 'SR', set: 'N', setName: 'New Set', pack: 'New' }),
      card({ id: 'old', rarity: 'SR', set: 'O', setName: 'Old Set', pack: 'Old' }),
      card({ id: 'old-2', rarity: 'SAR', set: 'O', setName: 'Old Set', pack: 'Old' }),
      card({ id: 'anchor', rarity: 'C', set: 'O', setName: 'Old Set', pack: 'Old' }),
      card({ id: 'gone', rarity: 'SR', set: 'D', setName: 'Deluxe Pack: ex', pack: 'Deluxe' }),
      card({ id: 'gone-anchor', rarity: 'C', set: 'D', setName: 'Deluxe Pack: ex', pack: 'Deluxe' }),
    ]
    const owned = new Set(['anchor', 'gone-anchor'])
    const ranked = rankPacksForNewTwoStar(cards, id => owned.has(id), {
      excludedSetNames: new Set(['Deluxe Pack: ex']),
    })
    expect(ranked).toEqual([{ label: 'Old Set', prob: 1 }])

    const includingFresh = rankPacksForNewTwoStar(cards, id => owned.has(id), {
      excludedSetNames: new Set(['Deluxe Pack: ex']),
      skipUntouchedSets: false,
    })
    expect(includingFresh.map(entry => entry.label)).toEqual(['New Set', 'Old Set'])
    expect(includingFresh.every(entry => entry.prob === 1)).toBe(true)
  })

  it('breaks ties by label and keeps only the top 10', () => {
    const cards: TwoStarPackCard[] = []
    for (let i = 0; i < 12; i++) {
      const name = `Set ${String.fromCharCode(65 + i)}`
      cards.push(card({ id: `c${i}`, rarity: 'C', set: name, setName: name, pack: 'P' }))
      cards.push(card({ id: `s${i}`, rarity: 'SR', set: name, setName: name, pack: 'P' }))
    }
    const owned = new Set(cards.filter(c => c.rarity === 'C').map(c => c.id))
    const ranked = rankPacksForNewTwoStar(cards, id => owned.has(id))
    expect(ranked).toHaveLength(10)
    expect(ranked.every(entry => entry.prob === 1)).toBe(true)
    expect(ranked.map(entry => entry.label)).toEqual([
      'Set A', 'Set B', 'Set C', 'Set D', 'Set E', 'Set F', 'Set G', 'Set H', 'Set I', 'Set J',
    ])
  })

  it('uses the set name alone when the set has a single booster', () => {
    const cards = [
      card({ id: 'a', rarity: 'SR', set: 'B2', setName: 'Fantastical Parade', pack: 'Gardevoir' }),
      card({ id: 'b', rarity: 'SAR', set: 'B2', setName: 'Fantastical Parade', pack: 'Gardevoir' }),
      card({ id: 'c', rarity: 'C', set: 'B2', setName: 'Fantastical Parade', pack: 'Gardevoir' }),
    ]
    const ranked = rankPacksForNewTwoStar(cards, id => id === 'c')
    expect(ranked).toEqual([{ label: 'Fantastical Parade', prob: 1 }])
  })
})

describe('sample collection against cards.json', () => {
  // Unowned ★★ counts chosen so the top 10 are distinct and hand-checkable.
  // Every other ★★ card in the file is owned, which also marks each set as started.
  const SPECS: { setName: string; pack?: string; total: number; unowned: number; label: string }[] = [
    { setName: 'Shining Revelry', total: 17, unowned: 4, label: 'Shining Revelry' },
    { setName: 'Fantastical Parade', total: 23, unowned: 5, label: 'Fantastical Parade' },
    { setName: 'Mega Rising', pack: 'Mega Blaziken', total: 11, unowned: 2, label: 'Mega Rising — Mega Blaziken' },
    { setName: 'Wisdom of Sea and Sky', pack: 'Lugia', total: 12, unowned: 2, label: 'Wisdom of Sea and Sky — Lugia' },
    { setName: 'Ruler of the Skies', total: 22, unowned: 3, label: 'Ruler of the Skies' },
    { setName: 'Paldean Wonders', total: 15, unowned: 2, label: 'Paldean Wonders' },
    { setName: 'Mega Shine', total: 9, unowned: 1, label: 'Mega Shine' },
    { setName: 'Space-Time Smackdown', pack: 'Dialga', total: 12, unowned: 1, label: 'Space-Time Smackdown — Dialga' },
    { setName: 'Celestial Guardians', pack: 'Solgaleo', total: 14, unowned: 1, label: 'Celestial Guardians — Solgaleo' },
    { setName: 'Pulsing Aura', total: 23, unowned: 1, label: 'Pulsing Aura' },
  ]

  function loadCards(): Card[] {
    return JSON.parse(readFileSync(resolve('public/cards.json'), 'utf8')) as Card[]
  }

  function twoStarIds(cards: Card[], setName: string, pack?: string): string[] {
    const ids = new Set<string>()
    for (const c of cards) {
      if (c.setName !== setName) continue
      if (pack !== undefined && c.pack !== pack) continue
      if (!TWO_STAR_RARITIES.has(c.rarity)) continue
      if (c.perPackRate <= 0) continue
      if (c.obtainable === 'mission') continue
      ids.add(c.id)
    }
    return [...ids].sort()
  }

  it('ranks the sample by unowned ★★ over ★★ in that pack', () => {
    const cards = loadCards()
    const unowned = new Set<string>()
    for (const spec of SPECS) {
      const ids = twoStarIds(cards, spec.setName, spec.pack)
      expect(ids, spec.label).toHaveLength(spec.total)
      for (const id of ids.slice(0, spec.unowned)) unowned.add(id)
    }

    const owned = new Set<string>()
    for (const c of cards) {
      if (TWO_STAR_RARITIES.has(c.rarity) && !unowned.has(c.id)) owned.add(c.id)
    }

    const ranked = rankPacksForNewTwoStar(cards, id => owned.has(id), {
      excludedSetNames: new Set(['Deluxe Pack: ex', 'Deluxe Pack: Mega']),
    })

    expect(ranked.map(entry => entry.label)).toEqual(SPECS.map(spec => spec.label))
    expect(ranked.map(entry => entry.prob)).toEqual(SPECS.map(spec => spec.unowned / spec.total))
    expect(ranked.map(entry => formatPct(entry.prob))).toEqual([
      '23.53%', // 4/17
      '21.74%', // 5/23
      '18.18%', // 2/11  Mega Rising — Mega Blaziken
      '16.67%', // 2/12  Wisdom of Sea and Sky — Lugia
      '13.64%', // 3/22
      '13.33%', // 2/15
      '11.11%', // 1/9
      '8.333%', // 1/12
      '7.143%', // 1/14
      '4.348%', // 1/23
    ])

    // Fully owned ★★ pools, and packs from sets this collection has started, stay off the list.
    expect(ranked.find(entry => entry.label === 'Mythical Island')).toBeUndefined()
    expect(ranked.find(entry => entry.label.includes('Deluxe'))).toBeUndefined()
    expect(ranked.find(entry => entry.label === 'Mega Rising — Mega Altaria')).toBeUndefined()
  })

  it('the tracker gates the event card on the end date', () => {
    const view = readFileSync(resolve('src/views/TrackerView.vue'), 'utf8')
    expect(view).toContain('isGuaranteedTwoStarEventActive')
    expect(view).toContain('guaranteedTwoStarEventActive')
    expect(view).toContain('rankPacksForNewTwoStar')
    const panel = readFileSync(resolve('src/components/TwoStarEventPanel.vue'), 'utf8')
    expect(panel).toContain('Best pack for a new ★★ card (event)')
    expect(panel).toContain('Every pack guarantees one ★★ card')
    expect(panel).toContain('Super Rare and Special Art Rare')
    expect(panel).toContain('equally likely')
    expect(panel).not.toContain('subtitle-detail')
    expect(view).toContain('lg:overflow-y-auto')
    expect(view).toContain('twoStarEventRecheckDelay')
    expect(view).toContain('visibilitychange')
  })
})
