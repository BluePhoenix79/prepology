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
  const cleanPassage = raw.stimulus ? nodeClean(raw.stimulus) : null;
  const cleanQuestion = nodeClean(raw.stem || raw.prompt || '');
  
  const finalPassageText = cleanPassage !== null ? cleanPassage : q.passageText;
  const finalQuestionText = cleanQuestion ? cleanQuestion : q.questionText;
  
  // 2. Clean options
  let finalOptions = undefined;
  let correctAnswer = q.correctAnswer;
  
  let rawChoices = [];
  if (raw.answerOptions) {
    rawChoices = raw.answerOptions;
  } else if (raw.choices) {
    rawChoices = raw.choices;
  } else if (raw.options) {
    rawChoices = raw.options;
  } else if (raw.answer && raw.answer.choices) {
    rawChoices = Object.entries(raw.answer.choices).map(([key, val]) => {
      return {
        id: key.toUpperCase(),
        content: (val && typeof val === 'object') ? (val.body || val.content || val.text || '') : String(val)
      };
    });
  }
  
  if (Array.isArray(rawChoices) && rawChoices.length > 0) {
    const parsedOptions = rawChoices.map((c, i) => {
      const letterId = String.fromCharCode(65 + i);
      const optText = nodeClean(c.content || c.body || c.text || '');
      return { id: letterId, text: optText, _uuid: c.id };
    });
    
    // Resolve correct answer letter
    let correctKeys = raw.correct_answer || raw.keys || [];
    if (raw.answer && raw.answer.correct_choice) {
      correctKeys = [raw.answer.correct_choice];
    }
    
    if (correctKeys.length > 0) {
      const key0 = String(correctKeys[0]).trim().toUpperCase();
      if (['A', 'B', 'C', 'D'].includes(key0)) {
        correctAnswer = key0;
      } else {
        const matchIdx = parsedOptions.findIndex(o => correctKeys.includes(o._uuid) || correctKeys.includes(o.id));
        if (matchIdx >= 0) {
          correctAnswer = parsedOptions[matchIdx].id;
        }
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
  const rawRationale = raw.rationale || raw.explanation || (raw.answer && raw.answer.rationale) || '';
  const cleanRationale = rawRationale ? nodeClean(rawRationale) : q.rationale;
  
  updateCount++;
  
  const res = {
    ...q,
    passageText: finalPassageText,
    questionText: finalQuestionText,
    correctAnswer,
    rationale: cleanRationale
  };
  
  if (finalOptions && finalOptions.length > 0) {
    res.options = finalOptions;
  } else {
    // If original question had options but raw had none, preserve original options!
    if (q.options && q.options.length > 0) {
      res.options = q.options;
    } else {
      delete res.options;
    }
  }
  
  return res;
});

console.log(`Successfully updated ${updateCount} questions.`);
fs.writeFileSync(questionsPath, JSON.stringify(updatedQuestions, null, 2), 'utf8');
console.log('Saved to questions.json successfully!');
