/**
 * Google Analytics (G-881GKMN0JQ). PostHog is separate and always stays on.
 *
 * gtag.js is not requested until the visitor accepts, or already has the
 * year-long consent cookie. Declining does not set that cookie.
 *
 * Palmeta starts in session mode (a tab session marker). Accepting, or loading
 * with this cookie already set, switches it to a persistent visitor id.
 */

export const GA_MEASUREMENT_ID = 'G-881GKMN0JQ'
export const CONSENT_COOKIE = 'analytics_consent'
export const CONSENT_VALUE = 'granted'
/** 365 days. The banner stays hidden at least this long after accept. */
export const CONSENT_MAX_AGE = 31536000

export function consentCookie(): string {
  return `${CONSENT_COOKIE}=${CONSENT_VALUE}; Max-Age=${CONSENT_MAX_AGE}; Path=/pokemon-tcg; SameSite=Lax; Secure`
}

export function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').includes(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
}

type Gtag = (...args: unknown[]) => void

/** Modes a.js accepts. `off` stores nothing; this site does not use it. */
export type PalmetaVisitorMode = 'session' | 'persistent'

interface PalmetaAnalytics {
  (name: string, value: string): void
  q?: unknown[]
  setVisitors?: (mode: PalmetaVisitorMode) => void
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Gtag
    palmetaAnalytics?: PalmetaAnalytics
  }
}

let loaded = false

/** Load gtag with analytics cookies allowed. No-op if already loaded. */
export function loadAnalytics(): void {
  if (loaded || typeof document === 'undefined') return
  loaded = true

  window.dataLayer = window.dataLayer || []
  const gtag: Gtag = (...args) => {
    window.dataLayer!.push(args)
  }
  window.gtag = gtag
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  })
  gtag('js', new Date())
  gtag('config', GA_MEASUREMENT_ID)

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

/** Switch Palmeta's store. `session` is the pre-consent default; `persistent` counts a visitor. */
export function setPalmetaVisitors(mode: PalmetaVisitorMode): void {
  if (typeof window === 'undefined') return
  window.palmetaAnalytics?.setVisitors?.(mode)
}

/** Remember the accept for at least a year, start Analytics, and count a visitor. */
export function acceptAnalytics(): void {
  document.cookie = consentCookie()
  loadAnalytics()
  setPalmetaVisitors('persistent')
}

/** Keep Palmeta on the session marker. Does not write the consent cookie. */
export function declineAnalytics(): void {
  setPalmetaVisitors('session')
}
