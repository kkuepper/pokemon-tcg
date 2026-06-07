import { describe, it, expect, vi } from 'vitest'

// ── External dependency mocks ─────────────────────────────────────────────────

vi.mock('../firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: vi.fn().mockResolvedValue({ exists: () => false }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => null),
}))

vi.mock('./useAuth', async () => {
  const { ref } = await import('vue')
  return { useAuth: () => ({ user: ref(null) }) }
})

// ── localStorage stub (Node has no DOM) ───────────────────────────────────────

const lsStore: Record<string, string> = {}
vi.stubGlobal('localStorage', {
  getItem: (k: string) => lsStore[k] ?? null,
  setItem: (k: string, v: string) => { lsStore[k] = v },
})

// ── Helper: fresh singleton per test ─────────────────────────────────────────
// useTracker reads localStorage at module init time, so we seed ls before import.

const STORAGE_KEY = 'ptcgp-tracker-owned'

async function freshTracker(preOwned: string[] = []) {
  delete lsStore[STORAGE_KEY]
  if (preOwned.length) lsStore[STORAGE_KEY] = JSON.stringify(preOwned)
  vi.resetModules()
  const { useTracker } = await import('./useTracker')
  return useTracker()
}

// ── Correctness ───────────────────────────────────────────────────────────────

describe('useTracker — correctness', () => {
  it('starts empty when localStorage has no data', async () => {
    const { isOwned, ownedIds } = await freshTracker()
    expect(ownedIds.value.size).toBe(0)
    expect(isOwned('a1-001')).toBe(false)
  })

  it('loads cards persisted in localStorage on init', async () => {
    const { isOwned } = await freshTracker(['a1-001', 'a1-002'])
    expect(isOwned('a1-001')).toBe(true)
    expect(isOwned('a1-002')).toBe(true)
    expect(isOwned('a1-003')).toBe(false)
  })

  it('toggle adds a card that is not owned', async () => {
    const { toggle, isOwned } = await freshTracker()
    toggle('a1-001')
    expect(isOwned('a1-001')).toBe(true)
  })

  it('toggle removes a card that is already owned', async () => {
    const { toggle, isOwned } = await freshTracker()
    toggle('a1-001')
    toggle('a1-001')
    expect(isOwned('a1-001')).toBe(false)
  })

  it('toggle on one card does not affect other cards', async () => {
    const { toggle, setOwned, isOwned } = await freshTracker()
    setOwned('a1-001', true)
    setOwned('a1-002', true)
    toggle('a1-001')
    expect(isOwned('a1-001')).toBe(false)
    expect(isOwned('a1-002')).toBe(true)
  })

  it('setOwned(id, true) marks the card as owned', async () => {
    const { setOwned, isOwned } = await freshTracker()
    setOwned('a1-001', true)
    expect(isOwned('a1-001')).toBe(true)
  })

  it('setOwned(id, false) marks the card as not owned', async () => {
    const { toggle, setOwned, isOwned } = await freshTracker()
    toggle('a1-001')
    setOwned('a1-001', false)
    expect(isOwned('a1-001')).toBe(false)
  })

  it('setOwned is a no-op when already in target state', async () => {
    const { setOwned, ownedIds } = await freshTracker()
    setOwned('a1-001', true)
    setOwned('a1-001', true)
    expect(ownedIds.value.size).toBe(1)
  })

  it('multiple independent cards can be owned simultaneously', async () => {
    const { toggle, isOwned, ownedIds } = await freshTracker()
    toggle('a1-001')
    toggle('a1-002')
    toggle('a1-003')
    expect(ownedIds.value.size).toBe(3)
    expect(isOwned('a1-001')).toBe(true)
    expect(isOwned('a1-002')).toBe(true)
    expect(isOwned('a1-003')).toBe(true)
    expect(isOwned('a1-004')).toBe(false)
  })
})

// ── Performance ───────────────────────────────────────────────────────────────

describe('useTracker — performance', () => {
  it('marks a card owned in under 100ms with 1000 pre-existing cards', async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `a1-${String(i + 1).padStart(3, '0')}`)
    const { toggle, isOwned } = await freshTracker(ids)

    const start = performance.now()
    toggle('new-card-9999')
    const elapsed = performance.now() - start

    expect(isOwned('new-card-9999')).toBe(true)
    expect(elapsed).toBeLessThan(100)
  })

  it('un-marks a card in under 100ms with 1000 pre-existing cards', async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `a1-${String(i + 1).padStart(3, '0')}`)
    const { toggle, isOwned } = await freshTracker(ids)

    const start = performance.now()
    toggle('a1-001')
    const elapsed = performance.now() - start

    expect(isOwned('a1-001')).toBe(false)
    expect(elapsed).toBeLessThan(100)
  })

  it('100 rapid sequential toggles with 1000 existing cards complete under 200ms total', async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `a1-${String(i + 1).padStart(3, '0')}`)
    const { toggle, ownedIds } = await freshTracker(ids)
    const extras = Array.from({ length: 100 }, (_, i) => `extra-${i}`)

    const start = performance.now()
    extras.forEach(id => toggle(id))
    const elapsed = performance.now() - start

    expect(ownedIds.value.size).toBe(1100)
    expect(elapsed).toBeLessThan(200)
  })
})
