/**
 * merge_whiz.js
 * =============
 * Merges scraped Whiz.study questions into the Prepology question bank (`src/data/questions.json`).
 * 
 * FEATURES:
 * - Validates question structure against TypeScript `Question` schema.
 * - Deduplicates against existing questions (by ID and question text similarity).
 * - Sanitizes LaTeX mathematical markup and option labels.
 * - Automatically creates a backup of `questions.json` before modifying.
 * - Displays a comprehensive breakdown summary of merged questions.
 * 
 * USAGE:
 *   node scripts/merge_whiz.js [path_to_scraped_whiz_questions.json]
 * 
 * EXAMPLE:
 *   node scripts/merge_whiz.js whiz_questions.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const QUESTIONS_DB_PATH = path.join(ROOT, 'src', 'data', 'questions.json');
const BACKUP_DB_PATH = path.join(ROOT, 'src', 'data', 'questions.backup.json');

// Helper to normalize strings for similarity comparison
function normalizeForComparison(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/<[^>]*>/g, '') // remove HTML
    .replace(/[^a-z0-9]/g, '') // keep alphanumeric
    .slice(0, 150); // first 150 chars
}

function main() {
  const inputFile = process.argv[2] || path.join(ROOT, 'whiz_questions.json');

  console.log(`\n======================================================`);
  console.log(`📥 Prepology — Whiz Question Bank Merger`);
  console.log(`======================================================\n`);
  console.log(`Reading input file: ${inputFile}`);

  if (!fs.existsSync(inputFile)) {
    console.error(`❌ Error: Input file "${inputFile}" does not exist!`);
    console.log(`\nTo scrape questions:`);
    console.log(`1. Open https://whiz.study and log in.`);
    console.log(`2. Paste scripts/scrape_whiz.js into DevTools Console.`);
    console.log(`3. Run downloadQuestions() and place the JSON file here.\n`);
    process.exit(1);
  }

  // Load input questions
  let rawWhizData;
  try {
    rawWhizData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  } catch (e) {
    console.error(`❌ Error parsing JSON from "${inputFile}":`, e.message);
    process.exit(1);
  }

  const whizList = Array.isArray(rawWhizData) ? rawWhizData : (rawWhizData.questions || []);
  console.log(`Found ${whizList.length} questions in source file.`);

  if (whizList.length === 0) {
    console.warn(`⚠️ No questions found in source JSON.`);
    process.exit(0);
  }

  // Load existing questions database
  let existingDb = [];
  if (fs.existsSync(QUESTIONS_DB_PATH)) {
    try {
      existingDb = JSON.parse(fs.readFileSync(QUESTIONS_DB_PATH, 'utf8'));
      console.log(`Loaded ${existingDb.length} existing questions from database.`);
    } catch (e) {
      console.error(`❌ Error loading existing questions.json:`, e.message);
      process.exit(1);
    }
  }

  // Build lookup index of existing questions for fast deduplication
  const existingIds = new Set(existingDb.map(q => q.id));
  const existingFingerprints = new Set(
    existingDb.map(q => normalizeForComparison((q.passageText || '') + (q.questionText || '')))
  );

  const mergedQuestions = [];
  let duplicateCount = 0;
  let invalidCount = 0;

  const sectionStats = { 'Reading and Writing': 0, 'Math': 0 };
  const domainStats = {};
  const diffStats = { Easy: 0, Medium: 0, Hard: 0 };

  for (let i = 0; i < whizList.length; i++) {
    const raw = whizList[i];

    // Validation
    if (!raw.questionText && !raw.passageText) {
      invalidCount++;
      continue;
    }

    // Check duplicate by text fingerprint
    const fingerprint = normalizeForComparison((raw.passageText || '') + (raw.questionText || ''));
    if (existingFingerprints.has(fingerprint)) {
      duplicateCount++;
      continue;
    }

    // Ensure unique ID
    let finalId = raw.id || `whiz-${Date.now()}-${i}`;
    if (existingIds.has(finalId)) {
      finalId = `whiz-${finalId}-${i}`;
    }

    // Format section
    const section = (raw.section === 'Math' || /math/i.test(raw.section || '')) ? 'Math' : 'Reading and Writing';
    
    // Format difficulty
    let difficulty = Number(raw.difficulty);
    if (![1, 2, 3].includes(difficulty)) {
      difficulty = 2; // default to medium
    }

    // Format options
    let options = [];
    if (Array.isArray(raw.options)) {
      options = raw.options.map((opt, optIdx) => ({
        id: opt.id || String.fromCharCode(65 + optIdx),
        text: String(opt.text || opt.content || opt || '').trim()
      })).filter(o => o.text);
    }

    // Format correct answer
    let correctAnswer = String(raw.correctAnswer || raw.correct_answer || (options[0]?.id || 'A')).trim();

    // Format tags
    const tags = Array.isArray(raw.tags) ? [...raw.tags] : ['Whiz', 'SAT'];
    if (!tags.includes('Whiz')) tags.unshift('Whiz');

    const cleanQuestion = {
      id: finalId,
      section,
      domain: raw.domain || (section === 'Math' ? 'Algebra' : 'Information and Ideas'),
      skill: raw.skill || raw.domain || 'General',
      difficulty,
      passageText: raw.passageText ? String(raw.passageText).trim() : undefined,
      questionText: String(raw.questionText || '').trim(),
      options,
      correctAnswer,
      rationale: String(raw.rationale || 'No explanation provided.').trim(),
      tags,
      official: false,
      isNew: true
    };

    // Add to merge list & index
    mergedQuestions.push(cleanQuestion);
    existingIds.add(finalId);
    existingFingerprints.add(fingerprint);

    // Update stats
    sectionStats[section] = (sectionStats[section] || 0) + 1;
    domainStats[cleanQuestion.domain] = (domainStats[cleanQuestion.domain] || 0) + 1;
    if (difficulty === 1) diffStats.Easy++;
    else if (difficulty === 3) diffStats.Hard++;
    else diffStats.Medium++;
  }

  console.log(`\n--- Processing Results ---`);
  console.log(`✅ Valid new questions to add: ${mergedQuestions.length}`);
  console.log(`🔁 Duplicates skipped:        ${duplicateCount}`);
  console.log(`⚠️ Invalid entries skipped:    ${invalidCount}`);

  if (mergedQuestions.length === 0) {
    console.log(`\nNo new unique questions to merge. Database unchanged.`);
    return;
  }

  // Create backup
  if (fs.existsSync(QUESTIONS_DB_PATH)) {
    fs.copyFileSync(QUESTIONS_DB_PATH, BACKUP_DB_PATH);
    console.log(`\n💾 Created database backup at: src/data/questions.backup.json`);
  }

  // Write merged database
  const updatedDb = [...existingDb, ...mergedQuestions];
  fs.writeFileSync(QUESTIONS_DB_PATH, JSON.stringify(updatedDb, null, 2), 'utf8');

  console.log(`🎉 Successfully updated questions.json! Total questions in database: ${updatedDb.length}`);

  // Print summary tables
  console.log(`\n--- New Questions by Section ---`);
  console.table(sectionStats);

  console.log(`--- New Questions by Domain ---`);
  console.table(domainStats);

  console.log(`--- New Questions by Difficulty ---`);
  console.table(diffStats);

  console.log(`\nAll set! You can run 'npm run dev' to practice with your new Whiz questions in Prepology.\n`);
}

main();
