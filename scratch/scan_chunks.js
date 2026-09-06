import fs from 'node:fs';
import path from 'node:path';

const dir = 'scratch/chunks';
const files = fs.readdirSync(dir);

const allSupabase = new Set();
const allApi = new Set();
const allTables = new Set();
const allRoutes = new Set();

for (const file of files) {
  const content = fs.readFileSync(path.join(dir, file), 'utf8');
  
  // Find supabase endpoints / keys
  const sbMatches = content.match(/https:\/\/[a-z0-9]+\.supabase\.co[^\s"'\`)]*/g) || [];
  sbMatches.forEach(m => allSupabase.add(m));

  // Find supabase anon keys
  const anonKeyMatches = content.match(/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g) || [];
  if (anonKeyMatches.length > 0) {
    console.log(`Found JWT / Supabase anon keys in ${file}:`, anonKeyMatches);
  }

  // Find .from('table')
  const fromMatches = content.match(/\.from\(['"]([a-zA-Z0-9_-]+)['"]\)/g) || [];
  fromMatches.forEach(m => allTables.add(m));

  // Find api routes /api/...
  const apiMatches = content.match(/["']\/api\/[a-zA-Z0-9_\-\/]+["']/g) || [];
  apiMatches.forEach(m => allApi.add(m));

  // Find page routes
  const routeMatches = content.match(/["']\/(?:sat|act|practice|drill|exam|test|app|dashboard)[a-zA-Z0-9_\-\/]*["']/g) || [];
  routeMatches.forEach(m => allRoutes.add(m));
}

console.log('\n--- Supabase URLs ---');
console.log(Array.from(allSupabase));

console.log('\n--- Supabase Tables ---');
console.log(Array.from(allTables));

console.log('\n--- API Endpoints ---');
console.log(Array.from(allApi));

console.log('\n--- App Routes (sample) ---');
console.log(Array.from(allRoutes).slice(0, 30));
