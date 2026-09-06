import fs from 'node:fs';

const code = fs.readFileSync('scratch/whiz_chunk_main.js', 'utf8');

// Find all fetch/http calls or endpoint definitions
const regex = /(?:https?:\/\/[^\s"'\`]+|\/api\/[^\s"'\`]+|supabase\.co[^\s"'\`]*)/g;
const urls = new Set(code.match(regex) || []);
console.log('URLs/Endpoints found:');
for (const u of urls) {
  console.log(' -', u);
}

// Find schema / types / interfaces or queries
const queryRegex = /(?:query|mutation|select|from)\s*[{(`][^})`]+[})`]/gi;
const queries = code.match(queryRegex) || [];
console.log(`Found ${queries.length} potential queries`);
for (const q of queries.slice(0, 15)) {
  console.log(' Query sample:', q.slice(0, 100));
}

// Let's search for "practice", "exam", "drill", "test", "question" functions
const functionRegex = /(?:function\s+([a-zA-Z0-9_$]+)|(?:const|let|var)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>)/g;
// Search for interesting variable/function names
const interestingNames = [];
let fm;
while ((fm = functionRegex.exec(code)) !== null) {
  const name = fm[1] || fm[2];
  if (/question|drill|exam|test|passage|fetch|scrape|load/i.test(name)) {
    interestingNames.push(name);
  }
}
console.log('Interesting function/var names (sample):', interestingNames.slice(0, 30));
