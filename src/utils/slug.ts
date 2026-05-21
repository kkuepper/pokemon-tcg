import type { Card } from '../types/card'

export function cardToSlug(card: Card): string {
  const name = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return `${name}-${card.id.toLowerCase()}`
}
