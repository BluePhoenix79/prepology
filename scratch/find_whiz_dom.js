import fs from 'node:fs';
import path from 'node:path';

const dir = 'scratch/chunks';
const files = fs.readdirSync(dir);

console.log('Searching for DOM selectors, React props, and Question representations...');

for (const file of files) {
  if (!file.endsWith('.js')) continue;
  const content = fs.readFileSync(path.join(dir, file), 'utf8');

  // Search for JSX element structures or classNames related to questions
  const classMatches = content.match(/className:\s*["']([^"']*(?:question|choice|passage|option|stem|module|answer)[^"']*)["']/gi) || [];
  if (classMatches.length > 0) {
    console.log(`\nFound classNames in ${file}:`);
    console.log(classMatches.slice(0, 10));
  }

  // Search for data-testid or data attributes
  const dataMatches = content.match(/data-[a-zA-Z0-9_\-]+=["']([^"']+)["']/g) || [];
  if (dataMatches.length > 0) {
    console.log(`\nFound data attributes in ${file}:`);
    console.log(Array.from(new Set(dataMatches)).slice(0, 15));
  }

  // Search for exact object property patterns for Question in Whiz
  const propMatches = content.match(/([a-zA-Z0-9_$]+)\s*:\s*(?:function|\([^)]*\)\s*=>|{[^}]*question)/g) || [];
  
  // Search for how Next.js actions or API routes are called
  const fetchPatterns = content.match(/(?:fetch|post|get)\s*\(\s*["'\`]([^"'\`]+)["'\`]/gi) || [];
  if (fetchPatterns.length > 0) {
    console.log(`\nFetch calls in ${file}:`, fetchPatterns.slice(0, 10));
  }
}
