import fs from 'node:fs';

async function checkManifests() {
  const dplId = 'dpl_zDU8Wp5xfGvtJWZxnbiNZYusMurE';
  const urls = [
    `https://www.whiz.study/_next/static/${dplId}/_buildManifest.js`,
    `https://www.whiz.study/_next/static/${dplId}/_ssgManifest.js`,
    `https://www.whiz.study/_next/static/development/_buildManifest.js`,
    `https://www.whiz.study/_next/static/chunks/app-pages-internals.js`,
  ];

  for (const u of urls) {
    const res = await fetch(u);
    console.log(`${u} -> Status: ${res.status}`);
    if (res.status === 200) {
      const text = await res.text();
      console.log(`  Content preview: ${text.slice(0, 300)}`);
    }
  }
}

// Also let's inspect turbopack chunk
function inspectTurbopack() {
  const content = fs.readFileSync('scratch/chunks/turbopack-08n3kv89s9cji.js', 'utf8');
  console.log('Turbopack length:', content.length);
  // Match chunk filenames
  const chunkNames = content.match(/[0-9a-z_\-]+\.js/g) || [];
  console.log('Turbopack referenced chunks:', Array.from(new Set(chunkNames)));
}

async function main() {
  await checkManifests();
  inspectTurbopack();
}

main();
