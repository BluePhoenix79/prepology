import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB = path.join(__dirname, '../src/data/questions.json');

const db = JSON.parse(fs.readFileSync(DB, 'utf8'));

const EoI_SKILLS = new Set(['Transitions', 'Rhetorical Synthesis']);

let fixed = 0;
db.forEach(q => {
  if (q.section !== 'Reading and Writing') return;
  if (EoI_SKILLS.has(q.skill)) {
    if (q.domain !== 'Expression of Ideas') {
      q.domain = 'Expression of Ideas';
      q.tags = ['Expression of Ideas', q.skill].filter(Boolean);
      fixed++;
    }
  }
});

console.log(`Fixed domain for ${fixed} questions → Expression of Ideas`);

// Verify final distribution
const byDomain = {};
db.filter(q => q.official && q.section === 'Reading and Writing')
  .forEach(q => byDomain[q.domain] = (byDomain[q.domain] || 0) + 1);
console.log('Final R&W domain distribution:', byDomain);

fs.writeFileSync(DB, JSON.stringify(db, null, 2));
console.log('Saved.');
