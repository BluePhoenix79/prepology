/**
 * merge_official.js
 * 
 * Merges a downloaded CB question bank JSON file into questions.json
 * 
 * USAGE:
 *   node scripts/merge_official.js path/to/cb_questions_*.json
 *
 * If no argument is given, it will look for any cb_questions_*.json
 * file in the project root automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');
const OUTPUT_FILE = path.join(ROOT, 'src/data/questions.json');

// ── Skill classifier (matches the one in the scraper) ────────────────────────
function classifySkill(section, domain, text) {
  const t = (text || '').toLowerCase();
  if (section === 'Math') {
    if (domain === 'Algebra') {
      if (t.includes('system') || t.includes('two linear')) return 'Systems of two linear equations in two variables';
      if (t.includes('inequal')) return 'Linear inequalities in one or two variables';
      if (t.includes('linear function') || t.includes('f(x)') || t.includes('slope')) return 'Linear functions';
      return 'Linear equations in one variable';
    }
    if (domain === 'Advanced Math') {
      if (t.includes('quadratic') || t.includes('exponential')) return 'Quadratic and exponential word problems';
      if (t.includes('radical') || t.includes('rational') || t.includes('denominator')) return 'Radicals and rational equations';
      return 'Nonlinear functions';
    }
    if (domain === 'Geometry and Trigonometry') {
      if (t.includes('volume') || t.includes('area') || t.includes('surface area')) return 'Area and volume';
      if (t.includes('circle') || t.includes('radius') || t.includes('arc')) return 'Circles';
      if (t.includes('trig') || t.includes('sin(') || t.includes('cos(') || t.includes('right triangle')) return 'Right triangles and trigonometry';
      return 'Angles, triangles, and polygons';
    }
    if (domain === 'Problem-Solving and Data Analysis') {
      if (t.includes('ratio') || t.includes('percent') || t.includes('rate')) return 'Ratio, proportion, units, and percentage';
      if (t.includes('probability') || t.includes('random') || t.includes('conditional')) return 'Probability and conditional probability';
      if (t.includes('scatter') || t.includes('line of best fit') || t.includes('association')) return 'Two-variable data: models and scatterplots';
      return 'One-variable data: distributions and measures of center and spread';
    }
  } else {
    if (domain === 'Information and Ideas') {
      if (t.includes('table') || t.includes('graph') || t.includes('evidence')) return 'Command of Evidence';
      if (t.includes('infer') || t.includes('conclusion') || t.includes('suggest')) return 'Inferences';
      return 'Central Ideas and Details';
    }
    if (domain === 'Craft and Structure') {
      if (t.includes('word') || t.includes('means') || t.includes('vocabulary') || t.includes('as used')) return 'Words in Context';
      if (t.includes('purpose') || t.includes('function') || t.includes('structure')) return 'Text Structure and Purpose';
      return 'Cross-Text Connections';
    }
    if (domain === 'Standard English Conventions') {
      if (t.includes('punctuation') || t.includes('comma') || t.includes('colon') || t.includes('semicolon')) return 'Boundaries';
      return 'Form, Structure, and Sense';
    }
    if (domain === 'Expression of Ideas') {
      if (t.includes('transition') || t.includes('furthermore') || t.includes('however') || t.includes('therefore')) return 'Transitions';
      return 'Rhetorical Synthesis';
    }
  }
  return domain;
}

function normalizeDomain(raw) {
  if (!raw) return 'Unknown';
  const r = raw.toLowerCase();
  if (r.includes('advanced math')) return 'Advanced Math';
  if (r.includes('algebra')) return 'Algebra';
  if (r.includes('geometry') || r.includes('trigonometry')) return 'Geometry and Trigonometry';
  if (r.includes('problem') || r.includes('data analysis') || r.includes('statistics')) return 'Problem-Solving and Data Analysis';
  if (r.includes('information') || r.includes('ideas')) return 'Information and Ideas';
  if (r.includes('craft') || r.includes('structure')) return 'Craft and Structure';
  if (r.includes('standard english') || r.includes('conventions')) return 'Standard English Conventions';
  if (r.includes('expression')) return 'Expression of Ideas';
  return raw;
}

// ── Find input file ───────────────────────────────────────────────────────────
let inputFile = process.argv[2];
if (!inputFile) {
  // Auto-detect in project root
  const candidates = fs.readdirSync(ROOT).filter(f => f.startsWith('cb_questions_') && f.endsWith('.json'));
  if (candidates.length === 0) {
    console.error('❌ No input file provided and no cb_questions_*.json found in project root.');
    console.log('Usage: node scripts/merge_official.js path/to/cb_questions_*.json');
    process.exit(1);
  }
  // Pick the most recent one
  candidates.sort();
  inputFile = path.join(ROOT, candidates[candidates.length - 1]);
  console.log(`Auto-detected input file: ${path.basename(inputFile)}`);
}

if (!fs.existsSync(inputFile)) {
  console.error(`❌ File not found: ${inputFile}`);
  process.exit(1);
}

// ── Load and normalize ────────────────────────────────────────────────────────
let rawImport;
try {
  rawImport = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
} catch (e) {
  console.error('❌ Failed to parse input JSON:', e.message);
  process.exit(1);
}

// The scraper wraps in { questions: [...] } but handle bare array too
const rawQuestions = Array.isArray(rawImport) ? rawImport : (rawImport.questions || []);
console.log(`Loaded ${rawQuestions.length} questions from: ${path.basename(inputFile)}`);

function guessDomain(section, questionText) {
  const t = questionText.toLowerCase();
  if (section === 'Math') {
    if (t.includes('sin(') || t.includes('cos(') || t.includes('tan(') || t.includes('triangle') || t.includes('circle') || t.includes('angle') || t.includes('volume') || t.includes('radian') || t.includes('theorem') || t.includes('geometry')) {
      return 'Geometry and Trigonometry';
    }
    if (t.includes('probability') || t.includes('mean') || t.includes('median') || t.includes('standard deviation') || t.includes('scatter') || t.includes('percent') || t.includes('ratio') || t.includes('survey') || t.includes('probability')) {
      return 'Problem-Solving and Data Analysis';
    }
    if (t.includes('x^2') || t.includes('x^{2}') || t.includes('quadratic') || t.includes('exponential') || t.includes('parabola') || t.includes('f(x)') || t.includes('nonlinear') || t.includes('radical') || t.includes('rational')) {
      return 'Advanced Math';
    }
    return 'Algebra';
  } else {
    if (t.includes('transition') || t.includes('furthermore') || t.includes('consequently') || t.includes('therefore') || t.includes('however') || t.includes('student notes') || t.includes('synthesize')) {
      return 'Expression of Ideas';
    }
    if (t.includes('precise word') || t.includes('as used in') || t.includes('main purpose') || t.includes('overall structure') || t.includes('connections') || t.includes('author')) {
      return 'Craft and Structure';
    }
    if (t.includes('conventions') || t.includes('punctuation') || t.includes('verb') || t.includes('pronoun') || t.includes('subject-verb') || t.includes('plural') || t.includes('colon') || t.includes('comma')) {
      return 'Standard English Conventions';
    }
    return 'Information and Ideas';
  }
}

// Normalize each question
const normalized = rawQuestions.map(q => {
  let section = q.section;
  let domain = normalizeDomain(q.domain);
  const mathDomains = ['Algebra', 'Advanced Math', 'Geometry and Trigonometry', 'Problem-Solving and Data Analysis'];

  // Force correct section based on MathML, SVG, LaTeX formulas, or equations
  const textBody = (q.questionText || '') + ' ' + (q.rationale || '');
  const containsMathTags = textBody.includes('<math') || textBody.includes('math xmlns') || textBody.includes('<svg') || textBody.includes('$$') || textBody.includes('\\(');
  const containsEquations = /[\+\=\<\>\^]/g.test(q.questionText || '') && (textBody.includes('x') || textBody.includes('y') || textBody.includes('equals') || textBody.includes('value of') || textBody.includes('equation'));
  const isMath = containsMathTags || containsEquations || mathDomains.includes(domain);

  section = isMath ? 'Math' : 'Reading and Writing';

  // Deduce domain if Unknown or misclassified
  const isRWDomain = ['Information and Ideas', 'Craft and Structure', 'Standard English Conventions', 'Expression of Ideas'].includes(domain);
  if (!domain || domain === 'Unknown' || (section === 'Math' && isRWDomain) || (section === 'Reading and Writing' && mathDomains.includes(domain))) {
    domain = guessDomain(section, textBody);
  }

  let skill = q.skill || domain;
  if (!skill || skill === domain || skill === 'Unknown') {
    skill = classifySkill(section, domain, textBody);
  }

  return {
    id: q.id,
    section,
    domain,
    skill,
    difficulty: q.difficulty || 2,
    passageText: q.passageText || null,
    questionText: q.questionText || '',
    options: q.options || [],
    correctAnswer: q.correctAnswer || '',
    rationale: q.rationale || '',
    official: true,
    tags: [domain, skill].filter(Boolean),
  };
}).filter(q => {
  const hasChoices = q.options && q.options.length > 0;
  const isMathGridIn = q.section === 'Math' && (!q.options || q.options.length === 0);
  return q.id && q.questionText && (hasChoices || isMathGridIn);
});

console.log(`Valid questions after filtering: ${normalized.length}`);

// ── Merge with existing questions.json ────────────────────────────────────────
let existing = [];
if (fs.existsSync(OUTPUT_FILE)) {
  try {
    existing = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
  } catch (e) {
    console.warn('Could not read existing questions.json, starting fresh.');
  }
}

// Keep existing official questions that are NOT in the new import file
const newOfficialIds = new Set(normalized.map(q => q.id));
const existingOfficialToKeep = existing.filter(q => q.official && !newOfficialIds.has(q.id));
const nonOfficial = existing.filter(q => !q.official);

// Merge: deduplicate by ID for new questions
const dedupedNew = [];
const seenNewIds = new Set();
for (const q of normalized) {
  if (!seenNewIds.has(q.id)) {
    seenNewIds.add(q.id);
    dedupedNew.push(q);
  }
}

const merged = [...nonOfficial, ...existingOfficialToKeep, ...dedupedNew];
const replaced = existing.filter(q => q.official && newOfficialIds.has(q.id)).length;

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2), 'utf8');

console.log(`
✅ Done!
   Drill questions kept:      ${nonOfficial.length}
   Official questions merged: ${dedupedNew.length} (${replaced} updated)
   Total questions now:       ${merged.length}

   Saved to: src/data/questions.json
   
   Restart your dev server to see the official questions appear in the
   "Official CB Bank" tab on the dashboard!
`);
