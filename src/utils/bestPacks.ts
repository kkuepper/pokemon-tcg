import { isMissionReward, type CardRarity } from '../types/card'
import { DIAMOND_RARITIES, SHINY_RARITIES, STAR_RARITIES } from './easiestSet'

/** Card fields the best-pack ranking reads. A full `Card` satisfies this. */
export interface BestPackCard {
  id: string
  set: string
  setName: string
  pack: string
  rarity: CardRarity
  perPackRate: number
  obtainable?: 'mission'
}

export interface BestPackRanking {
  label: string
  /** Chance a pack contains at least one card the collector does not own yet. */
  prob: number
}

function setHasCollectedCard(
  cards: readonly BestPackCard[],
  setCode: string,
  isOwned: (id: string) => boolean,
): boolean {
  for (const card of cards) {
    if (card.set !== setCode || !isOwned(card.id)) continue
    if (
      DIAMOND_RARITIES.has(card.rarity) ||
      STAR_RARITIES.has(card.rarity) ||
      SHINY_RARITIES.has(card.rarity)
    ) return true
  }
  return false
}

/**
 * Same ranking the Best Pack card has always used: for each pack,
 * 1 − ∏(1 − rate) over cards the collector does not own.
 * Sets with nothing collected, and set names in `excludedSetNames`, are left out.
 */
export function rankBestPacks(
  cards: readonly BestPackCard[],
  isOwned: (id: string) => boolean,
  options?: { excludedSetNames?: ReadonlySet<string>; limit?: number },
): BestPackRanking[] {
  const excluded = options?.excludedSetNames ?? new Set<string>()
  const limit = options?.limit ?? 10

  const packsPerSet = new Map<string, Set<string>>()
  for (const card of cards) {
    if (isMissionReward(card)) continue
    let packs = packsPerSet.get(card.set)
    if (!packs) {
      packs = new Set()
      packsPerSet.set(card.set, packs)
    }
    packs.add(card.pack)
  }

  interface Group { setCode: string; setName: string; pack: string; logNoNew: number; hasUnowned: boolean }
  const groups = new Map<string, Group>()
  const started = new Map<string, boolean>()
  const setStarted = (setCode: string) => {
    const known = started.get(setCode)
    if (known !== undefined) return known
    const yes = setHasCollectedCard(cards, setCode, isOwned)
    started.set(setCode, yes)
    return yes
  }

  for (const card of cards) {
    if (excluded.has(card.setName)) continue
    if (!setStarted(card.set)) continue
    if (card.perPackRate <= 0) continue

    const key = `${card.set}||${card.pack}`
    let group = groups.get(key)
    if (!group) {
      group = { setCode: card.set, setName: card.setName, pack: card.pack, logNoNew: 0, hasUnowned: false }
      groups.set(key, group)
    }
    if (!isOwned(card.id)) {
      group.logNoNew += Math.log(1 - card.perPackRate)
      group.hasUnowned = true
    }
  }

  return [...groups.values()]
    .filter(group => group.hasUnowned)
    .map(group => {
      const isMultiPack = (packsPerSet.get(group.setCode)?.size ?? 0) > 1
      const label = isMultiPack ? `${group.setName} — ${group.pack}` : group.setName
      return { label, prob: 1 - Math.exp(group.logNoNew) }
    })
    .sort((a, b) => b.prob - a.prob)
    .slice(0, limit)
}
