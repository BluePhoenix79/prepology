import fs from 'fs';
import path from 'path';

function nodeClean(html) {
  if (!html || typeof html !== 'string') return '';
  
  let cleaned = html;
  
  // Remove screen-reader only elements (both tag and content) because they duplicate text/math
  cleaned = cleaned.replace(/<span[^>]*class="[^"]*sr-only[^"]*"[^>]*>.*?<\/span>/gi, '');
  cleaned = cleaned.replace(/<span[^>]*class="[^"]*visual-cue[^"]*"[^>]*>.*?<\/span>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*sr-only[^"]*"[^>]*>.*?<\/div>/gi, '');
  cleaned = cleaned.replace(/<div[^>]*class="[^"]*visual-cue[^"]*"[^>]*>.*?<\/div>/gi, '');
  
  // Simply strip the aria-hidden="true" attribute text, but keep the element tags and contents!
  cleaned = cleaned.replace(/aria-hidden=["']true["']/gi, '');
  
  // Clean relative paths
  cleaned = cleaned.replace(/src="\/([^"]+)"/gi, 'src="https://satsuiteeducatorquestionbank.collegeboard.org/$1"');
  cleaned = cleaned.replace(/src='\/([^']+)'/gi, "src='https://satsuiteeducatorquestionbank.collegeboard.org/$1'");
  
  return cleaned
    .replace(/\r?\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
}

const dataDir = 'c:/Users/Pranav Sai/Downloads/prepology/src/data';
const questionsPath = path.join(dataDir, 'questions.json');
const mainQuestions = JSON.parse(fs.readFileSync(questionsPath, 'utf8'));

// Load all raw files
const rawFiles = ['cb_questions_1783754176965.json', 'cb_questions_1783765998132.json'];
const rawMap = new Map();

for (const file of rawFiles) {
  const filePath = path.join(dataDir, file);
  if (fs.existsSync(filePath)) {
    console.log(`Loading raw data from ${file}...`);
    const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const arr = fileData.questions || [];
    arr.forEach(q => {
      if (q.id) {
        rawMap.set(q.id.toLowerCase(), q);
      }
    });
  }
}

let updateCount = 0;

const updatedQuestions = mainQuestions.map(q => {
  if (!q.official) return q; // Keep custom questions exactly as is
  
  const rawQ = rawMap.get(q.id.toLowerCase());
  if (!rawQ) return q; // Fallback if not found in raw files
  
  const raw = rawQ._raw || rawQ;
  if (!raw) return q;
  
  // 1. Clean passageText (stimulus) and questionText (stem)
  const newPassage = raw.stimulus ? nodeClean(raw.stimulus) : null;
  const newQuestion = raw.stem ? nodeClean(raw.stem) : '';
  
  // 2. Clean options
  let finalOptions = undefined;
  let correctAnswer = q.correctAnswer;
  
  const rawChoices = raw.answerOptions || raw.choices || raw.options || [];
  if (Array.isArray(rawChoices) && rawChoices.length > 0) {
    const parsedOptions = rawChoices.map((c, i) => {
      const letterId = String.fromCharCode(65 + i);
      const optText = nodeClean(c.content || c.body || c.text || '');
      return { id: letterId, text: optText, _uuid: c.id };
    });
    
    // Resolve correct answer letter
    const correctKeys = raw.correct_answer || raw.keys || [];
    if (correctKeys.length > 0) {
      const matchIdx = parsedOptions.findIndex(o => correctKeys.includes(o._uuid));
      if (matchIdx >= 0) {
        correctAnswer = parsedOptions[matchIdx].id;
      }
    }
    
    finalOptions = parsedOptions.map(({ _uuid, ...o }) => o);
  } else {
    // Math SPR (grid-in) question: extract all valid answer keys and join them by comma
    const correctKeys = raw.correct_answer || raw.keys || [];
    if (correctKeys.length > 0) {
      correctAnswer = correctKeys.join(', ');
    }
  }
  
  // 3. Clean the rationale
  const rawRationale = raw.rationale || raw.explanation || '';
  const cleanRationale = rawRationale ? nodeClean(rawRationale) : q.rationale;
  
  updateCount++;
  
  const res = {
    ...q,
    passageText: newPassage,
    questionText: newQuestion,
    correctAnswer,
    rationale: cleanRationale
  };
  
  if (finalOptions) {
    res.options = finalOptions;
  } else {
    delete res.options;
  }
  
  return res;
});

console.log(`Successfully updated ${updateCount} questions.`);
fs.writeFileSync(questionsPath, JSON.stringify(updatedQuestions, null, 2), 'utf8');
console.log('Saved to questions.json successfully!');
