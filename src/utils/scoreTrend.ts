import type { UserStats } from '../types';

export interface ScorePoint {
  timestamp: number;
  dateLabel: string;
  mathScore: number | null;
  rwScore: number | null;
  totalScore: number | null;
  solvesCount: number;
}

export interface ScoreTrendData {
  points: ScorePoint[];
  latestTotal: number | null;
  latestMath: number | null;
  latestRW: number | null;
  totalChange: number | null;
  mathChange: number | null;
  rwChange: number | null;
  projectedTotal: number | null;
  projectedMath: number | null;
  projectedRW: number | null;
  targetScore: number;
  percentile: string;
  totalSolves: number;
}

const MIN_SECTION = 200;
const MAX_SECTION = 800;
const DEFAULT_BASELINE = 400; // Baseline for an unpracticed section

export const WINDOW = 20;

function weight(difficulty: number): number {
  return difficulty === 3 ? 2 : difficulty === 2 ? 1.5 : 1;
}

export function estimateSectionScore(solves: Array<{ correct: boolean; difficulty: number }>): number {
  if (solves.length === 0) return DEFAULT_BASELINE;
  let totalWeight = 0;
  let earnedWeight = 0;
  for (const s of solves) {
    const w = weight(s.difficulty);
    totalWeight += w;
    if (s.correct) earnedWeight += w;
  }
  if (totalWeight === 0) return DEFAULT_BASELINE;
  const ratio = earnedWeight / totalWeight;
  // Digital SAT section curve: 200 to 800 scale
  const raw = MIN_SECTION + ratio * (MAX_SECTION - MIN_SECTION);
  return Math.min(MAX_SECTION, Math.max(MIN_SECTION, Math.round(raw / 10) * 10));
}

export function getSatPercentile(score: number): string {
  if (score >= 1550) return '99th+ Percentile (Top 1%)';
  if (score >= 1500) return '98th Percentile (Top 2%)';
  if (score >= 1450) return '96th Percentile (Top 4%)';
  if (score >= 1400) return '93rd Percentile (Top 7%)';
  if (score >= 1350) return '89th Percentile';
  if (score >= 1300) return '85th Percentile';
  if (score >= 1200) return '75th Percentile';
  if (score >= 1100) return '61st Percentile';
  if (score >= 1000) return '45th Percentile';
  return 'Emerging Tier';
}

function projectSeries(ys: number[], daysAhead = 14): number | null {
  if (ys.length < 3) return null;
  const n = ys.length;
  const xs = ys.map((_, i) => i);
  const mx = (n - 1) / 2;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  const slope = num / den;
  // Project ahead proportional to data length
  const nextIdx = n - 1 + Math.min(3, Math.max(1, Math.round(daysAhead / 7)));
  const predicted = my + slope * (nextIdx - mx);
  return Math.round(predicted / 10) * 10;
}

export function buildScoreTrend(stats: UserStats): ScoreTrendData {
  const history = (stats.solveHistory || []).slice().sort((a, b) => a.timestamp - b.timestamp);
  const targetScore = stats.targetScore || 1500;
  const totalSolves = history.length;

  if (totalSolves < 3) {
    return {
      points: [],
      latestTotal: null,
      latestMath: null,
      latestRW: null,
      totalChange: null,
      mathChange: null,
      rwChange: null,
      projectedTotal: null,
      projectedMath: null,
      projectedRW: null,
      targetScore,
      percentile: '—',
      totalSolves
    };
  }

  // Determine checkpoint frequency
  // If few solves, check every 2-3 solves; if many, check every 5-10 solves or by day
  const checkpointStep = totalSolves <= 15 ? 2 : totalSolves <= 40 ? 4 : Math.max(5, Math.floor(totalSolves / 15));
  
  const checkpoints: number[] = [];
  for (let i = 2; i < totalSolves; i += checkpointStep) {
    checkpoints.push(i);
  }
  if (!checkpoints.includes(totalSolves - 1)) {
    checkpoints.push(totalSolves - 1);
  }

  const points: ScorePoint[] = checkpoints.map(endIdx => {
    const subset = history.slice(0, endIdx + 1);
    const ts = subset[subset.length - 1].timestamp;
    const d = new Date(ts);
    const dateLabel = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    const mathSolves = subset.filter(h => h.section === 'Math').slice(-WINDOW);
    const rwSolves = subset.filter(h => h.section === 'Reading and Writing').slice(-WINDOW);

    const mathScore = mathSolves.length >= 2 ? estimateSectionScore(mathSolves) : null;
    const rwScore = rwSolves.length >= 2 ? estimateSectionScore(rwSolves) : null;

    let totalScore: number | null = null;
    if (mathScore !== null && rwScore !== null) {
      totalScore = mathScore + rwScore;
    } else if (mathScore !== null) {
      totalScore = mathScore + DEFAULT_BASELINE;
    } else if (rwScore !== null) {
      totalScore = DEFAULT_BASELINE + rwScore;
    }

    return {
      timestamp: ts,
      dateLabel,
      mathScore,
      rwScore,
      totalScore,
      solvesCount: endIdx + 1
    };
  });

  // Calculate latest and deltas
  const validTotals = points.map(p => p.totalScore).filter((v): v is number => v !== null);
  const validMaths = points.map(p => p.mathScore).filter((v): v is number => v !== null);
  const validRWs = points.map(p => p.rwScore).filter((v): v is number => v !== null);

  const latestTotal = validTotals.length > 0 ? validTotals[validTotals.length - 1] : null;
  const firstTotal = validTotals.length > 0 ? validTotals[0] : null;
  const totalChange = latestTotal !== null && firstTotal !== null ? latestTotal - firstTotal : null;

  const latestMath = validMaths.length > 0 ? validMaths[validMaths.length - 1] : null;
  const firstMath = validMaths.length > 0 ? validMaths[0] : null;
  const mathChange = latestMath !== null && firstMath !== null ? latestMath - firstMath : null;

  const latestRW = validRWs.length > 0 ? validRWs[validRWs.length - 1] : null;
  const firstRW = validRWs.length > 0 ? validRWs[0] : null;
  const rwChange = latestRW !== null && firstRW !== null ? latestRW - firstRW : null;

  const projectedTotalRaw = projectSeries(validTotals);
  const projectedTotal = projectedTotalRaw !== null ? Math.min(1600, Math.max(400, projectedTotalRaw)) : null;

  const projectedMathRaw = projectSeries(validMaths);
  const projectedMath = projectedMathRaw !== null ? Math.min(800, Math.max(200, projectedMathRaw)) : null;

  const projectedRWRaw = projectSeries(validRWs);
  const projectedRW = projectedRWRaw !== null ? Math.min(800, Math.max(200, projectedRWRaw)) : null;

  const percentile = latestTotal ? getSatPercentile(latestTotal) : '—';

  return {
    points,
    latestTotal,
    latestMath,
    latestRW,
    totalChange,
    mathChange,
    rwChange,
    projectedTotal,
    projectedMath,
    projectedRW,
    targetScore,
    percentile,
    totalSolves
  };
}
