/**
 * Full-length adaptive practice test assembly.
 *
 * Mirrors the structure of the digital SAT: each section is two modules, and
 * the second module's difficulty is chosen from how the first one went. All
 * the selection and scoring maths lives here as pure functions so it can be
 * exercised without a DOM.
 *
 * Question counts and domain weights follow College Board's published
 * blueprint for the digital SAT. Scaled scoring is a documented approximation
 * — the real exam uses per-form equating tables that are not public — but it
 * reproduces the important behaviour: the module you are routed into caps and
 * floors what the section can score.
 */

import type { Question, Section } from '../types';

export type Tier = 'routing' | 'lower' | 'upper';

export interface ModulePlan {
  id: string;
  section: Section;
  /** 1 or 2 — which module of the section this is. */
  moduleNumber: 1 | 2;
  tier: Tier;
  questionIds: string[];
  timeLimitSec: number;
  label: string;
}

export interface ExamPlan {
  id: string;
  createdAt: number;
  modules: ModulePlan[];
  /** Index into `modules` of the module currently being taken. */
  currentModule: number;
  /** Per-module results, filled in as modules are submitted. */
  results: Array<{ moduleId: string; correct: number; total: number }>;
  completed: boolean;
}

export interface SectionScore {
  section: Section;
  correct: number;
  total: number;
  tier: Tier;
  scaled: number;
}

/* ── Blueprint ─────────────────────────────────────────────── */

export const MODULE_SPEC = {
  'Reading and Writing': {
    questionsPerModule: 27,
    timeLimitSec: 32 * 60,
    /** Domain quotas per module; sums to questionsPerModule. */
    domains: {
      'Information and Ideas': 7,
      'Craft and Structure': 8,
      'Expression of Ideas': 5,
      'Standard English Conventions': 7,
    } as Record<string, number>,
  },
  Math: {
    questionsPerModule: 22,
    timeLimitSec: 35 * 60,
    domains: {
      Algebra: 8,
      'Advanced Math': 8,
      'Problem-Solving and Data Analysis': 3,
      'Geometry and Trigonometry': 3,
    } as Record<string, number>,
  },
} as const;

export const SECTION_ORDER: Section[] = ['Reading and Writing', 'Math'];

/**
 * Difficulty mix per tier, as weights over [easy, medium, hard].
 * The routing module is deliberately balanced so performance on it
 * discriminates; module 2 then leans easy or hard.
 */
const DIFFICULTY_MIX: Record<Tier, [number, number, number]> = {
  routing: [0.40, 0.40, 0.20],
  lower:   [0.60, 0.35, 0.05],
  upper:   [0.10, 0.40, 0.50],
};

/** Fraction of module 1 a student must get right to be routed upward. */
export const UPPER_ROUTE_THRESHOLD = 0.6;

/* ── Selection ─────────────────────────────────────────────── */

function shuffle<T>(items: T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Split `count` across three difficulties by weight, preserving the total. */
export function difficultySplit(count: number, tier: Tier): [number, number, number] {
  const mix = DIFFICULTY_MIX[tier];
  const raw = mix.map(w => count * w);
  const floored = raw.map(Math.floor) as [number, number, number];
  let remainder = count - floored.reduce((a, b) => a + b, 0);
  // Hand out leftovers to the largest fractional parts first.
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);
  for (const { i } of order) {
    if (remainder <= 0) break;
    floored[i]++;
    remainder--;
  }
  return floored;
}

/**
 * Pick `count` questions from `pool` matching a tier's difficulty mix.
 * Falls back to any remaining difficulty when a bucket runs dry, so the module
 * always reaches its target length rather than silently coming up short.
 */
function pickForDifficultyMix(pool: Question[], count: number, tier: Tier): Question[] {
  const byDifficulty: Record<number, Question[]> = { 1: [], 2: [], 3: [] };
  for (const q of pool) byDifficulty[q.difficulty]?.push(q);
  for (const d of [1, 2, 3]) byDifficulty[d] = shuffle(byDifficulty[d]);

  const wanted = difficultySplit(count, tier);
  const chosen: Question[] = [];
  for (let d = 1; d <= 3; d++) {
    chosen.push(...byDifficulty[d].splice(0, wanted[d - 1]));
  }

  if (chosen.length < count) {
    const leftovers = shuffle([...byDifficulty[1], ...byDifficulty[2], ...byDifficulty[3]]);
    chosen.push(...leftovers.slice(0, count - chosen.length));
  }
  return shuffle(chosen);
}

/**
 * Assemble one module. `excludeIds` keeps a question from appearing twice in
 * the same exam.
 */
export function buildModule(
  bank: Question[],
  section: Section,
  moduleNumber: 1 | 2,
  tier: Tier,
  excludeIds: Set<string> = new Set(),
): ModulePlan {
  const spec = MODULE_SPEC[section];
  const available = bank.filter(q => q.section === section && !excludeIds.has(q.id));

  const questions: Question[] = [];
  for (const [domain, quota] of Object.entries(spec.domains)) {
    const pool = available.filter(
      q => q.domain === domain && !questions.some(c => c.id === q.id),
    );
    questions.push(...pickForDifficultyMix(pool, quota, tier));
  }

  // If some domain was too thin, top up from anything left in the section.
  if (questions.length < spec.questionsPerModule) {
    const used = new Set(questions.map(q => q.id));
    const rest = shuffle(available.filter(q => !used.has(q.id)));
    questions.push(...rest.slice(0, spec.questionsPerModule - questions.length));
  }

  const tierLabel = tier === 'upper' ? ' · harder' : tier === 'lower' ? ' · standard' : '';
  return {
    id: `${section}-${moduleNumber}-${crypto.randomUUID().slice(0, 8)}`,
    section,
    moduleNumber,
    tier,
    questionIds: shuffle(questions).map(q => q.id),
    timeLimitSec: spec.timeLimitSec,
    label: `${section === 'Math' ? 'Math' : 'Reading & Writing'} · Module ${moduleNumber}${tierLabel}`,
  };
}

/**
 * Start a new exam. Only the two routing modules are assembled now — each
 * module 2 is built once its module 1 has been scored, which is what makes
 * the test adaptive.
 */
export function buildExam(bank: Question[]): ExamPlan {
  const used = new Set<string>();
  const modules: ModulePlan[] = [];
  for (const section of SECTION_ORDER) {
    const mod = buildModule(bank, section, 1, 'routing', used);
    mod.questionIds.forEach(id => used.add(id));
    modules.push(mod);
  }
  return {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    modules,
    currentModule: 0,
    results: [],
    completed: false,
  };
}

/** Where a module-1 performance routes the student for module 2. */
export function pickTier(correct: number, total: number): Tier {
  if (total <= 0) return 'lower';
  return correct / total >= UPPER_ROUTE_THRESHOLD ? 'upper' : 'lower';
}

/** All question ids already committed to this exam. */
export function usedIds(plan: ExamPlan): Set<string> {
  return new Set(plan.modules.flatMap(m => m.questionIds));
}

/* ── Scoring ───────────────────────────────────────────────── */

/**
 * Map raw performance onto the 200–800 section scale.
 *
 * Approximation, deliberately: the routed-up path spans 400–800 and the
 * routed-down path 200–600. That reproduces the real exam's defining
 * property — the second module you receive bounds your attainable score —
 * without pretending to reproduce College Board's equating tables.
 */
export function scaleSection(correct: number, total: number, tier: Tier): number {
  if (total <= 0) return 200;
  const ratio = Math.max(0, Math.min(1, correct / total));
  const base = tier === 'upper' ? 400 : 200;
  const raw = base + ratio * 400;
  return Math.min(800, Math.max(200, Math.round(raw / 10) * 10));
}

/** Per-section scores for an exam, using whichever modules have been taken. */
export function scoreExam(plan: ExamPlan): SectionScore[] {
  const byId = new Map(plan.modules.map(m => [m.id, m]));
  const perSection = new Map<Section, { correct: number; total: number; tier: Tier }>();

  for (const result of plan.results) {
    const mod = byId.get(result.moduleId);
    if (!mod) continue;
    const entry = perSection.get(mod.section) || { correct: 0, total: 0, tier: 'lower' as Tier };
    entry.correct += result.correct;
    entry.total += result.total;
    // The module-2 tier is what determines the section's attainable band.
    if (mod.moduleNumber === 2) entry.tier = mod.tier;
    perSection.set(mod.section, entry);
  }

  return SECTION_ORDER.filter(s => perSection.has(s)).map(section => {
    const e = perSection.get(section)!;
    return {
      section,
      correct: e.correct,
      total: e.total,
      tier: e.tier,
      scaled: scaleSection(e.correct, e.total, e.tier),
    };
  });
}

export function totalScore(scores: SectionScore[]): number {
  return scores.reduce((sum, s) => sum + s.scaled, 0);
}

/* ── Persistence ───────────────────────────────────────────── */

const PLAN_KEY = 'prepology_exam_plan';

export function loadExam(): ExamPlan | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    const plan = JSON.parse(raw) as ExamPlan;
    return Array.isArray(plan.modules) ? plan : null;
  } catch {
    return null;
  }
}

export function saveExam(plan: ExamPlan | null): void {
  try {
    if (plan) localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    else localStorage.removeItem(PLAN_KEY);
  } catch {
    /* storage unavailable — the exam still runs for this session */
  }
}

export function formatDuration(sec: number): string {
  const m = Math.round(sec / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/** Total wall-clock length of a fully-assembled exam (4 modules). */
export function plannedTotalSeconds(): number {
  return SECTION_ORDER.reduce((sum, s) => sum + MODULE_SPEC[s].timeLimitSec * 2, 0);
}

/** Total question count of a fully-assembled exam. */
export function plannedTotalQuestions(): number {
  return SECTION_ORDER.reduce((sum, s) => sum + MODULE_SPEC[s].questionsPerModule * 2, 0);
}
