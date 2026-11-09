import { describe, expect, it } from 'vitest'
import type { Card } from '../types/card'
import { trackerSlots } from './trackerGrid'

function card(id: string, name = id): Card {
  const set = id.slice(0, id.lastIndexOf('-'))
  return {
    id,
    name,
    set,
    setName: set,
    pack: 'Pack',
    rarity: 'C',
    image: '',
    poolSize: 1,
    slot4Rate: 0,
    slot5Rate: 0,
    perPackRate: 0.1,
    rarePackContrib: 0,
  }
}

describe('trackerSlots', () => {
  it('reserves an empty slot for a missing number so later cards stay put', () => {
    const slots = trackerSlots([
      card('C1-001', 'One'),
      card('C1-002', 'Two'),
      card('C1-004', 'Four'),
      card('C1-005', 'Five'),
    ])
    expect(slots.map(s => s.number)).toEqual([1, 2, 3, 4, 5])
    expect(slots.map(s => s.card?.name ?? null)).toEqual(['One', 'Two', null, 'Four', 'Five'])
    // 5 columns: Four stays in column 4 (index 3), not column 3.
    expect(slots[3].card?.name).toBe('Four')
  })

  it('places mission cards at their own number', () => {
    const honey = { ...card('C1-152', 'Sweet Honey'), obtainable: 'mission' as const, perPackRate: 0 }
    const slots = trackerSlots([card('C1-151', 'Bidoof'), honey, card('C1-153', 'Exeggutor')])
    expect(slots).toHaveLength(153)
    expect(slots[150].card?.name).toBe('Bidoof')
    expect(slots[151].card?.name).toBe('Sweet Honey')
    expect(slots[152].card?.name).toBe('Exeggutor')
    expect(slots[0].card).toBeNull()
  })

  it('hides owned cards when missing-only is on without closing the gap', () => {
    const slots = trackerSlots(
      [card('C1-001', 'One'), card('C1-002', 'Two'), card('C1-003', 'Three')],
      { missingOnly: true, isOwned: id => id === 'C1-002' },
    )
    expect(slots.map(s => s.card?.id ?? null)).toEqual(['C1-001', null, 'C1-003'])
  })
})
