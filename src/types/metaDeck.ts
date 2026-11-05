export interface MetaCardRef {
  name: string
  cardId?: string
  imageSet?: string
  imageNum?: number
}

export interface MetaDeckOtherCard extends MetaCardRef {
  category: string
  listRate: number
  avgCount: number
}

export interface MetaMatchupRow {
  opponentId: string
  opponentName: string
  wins: number
  losses: number
  ties: number
  games: number
  winRate: number
}

export interface MetaDeckMatchups {
  hasData: boolean
  favorable: MetaMatchupRow[]
  unfavorable: MetaMatchupRow[]
}

export interface MetaDeck {
  id: string
  name: string
  icons: string[]
  highlightCards: MetaCardRef[]
  otherCards: MetaDeckOtherCard[]
  playShare: number | null
  winRate: number | null
  wins: number
  losses: number
  ties: number
  games: number
  deckEntries: number
  consistencyScore: number | null
  brickRiskScore: number | null
  consistencySample: number
  matchups: MetaDeckMatchups
  meetsSampleGate: boolean
}

export interface MetaDecksPayload {
  game: string
  fetchedAt: string
  tournamentCount: number
  sampleWindowDays?: number
  sampleWindowStart?: string
  rankMinGames?: number
  rankMinEntries?: number
  totalDeckEntries: number
  totalMatches?: number
  refreshFailedAt?: string
  source?: string
  docs?: string
  error?: string
  decks: MetaDeck[]
}
