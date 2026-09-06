import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const homeRes = await fetch('https://www.whiz.study');
  const homeHtml = await homeRes.text();
  
  // Find all script tags
  const scripts = [...homeHtml.matchAll(/src="(\/_next\/static\/chunks\/[^"]+)"/g)].map(m => m[1]);
  console.log(`Found ${scripts.length} chunk scripts.`);

  const outDir = 'scratch/chunks';
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  for (const s of scripts) {
    const filename = path.basename(s.split('?')[0]);
    const filePath = path.join(outDir, filename);
    if (!fs.existsSync(filePath)) {
      try {
        const res = await fetch('https://www.whiz.study' + s);
        const text = await res.text();
        fs.writeFileSync(filePath, text);
        console.log(`Downloaded ${filename} (${text.length} bytes)`);
      } catch (e) {
        console.error(`Failed ${filename}: ${e.message}`);
      }
    }
  }

  // Also check if build manifest exists: /_next/static/<buildId>/_buildManifest.js
  const buildIdMatch = homeHtml.match(/data-dpl-id="([^"]+)"/);
  console.log('Build/Deployment ID:', buildIdMatch ? buildIdMatch[1] : 'not found');
}

main();
