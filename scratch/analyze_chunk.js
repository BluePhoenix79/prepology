import fs from 'node:fs';

async function main() {
  const url = 'https://www.whiz.study/_next/static/chunks/0ja_tetkph6bd.js?dpl=dpl_zDU8Wp5xfGvtJWZxnbiNZYusMurE';
  const res = await fetch(url);
  const code = await res.text();
  fs.writeFileSync('scratch/whiz_chunk_main.js', code);
  console.log(`Saved whiz_chunk_main.js (${code.length} bytes)`);

  // Let's search for Supabase calls, supabase tables, api endpoints
  const supabaseQueries = code.match(/\.from\(['"]([^'"]+)['"]\)/g) || [];
  console.log('Supabase tables referenced:', supabaseQueries);

  // Search for function definitions or object keys related to questions
  const matches = [];
  const re = /(?:question|passage|choice|option|rationale|difficulty|domain|skill|exam_id|test_id)[a-zA-Z0-9_]*/gi;
  let m;
  const wordFreq = {};
  while ((m = re.exec(code)) !== null) {
    wordFreq[m[0]] = (wordFreq[m[0]] || 0) + 1;
  }
  console.log('Top relevant keywords:', Object.entries(wordFreq).sort((a,b) => b[1] - a[1]).slice(0, 30));
}

main();
