import fs from 'fs';

const questions = JSON.parse(fs.readFileSync('src/data/questions.json', 'utf8'));
const emptySPR = questions.filter(q => q._raw?.answer?.style === 'SPR' && (!q.correctAnswer || q.correctAnswer.trim() === ''));

const wordToNumber = {
  'one': '1', 'two': '2', 'three': '3', 'four': '4', 'five': '5',
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
    // Direct clean text check
    const clean = fragment.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/[$,]/g, '').trim();
    if (clean && !clean.includes('data:image')) {
      if (wordToNumber[clean.toLowerCase()]) return wordToNumber[clean.toLowerCase()];
      // Check if it's a number, decimal, or fraction
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

const results = [];
let failed = [];

for (const q of emptySPR) {
  const ans = extractSPRAnswer(q._raw?.answer?.rationale);
  if (ans) {
    results.push({ id: q.id, ans, rationaleStart: q._raw.answer.rationale.slice(0, 100) });
  } else {
    failed.push({ id: q.id, rationale: q._raw.answer.rationale.slice(0, 200) });
  }
}

console.log('Extracted:', results.length, 'out of', emptySPR.length);
console.log('Failed count:', failed.length);
if (failed.length > 0) {
  console.log('Failed items:', JSON.stringify(failed, null, 2));
} else {
  console.log('Sample 10 results:', JSON.stringify(results.slice(0, 10), null, 2));
}
