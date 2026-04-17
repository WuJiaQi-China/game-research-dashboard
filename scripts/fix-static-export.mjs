/**
 * Fix for Next.js 16 Turbopack static export bug.
 *
 * Problem:
 *   Turbopack generates RSC prefetch files at nested paths like
 *     out/browse/__next.browse/__PAGE__.txt
 *   But the client-side router requests them at flat paths like
 *     /browse/__next.browse.__PAGE__.txt
 *
 *   Result: every prefetch returns 404 -> Next.js falls back to a full
 *   hard navigation on every link click, wiping all in-memory state
 *   (React Query cache, WeakMap caches, etc.) and forcing re-downloads
 *   of HTML + JS chunks. KPI cards then reload from Firestore in 1-2s
 *   on every page switch.
 *
 * Fix:
 *   Mirror every `out/<route>/__next.<route>/__PAGE__.txt` to the flat
 *   filename `out/<route>/__next.<route>.__PAGE__.txt` so the client
 *   prefetch URLs resolve to 200.
 */

import { copyFile, readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const OUT_DIR = 'out';

async function findPageFiles(dir) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      // If this directory is a nested "__next.<route>" folder containing
      // __PAGE__.txt, schedule a flat copy.
      if (entry.name.startsWith('__next.')) {
        const pageFile = join(full, '__PAGE__.txt');
        try {
          const s = await stat(pageFile);
          if (s.isFile()) {
            const flatTarget = `${full}.__PAGE__.txt`;
            results.push({ src: pageFile, dst: flatTarget });
          }
        } catch {
          // __PAGE__.txt doesn't exist here; ignore
        }
      }
      // Recurse further (e.g., to reach nested segments like /foo/bar/)
      const sub = await findPageFiles(full);
      results.push(...sub);
    }
  }
  return results;
}

const copies = await findPageFiles(OUT_DIR);

if (copies.length === 0) {
  console.log('[fix-static-export] No __next.*/__PAGE__.txt files found; nothing to do.');
  process.exit(0);
}

for (const { src, dst } of copies) {
  await copyFile(src, dst);
  console.log(`[fix-static-export] ${src}  ->  ${dst}`);
}

console.log(`[fix-static-export] Patched ${copies.length} file(s).`);
