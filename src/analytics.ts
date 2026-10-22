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
 *
 * card_tracked is one anonymous count. This count sends no card names or ids and
 * no visitor id. a.js keeps at most 50 of that count per write. The count is
 * skipped without consent, when palmetaAnalytics is missing, and while the
 * index.html queue stub is still the function that receives calls.
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

export interface PalmetaEvent {
  name: string
  count: number
}

interface PalmetaAnalytics {
  (name: string, value?: string | PalmetaEvent): void
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

/** Same gate as a Google page view: consent granted, and not withdrawn this visit. */
function maySendAnalytics(): boolean {
  return !gaWithdrawn && hasAnalyticsConsent()
}

/**
 * One page view for the current URL. Skipped without consent, and after Off,
 * even if the consent cookie has not been dropped from document.cookie yet.
 */
export function trackPageView(): void {
  if (typeof window === 'undefined' || typeof location === 'undefined') return
  if (!maySendAnalytics()) return
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

/** One call keeps at most this many. A larger pending sum carries to the next write. */
const PALMETA_EVENT_LIMIT = 50

/**
 * The index.html stub pushes every call onto palmetaAnalytics.q. a.js replaces
 * that function; a probe call then no longer grows .q. .q itself may be absent.
 */
function queueStubStillInstalled(send: NonNullable<Window['palmetaAnalytics']>): boolean {
  if (!Array.isArray(send.q)) return false
  const queue = send.q
  const before = queue.length
  try {
    send('queue-probe', '')
  } catch {
    return true
  }
  if (queue.length === before) return false
  queue.length = before
  return true
}

/** Consent allows a Palmeta count, but a.js has not taken over from the queue stub. */
export function cardTrackedAwaitingScript(): boolean {
  if (!maySendAnalytics()) return false
  if (typeof window === 'undefined') return false
  const send = window.palmetaAnalytics
  if (typeof send !== 'function') return true
  return queueStubStillInstalled(send)
}

/**
 * Hand one card_tracked count to Palmeta. False, and no throw, when consent is
 * off, palmetaAnalytics is missing, or the queue stub still has the call.
 * This count sends no card names or ids and no visitor id. A count above 50 is
 * split so the extra is queued instead of dropped.
 */
export function trackPalmetaEvent(name: string, count: number): boolean {
  if (!Number.isInteger(count) || count < 1) return false
  if (!maySendAnalytics()) return false
  if (typeof window === 'undefined') return false
  const send = window.palmetaAnalytics
  if (typeof send !== 'function') return false
  if (queueStubStillInstalled(send)) return false
  try {
    let remaining = count
    while (remaining > 0) {
      const chunk = remaining > PALMETA_EVENT_LIMIT ? PALMETA_EVENT_LIMIT : remaining
      send('event', { name, count: chunk })
      remaining -= chunk
    }
    return true
  } catch {
    return false
  }
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
