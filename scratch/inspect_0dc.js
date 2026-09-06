import fs from 'node:fs';

const content = fs.readFileSync('scratch/chunks/0dc2tlcqvnqtu.js', 'utf8');

// Find all export/object keys or schemas in 0dc2tlcqvnqtu.js
console.log('0dc2tlcqvnqtu.js size:', content.length);

// Let's search for exam names or question types
const exams = content.match(/name:\s*["']([^"']+)["']/g) || [];
console.log('Exams/names found:', Array.from(new Set(exams)).slice(0, 30));

// Let's search for routes or actions
const actions = content.match(/(?:action|route|path|endpoint):\s*["']([^"']+)["']/g) || [];
console.log('Actions/routes found:', Array.from(new Set(actions)).slice(0, 30));

// Let's search for data fetching / state management
const fetches = content.match(/(?:fetch|axios|get|post)\s*\([^)]*\)/gi) || [];
console.log('Fetches found:', fetches.slice(0, 10));
