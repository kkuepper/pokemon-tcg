// Build-time script: reads from node_modules/pokemon-tcg-pocket-database,
// computes per-card pull probabilities, and writes public/cards.json.
// All output rates are fractions [0, 1].

import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const DB_PATH = resolve(root, 'node_modules/pokemon-tcg-pocket-database/dist')

function loadJson(filename) {
  return JSON.parse(readFileSync(resolve(DB_PATH, filename), 'utf-8'))
}

const cards = loadJson('cards.min.json')
const pullRates = loadJson('pullRates.json')
const setsData = loadJson('sets.json')

// Build set name and packs lookup
const setNames = {}
const setPacksMap = {}
for (const series of Object.values(setsData)) {
  for (const set of series) {
    setNames[set.code] = set.name.en
    setPacksMap[set.code] = set.packs ?? []
  }
}

// Detect foil variant: image filename contains _01_ (vs _00_ for non-foil)
function isFoil(image) {
  return image?.includes('_01_') ?? false
}

// Pool key mapping. Foil C/U/R cards belong to CF/UF/RF pools in pull rate tables.
// SAR shares the SR pool.
function poolKey(rarity, foil = false) {
  if (foil) {
    const foilMap = { C: 'CF', U: 'UF', R: 'RF' }
    if (foilMap[rarity]) return foilMap[rarity]
  }
  return rarity === 'SAR' ? 'SR' : rarity
}

// Rarities eligible for Rare Pack
const RARE_PACK_RARITIES = new Set(['AR', 'SR', 'SAR', 'IM', 'UR', 'SSR'])

// Build per-(set, pack, poolKey) pool size
const packPoolMap = {}
for (const card of cards) {
  const cardPacks = card.packs ?? setPacksMap[card.set] ?? []
  const pk = poolKey(card.rarity, isFoil(card.image))
  for (const pack of cardPacks) {
    const k = `${card.set}::${pack}::${pk}`
    packPoolMap[k] = (packPoolMap[k] || 0) + 1
  }
}

// Build whole-set pool for Rare Pack (not variant-specific)
const setPoolMap = {}
for (const card of cards) {
  const pk = poolKey(card.rarity, isFoil(card.image))
  const k = `${card.set}::${pk}`
  setPoolMap[k] = (setPoolMap[k] || 0) + 1
}

// Get the rate for a rarity in a slot object, returns 0 if absent
function slotRate(slots, slotKey, rarityKey) {
  return slots[slotKey]?.[rarityKey] ?? 0
}

// Compute per-card probability from a slot given pool-level rate (%) and pool size
function perCardProb(slotPct, poolSz) {
  return (slotPct / poolSz) / 100
}

// Given a slots object, find all "rare" slots (those containing the rarity key)
// Returns an array of per-card probabilities for each slot found
function findRarityInSlots(slots, rarityKey, poolSz) {
  const probs = []
  for (const slotKey of Object.keys(slots)) {
    const rate = slotRate(slots, slotKey, rarityKey)
    if (rate > 0) probs.push(perCardProb(rate, poolSz))
  }
  return probs
}

// P(at least once) across independent slots
function atLeastOnce(perSlotProbs) {
  let notProb = 1
  for (const p of perSlotProbs) notProb *= (1 - p)
  return 1 - notProb
}

function round8(n) {
  return Math.round(n * 1e8) / 1e8
}

const output = []

for (const card of cards) {
  const { set, number, name, rarity, image } = card
  const packs = card.packs ?? setPacksMap[set] ?? []

  // Skip cards with no known pack (promos not in pull rate DB)
  if (!packs.length) continue

  const setName = setNames[set] ?? set
  const rates = pullRates[set]
  if (!rates) continue

  const regularPack = rates['Regular Pack']
  const rarePack = rates['Rare Pack'] ?? null
  const regularPackPlus = rates['Regular Pack +1'] ?? null
  const themedRarePack = rates['Themed Rare Pack'] ?? null

  const regAppr = (regularPack?.appearance_rate ?? 0) / 100
  const rareAppr = (rarePack?.appearance_rate ?? 0) / 100
  const plus1Appr = (regularPackPlus?.appearance_rate ?? 0) / 100
  const themedAppr = (themedRarePack?.appearance_rate ?? 0) / 100

  const foil = isFoil(image)
  const pk = poolKey(rarity, foil)

  for (const pack of packs) {
    const packPoolSz = packPoolMap[`${set}::${pack}::${pk}`] ?? 1

    let regularPackRate = 0
    let plus1PackRate = 0
    let rarePackRate = 0
    let themedRarePackRate = 0

    // For all rarities (including C and foil variants): look up which slots they appear in
    if (regularPack) {
      const probs = findRarityInSlots(regularPack.slots, pk, packPoolSz)
      regularPackRate = atLeastOnce(probs)
    }

    // Regular Pack +1: may add slot 6 (bonus shiny slot in some sets)
    if (regularPackPlus) {
      const probs = findRarityInSlots(regularPackPlus.slots, pk, packPoolSz)
      plus1PackRate = atLeastOnce(probs)
    }

    // Rare Pack: pool is across all cards of that rarity in the whole set
    if (rarePack && RARE_PACK_RARITIES.has(rarity)) {
      const setPoolSz = setPoolMap[`${set}::${pk}`] ?? 1
      // All slots in Rare Pack have the same rates — use slot '1' as reference
      const rareSlotKey = Object.keys(rarePack.slots)[0]
      const rSlotPct = rarePack.slots[rareSlotKey]?.[pk] ?? 0
      const rPerSlot = perCardProb(rSlotPct, setPoolSz)
      const numSlots = rarePack.cards ?? 5
      rarePackRate = 1 - Math.pow(1 - rPerSlot, numSlots)
    }

    // Themed Rare Pack (B2b: all SSR)
    if (themedRarePack && rarity === 'SSR') {
      const themedSetPool = setPoolMap[`${set}::SSR`] ?? 1
      const themedSlotKey = Object.keys(themedRarePack.slots)[0]
      const tSlotPct = themedRarePack.slots[themedSlotKey]?.['SSR'] ?? 0
      const tPerSlot = perCardProb(tSlotPct, themedSetPool)
      const numSlots = themedRarePack.cards ?? 5
      themedRarePackRate = 1 - Math.pow(1 - tPerSlot, numSlots)
    }

    // Overall per-pack-opening probability (weighted by appearance rates)
    const perPackRate =
      regAppr * regularPackRate +
      plus1Appr * plus1PackRate +
      rareAppr * rarePackRate +
      themedAppr * themedRarePackRate

    // Slot breakdown for display
    const slot4Rate = rarity !== 'C' && regularPack
      ? perCardProb(slotRate(regularPack.slots, '4', pk), packPoolSz)
      : 0
    const slot5Rate = rarity !== 'C' && regularPack
      ? perCardProb(slotRate(regularPack.slots, '5', pk), packPoolSz)
      : 0

    output.push({
      id: `${set}-${String(number).padStart(3, '0')}`,
      name,
      set,
      setName,
      pack,
      rarity,
      image,
      poolSize: packPoolSz,
      slot4Rate: round8(slot4Rate),
      slot5Rate: round8(slot5Rate),
      perPackRate: round8(perPackRate),
      rarePackContrib: round8(rareAppr * rarePackRate),
    })
  }
}

mkdirSync(resolve(root, 'public'), { recursive: true })
writeFileSync(resolve(root, 'public/cards.json'), JSON.stringify(output))
console.log(`✓ Built ${output.length} card entries → public/cards.json`)
