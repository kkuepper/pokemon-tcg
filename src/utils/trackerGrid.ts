import type { Card } from '../types/card'

export interface TrackerSlot {
  /** Card number within the set, 1-based and contiguous. */
  number: number
  /** Null when this number is absent from the data, or hidden by "missing only". */
  card: Card | null
}

export function cardNumberFromId(id: string): number {
  return parseInt(id.split('-').pop()!, 10)
}

/**
 * One slot per card number from 1 through the highest number in the set.
 * A missing number stays an empty slot so later cards cannot shift columns.
 * Owned cards hidden by "missing only" also leave their slot empty.
 */
export function trackerSlots(
  cards: Card[],
  options: { missingOnly?: boolean; isOwned?: (id: string) => boolean } = {},
): TrackerSlot[] {
  const isOwned = options.isOwned ?? (() => false)
  const byNumber = new Map<number, Card>()
  let max = 0
  for (const card of cards) {
    const n = cardNumberFromId(card.id)
    if (!Number.isFinite(n) || n < 1) continue
    if (n > max) max = n
    if (!byNumber.has(n)) byNumber.set(n, card)
  }

  const slots: TrackerSlot[] = []
  for (let n = 1; n <= max; n++) {
    const card = byNumber.get(n) ?? null
    const hidden = options.missingOnly && card != null && isOwned(card.id)
    slots.push({ number: n, card: hidden ? null : card })
  }
  return slots
}
