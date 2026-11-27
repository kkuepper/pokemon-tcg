import { describe, expect, it, vi } from 'vitest'
import type { Card } from '../types/card'
import { applyPageMeta, cardMeta, HOME_META, metaForAppRoute, TRACKER_META } from './pageMeta'

function card(overrides: Partial<Card> = {}): Card {
  return {
    id: 'A1-036',
    name: 'Charizard ex',
    set: 'A1',
    setName: 'Genetic Apex',
    pack: 'Charizard',
    rarity: 'RR',
    image: 'cPK_10_000360_00_LIZARDONex_RR.webp',
    poolSize: 1,
    slot4Rate: 0,
    slot5Rate: 0,
    perPackRate: 0.0166,
    rarePackContrib: 0,
    ...overrides,
  }
}

// Just enough of Document for applyPageMeta: <title>, <meta> lookup by
// name/property, the canonical <link>, createElement/appendChild/remove.
class FakeElement {
  attrs = new Map<string, string>()
  constructor(
    public tag: string,
    private owner: FakeDocument,
  ) {}
  setAttribute(k: string, v: string) {
    this.attrs.set(k, v)
  }
  getAttribute(k: string) {
    return this.attrs.get(k) ?? null
  }
  remove() {
    this.owner.elements = this.owner.elements.filter((e) => e !== this)
  }
}

class FakeDocument {
  title = ''
  elements: FakeElement[] = []
  head = { appendChild: (el: FakeElement) => this.elements.push(el) }
  createElement(tag: string) {
    return new FakeElement(tag, this)
  }
  querySelector(selector: string) {
    const m = selector.match(/^(\w+)\[([\w:-]+)="([^"]*)"\]$/)
    if (!m) throw new Error(`FakeDocument: unsupported selector ${selector}`)
    const [, tag, attr, value] = m
    return this.elements.find((e) => e.tag === tag && e.getAttribute(attr) === value) ?? null
  }
  add(tag: string, attrs: Record<string, string>) {
    const el = this.createElement(tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    this.elements.push(el)
  }
  meta(attr: string, key: string) {
    return this.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content') ?? null
  }
  get canonical() {
    return this.querySelector('link[rel="canonical"]')?.getAttribute('href') ?? null
  }
  asDocument() {
    return this as unknown as Document
  }
}

const CARD_URL = 'https://kkuepper.github.io/pokemon-tcg/charizard-ex-a1-036'

/** The head of a prerendered card page as served for /charizard-ex-a1-036. */
function prerenderedCardPage() {
  const doc = new FakeDocument()
  const meta = cardMeta(card())
  doc.title = meta.title
  doc.add('meta', { name: 'description', content: meta.description })
  doc.add('link', { rel: 'canonical', href: CARD_URL })
  doc.add('meta', { property: 'og:title', content: meta.title })
  doc.add('meta', { property: 'og:description', content: meta.description })
  doc.add('meta', { property: 'og:url', content: CARD_URL })
  doc.add('meta', { property: 'og:image', content: meta.image! })
  doc.add('meta', { name: 'twitter:card', content: 'summary' })
  doc.add('meta', { name: 'twitter:title', content: meta.title })
  doc.add('meta', { name: 'twitter:description', content: meta.description })
  doc.add('meta', { name: 'twitter:image', content: meta.image! })
  return doc
}

/** Same logic as the watchEffect in App.vue. */
function syncAppMeta(state: Parameters<typeof metaForAppRoute>[0], doc: FakeDocument) {
  const meta = metaForAppRoute(state)
  if (meta) applyPageMeta(meta, doc.asDocument())
}

describe('metaForAppRoute', () => {
  it('returns null on a card slug while the card is still loading', () => {
    expect(metaForAppRoute({ slug: 'charizard-ex-a1-036', selectedCard: null })).toBeNull()
  })

  it('returns the card meta once the card is resolved', () => {
    const c = card()
    expect(metaForAppRoute({ slug: 'charizard-ex-a1-036', selectedCard: c })).toEqual(cardMeta(c))
  })

  it('returns HOME_META when there is no slug and no card', () => {
    expect(metaForAppRoute({ slug: undefined, selectedCard: null })).toBe(HOME_META)
    expect(metaForAppRoute({ slug: '', selectedCard: null })).toBe(HOME_META)
    expect(metaForAppRoute({ slug: [], selectedCard: null })).toBe(HOME_META)
  })
})

describe('App route meta during load', () => {
  it('never changes the canonical of a card URL while cards.json loads', () => {
    const doc = prerenderedCardPage()
    const setAttribute = vi.spyOn(FakeElement.prototype, 'setAttribute')
    const before = { title: doc.title, canonical: doc.canonical, ogUrl: doc.meta('property', 'og:url') }

    // cards.json not resolved yet (or failed): selectedCard stays null.
    syncAppMeta({ slug: 'charizard-ex-a1-036', selectedCard: null }, doc)
    expect(setAttribute).not.toHaveBeenCalled()
    expect({ title: doc.title, canonical: doc.canonical, ogUrl: doc.meta('property', 'og:url') }).toEqual(before)
    setAttribute.mockRestore()

    // Card resolves: tags describe the same card, canonical unchanged.
    syncAppMeta({ slug: 'charizard-ex-a1-036', selectedCard: card() }, doc)
    expect(doc.canonical).toBe(CARD_URL)
    expect(doc.meta('property', 'og:url')).toBe(CARD_URL)
    expect(doc.title).toBe('Charizard ex (A1-036) — Pack Odds')
  })
})

describe('applyPageMeta', () => {
  it('sets og:image and twitter tags on card pages and clears the image when leaving', () => {
    const doc = new FakeDocument()
    doc.add('link', { rel: 'canonical', href: 'https://kkuepper.github.io/pokemon-tcg/' })
    const meta = cardMeta(card())

    applyPageMeta(meta, doc.asDocument())
    expect(doc.meta('property', 'og:image')).toBe('https://kkuepper.github.io/pokemon-tcg/images/cards/A1/36.webp')
    expect(doc.meta('name', 'twitter:image')).toBe(doc.meta('property', 'og:image'))
    expect(doc.meta('name', 'twitter:card')).toBe('summary')
    expect(doc.meta('name', 'twitter:title')).toBe(meta.title)
    expect(doc.meta('name', 'twitter:description')).toBe(meta.description)
    expect(doc.canonical).toBe(CARD_URL)

    applyPageMeta(TRACKER_META, doc.asDocument())
    expect(doc.meta('property', 'og:image')).toBeNull()
    expect(doc.meta('name', 'twitter:image')).toBeNull()
    expect(doc.meta('name', 'twitter:title')).toBe(TRACKER_META.title)
    expect(doc.meta('name', 'twitter:description')).toBe(TRACKER_META.description)
    expect(doc.canonical).toBe('https://kkuepper.github.io/pokemon-tcg/tracker')
  })

  it('puts id and rarity in card descriptions so alt arts differ', () => {
    const a = cardMeta(card({ id: 'A1-253', name: 'Pikachu ex', rarity: 'SR', perPackRate: 0.0005 }))
    const b = cardMeta(card({ id: 'A1-259', name: 'Pikachu ex', rarity: 'SAR', perPackRate: 0.0005 }))
    expect(a.description).toContain('(A1-253, Super Rare)')
    expect(b.description).toContain('(A1-259, Special Art Rare)')
    expect(a.description).not.toBe(b.description)
  })
})
