import fs from 'node:fs';

async function inspectPage(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
    }
  });
  const html = await res.text();
  console.log(`\n=== URL: ${url} (Length: ${html.length}) ===`);
  
  // Extract scripts
  const scriptRegex = /src="(\/_next\/static\/[^"]+)"/g;
  let match;
  const scripts = [];
  while ((match = scriptRegex.exec(html)) !== null) {
    scripts.push(match[1]);
  }
  console.log(`Found ${scripts.length} Next.js scripts`);

  // Extract links
  const linkRegex = /href="([^"]+)"/g;
  const links = new Set();
  while ((match = linkRegex.exec(html)) !== null) {
    if (!match[1].startsWith('/_next') && !match[1].startsWith('https://fonts')) {
      links.add(match[1]);
    }
  }
  console.log('Links found:', Array.from(links));

  return scripts;
}

async function analyzeScript(scriptPath) {
  const url = 'https://www.whiz.study' + scriptPath;
  try {
    const res = await fetch(url);
    const code = await res.text();
    // Search for keywords
    const keywords = ['supabase', 'question', 'drill', 'exam', 'practice', 'clerk', 'api/'];
    const hits = {};
    for (const kw of keywords) {
      const count = (code.match(new RegExp(kw, 'gi')) || []).length;
      if (count > 0) hits[kw] = count;
    }
    if (Object.keys(hits).length > 2) {
      console.log(`Script: ${scriptPath} -> Hits:`, hits);
      // Let's search for interesting strings like table names or api endpoints
      const apiMatches = code.match(/["'](\/(?:api|[a-z0-9_-]+)\/[^"']+)["']/gi) || [];
      const interesting = apiMatches.filter(m => m.includes('exam') || m.includes('question') || m.includes('drill') || m.includes('sat') || m.includes('test'));
      if (interesting.length > 0) {
        console.log(`  Interesting endpoints/paths in ${scriptPath}:`, Array.from(new Set(interesting)).slice(0, 10));
      }
    }
  } catch (e) {
    console.error(`Error fetching script ${scriptPath}:`, e.message);
  }
}

async function main() {
  const scripts1 = await inspectPage('https://www.whiz.study/sat');
  const scripts2 = await inspectPage('https://www.whiz.study/exams');
  const allScripts = Array.from(new Set([...scripts1, ...scripts2]));

  console.log(`\nAnalyzing ${allScripts.length} unique scripts...`);
  for (const s of allScripts) {
    await analyzeScript(s);
  }
}

main();
