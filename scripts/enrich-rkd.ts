/**
 * Enrich Obsidian artist notes with RKDArtists identifiers.
 *
 * For each artist note that has a Wikidata ID but no RKDArtists field,
 * queries the Wikidata SPARQL endpoint for property P650 (RKDArtists ID)
 * and inserts the result after the ULAN line in the frontmatter.
 *
 * Run with: pnpm tsx scripts/enrich-rkd.ts [--dry-run]
 *
 * Required environment variables (set in .env):
 *   VAULT_PATH - Absolute path to the vault root
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

const DRY_RUN = process.argv.includes('--dry-run');
const DELAY_MS = 200; // polite delay between Wikidata requests

const VAULT = process.env.VAULT_PATH;
if (!VAULT) {
  console.error('Error: VAULT_PATH environment variable is required.');
  process.exit(1);
}
const ARTISTS_DIR = path.join(VAULT, 'Artists');

// ─── Wikidata lookup ──────────────────────────────────────────────────────────

async function fetchRkdId(wikidataId: string): Promise<string | null> {
  const sparql = `SELECT ?rkd WHERE { wd:${wikidataId} wdt:P650 ?rkd . }`;
  const url = `https://query.wikidata.org/sparql?query=${encodeURIComponent(sparql)}&format=json`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'cabinet-enrich-rkd/1.0 (https://github.com/cgroskopf/cabinet)' },
  });
  if (!res.ok) throw new Error(`Wikidata SPARQL error: ${res.status} ${res.statusText}`);
  const json = await res.json() as { results: { bindings: { rkd: { value: string } }[] } };
  const binding = json.results.bindings[0];
  return binding ? binding.rkd.value : null;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─── Frontmatter insertion ────────────────────────────────────────────────────

function insertRkdAfterUlan(raw: string, rkdId: string): string {
  const line = `RKDArtists: '${rkdId}'`;
  // Insert after ULAN line if present
  if (/^ULAN:/m.test(raw)) {
    return raw.replace(/^(ULAN:.*)/m, `$1\n${line}`);
  }
  // Otherwise insert after Wikidata line
  if (/^Wikidata:/m.test(raw)) {
    return raw.replace(/^(Wikidata:.*)/m, `$1\n${line}`);
  }
  // Fallback: insert before closing ---
  return raw.replace(/^(---\s*$)/m, `${line}\n$1`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (DRY_RUN) console.log('DRY RUN — no files will be written\n');

  const files = fs.readdirSync(ARTISTS_DIR)
    .filter(f => f.endsWith('.md'))
    .map(f => path.join(ARTISTS_DIR, f));

  const stats = { enriched: 0, alreadyHad: 0, noWikidata: 0, noMatch: 0, errors: 0 };

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    if (data['RKDArtists'] != null) {
      stats.alreadyHad++;
      continue;
    }

    const wikidataId = data['Wikidata'] ? String(data['Wikidata']) : null;
    if (!wikidataId) {
      stats.noWikidata++;
      continue;
    }

    try {
      await sleep(DELAY_MS);
      const rkdId = await fetchRkdId(wikidataId);

      if (!rkdId) {
        stats.noMatch++;
        continue;
      }

      const updated = insertRkdAfterUlan(raw, rkdId);
      const name = path.basename(filePath, '.md');

      if (DRY_RUN) {
        console.log(`[dry-run] ${name}: RKDArtists = '${rkdId}'`);
      } else {
        fs.writeFileSync(filePath, updated, 'utf-8');
        console.log(`${name}: RKDArtists = '${rkdId}'`);
      }
      stats.enriched++;
    } catch (err) {
      console.error(`Error processing ${path.basename(filePath)}: ${err}`);
      stats.errors++;
    }
  }

  console.log(`
Summary:
  Enriched:    ${stats.enriched}
  Already had: ${stats.alreadyHad}
  No Wikidata: ${stats.noWikidata}
  No P650:     ${stats.noMatch}
  Errors:      ${stats.errors}
`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
