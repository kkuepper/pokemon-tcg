import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { applyMeta, escapeHtml, prerender, routesFor } from './prerender.js'
import * as seo from './seoMeta.js'
import * as app from '../src/utils/pageMeta.ts'
import { RARITY_LABELS } from '../src/types/card.ts'

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
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Old title" />
    <meta name="twitter:description" content="Old description" />
    <!-- Structured data -->
    <script type="application/ld+json">
    { "@context": "https://schema.org", "@type": "WebApplication", "name": "Home" }
    </script>
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
  // Alt arts: same name, set and pull rate as each other — only id/rarity differ.
  { id: 'A1-253', name: 'Pikachu ex', set: 'A1', setName: 'Genetic Apex', pack: 'Pikachu', rarity: 'SR', perPackRate: 0.0005 },
  { id: 'A1-259', name: 'Pikachu ex', set: 'A1', setName: 'Genetic Apex', pack: 'Pikachu', rarity: 'SAR', perPackRate: 0.0005 },
  { id: 'A1-281', name: 'Pikachu ex', set: 'A1', setName: 'Genetic Apex', pack: 'Pikachu', rarity: 'SAR', perPackRate: 0.0005 },
  { id: 'C1-101', name: 'Mission Mew', set: 'C1', setName: 'Dual Fusion', pack: '', rarity: 'AR', perPackRate: 0, obtainable: 'mission' },
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
    ogImage: tag(html, /<meta property="og:image" content="([^"]*)"/),
    twitterCard: tag(html, /<meta name="twitter:card" content="([^"]*)"/),
    twitterTitle: tag(html, /<meta name="twitter:title" content="([^"]*)"/),
    twitterDescription: tag(html, /<meta name="twitter:description" content="([^"]*)"/),
    twitterImage: tag(html, /<meta name="twitter:image" content="([^"]*)"/),
    jsonLd: /<script type="application\/ld\+json">/.test(html),
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
    expect(head.ogImage).toBeNull()
    expect(head.twitterImage).toBeNull()
    expect(head.twitterCard).toBe('summary')
    expect(head.twitterTitle).toBe(head.title)
    expect(head.twitterDescription).toBe(head.description)
    expect(head.jsonLd).toBe(true)
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
        ogImage: null,
        twitterCard: 'summary',
        twitterTitle: escapeHtml(page.title),
        twitterDescription: escapeHtml(page.description),
        twitterImage: null,
        jsonLd: false,
      })
      expect(head.title).not.toBe(escapeHtml(seo.HOME_META.title))
    }
  })

  it('writes one file per unique card, using the first entry and escaping names', () => {
    const written = prerender({ distDir: dist, cards: CARDS })
    expect(written.filter((f) => f.startsWith('charizard-ex-a1-025'))).toHaveLength(1)

    const charizard = headOf(readFileSync(join(dist, 'charizard-ex-a1-025', 'index.html'), 'utf8'))
    expect(charizard.title).toBe('Charizard ex (A1-025) — Pack Odds')
    expect(charizard.description).toBe(
      'Pull rate for Charizard ex (A1-025, Double Rare) from Genetic Apex: 0.333% per pack. Find pack odds for every card in Pokémon TCG Pocket.',
    )
    expect(charizard.ogImage).toBe('https://kkuepper.github.io/pokemon-tcg/images/cards/A1/25.webp')
    expect(charizard.twitterImage).toBe(charizard.ogImage)
    expect(charizard.twitterCard).toBe('summary')
    expect(charizard.twitterTitle).toBe(charizard.title)
    expect(charizard.twitterDescription).toBe(charizard.description)
    expect(charizard.jsonLd).toBe(false)
    expect(charizard.canonical).toBe('https://kkuepper.github.io/pokemon-tcg/charizard-ex-a1-025')
    expect(charizard.ogUrl).toBe(charizard.canonical)
    expect(charizard.ogTitle).toBe(charizard.title)

    const farfetchd = readFileSync(join(dist, 'farfetch-d-friends-a1-276', 'index.html'), 'utf8')
    expect(headOf(farfetchd).title).toBe('Farfetch’d &amp; &quot;Friends&quot; (A1-276) — Pack Odds')

    const mission = headOf(readFileSync(join(dist, 'mission-mew-c1-100', 'index.html'), 'utf8'))
    expect(mission.title).toBe('Mission Mew (C1-100) — Mission reward')
    expect(mission.description).toBe(
      'Mission Mew (C1-100, Common) is a mission reward in Dual Fusion, not pulled from a booster pack.',
    )
    expect(mission.ogImage).toBe('https://kkuepper.github.io/pokemon-tcg/images/cards/C1/100.webp')
  })

  it('keeps writing both <route>/index.html and <route>.html', () => {
    prerender({ distDir: dist, cards: CARDS })
    for (const name of ['tracker', 'charizard-ex-a1-025', 'pikachu-ex-a1-259']) {
      expect(readFileSync(join(dist, `${name}.html`), 'utf8')).toBe(readFileSync(join(dist, name, 'index.html'), 'utf8'))
    }
  })

  it('gives alt arts of the same name and set distinct descriptions', () => {
    prerender({ distDir: dist, cards: CARDS })
    const descriptions = ['pikachu-ex-a1-253', 'pikachu-ex-a1-259', 'pikachu-ex-a1-281'].map(
      (name) => headOf(readFileSync(join(dist, name, 'index.html'), 'utf8')).description,
    )
    expect(new Set(descriptions).size).toBe(3)
    expect(descriptions[0]).toContain('(A1-253, Super Rare)')
    expect(descriptions[1]).toContain('(A1-259, Special Art Rare)')
  })

  it('writes a unique description and title for every page', () => {
    prerender({ distDir: dist, cards: CARDS })
    const files = routesFor(CARDS).map((r) => (r.path === '/' ? 'index.html' : join(r.path.slice(1), 'index.html')))
    const heads = files.map((f) => headOf(readFileSync(join(dist, f), 'utf8')))
    expect(new Set(heads.map((h) => h.description)).size).toBe(files.length)
    expect(new Set(heads.map((h) => h.title)).size).toBe(files.length)
  })

  it('removes a stale og:image when the page has none', () => {
    const cardHtml = applyMeta(TEMPLATE, seo.cardMeta(CARDS[0]))
    expect(headOf(cardHtml).ogImage).not.toBeNull()
    const home = headOf(applyMeta(cardHtml, seo.HOME_META))
    expect(home.ogImage).toBeNull()
    expect(home.twitterImage).toBeNull()
    expect(applyMeta(cardHtml, seo.cardMeta(CARDS[0]))).toBe(cardHtml)
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
    const noTwitter = TEMPLATE.replace(/<meta name="twitter:title"[^>]*>/, '')
    expect(() => applyMeta(noTwitter, seo.HOME_META)).toThrow(/twitter:title/)
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
    expect(seo.RARITY_LABELS).toEqual(RARITY_LABELS)
    for (const card of CARDS) expect(app.cardMeta(card)).toEqual(seo.cardMeta(card))
  })

  it('home page index.html source matches the home meta', () => {
    const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
    const head = headOf(html)
    expect(head.title).toBe(escapeHtml(seo.HOME_META.title))
    expect(head.description).toBe(escapeHtml(seo.HOME_META.description))
    expect(head.twitterTitle).toBe(head.title)
    expect(head.twitterDescription).toBe(head.description)
    expect(head.twitterCard).toBe('summary')
  })
})

describe('real cards.json', () => {
  const cards = JSON.parse(readFileSync(new URL('../public/cards.json', import.meta.url), 'utf8'))
  const pages = routesFor(cards)

  it('has a unique description for every page, alt arts included', () => {
    const counts = new Map()
    for (const p of pages) counts.set(p.description, (counts.get(p.description) ?? 0) + 1)
    const duplicates = [...counts].filter(([, n]) => n > 1).map(([d]) => d)
    expect(duplicates).toEqual([])
    expect(seo.uniqueCards(cards).length).toBeGreaterThan(1000)
  })

  it('names the rarity of every card in its description', () => {
    for (const card of seo.uniqueCards(cards)) {
      expect(seo.cardMeta(card).description).toContain(`(${card.id}, ${RARITY_LABELS[card.rarity]})`)
    }
  })
})
