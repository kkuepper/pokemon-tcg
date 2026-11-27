import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { applyMeta, escapeHtml, prerender } from './prerender.js'
import * as seo from './seoMeta.js'
import * as app from '../src/utils/pageMeta.ts'

const TEMPLATE = `<!doctype html>
<html lang="en">
  <head>
    <title>Old title</title>
    <meta name="description" content="Old description" />
    <link rel="canonical" href="https://kkuepper.github.io/pokemon-tcg/" />
    <meta property="og:title" content="Old title" />
    <meta property="og:description" content="Old description" />
    <meta property="og:url" content="https://kkuepper.github.io/pokemon-tcg/" />
    <meta property="og:type" content="website" />
    <script type="module" src="/pokemon-tcg/assets/index-abc.js"></script>
  </head>
  <body><div id="app"></div></body>
</html>
`

const CARDS = [
  { id: 'A1-025', name: 'Charizard ex', set: 'A1', setName: 'Genetic Apex', pack: 'Charizard', rarity: 'RR', perPackRate: 0.00333 },
  // Same card listed again for another pack — only the first entry is used.
  { id: 'A1-025', name: 'Charizard ex', set: 'A1', setName: 'Genetic Apex', pack: 'Mewtwo', rarity: 'RR', perPackRate: 0.5 },
  { id: 'A1-276', name: 'Farfetch’d & "Friends"', set: 'A1', setName: 'Genetic Apex', pack: 'Pikachu', rarity: 'C', perPackRate: 0.0587 },
  { id: 'C1-100', name: 'Mission Mew', set: 'C1', setName: 'Dual Fusion', pack: '', rarity: 'C', perPackRate: 0, obtainable: 'mission' },
]

function tag(html, re) {
  const m = html.match(re)
  return m ? m[1] : null
}

function headOf(html) {
  return {
    title: tag(html, /<title>([^<]*)<\/title>/),
    description: tag(html, /<meta name="description" content="([^"]*)"/),
    canonical: tag(html, /<link rel="canonical" href="([^"]*)"/),
    ogTitle: tag(html, /<meta property="og:title" content="([^"]*)"/),
    ogDescription: tag(html, /<meta property="og:description" content="([^"]*)"/),
    ogUrl: tag(html, /<meta property="og:url" content="([^"]*)"/),
    ogType: tag(html, /<meta property="og:type" content="([^"]*)"/),
  }
}

describe('prerender', () => {
  let dist
  beforeEach(() => {
    dist = mkdtempSync(join(tmpdir(), 'prerender-'))
    writeFileSync(join(dist, 'index.html'), TEMPLATE)
  })
  afterEach(() => rmSync(dist, { recursive: true, force: true }))

  it('rewrites the home page with the pack-odds keywords', () => {
    prerender({ distDir: dist, cards: CARDS })
    const head = headOf(readFileSync(join(dist, 'index.html'), 'utf8'))
    expect(head.title).toBe(escapeHtml(seo.HOME_META.title))
    expect(head.canonical).toBe('https://kkuepper.github.io/pokemon-tcg/')
    expect(head.ogUrl).toBe(head.canonical)
    expect(head.ogType).toBe('website')
    for (const text of [head.title, head.description, head.ogTitle, head.ogDescription]) {
      expect(text.toLowerCase()).toContain('pokémon tcg pocket odds')
      expect(text.toLowerCase()).toContain('pack odds')
    }
  })

  it('writes one file per static page with its own tags', () => {
    prerender({ distDir: dist, cards: CARDS })
    for (const page of seo.STATIC_PAGES) {
      const name = page.path.slice(1)
      const file = join(dist, name, 'index.html')
      expect(existsSync(file)).toBe(true)
      expect(readFileSync(join(dist, `${name}.html`), 'utf8')).toBe(readFileSync(file, 'utf8'))
      const head = headOf(readFileSync(file, 'utf8'))
      expect(head).toEqual({
        title: escapeHtml(page.title),
        description: escapeHtml(page.description),
        canonical: `https://kkuepper.github.io/pokemon-tcg${page.path}`,
        ogTitle: escapeHtml(page.title),
        ogDescription: escapeHtml(page.description),
        ogUrl: `https://kkuepper.github.io/pokemon-tcg${page.path}`,
        ogType: 'website',
      })
      expect(head.title).not.toBe(escapeHtml(seo.HOME_META.title))
    }
  })

  it('writes one file per unique card, using the first entry and escaping names', () => {
    const written = prerender({ distDir: dist, cards: CARDS })
    expect(written.filter((f) => f.startsWith('charizard-ex-a1-025'))).toHaveLength(1)

    const charizard = headOf(readFileSync(join(dist, 'charizard-ex-a1-025', 'index.html'), 'utf8'))
    expect(charizard.title).toBe('Charizard ex (A1-025) — Pack Odds | Pokémon TCG Pocket')
    expect(charizard.description).toBe(
      'Pull rate for Charizard ex from Genetic Apex: 0.333% per pack. Find pack odds for every card in Pokémon TCG Pocket.',
    )
    expect(charizard.canonical).toBe('https://kkuepper.github.io/pokemon-tcg/charizard-ex-a1-025')
    expect(charizard.ogUrl).toBe(charizard.canonical)
    expect(charizard.ogTitle).toBe(charizard.title)

    const farfetchd = readFileSync(join(dist, 'farfetch-d-friends-a1-276', 'index.html'), 'utf8')
    expect(headOf(farfetchd).title).toBe('Farfetch’d &amp; &quot;Friends&quot; (A1-276) — Pack Odds | Pokémon TCG Pocket')

    const mission = headOf(readFileSync(join(dist, 'mission-mew-c1-100', 'index.html'), 'utf8'))
    expect(mission.title).toBe('Mission Mew (C1-100) — Mission reward | Pokémon TCG Pocket')
  })

  it('keeps the rest of the template (scripts, body) intact', () => {
    prerender({ distDir: dist, cards: CARDS })
    const html = readFileSync(join(dist, 'tracker', 'index.html'), 'utf8')
    expect(html).toContain('<script type="module" src="/pokemon-tcg/assets/index-abc.js"></script>')
    expect(html).toContain('<div id="app"></div>')
  })

  it('fails loudly when the template is missing a tag', () => {
    const broken = TEMPLATE.replace(/<link rel="canonical"[^>]*>/, '')
    expect(() => applyMeta(broken, seo.HOME_META)).toThrow(/canonical/)
  })
})

describe('build-time and client-side meta agree', () => {
  it('uses the same text for every static route', () => {
    expect(app.SITE_URL).toBe(seo.SITE_URL)
    expect(app.HOME_META).toEqual(seo.HOME_META)
    const appPages = [app.META_DECKS_META, app.TRACKER_META, app.PRIVACY_META]
    expect(appPages).toEqual(seo.STATIC_PAGES)
  })

  it('uses the same text for card pages', () => {
    for (const card of CARDS) expect(app.cardMeta(card)).toEqual(seo.cardMeta(card))
  })

  it('home page index.html source matches the home meta', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const head = headOf(html)
    expect(head.title).toBe(escapeHtml(seo.HOME_META.title))
    expect(head.description).toBe(escapeHtml(seo.HOME_META.description))
  })
})
