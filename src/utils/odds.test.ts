import { describe, it, expect } from 'vitest'
import { atLeastOneIn, packsForProbability, formatPct, formatPacks } from './odds'

describe('atLeastOneIn', () => {
  it('returns 0 when per-pack rate is 0', () => {
    expect(atLeastOneIn(0, 100)).toBe(0)
  })

  it('returns 1 when per-pack rate is 1', () => {
    expect(atLeastOneIn(1, 1)).toBe(1)
  })

  it('equals perPackRate when n = 1', () => {
    expect(atLeastOneIn(0.3, 1)).toBeCloseTo(0.3)
  })

  it('1 - (1 - 0.5)^2 = 0.75 for n=2 at 50%', () => {
    expect(atLeastOneIn(0.5, 2)).toBeCloseTo(0.75)
  })

  it('approaches 1 as n grows large', () => {
    expect(atLeastOneIn(0.01, 1000)).toBeGreaterThan(0.9999)
  })

  it('is monotonically increasing with n', () => {
    const r = 0.016607 // ~Charizard ex RR
    expect(atLeastOneIn(r, 100)).toBeLessThan(atLeastOneIn(r, 200))
  })
})

describe('packsForProbability', () => {
  it('returns Infinity when per-pack rate is 0', () => {
    expect(packsForProbability(0, 0.5)).toBe(Infinity)
  })

  it('returns 1 when per-pack rate is 1', () => {
    expect(packsForProbability(1, 0.99)).toBe(1)
  })

  it('returns 0 when target probability is 0', () => {
    expect(packsForProbability(0.5, 0)).toBe(0)
  })

  it('returns Infinity when target probability is 1', () => {
    expect(packsForProbability(0.5, 1)).toBe(Infinity)
  })

  it('needs 1 pack for 50% when rate is 50%', () => {
    // atLeastOneIn(0.5, 1) = 0.5, so 1 pack suffices
    expect(packsForProbability(0.5, 0.5)).toBe(1)
  })

  it('needs 2 packs for 75% when rate is 50%', () => {
    // 1 - (1 - 0.5)^2 = 0.75
    expect(packsForProbability(0.5, 0.75)).toBe(2)
  })

  it('is the inverse of atLeastOneIn: atLeastOneIn(r, packsFor(r,p)) >= p', () => {
    const r = 0.016607
    const target = 0.5
    const n = packsForProbability(r, target)
    expect(atLeastOneIn(r, n)).toBeGreaterThanOrEqual(target)
  })

  it('result is always an integer (ceil)', () => {
    const n = packsForProbability(0.016607, 0.9)
    expect(Number.isInteger(n)).toBe(true)
  })
})

describe('formatPct', () => {
  it('formats exactly 0 as "0%"', () => {
    expect(formatPct(0)).toBe('0%')
  })

  it('formats >= 10% with 2 decimal places', () => {
    expect(formatPct(0.5)).toBe('50.00%')
    expect(formatPct(0.1)).toBe('10.00%')
  })

  it('formats 1–10% with 3 decimal places', () => {
    expect(formatPct(0.05)).toBe('5.000%')
    expect(formatPct(0.01)).toBe('1.000%')
  })

  it('formats 0.1–1% with 4 decimal places', () => {
    expect(formatPct(0.005)).toBe('0.5000%')
  })

  it('formats < 0.1% with 5 decimal places', () => {
    expect(formatPct(0.0007)).toBe('0.07000%')
    expect(formatPct(0.00001)).toBe('0.00100%')
  })

  it('formats 100% correctly', () => {
    expect(formatPct(1)).toBe('100.00%')
  })
})

describe('formatPacks', () => {
  it('formats Infinity as "∞"', () => {
    expect(formatPacks(Infinity)).toBe('∞')
  })

  it('formats 1 as "1"', () => {
    expect(formatPacks(1)).toBe('1')
  })

  it('formats large numbers with locale thousands separator', () => {
    // toLocaleString output varies by locale, but should contain the digits
    const result = formatPacks(1000)
    expect(result).toMatch(/1.000|1,000/) // comma or period depending on locale
  })
})
