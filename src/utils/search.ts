/**
 * Normalize a string for accent-insensitive, case-insensitive search.
 * Decomposes Unicode characters (NFD) then strips all combining diacritical
 * marks (Unicode category Mn), so e.g. "é" → "e", "â" → "a".
 * This lets "pokeb" match "Pokéball".
 */
export function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/\p{Mn}/gu, '').toLowerCase()
}
