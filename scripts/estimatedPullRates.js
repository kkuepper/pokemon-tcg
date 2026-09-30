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
// Built from the in-game "Offering Rates" screen, which was only partially
// captured. What is READ from it vs GUESSED is marked per line below.
//
//   Pack selection (read): Regular 98.283%, Regular +1 card 1.666%, Rare 0.050%
//
// Key finding: the 4th card is an ex-only slot. It shows UR 0.040% (Miraidon
// ex / Koraidon ex 0.020% each), IM 0.222% (Mega Charizard X ex) and SR only
// 0.375% = 12 x 0.03125% (Mega Venusaur ex 0.031%) — exactly B4b's 12 SR *ex*
// cards; its 4 trainer SRs are absent. Every RR, UR, IM and SSR in B4b is an
// ex, so the rest of that slot is taken to be RR. SR is therefore split into
// two pools (ESTIMATED_POOL_SPLITS): 'SRex' (12 Mega ex) and 'SR' (4 trainers).
//
// Cards 1-3 share one table that was NOT captured beyond one row: Rookidee
// [parallel foil] 0.301%. The guess: foil C and U at that same per-card weight
// (A4b "Deluxe Pack: ex" gives CF and UF identical per-card weights), and the
// remaining 59.064% split over plain C / U, R / RF, AR and trainer SR in the
// proportions A4b's cards 1-3 use on average. These are the least certain
// numbers here — the tier header rows of that screen would replace them.
//
// Rare pack cards 1-3 (read in part): UR 8% (4% each), IM 4%. That is a
// uniform 4% draw over a 25-card pool = AR 6 + SR 16 + IM 1 + UR 2, i.e. no
// SSR, matching the B-series rule that rare packs carry no shinies.
// ---------------------------------------------------------------------------

const B4B_CARDS_1_TO_3 = {
  CF: 21.371, UF: 19.565, // read: 0.301% per card (71 CF, 65 UF)
  C: 27.361, U: 19.120, R: 4.725, RF: 4.725, AR: 2.988, SR: 0.145, // guessed
}

// read: UR 0.040, IM 0.222, SRex 0.375; RR is the remainder (inferred).
const B4B_CARD_4 = { UR: 0.04, IM: 0.222, SRex: 0.375, RR: 99.363 }

// read: UR 8, IM 4 -> 4% per card over AR 6 + SR 4 + SRex 12 + IM 1 + UR 2.
const B4B_RARE_CARDS_1_TO_3 = { AR: 24, SR: 16, SRex: 48, IM: 4, UR: 8 }

export const ESTIMATED_PULL_RATES = {
  B4b: {
    'Regular Pack': {
      appearance_rate: 98.283,
      cards: 4,
      slots: {
        1: { ...B4B_CARDS_1_TO_3 },
        2: { ...B4B_CARDS_1_TO_3 },
        3: { ...B4B_CARDS_1_TO_3 },
        4: { ...B4B_CARD_4 },
      },
    },
    'Rare Pack': {
      appearance_rate: 0.05,
      // guessed: 4 cards, the last mirroring the regular ex-only 4th card as a
      // uniform draw over the 15 ex rares (UR 2, IM 1, SRex 12).
      cards: 4,
      slots: {
        1: { ...B4B_RARE_CARDS_1_TO_3 },
        2: { ...B4B_RARE_CARDS_1_TO_3 },
        3: { ...B4B_RARE_CARDS_1_TO_3 },
        4: { SRex: 80, IM: 6.667, UR: 13.333 },
      },
    },
    'Regular Pack +1': {
      appearance_rate: 1.666,
      cards: 5,
      slots: {
        1: { ...B4B_CARDS_1_TO_3 },
        2: { ...B4B_CARDS_1_TO_3 },
        3: { ...B4B_CARDS_1_TO_3 },
        4: { ...B4B_CARD_4 },
        // guessed: B-series extra cards are shiny-only and B4b has no S, so
        // the extra card is one of its 2 SSRs.
        5: { SSR: 100 },
      },
    },
  },
}

// Sub-pools for estimated sets whose slots draw only part of a rarity. Return
// a pool key to override the default, or null to keep it.
export const ESTIMATED_POOL_SPLITS = {
  B4b: card => (card.rarity === 'SR' && / ex$/.test(card.name) ? 'SRex' : null),
}
