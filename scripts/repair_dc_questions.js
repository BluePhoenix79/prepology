import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const SRC_JSON = path.join(ROOT, 'src/data/questions.json');
const PUB_JSON = path.join(ROOT, 'public/questions.json');

function nodeClean(html) {
  if (!html || typeof html !== 'string') return '';
  let cleaned = html;
  cleaned = cleaned.replace(/<span[^>]*class="[^"]*sr-only[^"]*"[^>]*>.*?<\/span>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*class="[^"]*visual-cue[^"]*"[^>]*>.*?<\/span>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*sr-only[^"]*"[^>]*>.*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*visual-cue[^"]*"[^>]*>.*?<\/div>/gi, '');
  cleaned = cleaned.replace(/aria-hidden=["']true["']/gi, '');
  cleaned = cleaned.replace(/src="\/([^"]+)"/gi, 'src="https://satsuiteeducatorquestionbank.collegeboard.org/$1"');
  cleaned = cleaned.replace(/src='\/([^']+)'/gi, "src='https://satsuiteeducatorquestionbank.collegeboard.org/$1'");
  return cleaned
    .replace(/\r?\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const wordToNumber = {
  'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
  'six': '6', 'seven': '7', 'eight': '8', 'nine': '9', 'ten': '10',
  'one half': '1/2', 'three halves': '3/2', 'five halves': '5/2', 'seven halves': '7/2',
  'one third': '1/3', 'two thirds': '2/3', 'four thirds': '4/3', 'five thirds': '5/3',
  'one fourth': '1/4', 'three fourths': '3/4', 'five fourths': '5/4', 'seven fourths': '7/4',
  'one fifth': '1/5', 'two fifths': '2/5', 'three fifths': '3/5', 'four fifths': '4/5'
};

function extractSPRAnswer(rationale) {
  if (!rationale) return null;

  // 1. Look for 'Note that X and Y are examples of ways to enter a correct answer'
  const noteMatch = rationale.match(/Note that\s+([^.]+?)\s+are examples of ways to enter/i);
  if (noteMatch) {
    const answers = noteMatch[1].split(/\s+and\s+/i).map(s => s.trim().replace(/^or\s+/i, ''));
    return answers.join(', ');
  }

  // 2. Extract from alt in math-img or direct text in "The correct answer is ..."
  const match = rationale.match(/The correct answer is\s+([^<]+?)(?:\.(?:\s+|<|$)|According|It&rsquo;s|It\s+|One|Since|Let|To|Subtracting|Dividing|Multiplying|Adding|Substituting|Because)/i);
  if (match) {
    let fragment = match[1].trim();
    const clean = fragment.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[$,]/g, '').trim();
    if (clean && !clean.includes('data:image')) {
      if (wordToNumber[clean.toLowerCase()]) return wordToNumber[clean.toLowerCase()];
      const mNum = clean.match(/^-?\d+(?:\.\d+)?(?:\s*\/\s*\d+)?/);
      if (mNum) return mNum[0].replace(/\s+/g, '');
    }
  }

  // 3. Fallback: check math-img in rationale
  const firstImgMatch = rationale.match(/The correct answer is\s+.*?<img[^>]*alt=["']([^"']+)["']/i);
  if (firstImgMatch) {
    const altText = firstImgMatch[1].trim().toLowerCase();
    if (wordToNumber[altText]) return wordToNumber[altText];
    const fracMatch = altText.match(/(?:the fraction\s+)?(-?\d+)\s+over\s+(-?\d+)/i);
    if (fracMatch) return `${fracMatch[1]}/${fracMatch[2]}`;
    const numMatch = altText.match(/-?\d+(?:\.\d+)?/);
    if (numMatch) return numMatch[0];
    return altText;
  }

  return null;
}

const questions = JSON.parse(fs.readFileSync(SRC_JSON, 'utf8'));
console.log(`Loaded ${questions.length} questions from ${SRC_JSON}`);

let fixedMC = 0;
let fixedSPR = 0;
let fixedPassage = 0;
let fixedRationale = 0;

const updatedQuestions = questions.map(q => {
  const raw = q._raw;
  let res = { ...q };

  // 1. Check if passageText is missing but raw.body exists
  if ((!res.passageText || res.passageText.trim() === '') && raw?.body) {
    res.passageText = nodeClean(raw.body);
    fixedPassage++;
  }

  // 2. Check if rationale is missing but raw rationale exists
  if ((!res.rationale || res.rationale.trim() === '') && raw?.answer?.rationale) {
    res.rationale = nodeClean(raw.answer.rationale);
    fixedRationale++;
  }

  // 3. Fix Multiple Choice questions that had empty options or empty correctAnswer
  if (raw?.answer?.choices && (!res.options || res.options.length === 0 || !res.correctAnswer)) {
    const choicesObj = raw.answer.choices;
    const choiceEntries = Object.entries(choicesObj);
    if (choiceEntries.length > 0) {
      res.options = choiceEntries.map(([key, val], idx) => {
        const id = key ? key.toUpperCase() : String.fromCharCode(65 + idx);
        const bodyText = (val && typeof val === 'object') ? (val.body || val.content || val.text || '') : String(val);
        return {
          id,
          text: nodeClean(bodyText)
        };
      });

      if (raw.answer.correct_choice) {
        res.correctAnswer = String(raw.answer.correct_choice).trim().toUpperCase();
      } else if (res.rationale) {
        const choiceMatch = res.rationale.match(/Choice\s+([A-D])\s+is correct/i);
        if (choiceMatch) {
          res.correctAnswer = choiceMatch[1].toUpperCase();
        }
      }
      fixedMC++;
    }
  }

  // 4. Fix SPR questions with empty correctAnswer
  if ((!res.options || res.options.length === 0) && (!res.correctAnswer || res.correctAnswer.trim() === '')) {
    const rationale = raw?.answer?.rationale || res.rationale;
    const sprAns = extractSPRAnswer(rationale);
    if (sprAns) {
      res.correctAnswer = sprAns;
      fixedSPR++;
    } else {
      console.warn(`Could not extract SPR answer for ${q.id}`);
    }
  }

  return res;
});

console.log(`Fixed ${fixedMC} Multiple Choice questions.`);
console.log(`Fixed ${fixedSPR} SPR questions.`);
console.log(`Fixed ${fixedPassage} questions with missing passageText.`);
console.log(`Fixed ${fixedRationale} questions with missing rationale.`);

// Validate remaining empty answers
const remainingEmpty = updatedQuestions.filter(q => !q.correctAnswer || q.correctAnswer.trim() === '');
console.log(`Remaining questions with empty correctAnswer: ${remainingEmpty.length}`);
if (remainingEmpty.length > 0) {
  console.log('Sample remaining empty:', remainingEmpty.slice(0, 3).map(q => q.id));
}

// Write to both SRC_JSON and PUB_JSON
fs.writeFileSync(SRC_JSON, JSON.stringify(updatedQuestions), 'utf8');
fs.writeFileSync(PUB_JSON, JSON.stringify(updatedQuestions), 'utf8');
console.log('Successfully written to src/data/questions.json and public/questions.json!');
