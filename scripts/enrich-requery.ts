/**
 * Artist enrichment — Phase 1b: Re-query Wikidata for revised IDs
 *
 * After human review of artists-enrichment.csv, some wikidata_id values will
 * have been corrected or added manually. This script re-fetches the entity
 * data for every row that has a wikidata_id and updates the data columns
 * (wikidata_born, wikidata_died, wikidata_nationality, ulan_id, ulan_score)
 * in place, leaving all other columns — especially wikidata_id, status, and
 * notes — exactly as the reviewer left them.
 *
 * Usage:
 *   pnpm tsx scripts/enrich-requery.ts
 *   pnpm tsx scripts/enrich-requery.ts --dry-run   # print changes, don't write
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

const CSV_PATH = path.join(import.meta.dirname, 'artists-enrichment.csv');
const DRY_RUN = process.argv.includes('--dry-run');

// ─── Country QID → nationality (same map as enrich-lookup.ts) ────────────────

const COUNTRY_TO_NATIONALITY: Record<string, string> = {
  Q183: 'German', Q31: 'Belgian', Q38: 'Italian', Q142: 'French',
  Q145: 'British', Q29: 'Spanish', Q55: 'Dutch', Q40: 'Austrian',
  Q39: 'Swiss', Q36: 'Polish', Q20: 'Norwegian', Q34: 'Swedish',
  Q35: 'Danish', Q45: 'Portuguese', Q30: 'American', Q16: 'Canadian',
  Q28: 'Hungarian', Q213: 'Czech', Q214: 'Slovak', Q174: 'Mexican',
  Q155: 'Brazilian', Q419: 'Peruvian', Q33: 'Finnish', Q218: 'Romanian',
  Q219: 'Bulgarian', Q212: 'Ukrainian', Q159: 'Russian', Q189: 'Icelandic',
  Q211: 'Latvian', Q37: 'Lithuanian', Q191: 'Estonian', Q17: 'Japanese',
  Q148: 'Chinese', Q884: 'South Korean', Q408: 'Australian', Q664: 'New Zealander',
  Q258: 'South African', Q224: 'Croatian', Q215: 'Slovenian', Q241: 'Cuban',
  Q414: 'Argentine', Q298: 'Chilean',
  Q170072: 'Dutch', Q47261: 'German', Q775899: 'German', Q12548: 'German',
  Q161885: 'German', Q153966: 'German', Q698721: 'German', Q152405: 'German',
  Q41304: 'Flemish', Q23308: 'Flemish',
  Q713750: 'Italian', Q4948: 'Italian', Q1425328: 'Italian', Q151624: 'Italian',
  Q156199: 'Italian', Q836440: 'Italian', Q3975: 'Italian',
  Q70972: 'French',
  Q28513: 'Austrian', Q184199: 'Austrian', Q131964: 'Austrian',
  Q5711: 'Spanish', Q186318: 'Spanish',
  Q9266: 'British', Q174193: 'British', Q7318: 'British', Q174745: 'Scottish',
  Q43287: 'German',
};

// ─── Wikidata API ─────────────────────────────────────────────────────────────

const UA = 'cabinet-enrich/1.0 (chrisgroskopf@gmail.com)';

function sleep(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}

function wikidataYear(timeStr: string | undefined): number | null {
  if (!timeStr) return null;
  const m = timeStr.match(/^[+-]0*(\d+)/);
  if (!m) return null;
  const yr = parseInt(m[1]);
  return yr === 0 ? null : yr;
}

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status === 503) {
        const wait = attempt * 2500;
        console.warn(`  ⚠ rate limited (${res.status}), waiting ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(attempt * 1200);
    }
  }
  throw new Error(`Failed after ${retries} attempts`);
}

interface EntityData {
  born: number | null;
  died: number | null;
  nationality: string | null;
  ulanId: string | null;
}

async function fetchEntity(wikidataId: string): Promise<EntityData> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', wikidataId);
  url.searchParams.set('props', 'claims');
  url.searchParams.set('format', 'json');

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const json = await res.json() as any;
  const claims = json.entities?.[wikidataId]?.claims ?? {};

  const born = wikidataYear(claims.P569?.[0]?.mainsnak?.datavalue?.value?.time);
  const died = wikidataYear(claims.P570?.[0]?.mainsnak?.datavalue?.value?.time);
  const ulanId: string | null = claims.P245?.[0]?.mainsnak?.datavalue?.value ?? null;

  // Try all P27 claims, prefer one that maps to a known nationality
  const citizenshipIds: string[] = (claims.P27 || [])
    .map((c: any) => c.mainsnak?.datavalue?.value?.id as string)
    .filter(Boolean);
  const orderedIds = [...citizenshipIds].reverse().concat(citizenshipIds);
  const citizenshipId = orderedIds.find(id => COUNTRY_TO_NATIONALITY[id]) ?? citizenshipIds[0] ?? null;
  const nationality = citizenshipId ? (COUNTRY_TO_NATIONALITY[citizenshipId] ?? null) : null;

  return { born, died, nationality, ulanId };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

function splitCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = false;
      } else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

function csvEscape(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}\nRun enrich-lookup.ts first.`);
    process.exit(1);
  }

  const raw = fs.readFileSync(CSV_PATH, 'utf-8');
  const lines = raw.split('\n');
  const headerLine = lines[0];
  const headers = splitCsvLine(headerLine);
  const dataLines = lines.slice(1);

  const toRequery = dataLines.filter(l => {
    if (!l.trim()) return false;
    const fields = splitCsvLine(l);
    const wikidataId = fields[headers.indexOf('wikidata_id')] ?? '';
    return wikidataId.trim().length > 0;
  });

  const total = toRequery.length;
  console.log(`${total} rows with a wikidata_id to re-query${DRY_RUN ? ' (dry run)' : ''}…\n`);

  // Build a map of file → updated row values
  const updates = new Map<string, Partial<Record<string, string>>>();

  for (let i = 0; i < toRequery.length; i++) {
    const fields = splitCsvLine(toRequery[i]);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = fields[j] ?? '';

    const wikidataId = row['wikidata_id'].trim();
    process.stdout.write(`[${i + 1}/${total}] ${row['artist_name']} (${wikidataId})… `);

    try {
      const entity = await fetchEntity(wikidataId);

      const patch: Partial<Record<string, string>> = {
        wikidata_born:        entity.born?.toString() ?? '',
        wikidata_died:        entity.died?.toString() ?? '',
        wikidata_nationality: entity.nationality ?? '',
        ulan_id:              entity.ulanId ?? '',
        ulan_score:           entity.ulanId ? (row['wikidata_score'] || 'manual') : '',
        ulan_born:            '',
        ulan_died:            '',
      };

      // Report changes
      const changed: string[] = [];
      for (const [k, v] of Object.entries(patch)) {
        if (row[k] !== v) changed.push(`${k}: ${row[k] || '∅'} → ${v || '∅'}`);
      }

      if (changed.length === 0) {
        console.log('no change');
      } else {
        console.log(changed.join(', '));
      }

      updates.set(row['file'], patch);
    } catch (e) {
      console.log(`⚠ error: ${e}`);
      updates.set(row['file'], {}); // no change on error
    }

    if (i < toRequery.length - 1) await sleep(500);
  }

  if (DRY_RUN) {
    console.log('\nDry run — no file written.');
    return;
  }

  // Rewrite CSV: apply patches row by row, preserve everything else
  const outputLines: string[] = [headerLine];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const fields = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) row[headers[j]] = fields[j] ?? '';

    const patch = updates.get(row['file']);
    if (patch) Object.assign(row, patch);

    outputLines.push(headers.map(h => csvEscape(row[h])).join(','));
  }

  fs.writeFileSync(CSV_PATH, outputLines.join('\n') + '\n');
  console.log(`\n✓ Updated ${CSV_PATH}`);
  console.log('  Next: run enrich-apply.ts --dry-run, then enrich-apply.ts');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
