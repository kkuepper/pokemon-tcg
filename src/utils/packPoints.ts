import type { CardRarity } from '../types/card'

export const PACK_POINTS_PER_PACK = 5

export const PACK_POINT_COST: Record<CardRarity, number> = {
  C:   35,
  U:   70,
  R:   150,
  RR:  400,
  AR:  500,
  SR:  1250,
  SAR: 1500,
  IM:  2500,
  UR:  2500,
  S:   1250,
  SSR: 2500,
}
