/**
 * infer_difficulty.js
 * 
 * Infers difficulty for legacy DC-format questions using:
 * 1. Real CB difficulty distribution per skill (from 1756-question API dump)
 * 2. Text-complexity signals as a tiebreaker
 * 
 * Score band mapping confirmed from CB API:
 *   bands 1-3 → Easy (1), bands 4-5 → Medium (2), bands 6-7 → Hard (3)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DB_FILE = path.join(ROOT, 'src/data/questions.json');

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

// Skill name aliases - old heuristic names → CB API names
const SKILL_ALIASES = {
  'Ratio, proportion, units, and percentage': 'Ratios, rates, proportional relationships, and units',
  'Quadratic and exponential word problems': 'Nonlinear functions',
  'Angles, triangles, and polygons': 'Lines, angles, and triangles',
  'Radicals and rational equations': 'Nonlinear equations in one variable and systems of equations in two variables',
};

// Real CB difficulty distribution per skill (from actual API data, 1756 questions)
const SKILL_PROFILES = {
  'Nonlinear functions':                                        { easy: 0.25, medium: 0.37, hard: 0.38 },
  'Linear functions':                                           { easy: 0.50, medium: 0.34, hard: 0.17 },
  'Nonlinear equations in one variable and systems of equations in two variables ': { easy: 0.27, medium: 0.36, hard: 0.36 },
  'Nonlinear equations in one variable and systems of equations in two variables':  { easy: 0.27, medium: 0.36, hard: 0.36 },
  'Linear equations in two variables':                          { easy: 0.44, medium: 0.31, hard: 0.25 },
  'Systems of two linear equations in two variables':           { easy: 0.31, medium: 0.35, hard: 0.34 },
  'Linear equations in one variable':                           { easy: 0.57, medium: 0.25, hard: 0.18 },
  'Equivalent expressions':                                     { easy: 0.38, medium: 0.35, hard: 0.27 },
  'Area and volume':                                            { easy: 0.32, medium: 0.36, hard: 0.32 },
  'Ratios, rates, proportional relationships, and units':       { easy: 0.46, medium: 0.34, hard: 0.20 },
  'Lines, angles, and triangles':                               { easy: 0.42, medium: 0.26, hard: 0.32 },
  'Percentages':                                                { easy: 0.35, medium: 0.28, hard: 0.37 },
  'One-variable data: Distributions and measures of center and spread': { easy: 0.45, medium: 0.25, hard: 0.30 },
  'Linear inequalities in one or two variables':                { easy: 0.36, medium: 0.36, hard: 0.27 },
  'Two-variable data: Models and scatterplots':                 { easy: 0.48, medium: 0.35, hard: 0.17 },
  'Right triangles and trigonometry':                           { easy: 0.18, medium: 0.25, hard: 0.58 },
  'Circles':                                                    { easy: 0.06, medium: 0.28, hard: 0.66 },
  'Probability and conditional probability':                    { easy: 0.51, medium: 0.31, hard: 0.18 },
  'Inference from sample statistics and margin of error':       { easy: 0.38, medium: 0.46, hard: 0.17 },
  'Evaluating statistical claims: Observational studies and experiments': { easy: 0.18, medium: 0.27, hard: 0.55 },
};

// Text-complexity signals — returns -1 (easier), 0 (neutral), +1 (harder)
function textComplexityBias(q) {
  const raw = ((q.questionText || '') + ' ' + (q.passageText || '')).replace(/<[^>]*>/g, ' ');
  const text = raw.toLowerCase();
  let score = 0;

  // Hard signals
  if (/system[s]? of|simultaneously/.test(text)) score += 2;
  if (/quadratic|exponential|parabola|radical|rational expression|complex number/.test(text)) score += 2;
  if (/minimum value|maximum value|greatest possible|least possible/.test(text)) score += 1;
  if (/must be true|cannot be true|always true|never true/.test(text)) score += 1;
  if (/directly proportional|inversely proportional/.test(text)) score += 1;
  if ((raw.match(/[a-zA-Z]\(/g) || []).length > 3) score += 1; // function notation density

  // Easy signals
  if (/solve for [a-z]\s*[.?]|find the value of [a-z]\s*[.?]/i.test(text)) score -= 1;
  const wordCount = raw.trim().split(/\s+/).filter(Boolean).length;
  if (wordCount < 25) score -= 1;
  if (wordCount > 100) score += 1;
  // Grid-in (SPR) tends harder
  if (!q.options || q.options.length === 0) score += 1;

  if (score >= 3) return 1;    // harder bias
  if (score <= -1) return -1;  // easier bias
  return 0;
}

// Assign difficulties proportionally across all DC questions in the same skill bucket
// This ensures the final E/M/H ratio matches the real CB distribution for that skill
function assignDifficultiesProportionally(questionsInSkill, profile, biases) {
  const n = questionsInSkill.length;
  // Calculate target counts for each difficulty level
  const easyTarget = Math.round(profile.easy * n);
  const hardTarget = Math.round(profile.hard * n);
  const medTarget = n - easyTarget - hardTarget;

  // Sort by text complexity bias (most negative first = easiest)
  const indexed = questionsInSkill.map((q, i) => ({ q, bias: biases[i] }));
  indexed.sort((a, b) => a.bias - b.bias);

  // Assign: first easyTarget get Easy, next medTarget get Medium, rest get Hard
  indexed.forEach(({ q }, i) => {
    if (i < easyTarget) q.difficulty = 1;
    else if (i < easyTarget + medTarget) q.difficulty = 2;
    else q.difficulty = 3;
  });
}

// Group DC questions by skill, then assign difficulties proportionally per group
const dcQuestions = db.filter(q => q.official && q.id && q.id.includes('-DC'));
console.log(`Processing ${dcQuestions.length} legacy DC questions...`);

const bySkill = {};
dcQuestions.forEach(q => {
  // Normalize skill name via aliases
  const skillNormalized = SKILL_ALIASES[q.skill] || q.skill || 'Unknown';
  if (!bySkill[skillNormalized]) bySkill[skillNormalized] = [];
  bySkill[skillNormalized].push(q);
});

Object.entries(bySkill).forEach(([skill, questions]) => {
  const profileKey = Object.keys(SKILL_PROFILES).find(k => k.trim() === skill.trim());
  const profile = profileKey ? SKILL_PROFILES[profileKey] : { easy: 0.35, medium: 0.35, hard: 0.30 };
  const biases = questions.map(q => textComplexityBias(q));
  assignDifficultiesProportionally(questions, profile, biases);
});

// Stats
const stats = { 1: 0, 2: 0, 3: 0 };
dcQuestions.forEach(q => stats[q.difficulty]++);

// Final distribution
const diffDist = { 1: 0, 2: 0, 3: 0 };
const domainDiffDist = {};
db.filter(q => q.official).forEach(q => {
  diffDist[q.difficulty] = (diffDist[q.difficulty] || 0) + 1;
  if (!domainDiffDist[q.domain]) domainDiffDist[q.domain] = {1:0,2:0,3:0};
  domainDiffDist[q.domain][q.difficulty]++;
});

console.log(`DC results → Easy: ${stats[1]}, Medium: ${stats[2]}, Hard: ${stats[3]}`);
console.log(`\nFinal overall difficulty: Easy=${diffDist[1]}, Medium=${diffDist[2]}, Hard=${diffDist[3]}`);
console.log('\nPer-domain breakdown:');
Object.entries(domainDiffDist).forEach(([d, dist]) => {
  console.log(`  ${d.padEnd(38)} E:${dist[1]} M:${dist[2]} H:${dist[3]}`);
});

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log('\n✅ Saved to questions.json');
