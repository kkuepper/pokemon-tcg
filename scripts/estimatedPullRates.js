// Stopgap pull rate tables for sets that ship in pokemon-tcg-pocket-database
// *before* their pull rate data does. Upstream publishes the card list at set
// announcement and pullRates.json only once the pack goes live, so a brand-new
// set would otherwise be dropped entirely by buildCardDb.js.
//
// buildCardDb.js prefers upstream `pullRates.json` and only falls back to this
// file. Cards priced from here are flagged `ratesEstimated: true` so the UI can
// label them. DELETE a set's entry once upstream ships its real rates — the
// build warns while any entry is still in use.
//
// ---------------------------------------------------------------------------
// B4 "Rulers of the Skies" (released 2026-07-30, 233 cards, 1 pack)
//
// Not a guess — both halves of the table are pinned by the existing data:
//
// 1. Regular Pack / Regular Pack +1 are BYTE-IDENTICAL across every B-series
//    *main* set (B1, B2, B3 verified equal field-for-field). The mini-sets
//    (B1a, B2a, B2b, B3a, B3b) use different slot 4/5 weights, but B4 is a main
//    set — 233 cards and a rarity profile matching B2/B3 almost exactly
//    (B2: C66 U51 R28 RR10 AR24 SR14 SAR9 IM2 S20 SSR8 UR2)
//    (B4: C66 U51 R28 RR10 AR24 SR14 SAR8 IM2 S20 SSR8 UR2)
//    so the B-series main-set table is copied verbatim from B2/B3.
//
// 2. Rare Pack ("god pack") rates are a uniform draw over the set's own rare
//    pool, so they are *derived*, not copied. Verified as exact (<0.0005, i.e.
//    upstream's 3-decimal rounding) for 15 of 19 sets; the four exceptions are
//    known upstream quirks, not counterexamples — B2b's gap is precisely the
//    slot-6-only Mew already handled by CARD_OVERRIDES in buildCardDb.js.
//
//    B4 rare pool (SAR folds into the SR pool, matching poolKey()):
//      AR 24 | SR 14+8 SAR = 22 | IM 2 | UR 2  →  total 50
//      AR 24/50 = 48%   SR 22/50 = 44%   IM 2/50 = 4%   UR 2/50 = 4%
//
// Caveat: B2b introduced a 0.005% "Themed Rare Pack" that shaved Regular Pack
// from 94.711% to 94.706%. Whether B4 has one is unknowable ahead of release,
// so none is assumed — if it does, per-pack rates here run ~0.005% high.
// ---------------------------------------------------------------------------

// Shared by Regular Pack and Regular Pack +1 (slots 1-5 are the same table).
const B_MAIN_SLOTS_1_TO_5 = {
  1: { C: 100 },
  2: { C: 100 },
  3: { C: 100 },
  4: { UR: 0.04, IM: 0.222, SR: 0.5, AR: 2.572, RR: 1.667, R: 5, U: 89.999 },
  5: { UR: 0.16, IM: 0.889, SR: 2, AR: 10.286, RR: 6.667, R: 20, U: 59.998 },
}

const B4_RARE_SLOT = { AR: 48, SR: 44, IM: 4, UR: 4 }

export const ESTIMATED_PULL_RATES = {
  B4: {
    'Regular Pack': {
      appearance_rate: 94.711,
      cards: 5,
      slots: { ...B_MAIN_SLOTS_1_TO_5 },
    },
    'Rare Pack': {
      appearance_rate: 0.05,
      cards: 5,
      slots: {
        1: { ...B4_RARE_SLOT },
        2: { ...B4_RARE_SLOT },
        3: { ...B4_RARE_SLOT },
        4: { ...B4_RARE_SLOT },
        5: { ...B4_RARE_SLOT },
      },
    },
    'Regular Pack +1': {
      appearance_rate: 5.238,
      cards: 6,
      slots: {
        ...B_MAIN_SLOTS_1_TO_5,
        // Shiny slot: the 6th card is always S or SSR.
        6: { SSR: 31.82, S: 68.18 },
      },
    },
  },
}
