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
}

export interface MetaDecksPayload {
  game: string
  fetchedAt: string
  tournamentCount: number
  totalDeckEntries: number
  source?: string
  docs?: string
  error?: string
  decks: MetaDeck[]
}
