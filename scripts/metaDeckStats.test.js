import { describe, expect, it } from 'vitest'
import {
  aggregateMetaDecks,
  buildCardIndex,
  computeConsistency,
  enrichPairingsWithDecks,
  invertDeckOutcome,
  meetsRankGate,
  MIN_RANK_ENTRIES,
  MIN_RANK_GAMES,
  outcomeForPlayer,
  playerDeckMapFromStandings,
  recordPairingMatchups,
  SAMPLE_WINDOW_DAYS,
  selectTournamentsInWindow,
  scoreIconMatch,
  cardMatchesIconSpecies,
  sortDecksForDisplay,
  windowCutoff,
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

describe('sample window and ranking', () => {
  const now = new Date('2026-10-30T12:00:00.000Z')
  const tournaments = [
    { id: '1', date: '2026-10-29T12:00:00.000Z', format: null },
    { id: '2', date: '2026-10-20T12:00:00.000Z', format: null },
    { id: '3', date: '2026-10-29T12:00:00.000Z', format: 'CUSTOM' },
  ]

  it('selects non-CUSTOM tournaments within 7 days', () => {
    const picked = selectTournamentsInWindow(tournaments, now)
    expect(picked.map((t) => t.id)).toEqual(['1'])
  })

  it('computes rolling cutoff from SAMPLE_WINDOW_DAYS', () => {
    const cutoff = windowCutoff(now, SAMPLE_WINDOW_DAYS)
    expect(cutoff.toISOString()).toBe('2026-10-23T12:00:00.000Z')
  })

  it('gates and sorts by win rate with ranked decks first', () => {
    const decks = [
      { id: 'low', winRate: 0.9, games: 10, deckEntries: 2, meetsSampleGate: false },
      { id: 'mid', winRate: 0.55, games: MIN_RANK_GAMES, deckEntries: MIN_RANK_ENTRIES, meetsSampleGate: true },
      { id: 'top', winRate: 0.62, games: 40, deckEntries: 10, meetsSampleGate: true },
    ]
    expect(meetsRankGate(decks[1])).toBe(true)
    expect(meetsRankGate(decks[0])).toBe(false)
    const sorted = sortDecksForDisplay(decks)
    expect(sorted.map((d) => d.id)).toEqual(['top', 'mid', 'low'])
  })
})

describe('icon highlight scoring', () => {
  it('prefers Greninja ex over Greninja and evolution lines when deck name implies ex', () => {
    const deckName = 'Greninja ex Suicune ex'
    expect(scoreIconMatch('Greninja ex', 'greninja', { deckName })).toBeGreaterThan(
      scoreIconMatch('Greninja', 'greninja', { deckName }),
    )
    expect(scoreIconMatch('Greninja ex', 'greninja', { deckName })).toBeGreaterThan(
      scoreIconMatch('Frogadier', 'greninja', { deckName }),
    )

    /** @type {import('./metaDeckStats.js').CardAgg[]} */
    const pokemonCards = [
      { name: 'Greninja', category: 'pokemon', listCount: 1, totalCopies: 1 },
      { name: 'Frogadier', category: 'pokemon', listCount: 1, totalCopies: 1 },
      { name: 'Greninja ex', category: 'pokemon', listCount: 1, totalCopies: 2 },
    ]
    const index = buildCardIndex([
      { id: 'A1-089', name: 'Greninja', set: 'A1' },
      { id: 'B1-012', name: 'Greninja ex', set: 'B1' },
      { id: 'A1-088', name: 'Frogadier', set: 'A1' },
    ])
    const standings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'greninja-ex-suicune',
          name: deckName,
          icons: ['greninja', 'suicune'],
        },
        decklist: {
          pokemon: [
            { name: 'Greninja', count: 1 },
            { name: 'Frogadier', count: 1 },
            { name: 'Greninja ex', count: 2 },
            { name: 'Suicune ex', count: 2 },
          ],
        },
      },
    ]
    const result = aggregateMetaDecks(standings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, index)
    const highlights = result.decks[0].highlightCards.map((c) => c.name)
    expect(highlights).toContain('Greninja ex')
    expect(highlights).not.toContain('Greninja')
    expect(highlights.every((n) => n.includes(' ex') || n.toLowerCase().includes('mega'))).toBe(true)
  })

  it('prefers Mega Greninja ex over Greninja ex for greninja-mega icon', () => {
    const deckName = 'Mega Greninja ex Greninja ex'
    expect(scoreIconMatch('Mega Greninja ex', 'greninja-mega', { deckName })).toBeGreaterThan(
      scoreIconMatch('Greninja ex', 'greninja-mega', { deckName }),
    )
    const index = buildCardIndex([
      { id: 'C1-001', name: 'Mega Greninja ex', set: 'C1' },
      { id: 'B1-012', name: 'Greninja ex', set: 'B1' },
    ])
    const standings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'mega-greninja',
          name: deckName,
          icons: ['greninja-mega'],
        },
        decklist: {
          pokemon: [
            { name: 'Greninja ex', count: 2 },
            { name: 'Mega Greninja ex', count: 2 },
          ],
        },
      },
    ]
    const result = aggregateMetaDecks(standings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, index)
    expect(result.decks[0].highlightCards[0]?.name).toBe('Mega Greninja ex')
  })

  it('does not let partner Mega/ex steal a plain species icon slot', () => {
    const deckName = 'Mega Sceptile ex Greninja'
    expect(scoreIconMatch('Mega Sceptile ex', 'greninja', { deckName })).toBe(0)
    expect(scoreIconMatch('Greninja', 'greninja', { deckName })).toBeGreaterThan(0)

    const index = buildCardIndex([
      { id: 'B3-001', name: 'Mega Sceptile ex', set: 'B3' },
      { id: 'A1-089', name: 'Greninja', set: 'A1' },
      { id: 'B3-010', name: 'Treecko', set: 'B3' },
    ])
    const standings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'mega-sceptile-greninja',
          name: deckName,
          icons: ['sceptile-mega', 'greninja'],
        },
        decklist: {
          pokemon: [
            { name: 'Mega Sceptile ex', count: 2 },
            { name: 'Greninja', count: 2 },
            { name: 'Treecko', count: 1 },
          ],
        },
      },
    ]
    const result = aggregateMetaDecks(standings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, index)
    const names = result.decks[0].highlightCards.map((c) => c.name)
    expect(names).toContain('Mega Sceptile ex')
    expect(names).toContain('Greninja')
  })

  it('includes Magnezone for a second magnezone icon on Magnezone ex Magnezone', () => {
    const deckName = 'Magnezone ex Magnezone'
    const index = buildCardIndex([
      { id: 'B3a-001', name: 'Magnezone ex', set: 'B3a' },
      { id: 'A2-156', name: 'Magnezone', set: 'A2' },
      { id: 'B3a-002', name: 'Miraidon ex', set: 'B3a' },
    ])
    const standings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'magnezone-duo',
          name: deckName,
          icons: ['magnezone', 'magnezone'],
        },
        decklist: {
          pokemon: [
            { name: 'Magnezone ex', count: 2 },
            { name: 'Magnezone', count: 2 },
            { name: 'Miraidon ex', count: 1 },
          ],
        },
      },
    ]
    const result = aggregateMetaDecks(standings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, index)
    const names = result.decks[0].highlightCards.map((c) => c.name)
    expect(names.filter((n) => n.toLowerCase().includes('magnezone')).length).toBeGreaterThanOrEqual(2)
    expect(scoreIconMatch('Miraidon ex', 'magnezone', { deckName })).toBe(0)
  })

  it('uses word boundaries so mew icon does not match Mewtwo', () => {
    expect(cardMatchesIconSpecies('Mew ex', 'mew')).toBe(true)
    expect(cardMatchesIconSpecies('Mewtwo ex', 'mew')).toBe(false)
    expect(scoreIconMatch('Mewtwo ex', 'mew', { deckName: 'Mew ex Mega Diancie ex' })).toBe(0)

    const index = buildCardIndex([
      { id: 'C1-050', name: 'Mew ex', set: 'C1' },
      { id: 'C1-051', name: 'Mewtwo ex', set: 'C1' },
      { id: 'B3b-040', name: 'Mega Diancie ex', set: 'B3b' },
    ])
    const standings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'mew-diancie',
          name: 'Mew ex Mega Diancie ex',
          icons: ['mew', 'diancie-mega'],
        },
        decklist: {
          pokemon: [
            { name: 'Mew ex', count: 2 },
            { name: 'Mewtwo ex', count: 2 },
            { name: 'Mega Diancie ex', count: 2 },
          ],
        },
      },
    ]
    const result = aggregateMetaDecks(standings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, index)
    const names = result.decks[0].highlightCards.map((c) => c.name)
    expect(names[0]).toBe('Mew ex')
    expect(names).not.toContain('Mewtwo ex')
  })

  it('prefers Mega Charizard X over Y for charizard-mega-x icon', () => {
    const deckName = 'Mega Charizard X ex Mega Charizard Y ex'
    expect(scoreIconMatch('Mega Charizard X ex', 'charizard-mega-x', { deckName })).toBeGreaterThan(
      scoreIconMatch('Mega Charizard Y ex', 'charizard-mega-x', { deckName }),
    )
    expect(cardMatchesIconSpecies('mega charizard y ex', 'x')).toBe(false)

    const index = buildCardIndex([
      { id: 'B1a-001', name: 'Mega Charizard X ex', set: 'B1a' },
      { id: 'B1a-002', name: 'Mega Charizard Y ex', set: 'B1a' },
    ])
    const standings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'charizard-xy',
          name: deckName,
          icons: ['charizard-mega-x', 'charizard-mega-y'],
        },
        decklist: {
          pokemon: [
            { name: 'Mega Charizard X ex', count: 2 },
            { name: 'Mega Charizard Y ex', count: 2 },
          ],
        },
      },
    ]
    const result = aggregateMetaDecks(standings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, index)
    const names = result.decks[0].highlightCards.map((c) => c.name)
    expect(names[0]).toMatch(/Charizard X/i)
    expect(names[1]).toMatch(/Charizard Y/i)
  })

  it('prefers regional forms on regional icons when base and regional are both listed', () => {
    expect(
      scoreIconMatch('Alolan Exeggutor ex', 'exeggutor-alola', {
        deckName: 'Alolan Exeggutor ex',
      }),
    ).toBeGreaterThan(scoreIconMatch('Exeggutor ex', 'exeggutor-alola', { deckName: 'Alolan Exeggutor ex' }))

    const exeggutorIndex = buildCardIndex([
      { id: 'A2-101', name: 'Exeggutor ex', set: 'A2' },
      { id: 'A2-102', name: 'Alolan Exeggutor ex', set: 'A2' },
    ])
    const exeggutorStandings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'alola-exeggutor',
          name: 'Alolan Exeggutor ex',
          icons: ['exeggutor-alola'],
        },
        decklist: {
          pokemon: [
            { name: 'Exeggutor ex', count: 2 },
            { name: 'Alolan Exeggutor ex', count: 2 },
          ],
        },
      },
    ]
    const exeggutorResult = aggregateMetaDecks(exeggutorStandings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, exeggutorIndex)
    expect(exeggutorResult.decks[0].highlightCards[0]?.name).toBe('Alolan Exeggutor ex')

    expect(scoreIconMatch('Hisuian Goodra', 'goodra-hisui', { deckName: 'Hisuian Goodra' })).toBeGreaterThan(
      scoreIconMatch('Goodra', 'goodra-hisui', { deckName: 'Hisuian Goodra' }),
    )
    expect(scoreIconMatch('Hisuian Zoroark ex', 'zoroark-hisui', { deckName: 'Hisuian Zoroark ex' })).toBeGreaterThan(
      scoreIconMatch('Zoroark ex', 'zoroark-hisui', { deckName: 'Hisuian Zoroark ex' }),
    )

    const hisuiIndex = buildCardIndex([
      { id: 'B2-001', name: 'Goodra', set: 'B2' },
      { id: 'B2-002', name: 'Hisuian Goodra', set: 'B2' },
      { id: 'B2-003', name: 'Zoroark ex', set: 'B2' },
      { id: 'B2-004', name: 'Hisuian Zoroark ex', set: 'B2' },
    ])
    const hisuiStandings = [
      {
        player: 'a',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'hisui-goodra',
          name: 'Hisuian Goodra',
          icons: ['goodra-hisui'],
        },
        decklist: {
          pokemon: [
            { name: 'Goodra', count: 2 },
            { name: 'Hisuian Goodra', count: 2 },
          ],
        },
      },
      {
        player: 'b',
        record: { wins: 30, losses: 5, ties: 0 },
        deck: {
          id: 'hisui-zoroark',
          name: 'Hisuian Zoroark ex',
          icons: ['zoroark-hisui'],
        },
        decklist: {
          pokemon: [
            { name: 'Zoroark ex', count: 2 },
            { name: 'Hisuian Zoroark ex', count: 2 },
          ],
        },
      },
    ]
    const hisuiResult = aggregateMetaDecks(hisuiStandings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, hisuiIndex)
    const goodraDeck = hisuiResult.decks.find((d) => d.id === 'hisui-goodra')
    const zoroarkDeck = hisuiResult.decks.find((d) => d.id === 'hisui-zoroark')
    expect(goodraDeck?.highlightCards[0]?.name).toBe('Hisuian Goodra')
    expect(zoroarkDeck?.highlightCards[0]?.name).toBe('Hisuian Zoroark ex')
  })
})

describe('decklist aggregation', () => {
  it('builds highlight and other cards from decklists', () => {
    const cards = [
      { id: 'A4a-010', name: 'Entei ex', set: 'A4a' },
      { id: 'B1a-001', name: 'Mega Charizard Y ex', set: 'B1a' },
      { id: 'C1-128', name: 'Rika', set: 'C1' },
    ]
    const index = buildCardIndex(cards)
    const standings = [
      {
        player: 'a',
        record: { wins: 30, losses: 10, ties: 0 },
        deck: { id: 'charizard', name: 'Mega Charizard Y ex Entei ex', icons: ['charizard-mega-y', 'entei'] },
        decklist: {
          pokemon: [
            { name: 'Mega Charizard Y ex', set: 'B1a', number: '1', count: 2 },
            { name: 'Entei ex', set: 'A4a', number: '10', count: 2 },
          ],
          trainer: [{ name: 'Rika', set: 'C1', number: '128', count: 2 }],
        },
      },
    ]
    const result = aggregateMetaDecks(standings, [], {
      game: 'POCKET',
      fetchedAt: '2026-01-01T00:00:00.000Z',
      tournamentCount: 1,
    }, index)
    const deck = result.decks[0]
    expect(deck.highlightCards.length).toBeGreaterThan(0)
    expect(deck.otherCards.some((c) => c.name === 'Rika')).toBe(true)
    expect(deck.highlightCards.every((c) => c.name !== 'Rika')).toBe(true)
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
