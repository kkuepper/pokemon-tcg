import { describe, expect, it } from 'vitest'
import {
  aggregateMetaDecks,
  computeConsistency,
  enrichPairingsWithDecks,
  playerDeckMapFromStandings,
} from './metaDeckStats.js'

describe('computeConsistency', () => {
  it('returns null when fewer than two samples', () => {
    expect(computeConsistency([0.5]).consistencyScore).toBeNull()
    expect(computeConsistency([]).consistencyScore).toBeNull()
  })

  it('scores higher when player win rates cluster tightly', () => {
    const tight = computeConsistency([0.52, 0.5, 0.48, 0.51])
    const spread = computeConsistency([0.8, 0.3, 0.55, 0.2])
    expect(tight.consistencyScore).toBeGreaterThan(spread.consistencyScore ?? 0)
    expect(tight.brickRiskScore).toBeLessThan(spread.brickRiskScore ?? 100)
  })
})

describe('aggregateMetaDecks', () => {
  it('computes play share, win rate, and sample size', () => {
    const standings = [
      {
        player: 'a',
        record: { wins: 6, losses: 2, ties: 0 },
        deck: { id: 'deck-a', name: 'Deck A', icons: [] },
      },
      {
        player: 'b',
        record: { wins: 2, losses: 6, ties: 0 },
        deck: { id: 'deck-a', name: 'Deck A', icons: [] },
      },
      {
        player: 'c',
        record: { wins: 5, losses: 3, ties: 0 },
        deck: { id: 'deck-b', name: 'Deck B', icons: [] },
      },
    ]
    const playerDecks = playerDeckMapFromStandings(standings)
    const pairings = enrichPairingsWithDecks(
      [
        { player1: 'a', player2: 'c', winner: 'a' },
        { player1: 'b', player2: 'c', winner: 'c' },
      ],
      playerDecks,
    )
    const result = aggregateMetaDecks(standings, pairings, {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    })
    expect(result.totalDeckEntries).toBe(3)
    const deckA = result.decks.find((d) => d.id === 'deck-a')
    expect(deckA?.playShare).toBeCloseTo(2 / 3)
    expect(deckA?.winRate).toBeCloseTo(8 / 16)
    expect(deckA?.games).toBe(16)
    expect(deckA?.deckEntries).toBe(2)
  })
})
