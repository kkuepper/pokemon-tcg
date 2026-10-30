/**
 * Aggregate Limitless POCKET tournament standings + pairings into meta deck stats.
 *
 * Consistency / brick-risk proxy (no mulligan data in the API):
 * For each deck archetype, collect every player-tournament match win rate
 * (wins / (wins + losses + ties)) where they played at least MIN_GAMES rounds.
 * consistencyScore = clamp(0, 100, 100 * (1 - min(1, stdDev / 0.25))).
 * Higher score = more stable results across pilots (lower brick-risk proxy).
 * brickRiskScore = 100 - consistencyScore.
 */

export const MIN_GAMES_FOR_CONSISTENCY = 3
export const CONSISTENCY_STDDEV_CAP = 0.25
export const MIN_MATCHUP_GAMES = 5

/**
 * @typedef {Object} StandingEntry
 * @property {string} player
 * @property {{ wins: number, losses: number, ties: number }} record
 * @property {{ id: string, name: string, icons?: string[] } | null | undefined} deck
 */

/**
 * @typedef {Object} PairingEntry
 * @property {string} [player1]
 * @property {string} [player2]
 * @property {string | number} [winner]
 */

/**
 * @param {StandingEntry[]} standings
 * @param {PairingEntry[]} pairings
 * @param {{ tournamentCount: number, fetchedAt: string, game: string }} meta
 */
export function aggregateMetaDecks(standings, pairings, meta) {
  /** @type {Map<string, { id: string, name: string, icons: string[], deckCount: number, wins: number, losses: number, ties: number, playerRates: number[] }>} */
  const decks = new Map()

  for (const row of standings) {
    const deck = row.deck
    if (!deck?.id) continue
    let entry = decks.get(deck.id)
    if (!entry) {
      entry = {
        id: deck.id,
        name: deck.name,
        icons: deck.icons ?? [],
        deckCount: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        playerRates: [],
      }
      decks.set(deck.id, entry)
    }
    entry.deckCount += 1
    const { wins, losses, ties } = row.record
    entry.wins += wins
    entry.losses += losses
    entry.ties += ties
    const games = wins + losses + ties
    if (games >= MIN_GAMES_FOR_CONSISTENCY) {
      entry.playerRates.push(wins / games)
    }
  }

  const totalDecks = [...decks.values()].reduce((s, d) => s + d.deckCount, 0)

  /** @type {Map<string, Map<string, { wins: number, losses: number, ties: number }>>} */
  const matchupMatrix = new Map()

  for (const batch of pairings) {
    const { player1, player2, winner } = batch
    if (!player1 || !player2) continue
    if (winner === -1) continue
    const deck1 = batch._deck1
    const deck2 = batch._deck2
    if (!deck1 || !deck2 || deck1 === deck2) continue

    addMatchup(matchupMatrix, deck1, deck2, outcomeForPlayer(winner, player1, player2))
  }

  const deckList = [...decks.values()]
    .map((d) => {
      const games = d.wins + d.losses + d.ties
      const winRate = games > 0 ? d.wins / games : null
      const playShare = totalDecks > 0 ? d.deckCount / totalDecks : null
      const { consistencyScore, brickRiskScore, consistencySample } =
        computeConsistency(d.playerRates)

      const idToName = new Map([...decks.values()].map((x) => [x.id, x.name]))
      const matchups = buildMatchupBias(matchupMatrix.get(d.id), idToName)

      return {
        id: d.id,
        name: d.name,
        icons: d.icons,
        playShare,
        winRate,
        wins: d.wins,
        losses: d.losses,
        ties: d.ties,
        games,
        deckEntries: d.deckCount,
        consistencyScore,
        brickRiskScore,
        consistencySample,
        matchups,
      }
    })
    .sort((a, b) => (b.playShare ?? 0) - (a.playShare ?? 0))

  return {
    ...meta,
    totalDeckEntries: totalDecks,
    decks: deckList,
  }
}

/** @param {number[]} rates */
export function computeConsistency(rates) {
  if (rates.length < 2) {
    return { consistencyScore: null, brickRiskScore: null, consistencySample: rates.length }
  }
  const mean = rates.reduce((a, b) => a + b, 0) / rates.length
  const variance =
    rates.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (rates.length - 1)
  const stdDev = Math.sqrt(variance)
  const consistencyScore = Math.round(
    Math.min(100, Math.max(0, 100 * (1 - Math.min(1, stdDev / CONSISTENCY_STDDEV_CAP)))),
  )
  return {
    consistencyScore,
    brickRiskScore: 100 - consistencyScore,
    consistencySample: rates.length,
  }
}

/**
 * Attach deck ids to pairings using per-tournament player → deck map.
 * @param {PairingEntry[]} pairings
 * @param {Map<string, string>} playerToDeck
 */
export function enrichPairingsWithDecks(pairings, playerToDeck) {
  return pairings.map((p) => ({
    ...p,
    _deck1: p.player1 ? playerToDeck.get(p.player1) : undefined,
    _deck2: p.player2 ? playerToDeck.get(p.player2) : undefined,
  }))
}

/**
 * @param {StandingEntry[]} standings
 * @returns {Map<string, string>}
 */
export function playerDeckMapFromStandings(standings) {
  const map = new Map()
  for (const row of standings) {
    if (row.player && row.deck?.id) map.set(row.player, row.deck.id)
  }
  return map
}

/** @param {string | number} winner @param {string} player1 @param {string} player2 */
function outcomeForPlayer(winner, player1, player2) {
  if (winner === 0) return { p1: 0, p2: 0 }
  if (winner === player1) return { p1: 1, p2: 0 }
  if (winner === player2) return { p1: 0, p2: 1 }
  return null
}

/**
 * @param {Map<string, { wins: number, losses: number, ties: number }> | undefined} row
 */
function buildMatchupBias(row, idToName) {
  if (!row || row.size === 0) {
    return { favorable: [], unfavorable: [], hasData: false }
  }
  const stats = []
  for (const [opponentId, rec] of row.entries()) {
    const games = rec.wins + rec.losses + rec.ties
    if (games < MIN_MATCHUP_GAMES) continue
    stats.push({
      opponentId,
      opponentName: idToName.get(opponentId) ?? opponentId,
      wins: rec.wins,
      losses: rec.losses,
      ties: rec.ties,
      games,
      winRate: rec.wins / games,
    })
  }
  stats.sort((a, b) => b.winRate - a.winRate)
  const favorable = stats.filter((s) => s.winRate >= 0.5).slice(0, 3)
  const unfavorable = [...stats]
    .filter((s) => s.winRate < 0.5)
    .sort((a, b) => a.winRate - b.winRate)
    .slice(0, 3)
  return {
    hasData: favorable.length > 0 || unfavorable.length > 0,
    favorable,
    unfavorable,
  }
}

/**
 * @param {Map<string, Map<string, { wins: number, losses: number, ties: number }>>} matrix
 * @param {string} deckA
 * @param {string} deckB
 * @param {{ p1: number, p2: number } | null} outcome
 */
function addMatchup(matrix, deckA, deckB, outcome) {
  if (!outcome) return
  let rowA = matrix.get(deckA)
  if (!rowA) {
    rowA = new Map()
    matrix.set(deckA, rowA)
  }
  let vsB = rowA.get(deckB)
  if (!vsB) {
    vsB = { wins: 0, losses: 0, ties: 0 }
    rowA.set(deckB, vsB)
  }
  if (outcome.p1 === 1) {
    vsB.wins += 1
  } else if (outcome.p1 === 0 && outcome.p2 === 1) {
    vsB.losses += 1
  } else {
    vsB.ties += 1
  }
}
