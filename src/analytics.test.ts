import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  CONSENT_VALUE,
  DECLINED_PREFERENCE_KEY,
  DECLINED_PREFERENCE_VALUE,
  GA_DISABLE_KEY,
  acceptAnalytics,
  clearConsentCookie,
  consentCookie,
  declineAnalytics,
  gaCookieClears,
  hasDeclinedAnalytics,
  setPalmetaVisitors,
  shouldShowBanner,
  withdrawAnalytics,
} from './analytics'

describe('consentCookie', () => {
  it('remembers an accept for at least a year', () => {
    expect(CONSENT_MAX_AGE).toBeGreaterThanOrEqual(31536000)
    const cookie = consentCookie()
    expect(cookie).toContain(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
    expect(cookie).toContain(`Max-Age=${CONSENT_MAX_AGE}`)
    expect(cookie).toContain('Path=/pokemon-tcg')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).toContain('Secure')
  })
})

describe('palmeta visitor consent', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('forwards session and persistent to the page hook', () => {
    const setVisitors = vi.fn()
    vi.stubGlobal('window', { palmetaAnalytics: { setVisitors } })

    setPalmetaVisitors('session')
    setPalmetaVisitors('persistent')

    expect(setVisitors).toHaveBeenNthCalledWith(1, 'session')
    expect(setVisitors).toHaveBeenNthCalledWith(2, 'persistent')
  })

  it('accept stores the consent cookie and switches Palmeta to persistent', () => {
    const setVisitors = vi.fn()
    const cookieWrites: string[] = []
    vi.stubGlobal('window', { palmetaAnalytics: { setVisitors } })
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: () => {} },
      get cookie() { return '' },
      set cookie(value: string) { cookieWrites.push(value) },
    })

    acceptAnalytics()

    expect(cookieWrites[0]).toContain(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
    expect(setVisitors).toHaveBeenCalledWith('persistent')
  })

  it('decline stays on session counting, stores only the word declined, and does not grant consent', () => {
    const setVisitors = vi.fn()
    const cookieWrites: string[] = []
    const store: Record<string, string> = {}
    vi.stubGlobal('window', { palmetaAnalytics: { setVisitors } })
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
    })
    vi.stubGlobal('document', {
      get cookie() { return '' },
      set cookie(value: string) { cookieWrites.push(value) },
    })

    declineAnalytics()

    expect(setVisitors).toHaveBeenCalledWith('session')
    expect(cookieWrites).toEqual([])
    expect(store[DECLINED_PREFERENCE_KEY]).toBe(DECLINED_PREFERENCE_VALUE)
    expect(hasDeclinedAnalytics()).toBe(true)
    expect(shouldShowBanner()).toBe(false)
  })

  it('withdraw deletes the consent cookie and returns Palmeta to session; turning it on grants again', () => {
    const setVisitors = vi.fn()
    const cookieWrites: string[] = []
    const store: Record<string, string> = {}
    const win: Record<string, unknown> = { palmetaAnalytics: { setVisitors } }
    vi.stubGlobal('window', win)
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => { store[key] = value },
      removeItem: (key: string) => { delete store[key] },
    })
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: () => {} },
      get cookie() { return '' },
      set cookie(value: string) { cookieWrites.push(value) },
    })

    withdrawAnalytics()

    expect(cookieWrites[0]).toBe(clearConsentCookie())
    expect(cookieWrites[0]).toContain('Max-Age=0')
    expect(cookieWrites[0]).toContain('Path=/pokemon-tcg')
    expect(cookieWrites).toEqual(expect.arrayContaining(gaCookieClears()))
    expect(win[GA_DISABLE_KEY]).toBe(true)
    expect(setVisitors).toHaveBeenCalledWith('session')
    expect(store[DECLINED_PREFERENCE_KEY]).toBe('declined')

    acceptAnalytics()
    expect(win[GA_DISABLE_KEY]).toBe(false)

    expect(cookieWrites[cookieWrites.length - 1]).toContain(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
    expect(setVisitors).toHaveBeenLastCalledWith('persistent')
    expect(store[DECLINED_PREFERENCE_KEY]).toBeUndefined()
  })

  it('pushes Arguments objects that gtag.js can read', async () => {
    vi.resetModules()
    const win: {
      dataLayer?: unknown[]
      gtag?: (...args: unknown[]) => void
      palmetaAnalytics?: { setVisitors: (mode: string) => void }
    } = { palmetaAnalytics: { setVisitors: () => {} } }
    vi.stubGlobal('window', win)
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: () => {} },
    })

    const { loadAnalytics } = await import('./analytics')
    loadAnalytics()

    expect(win.dataLayer!.length).toBeGreaterThanOrEqual(3)
    for (const entry of win.dataLayer!) {
      expect(Object.prototype.toString.call(entry)).toBe('[object Arguments]')
      expect(Array.isArray(entry)).toBe(false)
    }

    win.gtag!('event', 'page_view')
    const last = win.dataLayer![win.dataLayer!.length - 1] as IArguments
    expect(Object.prototype.toString.call(last)).toBe('[object Arguments]')
    expect(last[0]).toBe('event')
    expect(last[1]).toBe('page_view')
  })

  it('queues persistent mode before a.js when the consent cookie is already granted', () => {
    const html = readFileSync(resolve('index.html'), 'utf8')
    const queue = html.indexOf('window.palmetaAnalytics = window.palmetaAnalytics')
    const consent = html.indexOf(
      `document.cookie.split('; ').indexOf('${CONSENT_COOKIE}=${CONSENT_VALUE}')`,
    )
    const tag = html.indexOf('src="https://analytics.palmeta.net/a.js"')

    expect(queue).toBeGreaterThan(-1)
    expect(consent).toBeGreaterThan(queue)
    expect(tag).toBeGreaterThan(consent)
    expect(html).toContain('data-visitors="session"')
    expect(html).toContain("window.palmetaAnalytics.setVisitors('persistent')")
  })

  it('banner says PostHog runs either way and links to privacy', () => {
    const banner = readFileSync(resolve('src/components/CookieBanner.vue'), 'utf8')
    expect(banner).toContain('analytics session marker')
    expect(banner).toContain('visitor id')
    expect(banner).toContain('PostHog runs either way')
    expect(banner).not.toContain('This site uses analytics cookies')
    expect(banner).toContain('to="/privacy"')
  })

  it('footer can turn analytics on or off and links to privacy', () => {
    const footer = readFileSync(resolve('src/components/SiteFooter.vue'), 'utf8')
    expect(footer).toContain('Analytics:')
    expect(footer).toContain("'not set'")
    expect(footer).toContain("'off'")
    expect(footer).toContain("'on'")
    expect(footer).not.toContain('aria-pressed')
    expect(footer).toContain('withdraw()')
    expect(footer).toContain('accept()')
    expect(footer).toContain('to="/privacy"')
  })

  it('privacy page covers Palmeta, Google Analytics, and PostHog', () => {
    const page = readFileSync(resolve('src/views/PrivacyView.vue'), 'utf8')
    expect(page).toContain('without the query string')
    expect(page).toContain('UTC day with no time')
    expect(page).toContain('never sent')
    expect(page).toContain('400 days')
    expect(page).toContain('a.s')
    expect(page).toContain('a.c')
    expect(page).toContain('a.u')
    expect(page).toContain('deletes the visitor id')
    expect(page).toContain('removes those _ga cookies')
    expect(page).toContain('G-881GKMN0JQ')
    expect(page).toContain('PostHog runs on every visit')
    const router = readFileSync(resolve('src/router.ts'), 'utf8')
    expect(router.indexOf("path: '/privacy'")).toBeLessThan(router.indexOf("path: '/:slug?'"))
    expect(readFileSync(resolve('src/main.ts'), 'utf8')).toContain('installGaPageViews(router)')
  })
})

describe('google analytics hits', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function pageViewsOf(win: Record<string, unknown>): IArguments[] {
    const layer = (win.dataLayer as IArguments[] | undefined) ?? []
    return layer.filter((entry) => entry[0] === 'event' && entry[1] === 'page_view')
  }

  it('off stops page views even when the consent cookie still reads granted', async () => {
    vi.resetModules()
    const win: Record<string, unknown> = { palmetaAnalytics: { setVisitors() {} } }
    const writes: string[] = []
    vi.stubGlobal('window', win)
    vi.stubGlobal('location', {
      pathname: '/pokemon-tcg/',
      search: '',
      hash: '',
      href: 'https://kkuepper.github.io/pokemon-tcg/',
    })
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: () => {} },
      get cookie() { return `${CONSENT_COOKIE}=${CONSENT_VALUE}` },
      set cookie(value: string) { writes.push(value) },
    })

    const { loadAnalytics, trackPageView, withdrawAnalytics } = await import('./analytics')
    loadAnalytics()
    trackPageView()
    expect(pageViewsOf(win)).toHaveLength(1)

    withdrawAnalytics()
    trackPageView()

    expect(pageViewsOf(win)).toHaveLength(1)
    expect(win[GA_DISABLE_KEY]).toBe(true)
    expect(writes).toEqual(expect.arrayContaining(gaCookieClears()))
    for (const clear of gaCookieClears()) {
      expect(clear.startsWith('_ga')).toBe(true)
      expect(clear).toContain('Path=/')
    }
    expect(gaCookieClears().some((clear) => clear.includes('Domain=.kkuepper.github.io'))).toBe(true)
    expect(gaCookieClears().some((clear) => !clear.includes('Domain='))).toBe(true)
  })

  it('accept sends one page view, and a later route sends another only while allowed', async () => {
    vi.resetModules()
    const win: Record<string, unknown> = { palmetaAnalytics: { setVisitors() {} } }
    const cookies = new Map<string, string>()
    let scripts = 0
    const loc = {
      pathname: '/pokemon-tcg/',
      search: '?pack=a',
      hash: '#cards',
      href: 'https://kkuepper.github.io/pokemon-tcg/?pack=a#cards',
    }
    vi.stubGlobal('window', win)
    vi.stubGlobal('location', loc)
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    })
    vi.stubGlobal('document', {
      createElement: () => ({}),
      head: { appendChild: () => { scripts += 1 } },
      get cookie() {
        return [...cookies.entries()].map(([key, value]) => `${key}=${value}`).join('; ')
      },
      set cookie(value: string) {
        const [pair, ...attrs] = value.split(';').map((part) => part.trim())
        const eq = pair.indexOf('=')
        const name = pair.slice(0, eq)
        const stored = pair.slice(eq + 1)
        const maxAge = attrs.find((attr) => attr.toLowerCase().startsWith('max-age='))
        if (maxAge && Number(maxAge.split('=')[1]) <= 0) cookies.delete(name)
        else cookies.set(name, stored)
      },
    })

    const { acceptAnalytics, installGaPageViews, withdrawAnalytics } = await import('./analytics')
    const hooks: Array<() => void> = []
    installGaPageViews({ afterEach(guard) { hooks.push(guard) } })

    hooks[0]()
    expect(pageViewsOf(win)).toHaveLength(0)

    acceptAnalytics()
    expect(scripts).toBe(1)
    expect(pageViewsOf(win)).toHaveLength(1)
    const first = pageViewsOf(win)[0][2] as { page_path: string; page_location: string }
    expect(first.page_path).toBe('/pokemon-tcg/?pack=a#cards')
    expect(first.page_location).toBe('https://kkuepper.github.io/pokemon-tcg/?pack=a#cards')

    const config = (win.dataLayer as IArguments[]).find((entry) => entry[0] === 'config')
    expect(config?.[2]).toMatchObject({ send_page_view: false })
    const granted = (win.dataLayer as IArguments[]).some((entry) => {
      const update = entry[2] as { analytics_storage?: string } | undefined
      return entry[0] === 'consent' && entry[1] === 'update' && update?.analytics_storage === 'granted'
    })
    expect(granted).toBe(true)

    loc.pathname = '/pokemon-tcg/tracker'
    loc.search = ''
    loc.hash = ''
    loc.href = 'https://kkuepper.github.io/pokemon-tcg/tracker'
    hooks[0]()
    expect(pageViewsOf(win)).toHaveLength(2)
    const second = pageViewsOf(win)[1][2] as { page_path: string; page_location: string }
    expect(second.page_path).toBe('/pokemon-tcg/tracker')
    expect(second.page_location).toBe('https://kkuepper.github.io/pokemon-tcg/tracker')

    withdrawAnalytics()
    hooks[0]()
    expect(pageViewsOf(win)).toHaveLength(2)
    expect(win[GA_DISABLE_KEY]).toBe(true)

    acceptAnalytics()
    expect(scripts).toBe(1)
    expect(win[GA_DISABLE_KEY]).toBe(false)
    expect(pageViewsOf(win)).toHaveLength(3)
  })
})
