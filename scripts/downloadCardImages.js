// Downloads card images from the CDN, resizes to 200px height, and saves to
// public/images/cards/{set}/{n}.webp. Already-present files are skipped so the
// script is fast on subsequent runs. Reads public/cards.json (built first by
// buildCardDb.js) to determine which images are needed.

import { existsSync, mkdirSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root     = resolve(__dirname, '..')
const OUT_DIR  = resolve(root, 'public', 'images', 'cards')
const BASE_URL = 'https://cdn.jsdelivr.net/gh/flibustier/pokemon-tcg-exchange@main/public/images/cards-by-set'
const TARGET_HEIGHT = 200
const CONCURRENCY   = 20

const cards = JSON.parse(readFileSync(resolve(root, 'public', 'cards.json'), 'utf-8'))

// Collect unique (set, cardNumber) pairs.
const imageMap = new Map()
for (const card of cards) {
  const [set, paddedNum] = card.id.split('-')
  const num = parseInt(paddedNum, 10)
  const key = `${set}/${num}`
  if (!imageMap.has(key)) imageMap.set(key, { set, num })
}

const todo = [...imageMap.values()].filter(
  ({ set, num }) => !existsSync(resolve(OUT_DIR, set, `${num}.webp`))
)

if (todo.length === 0) {
  console.log(`✓ All ${imageMap.size} card images already present`)
  process.exit(0)
}

const cached = imageMap.size - todo.length
console.log(`Downloading ${todo.length} card images${cached ? ` (${cached} already cached)` : ''}…`)

let done = 0
let failed = 0

async function processOne({ set, num }) {
  const outDir  = resolve(OUT_DIR, set)
  const outPath = resolve(outDir, `${num}.webp`)
  const url     = `${BASE_URL}/${set}/${num}.webp`

  try {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    mkdirSync(outDir, { recursive: true })
    await sharp(buf)
      .resize({ height: TARGET_HEIGHT, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toFile(outPath)
    done++
    if (done % 100 === 0 || done === todo.length) {
      process.stdout.write(`\r  ${done}/${todo.length}`)
    }
  } catch (err) {
    failed++
    console.error(`\nFailed ${set}/${num}: ${err.message}`)
  }
}

let idx = 0
async function worker() {
  while (idx < todo.length) await processOne(todo[idx++])
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
console.log(`\n✓ Saved ${done} thumbnails → public/images/cards/`)
if (failed) console.warn(`  ⚠ ${failed} failed`)
if (failed > 0) process.exit(1)
