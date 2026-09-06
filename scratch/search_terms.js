import fs from 'node:fs';

const content = fs.readFileSync('scratch/chunks/0dc2tlcqvnqtu.js', 'utf8');

for (const term of ['centralAngleDeg', 'arcLengthLen', 'questionTypeId', 'optionsRules', 'passageRules', 'skillRules']) {
  const idx = content.indexOf(term);
  if (idx !== -1) {
    console.log(`\n=== Term: ${term} at position ${idx} ===`);
    console.log(content.slice(Math.max(0, idx - 300), Math.min(content.length, idx + 700)));
  }
}
