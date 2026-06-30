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
const MAX_RETRIES   = 4      // for transient CDN errors (503/429/network)
const RETRY_BASE_MS = 500    // exponential backoff base

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
let missing = 0   // 404 — image not published upstream yet
let errored = 0   // other failures after retries (CDN/network)

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Returns the image buffer, or null if the CDN reports it's not published (404).
// Throws (after exhausting retries) on transient errors so the caller can count it.
async function fetchImage(url) {
  let lastErr
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url)
      if (res.status === 404) return null
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return Buffer.from(await res.arrayBuffer())
    } catch (err) {
      lastErr = err
      if (attempt < MAX_RETRIES) await sleep(RETRY_BASE_MS * 2 ** attempt)
    }
  }
  throw lastErr
}

async function processOne({ set, num }) {
  const outDir  = resolve(OUT_DIR, set)
  const outPath = resolve(outDir, `${num}.webp`)
  const url     = `${BASE_URL}/${set}/${num}.webp`

  try {
    const buf = await fetchImage(url)
    if (buf === null) {
      missing++
      return
    }
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
    errored++
    console.error(`\nFailed ${set}/${num}: ${err.message}`)
  }
}

let idx = 0
async function worker() {
  while (idx < todo.length) await processOne(todo[idx++])
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker))
console.log(`\n✓ Saved ${done} thumbnails → public/images/cards/`)
const unavailable = missing + errored
if (unavailable) {
  // jsDelivr returns 404 OR 503 for files that aren't published yet (e.g. a
  // brand-new pack whose images haven't been added upstream), so both are
  // treated as "not available yet" rather than a build failure.
  console.warn(`  ⓘ ${unavailable} image(s) not available yet — will be fetched on a future run`)
}

// Images are a best-effort, self-healing asset: missing ones fall back to a
// placeholder in the UI and are retried on the next deploy, and previously
// fetched ones persist via the CI cache. So a lagging new pack must not block
// the deploy. Only fail on a genuinely cold run that produced nothing at all —
// the signature of a real outage or a broken CDN URL, not a not-yet-ready pack.
if (cached === 0 && done === 0) {
  console.error(`\n✗ No images could be downloaded and none were cached — failing build`)
  process.exit(1)
}
