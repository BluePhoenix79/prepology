/**
 * Estimated section-score trend over time, derived from solve history.
 *
 * Each point is a rolling estimate: the trailing `window` solves for that
 * section as of that day, weighted by difficulty so clearing hard questions
 * moves the estimate more than clearing easy ones. Pure functions — the chart
 * only renders what this returns.
 */

import type { Section, UserStats } from '../types';

export interface TrendPoint {
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  timestamp: number;
  score: number;
  solves: number;
}

export interface SectionTrend {
  section: Section;
  points: TrendPoint[];
  latest: number | null;
  change: number | null;
  /** Linear extrapolation of the recent slope, clamped to the scale. */
  projection: number | null;
}

const MIN_SCORE = 200;
const MAX_SCORE = 800;
/** Solves considered by each rolling estimate. */
export const WINDOW = 25;
/** Points needed before an estimate is shown at all. */
export const MIN_SOLVES = 5;

function weight(difficulty: number): number {
  return difficulty === 3 ? 2 : difficulty === 2 ? 1.5 : 1;
}

function toDay(ts: number): string {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Weighted accuracy of a set of solves mapped onto the 200-800 scale. */
export function estimateScore(solves: Array<{ correct: boolean; difficulty: number }>): number {
  if (solves.length === 0) return MIN_SCORE;
  let total = 0;
  let earned = 0;
  for (const s of solves) {
    const w = weight(s.difficulty);
    total += w;
    if (s.correct) earned += w;
  }
  const ratio = total > 0 ? earned / total : 0;
  const raw = MIN_SCORE + ratio * (MAX_SCORE - MIN_SCORE);
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(raw / 10) * 10));
}

/**
 * Least-squares slope per day over the last `n` points, extrapolated
 * `daysAhead` beyond the final point.
 */
function project(points: TrendPoint[], n = 6, daysAhead = 14): number | null {
  const tail = points.slice(-n);
  if (tail.length < 3) return null;
  const t0 = tail[0].timestamp;
  const DAY = 86400000;
  const xs = tail.map(p => (p.timestamp - t0) / DAY);
  const ys = tail.map(p => p.score);
  const n2 = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n2;
  const my = ys.reduce((a, b) => a + b, 0) / n2;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n2; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  const lastX = xs[n2 - 1];
  const predicted = my + slope * (lastX + daysAhead - mx);
  return Math.min(MAX_SCORE, Math.max(MIN_SCORE, Math.round(predicted / 10) * 10));
}

export function buildTrend(stats: UserStats, section: Section): SectionTrend {
  const history = (stats.solveHistory || [])
    .filter(h => h.section === section)
    .sort((a, b) => a.timestamp - b.timestamp);

  const points: TrendPoint[] = [];
  const seenDays = new Map<string, number>(); // day -> index into points

  for (let i = 0; i < history.length; i++) {
    if (i + 1 < MIN_SOLVES) continue;
    const windowSolves = history.slice(Math.max(0, i + 1 - WINDOW), i + 1);
    const day = toDay(history[i].timestamp);
    const point: TrendPoint = {
      day,
      timestamp: history[i].timestamp,
      score: estimateScore(windowSolves),
      solves: windowSolves.length,
    };
    // One point per day — the last estimate of that day wins.
    const existing = seenDays.get(day);
    if (existing !== undefined) points[existing] = point;
    else {
      seenDays.set(day, points.length);
      points.push(point);
    }
  }

  const latest = points.length ? points[points.length - 1].score : null;
  const first = points.length ? points[0].score : null;
  return {
    section,
    points,
    latest,
    change: latest !== null && first !== null ? latest - first : null,
    projection: project(points),
  };
}

export function buildTrends(stats: UserStats): SectionTrend[] {
  return (['Reading and Writing', 'Math'] as Section[]).map(s => buildTrend(stats, s));
}

/** Combined estimate, only meaningful once both sections have data. */
export function combinedLatest(trends: SectionTrend[]): number | null {
  const values = trends.map(t => t.latest).filter((v): v is number => v !== null);
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0);
}
