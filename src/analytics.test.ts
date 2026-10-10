import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE,
  CONSENT_VALUE,
  acceptAnalytics,
  consentCookie,
  declineAnalytics,
  setPalmetaVisitors,
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

  it('decline stays on session counting and does not write the consent cookie', () => {
    const setVisitors = vi.fn()
    const cookieWrites: string[] = []
    vi.stubGlobal('window', { palmetaAnalytics: { setVisitors } })
    vi.stubGlobal('document', {
      get cookie() { return '' },
      set cookie(value: string) { cookieWrites.push(value) },
    })

    declineAnalytics()

    expect(setVisitors).toHaveBeenCalledWith('session')
    expect(cookieWrites).toEqual([])
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

  it('banner names the session marker and the visitor id after consent', () => {
    const banner = readFileSync(resolve('src/components/CookieBanner.vue'), 'utf8')
    expect(banner).toContain('analytics session marker')
    expect(banner).toContain('visitor id')
    expect(banner).toContain('acceptAnalytics()')
    expect(banner).toContain('declineAnalytics()')
  })
})
