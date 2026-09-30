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
// Built from screenshots of the in-game "Offering Rates" screen. Most of it is
// READ directly; what had to be GUESSED is marked per line below. The screen
// truncates to 3 decimals (82.27/65 = 1.2657 shows as 1.265), so a displayed
// 0.301 means [0.301, 0.302).
//
//   Pack selection (read): Regular 98.283%, Regular +1 card 1.666%, Rare 0.050%
//
// Same 4-card shape as A4b "Deluxe Pack: ex" — cards 1-2 plain C/U, card 3 the
// hit slot, card 4 an ex slot — with the +1 pack adding a 5th card.
//
// SR is split into two pools (ESTIMATED_POOL_SPLITS): 'SRex' for the 12 Mega
// ex SRs and 'SR' for the 4 trainer SRs, because card 4 draws only the former
// (its SR 0.375% = 12 x 0.03125%, Mega Venusaur ex 0.031%). Every RR, UR, IM
// and SSR in B4b is an ex.
//
// Card 3 (read in part): UR 0.158 (0.079 each), IM 0.889, SR 2.125. Mega
// Venusaur ex is 0.125%, so 12 SR ex = 1.5 and the 4 trainer SRs share 0.625
// (0.15625 each — exactly A4b's per-card SR rate). Foil Rookidee shows 0.301%:
// A4b's foil C+U tier (41.006%, one per-card weight for CF and UF alike)
// spread over B4b's 136 foil C/U gives 0.3015 — consistent, so it is used.
// The rest of card 3 was not captured: AR, R and RF split the remaining
// 55.822% in A4b's card-3 proportions (guessed).
//
// Cards 1-2 (read): identical to A4b. Card 1 is 71 plain C at 1.408% each;
// card 2 is C 17.73% (0.249% each) / U 82.27% (1.265% each), no foils.
//
// Rare pack (read): cards 1-3 are a uniform 4% draw over AR 6 + SR 16 + IM 1
// + UR 2 (no SSR); card 4 is 6.666% each over the 15 ex rares.
// ---------------------------------------------------------------------------

const B4B_CARDS_1_TO_4 = {
  1: { C: 100 }, // read
  2: { C: 17.73, U: 82.27 }, // read
  3: {
    UR: 0.158, IM: 0.889, SRex: 1.5, SR: 0.625, // read
    CF: 21.408, UF: 19.598, // read: 0.301% per card shown (71 CF, 65 UF)
    AR: 13.412, R: 21.205, RF: 21.205, // guessed
  },
  4: { UR: 0.04, IM: 0.222, SRex: 0.375, RR: 99.363 }, // read
}

// read: 4% per card over AR 6 + SR 4 + SRex 12 + IM 1 + UR 2.
const B4B_RARE_CARDS_1_TO_3 = { AR: 24, SR: 16, SRex: 48, IM: 4, UR: 8 }

export const ESTIMATED_PULL_RATES = {
  B4b: {
    'Regular Pack': {
      appearance_rate: 98.283,
      cards: 4,
      slots: { ...B4B_CARDS_1_TO_4 },
    },
    'Rare Pack': {
      appearance_rate: 0.05,
      cards: 4,
      slots: {
        1: { ...B4B_RARE_CARDS_1_TO_3 },
        2: { ...B4B_RARE_CARDS_1_TO_3 },
        3: { ...B4B_RARE_CARDS_1_TO_3 },
        4: { UR: 13.333, IM: 6.667, SRex: 80 }, // read (IM shows 6.666, truncated)
      },
    },
    'Regular Pack +1': {
      appearance_rate: 1.666,
      cards: 5,
      slots: {
        ...B4B_CARDS_1_TO_4, // read for card 4; cards 1-3 assumed same as Regular
        5: { SSR: 100 }, // read: Dedenne ex / Mega Diancie ex 50% each
      },
    },
  },
}

// Sub-pools for estimated sets whose slots draw only part of a rarity. Return
// a pool key to override the default, or null to keep it.
export const ESTIMATED_POOL_SPLITS = {
  B4b: card => (card.rarity === 'SR' && / ex$/.test(card.name) ? 'SRex' : null),
}
