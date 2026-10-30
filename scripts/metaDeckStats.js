/**
 * Aggregate Limitless POCKET tournament standings + pairings into meta deck stats.
 *
 * Consistency / brick-risk proxy (no mulligan data in the API):
 * For each deck archetype, collect every player-tournament match win rate
 * (wins / (wins + losses + ties)) where they played at least MIN_GAMES rounds.
 * consistencyScore = clamp(0, 100, 100 * (1 - min(1, stdDev / 0.25))).
 * Higher score = more stable results across pilots (lower brick-risk proxy).
 * brickRiskScore = 100 - consistencyScore.
 *
 * Ranked list gate (default): MIN_RANK_GAMES match results and MIN_RANK_ENTRIES lists.
 */

export const MIN_GAMES_FOR_CONSISTENCY = 3
export const CONSISTENCY_STDDEV_CAP = 0.25
export const MIN_MATCHUP_GAMES = 5
export const SAMPLE_WINDOW_DAYS = 7
/** Minimum aggregate match results (standings W+L+T) to appear in the ranked list. */
export const MIN_RANK_GAMES = 25
/** Minimum decklist count to appear in the ranked list. */
export const MIN_RANK_ENTRIES = 5

/**
 * @typedef {Object} StandingEntry
 * @property {string} player
 * @property {{ wins: number, losses: number, ties: number }} record
 * @property {{ id: string, name: string, icons?: string[] } | null | undefined} deck
 * @property {Object} [decklist]
 */

/**
 * @typedef {Object} PairingEntry
 * @property {string} [player1]
 * @property {string} [player2]
 * @property {string | number} [winner]
 */

/**
 * @typedef {Object} SiteCard
 * @property {string} id
 * @property {string} name
 * @property {string} set
 */

/**
 * @typedef {Object} CardIndex
 * @property {Map<string, SiteCard>} byNameLower
 * @property {Map<string, SiteCard>} bySetNumber
 */

/**
 * @param {SiteCard[]} cards
 * @returns {CardIndex}
 */
export function buildCardIndex(cards) {
  /** @type {Map<string, SiteCard>} */
  const byNameLower = new Map()
  /** @type {Map<string, SiteCard>} */
  const bySetNumber = new Map()
  for (const card of cards) {
    byNameLower.set(card.name.toLowerCase(), card)
    const num = card.id.split('-')[1]
    bySetNumber.set(`${normalizeSetCode(card.set)}-${parseInt(num, 10)}`, card)
  }
  return { byNameLower, bySetNumber }
}

/** @param {string} set */
export function normalizeSetCode(set) {
  return set ? String(set) : set
}

/**
 * @param {{ name: string, set?: string, number?: string | number }} entry
 * @param {CardIndex | null} index
 */
export function resolveLimitlessCard(entry, index) {
  if (!index) return null
  if (entry.set != null && entry.number != null) {
    const set = normalizeSetCode(String(entry.set))
    const num = parseInt(String(entry.number), 10)
    const hit = index.bySetNumber.get(`${set}-${num}`)
    if (hit) return toCardRef(hit)
  }
  const byName = index.byNameLower.get(entry.name.toLowerCase())
  if (byName) return toCardRef(byName)
  return null
}

/** @param {SiteCard} card */
function toCardRef(card) {
  const num = parseInt(card.id.split('-')[1], 10)
  return {
    name: card.name,
    cardId: card.id,
    imageSet: card.set,
    imageNum: num,
  }
}

/**
 * @param {Array<{ date: string, format?: string | null }>} tournaments
 * @param {Date} [now]
 */
export function selectTournamentsInWindow(tournaments, now = new Date()) {
  const cutoff = windowCutoff(now, SAMPLE_WINDOW_DAYS)
  return tournaments.filter(
    (t) => t.format !== 'CUSTOM' && new Date(t.date) >= cutoff,
  )
}

/** @param {Date} now @param {number} days */
export function windowCutoff(now, days = SAMPLE_WINDOW_DAYS) {
  const cutoff = new Date(now)
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  return cutoff
}

/** @param {{ games: number, deckEntries: number }} deck */
export function meetsRankGate(deck) {
  return deck.games >= MIN_RANK_GAMES && deck.deckEntries >= MIN_RANK_ENTRIES
}

/**
 * Ranked decks first (win rate desc), then insufficient-sample decks (win rate desc).
 * @param {Array<{ winRate: number | null, games: number, deckEntries: number, meetsSampleGate?: boolean }>} decks
 */
export function sortDecksForDisplay(decks) {
  return [...decks].sort((a, b) => {
    const gateA = meetsRankGate(a) ? 1 : 0
    const gateB = meetsRankGate(b) ? 1 : 0
    if (gateA !== gateB) return gateB - gateA
    return (b.winRate ?? 0) - (a.winRate ?? 0)
  })
}

/**
 * @param {StandingEntry[]} standings
 * @param {PairingEntry[]} pairings
 * @param {Record<string, unknown>} meta
 * @param {CardIndex | null} [cardIndex]
 */
export function aggregateMetaDecks(standings, pairings, meta, cardIndex = null) {
  /** @type {Map<string, DeckAgg>} */
  const decks = new Map()

  for (const row of standings) {
    const deck = row.deck
    if (!deck?.id) continue
    let entry = decks.get(deck.id)
    if (!entry) {
      entry = newDeckAgg(deck)
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
    if (row.decklist) {
      accumulateDecklist(entry, row.decklist)
    }
  }

  const totalDecks = [...decks.values()].reduce((s, d) => s + d.deckCount, 0)

  /** @type {Map<string, Map<string, { wins: number, losses: number, ties: number }>>} */
  const matchupMatrix = new Map()
  let totalMatches = 0

  for (const batch of pairings) {
    if (recordPairingMatchups(matchupMatrix, batch)) totalMatches += 1
  }

  const idToName = new Map([...decks.values()].map((x) => [x.id, x.name]))

  const deckList = [...decks.values()].map((d) => {
    const games = d.wins + d.losses + d.ties
    const winRate = games > 0 ? d.wins / games : null
    const playShare = totalDecks > 0 ? d.deckCount / totalDecks : null
    const { consistencyScore, brickRiskScore, consistencySample } =
      computeConsistency(d.playerRates)

    const matchups = buildMatchupBias(matchupMatrix.get(d.id), idToName)
    const highlightCards = pickHighlightCards(d, cardIndex)
    const highlightKeys = new Set(highlightCards.map((c) => cardKey(c.name, c.cardId)))
    const otherCards = buildOtherCards(d, highlightKeys, cardIndex)

    return {
      id: d.id,
      name: d.name,
      icons: d.icons,
      highlightCards,
      otherCards,
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
      meetsSampleGate: meetsRankGate({ games, deckEntries: d.deckCount }),
    }
  })

  return {
    ...meta,
    sampleWindowDays: SAMPLE_WINDOW_DAYS,
    rankMinGames: MIN_RANK_GAMES,
    rankMinEntries: MIN_RANK_ENTRIES,
    totalDeckEntries: totalDecks,
    totalMatches,
    decks: sortDecksForDisplay(deckList),
  }
}

/** @typedef {{ id: string, name: string, icons: string[], deckCount: number, wins: number, losses: number, ties: number, playerRates: number[], cards: Map<string, CardAgg> }} DeckAgg */
/** @typedef {{ name: string, set?: string, number?: string | number, category: string, listCount: number, totalCopies: number }} CardAgg */

/** @param {{ id: string, name: string, icons?: string[] }} deck */
function newDeckAgg(deck) {
  return {
    id: deck.id,
    name: deck.name,
    icons: deck.icons ?? [],
    deckCount: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    playerRates: [],
    /** @type {Map<string, CardAgg>} */
    cards: new Map(),
  }
}

/** @param {DeckAgg} entry @param {Object} decklist */
function accumulateDecklist(entry, decklist) {
  for (const category of ['pokemon', 'trainer']) {
    const rows = decklist[category]
    if (!Array.isArray(rows)) continue
    for (const row of rows) {
      if (!row?.name) continue
      const key = `${category}:${row.name}:${row.set ?? ''}:${row.number ?? ''}`
      let card = entry.cards.get(key)
      if (!card) {
        card = {
          name: row.name,
          set: row.set,
          number: row.number,
          category,
          listCount: 0,
          totalCopies: 0,
        }
        entry.cards.set(key, card)
      }
      card.listCount += 1
      card.totalCopies += Number(row.count) || 1
    }
  }
}

/** @param {DeckAgg} entry @param {CardIndex | null} cardIndex */
function pickHighlightCards(entry, cardIndex) {
  /** @type {Array<{ name: string, cardId?: string, imageSet?: string, imageNum?: number }>} */
  const picked = []
  const used = new Set()

  const pokemonCards = [...entry.cards.values()].filter((c) => c.category === 'pokemon')

  for (const icon of entry.icons) {
    const match = bestPokemonForIcon(icon, pokemonCards, cardIndex, entry.name)
    if (match && !used.has(match.name)) {
      picked.push(match)
      used.add(match.name)
    }
    if (picked.length >= 3) return picked
  }

  const byRate = pokemonCards
    .map((c) => ({
      card: c,
      ref: resolveLimitlessCard(c, cardIndex),
      rate: c.listCount / entry.deckCount,
    }))
    .filter((x) => x.ref)
    .sort((a, b) => {
      if (b.rate !== a.rate) return b.rate - a.rate
      return tieBreakRank(b.ref.name, '', entry.name) - tieBreakRank(a.ref.name, '', entry.name)
    })

  let fillCandidates = byRate.filter((row) => {
    const n = row.ref.name.toLowerCase()
    return nameIncludesEx(n) || n.includes('mega')
  })
  if (fillCandidates.length + picked.length < 3) {
    fillCandidates = byRate
  }

  for (const row of fillCandidates) {
    if (picked.length >= 3) break
    if (used.has(row.ref.name)) continue
    if (shouldSkipRedundantHighlight(row.card.name, pokemonCards)) continue
    picked.push(row.ref)
    used.add(row.ref.name)
  }

  return picked
}

/** @param {string} icon @param {CardAgg[]} pokemonCards @param {CardIndex | null} cardIndex @param {string} [deckName] */
function bestPokemonForIcon(icon, pokemonCards, cardIndex, deckName = '') {
  let best = null
  let bestScore = -Infinity
  for (const c of pokemonCards) {
    const score = scoreIconMatch(c.name, icon, { deckName })
    if (score <= 0) continue
    if (
      !best ||
      score > bestScore ||
      (score === bestScore && tieBreakPrefers(c.name, best.name, icon, deckName))
    ) {
      bestScore = score
      best = c
    }
  }
  if (best && bestScore > 0) {
    return resolveLimitlessCard(best, cardIndex) ?? { name: best.name }
  }
  for (const c of pokemonCards) {
    const ref = resolveLimitlessCard(c, cardIndex)
    if (!ref) continue
    const score = scoreIconMatch(ref.name, icon, { deckName })
    if (score <= 0) continue
    if (
      !best ||
      score > bestScore ||
      (score === bestScore && tieBreakPrefers(ref.name, best.name, icon, deckName))
    ) {
      bestScore = score
      best = c
    }
  }
  if (best && bestScore > 0) {
    return resolveLimitlessCard(best, cardIndex) ?? { name: best.name }
  }
  return null
}

/**
 * @param {string} cardName
 * @param {string} iconSlug
 * @param {{ deckName?: string }} [context]
 */
export function scoreIconMatch(cardName, iconSlug, context = {}) {
  const name = cardName.toLowerCase()
  const deckName = (context.deckName ?? '').toLowerCase()
  const slug = iconSlug.toLowerCase()
  const parts = slug.split('-').filter((p) => p !== 'p' && p !== 'b')
  const slugWantsEx = parts.includes('ex')
  const slugWantsMega = parts.includes('mega') || slug.includes('-mega-')

  let score = 0
  for (const part of parts) {
    if (part === 'ex') {
      if (nameIncludesEx(name)) score += 3
    } else if (part === 'mega') {
      if (name.includes('mega')) score += 3
    } else if (name.includes(part)) {
      score += 1
    }
  }

  const speciesTokens = parts.filter((p) => p !== 'ex' && p !== 'mega')
  for (const token of speciesTokens) {
    const deckUsesEx = deckNameIncludesSpeciesEx(deckName, token)
    if (deckUsesEx || slugWantsEx) {
      if (nameIncludesEx(name)) score += 2
      else if (isEvolutionLineName(name, token)) score -= 1
    }
    if (slugWantsMega || (deckName.includes(token) && deckName.includes('mega'))) {
      if (name.includes('mega')) score += 2
    }
  }

  return score
}

/** @param {string} nameA @param {string} nameB @param {string} icon @param {string} deckName */
export function tieBreakPrefers(nameA, nameB, icon, deckName) {
  return tieBreakRank(nameA, icon, deckName) > tieBreakRank(nameB, icon, deckName)
}

/** @param {string} cardName @param {string} iconSlug @param {string} deckName */
function tieBreakRank(cardName, iconSlug, deckName) {
  const name = cardName.toLowerCase()
  let rank = 0
  if (name.includes('mega')) rank += 8
  if (nameIncludesEx(name)) rank += 4
  if (isEvolutionLineName(name, iconSlug.split('-')[0] ?? '')) rank -= 2
  void deckName
  return rank
}

function nameIncludesEx(name) {
  return name.includes(' ex') || name.endsWith('ex')
}

/** @param {string} deckName @param {string} token */
function deckNameIncludesSpeciesEx(deckName, token) {
  if (!deckName || !token) return false
  const idx = deckName.indexOf(token)
  if (idx === -1) return false
  const after = deckName.slice(idx + token.length)
  return after.startsWith(' ex') || after.startsWith('-ex')
}

/** Penalize mid-evolution lines when matching a species icon (Frogadier vs Greninja ex). */
function isEvolutionLineName(name, token) {
  if (nameIncludesEx(name) || name.includes('mega')) return false
  return name.includes(token) && name !== token
}

/** Skip base species / pre-evolutions when an ex (or mega) line card exists in the archetype. */
/** @param {string} cardName @param {CardAgg[]} pokemonCards */
function shouldSkipRedundantHighlight(cardName, pokemonCards) {
  const name = cardName.toLowerCase()
  if (nameIncludesEx(name) || name.includes('mega')) return false
  for (const other of pokemonCards) {
    const otherName = other.name.toLowerCase()
    if (otherName === `${name} ex` || otherName === `mega ${name} ex`) return true
    if (nameIncludesEx(otherName) && otherName.includes(name) && otherName !== name) return true
    if (otherName.includes('mega') && otherName.includes(name.split(' ')[0])) return true
  }
  return false
}

/** @param {DeckAgg} entry @param {Set<string>} highlightKeys @param {CardIndex | null} cardIndex */
function buildOtherCards(entry, highlightKeys, cardIndex) {
  const rows = [...entry.cards.values()]
    .map((c) => {
      const ref = resolveLimitlessCard(c, cardIndex)
      const key = cardKey(c.name, ref?.cardId)
      if (highlightKeys.has(key)) return null
      return {
        name: c.name,
        category: c.category,
        listRate: entry.deckCount > 0 ? c.listCount / entry.deckCount : 0,
        avgCount: c.listCount > 0 ? c.totalCopies / c.listCount : 0,
        cardId: ref?.cardId,
        imageSet: ref?.imageSet,
        imageNum: ref?.imageNum,
      }
    })
    .filter(Boolean)
    .sort((a, b) => b.listRate - a.listRate)
  return rows
}

function cardKey(name, cardId) {
  return cardId ?? name.toLowerCase()
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
export function outcomeForPlayer(winner, player1, player2) {
  if (winner === 0) return { deckAWin: 0, deckBLoss: 0, tie: 1 }
  if (winner === player1) return { deckAWin: 1, deckBLoss: 0, tie: 0 }
  if (winner === player2) return { deckAWin: 0, deckBLoss: 1, tie: 0 }
  return null
}

/**
 * Record one Limitless pairing for both deck seats (A vs B and B vs A).
 * @param {Map<string, Map<string, { wins: number, losses: number, ties: number }>>} matrix
 * @param {PairingEntry & { _deck1?: string, _deck2?: string }} batch
 * @returns {boolean} true if the pairing was counted
 */
export function recordPairingMatchups(matrix, batch) {
  const { player1, player2, winner } = batch
  if (!player1 || !player2) return false
  if (winner === -1) return false
  const deck1 = batch._deck1
  const deck2 = batch._deck2
  if (!deck1 || !deck2 || deck1 === deck2) return false

  const fromDeck1 = outcomeForPlayer(winner, player1, player2)
  if (!fromDeck1) return false
  addMatchup(matrix, deck1, deck2, fromDeck1)
  addMatchup(matrix, deck2, deck1, invertDeckOutcome(fromDeck1))
  return true
}

/** @param {{ deckAWin: number, deckBLoss: number, tie: number }} outcome */
export function invertDeckOutcome(outcome) {
  return {
    deckAWin: outcome.deckBLoss,
    deckBLoss: outcome.deckAWin,
    tie: outcome.tie,
  }
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
 * @param {{ deckAWin: number, deckBLoss: number, tie: number }} outcome
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
  if (outcome.deckAWin) {
    vsB.wins += 1
  } else if (outcome.deckBLoss) {
    vsB.losses += 1
  } else if (outcome.tie) {
    vsB.ties += 1
  }
}
