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
      if (t.includes('transition') || t.includes('furthermore') || t.includes('however') || t.includes('therefore') || t.includes('consequently') || t.includes('additionally')) return 'Transitions';
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

// Load difficulty map if provided (e.g. node scripts/merge_official.js cb_questions.json cb_difficulties.json)
let difficultyMap = {};
const diffArg = process.argv[3];
if (diffArg) {
  const diffPath = path.resolve(ROOT, diffArg);
  if (fs.existsSync(diffPath)) {
    console.log(`Loading difficulties from: ${path.basename(diffPath)}`);
    try {
      difficultyMap = JSON.parse(fs.readFileSync(diffPath, 'utf8'));
    } catch (e) {
      console.warn(`⚠️ Failed to parse difficulty map: ${e.message}`);
    }
  } else {
    console.warn(`⚠️ Difficulty map file not found: ${diffPath}`);
  }
}

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
    if (t.includes('transition') || t.includes('furthermore') || t.includes('consequently') || t.includes('therefore') || t.includes('however') || t.includes('additionally') || t.includes('student notes') || t.includes('synthesize') || t.includes('note') || t.includes('complete the text')) {
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

// Helper for question text comparison normalization
function normalizeTextForComparison(text) {
  if (!text) return '';
  return text
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/data:image\/[^;]+;base64,[^\s"'>]+/g, '') // Strip base64 image data so we only compare text content
    .replace(/[^a-zA-Z0-9]/g, '') // Strip punctuation, spaces, operators
    .toLowerCase();
}

// Normalize each question
const normalized = rawQuestions.map(q => {
  let section = q.section;
  let domain = normalizeDomain(q.domain);
  const mathDomains = ['Algebra', 'Advanced Math', 'Geometry and Trigonometry', 'Problem-Solving and Data Analysis'];

  // Force correct section based on MathML, SVG, LaTeX formulas, or equations
  const textBody = (q.questionText || '') + ' ' + (q.rationale || '');
  const cleanText = (q.questionText || '').replace(/<[^>]*>/g, '');
  const cleanBody = textBody.replace(/<[^>]*>/g, '');
  const containsMathTags = textBody.includes('<math') || textBody.includes('math xmlns') || textBody.includes('<svg') || textBody.includes('$$') || textBody.includes('\\(');
  const containsEquations = /[\+\=\^]/g.test(cleanText) && (cleanBody.includes('x') || cleanBody.includes('y') || cleanBody.includes('equals') || cleanBody.includes('value of') || cleanBody.includes('equation'));
  const isMath = containsMathTags || containsEquations || mathDomains.includes(domain);

  if (isMath) {
    section = 'Math';
  } else if (!section || section === 'Unknown') {
    section = 'Reading and Writing';
  }

  // Deduce domain if Unknown or misclassified
  const isRWDomain = ['Information and Ideas', 'Craft and Structure', 'Standard English Conventions', 'Expression of Ideas'].includes(domain);
  if (!domain || domain === 'Unknown' || (section === 'Math' && isRWDomain) || (section === 'Reading and Writing' && mathDomains.includes(domain))) {
    domain = guessDomain(section, textBody);
  }

  let skill = q.skill || domain;
  if (!skill || skill === domain || skill === 'Unknown') {
    skill = classifySkill(section, domain, textBody);
  }

  // Determine difficulty
  const shortId = (q.id || '').substring(0, 8).toLowerCase();
  const fullId = (q.id || '').toLowerCase();
  let difficulty = q.difficulty || 2;
  if (difficultyMap[fullId] !== undefined) {
    difficulty = difficultyMap[fullId];
  } else if (difficultyMap[shortId] !== undefined) {
    difficulty = difficultyMap[shortId];
  }

  if (typeof difficulty === 'string') {
    const dStr = difficulty.toLowerCase();
    if (dStr === 'easy' || dStr === '1') difficulty = 1;
    else if (dStr === 'medium' || dStr === '2') difficulty = 2;
    else if (dStr === 'hard' || dStr === '3') difficulty = 3;
  }

  return {
    id: q.id,
    section,
    domain,
    skill,
    difficulty,
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

const existingOfficials = existing.filter(q => q.official);
const nonOfficial = existing.filter(q => !q.official);

// Helper to find a match by text content
function findExistingMatchByText(newQ) {
  const normNew = normalizeTextForComparison(newQ.questionText);
  if (!normNew || normNew.length < 15) return null;
  
  return existingOfficials.find(eq => {
    if (eq.section !== newQ.section) return false;
    const normEq = normalizeTextForComparison(eq.questionText);
    return normEq && normEq === normNew;
  });
}

const updatedIds = new Set();
const addedQuestions = [];
let replaced = 0;

for (const newQ of normalized) {
  // 1. Try to find match by ID
  let match = existingOfficials.find(eq => eq.id === newQ.id);
  
  // 2. Try to find match by normalized question text (stem)
  if (!match) {
    match = findExistingMatchByText(newQ);
  }

  if (match) {
    // Update existing question difficulty and metadata safely
    match.difficulty = newQ.difficulty || match.difficulty || 2;
    
    // Always trust newly scraped domain/skill if they are valid (to fix previous heuristic misclassifications)
    if (newQ.domain && newQ.domain !== 'Unknown') {
      match.domain = newQ.domain;
    }
    if (newQ.skill && newQ.skill !== 'Unknown') {
      match.skill = newQ.skill;
    }
    match.tags = [match.domain, match.skill].filter(Boolean);
    
    // Recovery: If existing text is empty/short but new one is populated, recover the text!
    if ((!match.questionText || match.questionText.length < 20) && newQ.questionText && newQ.questionText.length >= 20) {
      match.questionText = newQ.questionText;
    }
    // Recovery: If existing options are empty but new one has options, recover options!
    if ((!match.options || match.options.length === 0) && newQ.options && newQ.options.length > 0) {
      match.options = newQ.options;
      match.correctAnswer = newQ.correctAnswer;
    }
    
    updatedIds.add(match.id);
    replaced++;
  } else {
    addedQuestions.push(newQ);
  }
}

// Keep all existing official questions (some might not have been matched or updated)
// Reassemble the merged database: non-official first, then official database (which was updated in-place)
const merged = [...nonOfficial, ...existingOfficials];

// Also append any genuinely new questions that didn't match anything
for (const q of addedQuestions) {
  if (!existingOfficials.some(eq => eq.id === q.id)) {
    merged.push(q);
  }
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(merged, null, 2), 'utf8');

console.log(`
✅ Done!
   Drill questions kept:        ${nonOfficial.length}
   Official questions matched:  ${replaced} (difficulty updated)
   Genuinely new official:      ${addedQuestions.length}
   Total questions now:         ${merged.length}

   Saved to: src/data/questions.json
   
   Restart your dev server to see the official questions appear in the
   "Official CB Bank" tab on the dashboard!
`);
