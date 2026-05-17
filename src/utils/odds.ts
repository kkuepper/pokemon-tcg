/**
 * P(at least one copy of the card in n independent pack openings)
 * @param perPackRate - probability per pack [0, 1]
 * @param n - number of packs
 */
export function atLeastOneIn(perPackRate: number, n: number): number {
  if (perPackRate <= 0) return 0
  if (perPackRate >= 1) return 1
  return 1 - Math.pow(1 - perPackRate, n)
}

/**
 * How many packs needed to reach at least targetProb probability.
 * @param perPackRate - probability per pack [0, 1]
 * @param targetProb - desired cumulative probability [0, 1]
 */
export function packsForProbability(perPackRate: number, targetProb: number): number {
  if (perPackRate <= 0) return Infinity
  if (perPackRate >= 1) return 1
  if (targetProb <= 0) return 0
  if (targetProb >= 1) return Infinity
  return Math.ceil(Math.log(1 - targetProb) / Math.log(1 - perPackRate))
}

/**
 * Format a probability [0, 1] as a percentage string with appropriate precision.
 * Very small numbers get more decimal places so they don't show as 0.00%.
 */
export function formatPct(prob: number): string {
  const pct = prob * 100
  if (pct === 0) return '0%'
  if (pct >= 10) return `${pct.toFixed(2)}%`
  if (pct >= 1) return `${pct.toFixed(3)}%`
  if (pct >= 0.1) return `${pct.toFixed(4)}%`
  return `${pct.toFixed(5)}%`
}

/**
 * Format a large number of packs with commas.
 */
export function formatPacks(n: number): string {
  if (!isFinite(n)) return '∞'
  return n.toLocaleString()
}
