export type CardRarity = 'C' | 'U' | 'R' | 'RR' | 'AR' | 'SR' | 'SAR' | 'IM' | 'UR' | 'S' | 'SSR'

export interface Card {
  id: string
  name: string
  set: string
  setName: string
  pack: string
  rarity: CardRarity
  image: string
  poolSize: number
  /** Per-card probability from slot 4 of Regular Pack [0,1] */
  slot4Rate: number
  /** Per-card probability from slot 5 of Regular Pack [0,1] */
  slot5Rate: number
  /** Overall probability of pulling this card from one pack opening [0,1] */
  perPackRate: number
  /** Contribution from the Rare Pack ("God Pack") [0,1] */
  rarePackContrib: number
}

export const RARITY_LABELS: Record<CardRarity, string> = {
  C:   'Common',
  U:   'Uncommon',
  R:   'Rare',
  RR:  'Double Rare',
  AR:  'Art Rare',
  SR:  'Super Rare',
  SAR: 'Special Art Rare',
  IM:  'Immersive',
  UR:  'Crown Rare',
  S:   'Shiny',
  SSR: 'Shiny Super Rare',
}

export const RARITY_COLORS: Record<CardRarity, string> = {
  C:   'bg-gray-100 text-gray-700',
  U:   'bg-green-100 text-green-800',
  R:   'bg-blue-100 text-blue-800',
  RR:  'bg-blue-200 text-blue-900',
  AR:  'bg-yellow-100 text-yellow-800',
  SR:  'bg-purple-100 text-purple-800',
  SAR: 'bg-purple-200 text-purple-900',
  IM:  'bg-pink-100 text-pink-800',
  UR:  'bg-amber-200 text-amber-900',
  S:   'bg-cyan-100 text-cyan-800',
  SSR: 'bg-cyan-200 text-cyan-900',
}
