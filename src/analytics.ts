/**
 * Google Analytics (G-881GKMN0JQ) loads only after accept. PostHog always stays on.
 *
 * Palmeta starts in session mode (a tab session marker). Accepting, or loading
 * with the consent cookie already set, switches it to a persistent visitor id.
 * Turning analytics off deletes that cookie and calls setVisitors('session'),
 * which makes a.js remove the visitor id and the consented-session marker.
 *
 * A decline is remembered as the fixed localStorage word "declined". That value
 * is not an identifier and is not sent with requests.
 */

export const GA_MEASUREMENT_ID = 'G-881GKMN0JQ'
/** Google's runtime kill switch. Must be set before any further hit. */
export const GA_DISABLE_KEY = `ga-disable-${GA_MEASUREMENT_ID}`
/** Host-only and parent-domain copies. GA sets both shapes on GitHub Pages. */
export const GA_COOKIE_DOMAIN = '.kkuepper.github.io'
export const GA_COOKIE_NAMES = ['_ga', '_ga_881GKMN0JQ'] as const
export const CONSENT_COOKIE = 'analytics_consent'
export const CONSENT_VALUE = 'granted'
/** 365 days. The banner stays hidden at least this long after accept. */
export const CONSENT_MAX_AGE = 31536000
/** localStorage only. Fixed word, not a cookie and not a visitor id. */
export const DECLINED_PREFERENCE_KEY = 'analytics_choice'
export const DECLINED_PREFERENCE_VALUE = 'declined'

export function consentCookie(): string {
  return `${CONSENT_COOKIE}=${CONSENT_VALUE}; Max-Age=${CONSENT_MAX_AGE}; Path=/pokemon-tcg; SameSite=Lax; Secure`
}

/** Remove the accept cookie. Path must match the one that set it. */
export function clearConsentCookie(): string {
  return `${CONSENT_COOKIE}=; Max-Age=0; Path=/pokemon-tcg; SameSite=Lax; Secure`
}

/** Expire GA client cookies on this host and on the GitHub Pages parent domain. */
export function gaCookieClears(): string[] {
  return GA_COOKIE_NAMES.flatMap((name) => [
    `${name}=; Max-Age=0; Path=/`,
    `${name}=; Max-Age=0; Path=/; Domain=${GA_COOKIE_DOMAIN}`,
  ])
}

export function hasAnalyticsConsent(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').includes(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
}

export function hasDeclinedAnalytics(): boolean {
  if (typeof localStorage === 'undefined') return false
  try {
    return localStorage.getItem(DECLINED_PREFERENCE_KEY) === DECLINED_PREFERENCE_VALUE
  } catch {
    return false
  }
}

/** Banner shows until the visitor accepts or stores the declined preference. */
export function shouldShowBanner(): boolean {
  return !hasAnalyticsConsent() && !hasDeclinedAnalytics()
}

function rememberDecline(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(DECLINED_PREFERENCE_KEY, DECLINED_PREFERENCE_VALUE)
  } catch {
    /* private mode */
  }
}

function clearDecline(): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(DECLINED_PREFERENCE_KEY)
  } catch {
    /* private mode */
  }
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
/** Stops our page_view calls for the rest of this visit. The ga-disable flag stops gtag.js itself. */
let gaWithdrawn = false

function setGaDisabled(disabled: boolean): void {
  if (typeof window === 'undefined') return
  ;(window as unknown as Record<string, boolean>)[GA_DISABLE_KEY] = disabled
}

/** Load gtag with analytics cookies allowed. No-op if already loaded. Does not send a page view. */
export function loadAnalytics(): void {
  if (loaded || typeof document === 'undefined') return
  loaded = true

  window.dataLayer = window.dataLayer || []
  // gtag.js only processes Arguments objects. A rest-parameter array is ignored.
  window.gtag = function () {
    window.dataLayer!.push(arguments)
  }
  window.gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'granted',
  })
  window.gtag('js', new Date())
  window.gtag('config', GA_MEASUREMENT_ID, { send_page_view: false })

  const script = document.createElement('script')
  script.async = true
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  document.head.appendChild(script)
}

/**
 * One page view for the current URL. Skipped without consent, and after Off,
 * even if the consent cookie has not been dropped from document.cookie yet.
 */
export function trackPageView(): void {
  if (typeof window === 'undefined' || typeof location === 'undefined') return
  if (gaWithdrawn || !hasAnalyticsConsent()) return
  if (typeof window.gtag !== 'function') return
  window.gtag('event', 'page_view', {
    page_path: location.pathname + location.search + location.hash,
    page_location: location.href,
  })
}

/** Route changes. The initial navigation is the first page view for a returning visitor. */
export function installGaPageViews(router: { afterEach: (guard: () => void) => void }): void {
  router.afterEach(() => {
    trackPageView()
  })
}

/** Switch Palmeta's store. `session` is the pre-consent default; `persistent` counts a visitor. */
export function setPalmetaVisitors(mode: PalmetaVisitorMode): void {
  if (typeof window === 'undefined') return
  window.palmetaAnalytics?.setVisitors?.(mode)
}

function updateGaConsent(granted: boolean): void {
  if (typeof window === 'undefined' || typeof window.gtag !== 'function') return
  window.gtag('consent', 'update', {
    analytics_storage: granted ? 'granted' : 'denied',
  })
}

/** Remember the accept for at least a year, start Analytics, and count a visitor. */
export function acceptAnalytics(): void {
  clearDecline()
  gaWithdrawn = false
  setGaDisabled(false)
  document.cookie = consentCookie()
  loadAnalytics()
  updateGaConsent(true)
  trackPageView()
  setPalmetaVisitors('persistent')
}

/** Keep Palmeta on the session marker and remember the decline. Does not grant consent. */
export function declineAnalytics(): void {
  rememberDecline()
  setPalmetaVisitors('session')
}

/**
 * Turn analytics off for the rest of this visit. ga-disable stops gtag.js hits
 * that are already queued. The withdrawn flag blocks our own page views.
 * Cookie expiry removes _ga even though a consent update does not.
 */
export function withdrawAnalytics(): void {
  gaWithdrawn = true
  setGaDisabled(true)
  document.cookie = clearConsentCookie()
  if (typeof document !== 'undefined') {
    for (const clear of gaCookieClears()) document.cookie = clear
  }
  updateGaConsent(false)
  declineAnalytics()
}
