import { describe, expect, it } from 'vitest'
import { CONSENT_COOKIE, CONSENT_MAX_AGE, CONSENT_VALUE, consentCookie } from './analytics'

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
