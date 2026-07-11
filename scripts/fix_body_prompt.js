import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DB_FILE = path.join(ROOT, 'src/data/questions.json');
const OLD_FILE = 'C:/Users/Pranav Sai/Downloads/cb_questions_1783754176965.json';

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
const oldData = JSON.parse(fs.readFileSync(OLD_FILE, 'utf8'));
const oldQuestions = Array.isArray(oldData) ? oldData : (oldData.questions || []);

// Build lookup from old file by ID
const oldMap = {};
oldQuestions.forEach(q => { if (q.id) oldMap[q.id] = q; });

function clean(html) {
  if (!html || typeof html !== 'string') return '';
  return html.replace(/\r?\n/g, ' ').replace(/[ \t]+/g, ' ').trim();
}

function isStimulus(html) {
  if (!html) return false;
  return /class=["'][^"']*stimulus[^"']*/i.test(html) || /stimulus_reference/i.test(html);
}

let fixed = 0;

db.forEach(q => {
  if (!q.id) return;

  const oldQ = oldMap[q.id];
  if (!oldQ || !oldQ._raw) return;

  const raw = oldQ._raw;

  // Check if body is a stimulus and prompt has the real question
  const bodyHtml = typeof raw.body === 'string' ? raw.body : '';
  if (isStimulus(bodyHtml) && raw.prompt) {
    const realQuestionText = clean(raw.prompt);
    const stimulusText = clean(raw.body);

    // Only fix if the current questionText is the stimulus (body), not the actual question
    if (q.questionText && isStimulus(q.questionText) && realQuestionText) {
      q.passageText = stimulusText || q.passageText;
      q.questionText = realQuestionText;
      fixed++;
    }
  }
});

console.log(`Fixed body/prompt mapping for ${fixed} questions.`);
fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
console.log('Database saved!');
