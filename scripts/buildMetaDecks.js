// Build-time: fetch Limitless Play POCKET tournaments and write public/meta-decks.json.
// API base: https://play.limitlesstcg.com/api (see https://docs.limitlesstcg.com/developer)

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  aggregateMetaDecks,
  buildCardIndex,
  enrichPairingsWithDecks,
  playerDeckMapFromStandings,
  SAMPLE_WINDOW_DAYS,
  windowCutoff,
} from './metaDeckStats.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const OUT_PATH = resolve(root, 'public/meta-decks.json')
const CARDS_PATH = resolve(root, 'public/cards.json')
const API = 'https://play.limitlesstcg.com/api'
const GAME = 'POCKET'

const REQUEST_DELAY_MS = Number(process.env.LIMITLESS_REQUEST_DELAY_MS || 150)
const MAX_LIST_PAGES = Number(process.env.LIMITLESS_MAX_LIST_PAGES || 30)

/** @type {StandingEntry[]} */
const allStandings = []
/** @type {import('./metaDeckStats.js').PairingEntry[]} */
const allPairings = []
let tournamentsUsed = 0
/** @type {string[]} */
const fetchWarnings = []

/**
 * @typedef {import('./metaDeckStats.js').StandingEntry} StandingEntry
 */

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms))
}

async function fetchJson(path) {
  const url = `${API}${path}`
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Limitless API ${path}: ${res.status} ${res.statusText}`)
  }
  await sleep(REQUEST_DELAY_MS)
  return res.json()
}

function shouldIncludeTournament(t) {
  if (t.format === 'CUSTOM') return false
  return true
}

async function loadTournamentsInWindow(now = new Date()) {
  const cutoff = windowCutoff(now, SAMPLE_WINDOW_DAYS)
  /** @type {Array<{ id: string, date: string, format?: string | null }>} */
  const selected = []
  for (let page = 1; page <= MAX_LIST_PAGES; page++) {
    const list = await fetchJson(`/tournaments?game=${GAME}&limit=50&page=${page}`)
    if (!Array.isArray(list) || list.length === 0) break
    for (const t of list) {
      if (!shouldIncludeTournament(t)) continue
      if (new Date(t.date) >= cutoff) selected.push(t)
    }
    const oldest = new Date(list[list.length - 1].date)
    if (oldest < cutoff) break
  }
  return { tournaments: selected, windowStart: cutoff.toISOString(), now: now.toISOString() }
}

function readExistingPayload() {
  if (existsSync(OUT_PATH)) {
    try {
      return JSON.parse(readFileSync(OUT_PATH, 'utf-8'))
    } catch {
      /* ignore */
    }
  }
  return { decks: [], totalDeckEntries: 0, source: 'https://play.limitlesstcg.com/' }
}

function isNonEmptyPayload(payload) {
  return Array.isArray(payload?.decks) && payload.decks.length > 0
}

function mergeErrors(...parts) {
  return parts.filter(Boolean).join(' ')
}

function writePayload(payload) {
  writeFileSync(OUT_PATH, JSON.stringify(payload))
}

function loadCardIndex() {
  try {
    const cards = JSON.parse(readFileSync(CARDS_PATH, 'utf-8'))
    return buildCardIndex(cards)
  } catch (err) {
    console.warn('Could not load cards.json for meta deck art mapping:', err.message)
    return null
  }
}

async function main() {
  const previous = readExistingPayload()
  const cardIndex = loadCardIndex()

  try {
    const { tournaments, windowStart } = await loadTournamentsInWindow()
    if (tournaments.length === 0) {
      fetchWarnings.push(
        `No eligible Pokémon TCG Pocket tournaments in the last ${SAMPLE_WINDOW_DAYS} days.`,
      )
    }

    for (const t of tournaments) {
      try {
        const [standings, pairings] = await Promise.all([
          fetchJson(`/tournaments/${t.id}/standings`),
          fetchJson(`/tournaments/${t.id}/pairings`),
        ])
        if (!Array.isArray(standings) || !Array.isArray(pairings)) continue
        const playerDecks = playerDeckMapFromStandings(standings)
        const enriched = enrichPairingsWithDecks(pairings, playerDecks)
        allStandings.push(...standings)
        allPairings.push(...enriched)
        tournamentsUsed += 1
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`Skipping tournament ${t.id}:`, msg)
        fetchWarnings.push(`Skipped tournament ${t.id}: ${msg}`)
      }
    }

    const payload = aggregateMetaDecks(allStandings, allPairings, {
      game: GAME,
      fetchedAt: new Date().toISOString(),
      tournamentCount: tournamentsUsed,
      sampleWindowStart: windowStart,
      source: 'https://play.limitlesstcg.com/',
      docs: 'https://docs.limitlesstcg.com/developer/tournaments',
    }, cardIndex)

    if (payload.decks.length === 0) {
      fetchWarnings.push('Tournament data loaded but no categorized decks were found.')
    }

    if (!isNonEmptyPayload(payload) && isNonEmptyPayload(previous)) {
      const kept = {
        ...previous,
        error: mergeErrors(...fetchWarnings, previous.error),
        refreshFailedAt: new Date().toISOString(),
      }
      writePayload(kept)
      console.warn(
        `Kept previous ${OUT_PATH} (${previous.decks.length} decks); refresh produced no decks.`,
      )
      return
    }

    if (fetchWarnings.length) payload.error = mergeErrors(...fetchWarnings)
    writePayload(payload)
    console.log(
      `Wrote ${OUT_PATH} — ${payload.decks.length} decks from ${tournamentsUsed} tournaments in ${SAMPLE_WINDOW_DAYS}d window (${payload.totalDeckEntries} entries)`,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('Meta deck build failed:', msg)
    if (isNonEmptyPayload(previous)) {
      writePayload({
        ...previous,
        error: mergeErrors(msg, previous.error),
        refreshFailedAt: new Date().toISOString(),
      })
      console.warn(`Kept previous ${OUT_PATH} after total fetch failure.`)
    } else {
      writePayload({
        ...previous,
        error: msg,
        game: GAME,
      })
    }
    process.exitCode = 0
  }
}

main()
