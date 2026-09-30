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
// Track record: the B4 and B4a estimates previously kept here matched the
// rates upstream later shipped exactly (B4a IM differed only by 3-decimal
// rounding, 4.167 vs 4.166).
//
// ---------------------------------------------------------------------------
// B4b "Deluxe Pack: Mega" (released 2026-09-30, 429 cards, 1 pack)
//
// A Deluxe pack, not a regular booster: the only precedent is A4b "Deluxe
// Pack: ex", so the B-series slot tables do NOT apply. B4b has the same shape
// as A4b — 4-card Regular Pack, every C/U/R printed both plain and foil, an
// all-RR 4th slot, no Regular Pack +1 — with near-identical pool sizes:
//
//              C   CF   U   UF   R  RF  RR  AR  SR  IM  SSR  UR
//      A4b    64   64  50   50  25  25  75   6  16   1    2   1
//      B4b    71   71  65   65  30  30  70   6  16   1    2   2
//
// 1. Regular Pack is copied from A4b, with one adjustment. In A4b's 3rd slot,
//    CF and UF have the SAME per-card weight (23.021/64 = 17.985/50 = 0.35970),
//    as do R and RF (0.81318). So foil C+U is one tier (41.006%) split evenly
//    per card, not two fixed rarity rates. Re-splitting that tier over B4b's
//    71 CF / 65 UF gives CF 21.408 / UF 19.598. R/RF stay 20.3295 each (the
//    30/30 split is still even). Every other rarity keeps its A4b total — the
//    same convention regular sets follow, where slot rates are fixed per
//    rarity regardless of pool size.
//
// 2. Rare Pack rates are a uniform draw over the set's rare pool (A4b's
//    3.846 = 1/26 per card confirms it holds for Deluxe too).
//
//    B4b rare pool: AR 6 | SR 16 | IM 1 | SSR 2 | UR 2  ->  total 27
//      AR 6/27 = 22.222%  SR 16/27 = 59.259%  IM 1/27 = 3.704%
//      SSR 2/27 = 7.407%  UR 2/27 = 7.407%
//
// Caveat: B4b has 2 URs where A4b had 1. Keeping the UR slot-3 total at 0.198
// halves each UR's regular-pack rate; if the game instead fixes per-card
// weights, each UR's rate here is ~50% too low. That is the least certain part
// of this table.
// ---------------------------------------------------------------------------

const B4B_RARE_SLOT = { AR: 22.222, SR: 59.259, IM: 3.704, SSR: 7.407, UR: 7.407 }

export const ESTIMATED_PULL_RATES = {
  B4b: {
    'Regular Pack': {
      appearance_rate: 99.95,
      cards: 4,
      slots: {
        1: { C: 100 },
        2: { C: 17.73, U: 82.27 },
        3: {
          UR: 0.198, SSR: 1.667, IM: 1.111, SR: 2.5, AR: 12.858,
          R: 20.3295, RF: 20.3295, UF: 19.598, CF: 21.408,
        },
        4: { RR: 100 },
      },
    },
    'Rare Pack': {
      appearance_rate: 0.05,
      cards: 5,
      slots: {
        1: { ...B4B_RARE_SLOT },
        2: { ...B4B_RARE_SLOT },
        3: { ...B4B_RARE_SLOT },
        4: { ...B4B_RARE_SLOT },
        5: { ...B4B_RARE_SLOT },
      },
    },
  },
}
