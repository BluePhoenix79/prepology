import fs from 'node:fs';
import path from 'node:path';

const dir = 'scratch/chunks';
const files = fs.readdirSync(dir);

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  // Search for questions structure, fields like choices, answer, explanation, stimulus, stem, passage
  if (content.includes('passage') && content.includes('choices') && content.includes('rationale')) {
    console.log(`Found question structure in ${file}`);
    // extract surrounding snippets
    const idx = content.indexOf('rationale');
    console.log(`Snippet around rationale in ${file}:`);
    console.log(content.slice(Math.max(0, idx - 200), Math.min(content.length, idx + 400)));
  }

  // Search for any mock questions or embedded question data
  const testQ = content.match(/\{[^{}]*(?:question|stem|passage)[^{}]*(?:choices|options)[^{}]*\}/gi);
  if (testQ && testQ.length > 0) {
    console.log(`Found ${testQ.length} embedded question objects in ${file}`);
    console.log('Sample:', testQ[0].slice(0, 200));
  }
}
