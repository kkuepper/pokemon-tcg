# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Build card DB + start Vite dev server
npm run build        # Type-check (vue-tsc) + Vite build (runs prebuild automatically)
npm run test         # Run Vitest once
npm run test:watch   # Run Vitest in watch mode
npm run preview      # Preview production build locally
```

To run a single test file:
```bash
npx vitest run src/utils/odds.test.ts
```

There is no linter configured — TypeScript strict mode via `vue-tsc` is the code quality gate.

## Architecture

**Vue 3 SPA** deployed to GitHub Pages at `/pokemon-tcg/`.

### Data pipeline

At build time, `scripts/buildCardDb.js` reads card data from the `pokemon-tcg-pocket-database` npm package and computes per-card pull rates (accounting for slots 4/5, foil pools, and the 0.05% god pack). Output: `public/cards.json`.

At runtime, `src/composables/useCardDb.ts` fetches `cards.json` once (singleton pattern — subsequent calls return the same reactive state), builds a Fuse.js search index, and exposes reactive filters (set/pack/rarity).

### Component layout

`App.vue` is the shell: 3-column grid with `CardSearch` (left, sticky), `CardDetail` + `PackOdds` (center), and `MultiPackSimulator` + `CompleteThePack` (right). It owns `selectedCard` state and syncs it bidirectionally with the URL slug (`/{card-name}-{card-id}`).

### Probability math

`src/utils/odds.ts` — `atLeastOneIn(rate, n)` and `packsForProbability(rate, target)` (binary search). These are pure functions with unit tests. `CompleteThePack.vue` extends the logic to compute packs needed to collect all cards in a pack via ∏(1 - (1-rate)^n).

### Key types

`src/types/card.ts` defines the `Card` interface with precomputed fields: `slot4Rate`, `slot5Rate`, `perPackRate`, `rarePackContrib`. These are computed at build time, not at runtime.

### URL routing

Single catch-all route `/:slug?`. Slug format: `{kebab-card-name}-{card-id}` (e.g., `charizard-ex-a1-025`). Slug conversion helpers live in `App.vue`.

### Analytics

PostHog is initialized in `main.ts`. Tracking calls are scattered across `CardSearch.vue` and `MultiPackSimulator.vue` — check existing event names before adding new ones.

## Deployment

GitHub Actions (`.github/workflows/deploy.yml`) runs `npm test` then `npm run build` on every push to `main`, then deploys to GitHub Pages.
