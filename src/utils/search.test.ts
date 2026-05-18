import { describe, it, expect } from 'vitest'
import { normalizeForSearch } from './search'

describe('normalizeForSearch', () => {
  it('strips acute accent so "pokeb" matches "Pokéball"', () => {
    const name = normalizeForSearch('Pokéball')
    const query = normalizeForSearch('pokeb')
    expect(name.includes(query)).toBe(true)
  })

  it('strips accent from query so "eevee" still matches "Eevee"', () => {
    expect(normalizeForSearch('Eevee').includes(normalizeForSearch('eevee'))).toBe(true)
  })

  it('is case-insensitive', () => {
    expect(normalizeForSearch('MEWTWO')).toBe('mewtwo')
  })

  it('strips multiple different accents in one string', () => {
    // â → a, é → e
    expect(normalizeForSearch('Flâré')).toBe('flare')
  })

  it('passes through plain ASCII unchanged (modulo lowercase)', () => {
    expect(normalizeForSearch('Charizard')).toBe('charizard')
  })

  it('returns empty string for empty input', () => {
    expect(normalizeForSearch('')).toBe('')
  })

  it('handles Japanese/non-Latin characters without throwing', () => {
    // Non-Latin characters that have no combining marks pass through unchanged
    expect(() => normalizeForSearch('フシギダネ')).not.toThrow()
  })
})
