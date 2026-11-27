// Post-build step: give every crawlable route its own static HTML file so
// GitHub Pages answers with HTTP 200 and page-specific <head> tags instead of
// the 404.html SPA redirect.
//
//   dist/index.html             home page tags rewritten in place
//   dist/<route>/index.html     one per static view and per card (without the
//                               homepage WebApplication JSON-LD)
//   dist/<route>.html           same content; GitHub Pages serves this for the
//                               extensionless URL (/meta-decks) with a 200,
//                               where the directory alone would 301 to /meta-decks/
//
// Unknown routes still fall through to dist/404.html (copied from public/).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { dirname, join, resolve } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'
import { cardMeta, HOME_META, pageUrl, STATIC_PAGES, uniqueCards } from './seoMeta.js'

export function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function replaceOnce(html, pattern, replacement, label) {
  const matches = html.match(new RegExp(pattern.source, 'g')) ?? []
  if (matches.length !== 1) {
    throw new Error(`prerender: expected exactly one ${label} in index.html, found ${matches.length}`)
  }
  return html.replace(pattern, () => replacement)
}

const IMAGE_TAG = /[ \t]*<meta\s+(?:property="og:image"|name="twitter:image")\s+content="[^"]*"\s*\/?>\r?\n?/g
const STRUCTURED_DATA = /[ \t]*(?:<!--\s*Structured data\s*-->\s*)?<script\s+type="application\/ld\+json">[\s\S]*?<\/script>\r?\n?/g

/**
 * Rewrite title, description, canonical, Open Graph and Twitter tags of the
 * built index.html. og:image / twitter:image are inserted after
 * twitter:description when the page has an image and removed otherwise.
 */
export function applyMeta(html, { path, title, description, image, type = 'website' }) {
  const url = escapeHtml(pageUrl(path))
  const t = escapeHtml(title)
  const d = escapeHtml(description)
  const meta = (attr, key, content) => [
    new RegExp(`<meta\\s+${attr}="${key}"\\s+content="[^"]*"\\s*/?>`),
    `<meta ${attr}="${key}" content="${content}" />`,
    `${attr}="${key}"`,
  ]
  const rules = [
    [/<title>[^<]*<\/title>/, `<title>${t}</title>`, '<title>'],
    meta('name', 'description', d),
    [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, `<link rel="canonical" href="${url}" />`, 'canonical link'],
    meta('property', 'og:title', t),
    meta('property', 'og:description', d),
    meta('property', 'og:url', url),
    meta('property', 'og:type', type),
    meta('name', 'twitter:card', 'summary'),
    meta('name', 'twitter:title', t),
    meta('name', 'twitter:description', d),
  ]
  let out = rules.reduce((acc, [pattern, replacement, label]) => replaceOnce(acc, pattern, replacement, label), html)
  out = out.replace(IMAGE_TAG, '')
  if (image) {
    const img = escapeHtml(image)
    out = out.replace(
      /([ \t]*)(<meta name="twitter:description" content="[^"]*" \/>)/,
      (_, indent, tag) =>
        `${indent}${tag}\n${indent}<meta property="og:image" content="${img}" />\n${indent}<meta name="twitter:image" content="${img}" />`,
    )
  }
  return out
}

/** Remove the homepage WebApplication JSON-LD (and its comment); it only describes the home page. */
export function stripStructuredData(html) {
  return html.replace(STRUCTURED_DATA, '')
}

/** Every route that gets a prerendered file, home first. */
export function routesFor(cards) {
  return [HOME_META, ...STATIC_PAGES, ...uniqueCards(cards).map(cardMeta)]
}

export function prerender({ distDir, cards }) {
  const template = readFileSync(join(distDir, 'index.html'), 'utf8')
  const written = []
  for (const route of routesFor(cards)) {
    const html = applyMeta(template, route)
    if (route.path === '/') {
      writeFileSync(join(distDir, 'index.html'), html)
      written.push('index.html')
      continue
    }
    const name = route.path.slice(1)
    if (!/^[a-z0-9-]+$/.test(name)) throw new Error(`prerender: unexpected route path ${route.path}`)
    const page = stripStructuredData(html)
    mkdirSync(join(distDir, name), { recursive: true })
    writeFileSync(join(distDir, name, 'index.html'), page)
    writeFileSync(join(distDir, `${name}.html`), page)
    written.push(`${name}/index.html`)
  }
  return written
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const distDir = resolve(root, 'dist')
  const cardsPath = [join(distDir, 'cards.json'), resolve(root, 'public/cards.json')].find(existsSync)
  if (!cardsPath) throw new Error('prerender: cards.json not found in dist/ or public/')
  const cards = JSON.parse(readFileSync(cardsPath, 'utf8'))
  const written = prerender({ distDir, cards })
  console.log(`✓ Prerendered ${written.length} pages → dist/`)
}

const isDirectRun = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href
if (isDirectRun) main()
