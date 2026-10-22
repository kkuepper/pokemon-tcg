import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { CONSENT_COOKIE, CONSENT_VALUE } from '../analytics'

// ── External dependency mocks ─────────────────────────────────────────────────

const { getDocMock, authUser } = vi.hoisted(() => ({
  getDocMock: vi.fn().mockResolvedValue({ exists: () => false }),
  authUser: { current: null as { value: { uid: string } | null } | null },
}))

vi.mock('../firebase', () => ({ db: {} }))

vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  getDoc: getDocMock,
  setDoc: vi.fn().mockResolvedValue(undefined),
  serverTimestamp: vi.fn(() => null),
}))

vi.mock('./useAuth', async () => {
  const { ref } = await import('vue')
  const user = ref<{ uid: string } | null>(null)
  authUser.current = user
  return { useAuth: () => ({ user }) }
})

// ── localStorage stub (Node has no DOM) ───────────────────────────────────────

const lsStore: Record<string, string> = {}
function installLocalStorage() {
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => lsStore[k] ?? null,
    setItem: (k: string, v: string) => { lsStore[k] = v },
    removeItem: (k: string) => { delete lsStore[k] },
  })
}
installLocalStorage()

// ── Helper: fresh singleton per test ─────────────────────────────────────────
// useTracker reads localStorage at module init time, so we seed ls before import.

const STORAGE_KEY = 'ptcgp-tracker-owned'

async function freshTracker(preOwned: string[] = []) {
  delete lsStore[STORAGE_KEY]
  if (preOwned.length) lsStore[STORAGE_KEY] = JSON.stringify(preOwned)
  vi.resetModules()
  const mod = await import('./useTracker')
  return Object.assign(mod.useTracker(), {
    holdCardTrackedFlush: mod.holdCardTrackedFlush,
    releaseCardTrackedFlush: mod.releaseCardTrackedFlush,
  })
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

// ── Anonymous card_tracked events ─────────────────────────────────────────────

const REPORTED_KEY = 'ptcgp-tracked-reported'
const PENDING_KEY = 'ptcgp-tracked-pending'
const SAVE_DEBOUNCE_MS = 300

type ListenerMap = Record<string, Array<() => void>>

describe('useTracker — card_tracked', () => {
  // Earlier tests schedule the real 300ms save. Let those finish before this
  // file stubs window, or a late save could touch the analytics mock.
  beforeAll(async () => {
    await new Promise((resolve) => setTimeout(resolve, SAVE_DEBOUNCE_MS + 50))
  })

  beforeEach(() => {
    vi.useFakeTimers()
    delete lsStore[REPORTED_KEY]
    delete lsStore[PENDING_KEY]
    delete lsStore[STORAGE_KEY]
    getDocMock.mockReset()
    getDocMock.mockResolvedValue({ exists: () => false })
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.useRealTimers()
    vi.unstubAllGlobals()
    installLocalStorage()
  })

  function stubDocument(cookie: string) {
    // Vue reads document while the module is loading. A cookie-only stub throws.
    const doc = {
      cookie,
      visibilityState: 'visible' as DocumentVisibilityState,
      createElement: () => ({}),
    }
    vi.stubGlobal('document', doc)
    return doc
  }

  function stubWindow(palmeta?: (...args: unknown[]) => void) {
    const listeners: ListenerMap = {}
    const win: Record<string, unknown> = {
      addEventListener(type: string, fn: () => void) {
        ;(listeners[type] ??= []).push(fn)
      },
      removeEventListener(type: string, fn: () => void) {
        const list = listeners[type]
        if (!list) return
        const index = list.indexOf(fn)
        if (index >= 0) list.splice(index, 1)
      },
    }
    if (palmeta) win.palmetaAnalytics = palmeta
    vi.stubGlobal('window', win)
    return { listeners, win }
  }

  function grantConsent(palmeta?: (...args: unknown[]) => void) {
    const installed = stubWindow(palmeta)
    stubDocument(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
    return installed
  }

  function fire(listeners: ListenerMap, type: string) {
    for (const fn of listeners[type] ?? []) fn()
  }

  it('counts a single tap once the save debounce flushes', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    const { toggle, isOwned } = await freshTracker()

    toggle('a1-001')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS - 1)
    expect(palmeta).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(isOwned('a1-001')).toBe(true)
    expect(palmeta).toHaveBeenCalledTimes(1)
    expect(palmeta).toHaveBeenCalledWith('event', { name: 'card_tracked', count: 1 })
    expect(JSON.parse(lsStore[REPORTED_KEY])).toEqual(['a1-001'])
  })

  it('ignores untracking, including a track that is undone before the debounce', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    const { toggle, setOwned } = await freshTracker(['a1-001'])

    toggle('a1-001')
    setOwned('a1-002', false)
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(palmeta).not.toHaveBeenCalled()

    toggle('a1-003')
    setOwned('a1-003', false)
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(palmeta).not.toHaveBeenCalled()
    expect(lsStore[REPORTED_KEY]).toBeUndefined()
  })

  it('drops cards a drag puts back before the debounce fires', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    const { setOwned, isOwned } = await freshTracker()

    setOwned('a1-001', true)
    setOwned('a1-002', true)
    setOwned('a1-003', true)
    await vi.advanceTimersByTimeAsync(200)
    setOwned('a1-001', false)
    setOwned('a1-002', false)
    expect(palmeta).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(isOwned('a1-001')).toBe(false)
    expect(isOwned('a1-002')).toBe(false)
    expect(isOwned('a1-003')).toBe(true)
    expect(palmeta).toHaveBeenCalledTimes(1)
    expect(palmeta).toHaveBeenCalledWith('event', { name: 'card_tracked', count: 1 })
    expect(JSON.parse(lsStore[REPORTED_KEY])).toEqual(['a1-003'])
  })

  it('skips cards this browser already reported, including after a reload', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    const first = await freshTracker()
    first.toggle('a1-001')
    first.setOwned('a1-002', true)
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(palmeta).toHaveBeenCalledTimes(1)
    expect(palmeta).toHaveBeenCalledWith('event', { name: 'card_tracked', count: 2 })

    palmeta.mockClear()
    vi.clearAllTimers()
    const second = await freshTracker()
    second.toggle('a1-001')
    second.setOwned('a1-003', true)
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(palmeta).toHaveBeenCalledTimes(1)
    expect(palmeta).toHaveBeenCalledWith('event', { name: 'card_tracked', count: 1 })
    expect(JSON.parse(lsStore[REPORTED_KEY])).toEqual(expect.arrayContaining(['a1-001', 'a1-002', 'a1-003']))
  })

  it('ignores cards loaded from the Firestore copy at sign-in', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ cardIds: ['remote-1', 'remote-2'] }),
    })
    const { isOwned } = await freshTracker(['local-1'])
    expect(authUser.current).toBeTruthy()

    authUser.current!.value = { uid: 'user-1' }
    for (let i = 0; i < 20; i++) await Promise.resolve()
    expect(isOwned('local-1')).toBe(true)
    expect(isOwned('remote-1')).toBe(true)
    expect(isOwned('remote-2')).toBe(true)

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(palmeta).not.toHaveBeenCalled()
    expect(lsStore[REPORTED_KEY]).toBeUndefined()
  })

  it('does not throw when palmetaAnalytics is missing', async () => {
    grantConsent()
    const { toggle, isOwned } = await freshTracker()

    expect(() => toggle('a1-001')).not.toThrow()
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(isOwned('a1-001')).toBe(true)
    expect(lsStore[REPORTED_KEY]).toBeUndefined()
  })

  it('splits a count above 50 so the extra carries over', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    const { setOwned } = await freshTracker()
    for (let i = 0; i < 51; i++) setOwned(`card-${i}`, true)

    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(palmeta).toHaveBeenCalledTimes(2)
    expect(palmeta).toHaveBeenNthCalledWith(1, 'event', { name: 'card_tracked', count: 50 })
    expect(palmeta).toHaveBeenNthCalledWith(2, 'event', { name: 'card_tracked', count: 1 })
    expect(JSON.parse(lsStore[REPORTED_KEY])).toHaveLength(51)
  })

  it('sends nothing when analytics consent is off', async () => {
    const palmeta = vi.fn()
    stubWindow(palmeta)
    stubDocument('')
    const { toggle } = await freshTracker()

    toggle('a1-001')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(palmeta).not.toHaveBeenCalled()
    expect(lsStore[REPORTED_KEY]).toBeUndefined()
  })

  it('does not count a touch that is still provisional, including a scroll that puts it back', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    const { setOwned, holdCardTrackedFlush, releaseCardTrackedFlush, isOwned } = await freshTracker()

    holdCardTrackedFlush()
    setOwned('a1-001', true)
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS + 50)
    expect(palmeta).not.toHaveBeenCalled()
    expect(isOwned('a1-001')).toBe(true)

    setOwned('a1-001', false)
    releaseCardTrackedFlush()
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(isOwned('a1-001')).toBe(false)
    expect(palmeta).not.toHaveBeenCalled()
    expect(lsStore[REPORTED_KEY]).toBeUndefined()
    expect(lsStore[PENDING_KEY]).toBeUndefined()
  })

  it('counts a touch once the gesture is released and the card stays tracked', async () => {
    const palmeta = vi.fn()
    grantConsent(palmeta)
    const { setOwned, holdCardTrackedFlush, releaseCardTrackedFlush } = await freshTracker()

    holdCardTrackedFlush()
    setOwned('a1-001', true)
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(palmeta).not.toHaveBeenCalled()

    releaseCardTrackedFlush()
    expect(palmeta).toHaveBeenCalledTimes(1)
    expect(palmeta).toHaveBeenCalledWith('event', { name: 'card_tracked', count: 1 })
  })

  it('flushes on pagehide and when the page is hidden, and does not send twice', async () => {
    const palmeta = vi.fn()
    const { listeners } = grantConsent(palmeta)
    const doc = stubDocument(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
    const { toggle } = await freshTracker()

    toggle('a1-001')
    await vi.advanceTimersByTimeAsync(100)
    expect(palmeta).not.toHaveBeenCalled()

    doc.visibilityState = 'hidden'
    fire(listeners, 'visibilitychange')
    expect(palmeta).toHaveBeenCalledTimes(1)
    expect(palmeta).toHaveBeenCalledWith('event', { name: 'card_tracked', count: 1 })

    fire(listeners, 'pagehide')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)
    expect(palmeta).toHaveBeenCalledTimes(1)
  })

  it('keeps ids pending while the queue stub is installed, then sends them once a.js has replaced it', async () => {
    const queued: unknown[] = []
    function palmetaStub(name: unknown, value: unknown) {
      queued.push([name, value])
    }
    palmetaStub.q = queued
    grantConsent(palmetaStub)
    const first = await freshTracker()
    first.toggle('a1-009')
    await vi.advanceTimersByTimeAsync(SAVE_DEBOUNCE_MS)

    expect(queued).toEqual([])
    expect(lsStore[REPORTED_KEY]).toBeUndefined()
    expect(JSON.parse(lsStore[PENDING_KEY])).toEqual(['a1-009'])

    const loaded = vi.fn()
    const secondWindow = stubWindow(loaded)
    stubDocument(`${CONSENT_COOKIE}=${CONSENT_VALUE}`)
    await freshTracker(['a1-009'])
    fire(secondWindow.listeners, 'pagehide')

    expect(loaded).toHaveBeenCalledTimes(1)
    expect(loaded).toHaveBeenCalledWith('event', { name: 'card_tracked', count: 1 })
    expect(JSON.parse(lsStore[REPORTED_KEY])).toEqual(['a1-009'])
    expect(lsStore[PENDING_KEY]).toBeUndefined()

    fire(secondWindow.listeners, 'pagehide')
    expect(loaded).toHaveBeenCalledTimes(1)
  })
})
