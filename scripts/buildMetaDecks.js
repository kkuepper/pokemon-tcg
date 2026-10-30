// Build-time: fetch Limitless Play POCKET tournaments and write public/meta-decks.json.
// API base: https://play.limitlesstcg.com/api (see https://docs.limitlesstcg.com/developer)

import { writeFileSync, readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import {
  aggregateMetaDecks,
  enrichPairingsWithDecks,
  playerDeckMapFromStandings,
} from './metaDeckStats.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const OUT_PATH = resolve(root, 'public/meta-decks.json')
const API = 'https://play.limitlesstcg.com/api'
const GAME = 'POCKET'

const MAX_TOURNAMENTS = Number(process.env.LIMITLESS_MAX_TOURNAMENTS || 20)
const REQUEST_DELAY_MS = Number(process.env.LIMITLESS_REQUEST_DELAY_MS || 150)

/** @type {StandingEntry[]} */
const allStandings = []
/** @type {import('./metaDeckStats.js').PairingEntry[]} */
const allPairings = []
let tournamentsUsed = 0
let errorMessage = null

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

async function loadTournaments() {
  const list = await fetchJson(`/tournaments?game=${GAME}&limit=50`)
  if (!Array.isArray(list)) throw new Error('Unexpected tournaments response')
  return list.filter(shouldIncludeTournament).slice(0, MAX_TOURNAMENTS)
}

async function main() {
  try {
    const tournaments = await loadTournaments()
    if (tournaments.length === 0) {
      errorMessage = 'No eligible Pokémon TCG Pocket tournaments found.'
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
        console.warn(`Skipping tournament ${t.id}:`, err.message)
      }
    }

    const payload = aggregateMetaDecks(allStandings, allPairings, {
      game: GAME,
      fetchedAt: new Date().toISOString(),
      tournamentCount: tournamentsUsed,
      source: 'https://play.limitlesstcg.com/',
      docs: 'https://docs.limitlesstcg.com/developer/tournaments',
    })

    if (errorMessage) payload.error = errorMessage
    if (payload.decks.length === 0 && !errorMessage) {
      payload.error = 'Tournament data loaded but no categorized decks were found.'
    }

    writeFileSync(OUT_PATH, JSON.stringify(payload))
    console.log(
      `Wrote ${OUT_PATH} — ${payload.decks.length} decks from ${tournamentsUsed} tournaments (${payload.totalDeckEntries} entries)`,
    )
  } catch (err) {
    console.error('Meta deck build failed:', err.message)
    const fallback = readFallback()
    const payload = {
      ...fallback,
      error: err.message,
      fetchedAt: new Date().toISOString(),
      tournamentCount: 0,
      game: GAME,
    }
    writeFileSync(OUT_PATH, JSON.stringify(payload))
    process.exitCode = 0
  }
}

function readFallback() {
  if (existsSync(OUT_PATH)) {
    try {
      return JSON.parse(readFileSync(OUT_PATH, 'utf-8'))
    } catch {
      /* ignore */
    }
  }
  return { decks: [], totalDeckEntries: 0, source: 'https://play.limitlesstcg.com/' }
}

main()
