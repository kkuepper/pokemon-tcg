import { describe, expect, it } from 'vitest'
import {
  aggregateMetaDecks,
  computeConsistency,
  enrichPairingsWithDecks,
  invertDeckOutcome,
  outcomeForPlayer,
  playerDeckMapFromStandings,
  recordPairingMatchups,
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

describe('recordPairingMatchups', () => {
  it('records both deck seats as mirror records', () => {
    const matrix = new Map()
    recordPairingMatchups(matrix, {
      player1: 'a',
      player2: 'b',
      winner: 'a',
      _deck1: 'deck-a',
      _deck2: 'deck-b',
    })
    expect(matrix.get('deck-a')?.get('deck-b')).toEqual({ wins: 1, losses: 0, ties: 0 })
    expect(matrix.get('deck-b')?.get('deck-a')).toEqual({ wins: 0, losses: 1, ties: 0 })
  })

  it('skips bye and double-loss pairings', () => {
    const matrix = new Map()
    expect(
      recordPairingMatchups(matrix, { player1: 'solo', winner: -1, _deck1: 'deck-a' }),
    ).toBe(false)
    expect(
      recordPairingMatchups(matrix, {
        player1: 'a',
        player2: 'b',
        winner: -1,
        _deck1: 'deck-a',
        _deck2: 'deck-b',
      }),
    ).toBe(false)
    expect(matrix.size).toBe(0)
  })

  it('skips mirror archetypes and missing deck ids', () => {
    const matrix = new Map()
    expect(
      recordPairingMatchups(matrix, {
        player1: 'a',
        player2: 'b',
        winner: 'a',
        _deck1: 'same',
        _deck2: 'same',
      }),
    ).toBe(false)
    expect(
      recordPairingMatchups(matrix, {
        player1: 'a',
        player2: 'b',
        winner: 'a',
        _deck1: 'deck-a',
      }),
    ).toBe(false)
    expect(matrix.size).toBe(0)
  })

  it('inverts ties for the reverse seat', () => {
    const matrix = new Map()
    recordPairingMatchups(matrix, {
      player1: 'a',
      player2: 'b',
      winner: 0,
      _deck1: 'deck-a',
      _deck2: 'deck-b',
    })
    expect(matrix.get('deck-a')?.get('deck-b')).toEqual({ wins: 0, losses: 0, ties: 1 })
    expect(matrix.get('deck-b')?.get('deck-a')).toEqual({ wins: 0, losses: 0, ties: 1 })
  })
})

describe('outcomeForPlayer / invertDeckOutcome', () => {
  it('inverts wins and losses between decks', () => {
    const fromA = outcomeForPlayer('p1', 'p1', 'p2')
    expect(fromA).toEqual({ deckAWin: 1, deckBLoss: 0, tie: 0 })
    expect(invertDeckOutcome(fromA)).toEqual({ deckAWin: 0, deckBLoss: 1, tie: 0 })
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
    expect(result.totalMatches).toBe(2)
    const deckA = result.decks.find((d) => d.id === 'deck-a')
    expect(deckA?.playShare).toBeCloseTo(2 / 3)
    expect(deckA?.winRate).toBeCloseTo(8 / 16)
    expect(deckA?.games).toBe(16)
    expect(deckA?.deckEntries).toBe(2)
  })

  it('does not list both decks as favorable against each other when one leads', () => {
    const standings = [
      {
        player: 'a',
        record: { wins: 5, losses: 0, ties: 0 },
        deck: { id: 'deck-a', name: 'Deck A', icons: [] },
      },
      {
        player: 'b',
        record: { wins: 0, losses: 5, ties: 0 },
        deck: { id: 'deck-b', name: 'Deck B', icons: [] },
      },
    ]
    const playerDecks = playerDeckMapFromStandings(standings)
    const pairings = enrichPairingsWithDecks(
      Array.from({ length: 5 }, () => ({
        player1: 'a',
        player2: 'b',
        winner: 'a',
      })),
      playerDecks,
    )
    const result = aggregateMetaDecks(standings, pairings, {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    })
    const deckA = result.decks.find((d) => d.id === 'deck-a')
    const deckB = result.decks.find((d) => d.id === 'deck-b')
    expect(deckA?.matchups.favorable.some((m) => m.opponentId === 'deck-b')).toBe(true)
    expect(deckB?.matchups.favorable.some((m) => m.opponentId === 'deck-a')).toBe(false)
    expect(deckB?.matchups.unfavorable.some((m) => m.opponentId === 'deck-a')).toBe(true)
  })
})
