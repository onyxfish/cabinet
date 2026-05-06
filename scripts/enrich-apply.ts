/**
 * Artist enrichment — Phase 3: Apply approved matches
 *
 * Reads the reviewed CSV produced by enrich-lookup.ts and writes
 * Wikidata/ULAN IDs and missing biographical data back to Obsidian
 * artist Markdown files.
 *
 * Only processes rows with status "auto" or "accept".
 * Never overwrites existing Born/Died/Nationality values — fills gaps only.
 * Wikidata and ULAN fields are always set (they're new).
 *
 * Usage:
 *   pnpm tsx scripts/enrich-apply.ts           # apply accepted rows
 *   pnpm tsx scripts/enrich-apply.ts --dry-run # print diffs, don't write
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';

// ─── Config ──────────────────────────────────────────────────────────────────

const VAULT = process.env.VAULT_PATH || '/Users/cgroskop/Documents/obsidian/life/Collections';
const ARTISTS_DIR = path.join(VAULT, 'Artists');
const CSV_PATH = path.join(import.meta.dirname, 'artists-enrichment.csv');

const DRY_RUN = process.argv.includes('--dry-run');

// ─── CSV Parsing ─────────────────────────────────────────────────────────────

interface CsvRow {
  file: string;
  artist_name: string;
  current_born: string;
  current_died: string;
  current_nationality: string;
  wikidata_id: string;
  wikidata_score: string;
  wikidata_born: string;
  wikidata_died: string;
  wikidata_nationality: string;
  ulan_id: string;
  ulan_score: string;
  ulan_born: string;
  ulan_died: string;
  status: string;
  notes: string;
}

function parseCsv(content: string): CsvRow[] {
  const lines = content.split('\n').filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = splitCsvLine(lines[0]);
  const rows: CsvRow[] = [];

  for (const line of lines.slice(1)) {
    const values = splitCsvLine(line);
    const row: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      row[headers[i]] = values[i] ?? '';
    }
    rows.push(row as CsvRow);
  }

  return rows;
}

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
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ',') { fields.push(current); current = ''; }
      else { current += ch; }
    }
  }
  fields.push(current);
  return fields;
}

// ─── Frontmatter Update ───────────────────────────────────────────────────────

function isEmptyValue(val: unknown): boolean {
  if (val == null || val === '') return true;
  if (Array.isArray(val)) return val.length === 0;
  return false;
}

function applyToFrontmatter(
  data: Record<string, unknown>,
  row: CsvRow,
): { data: Record<string, unknown>; changed: string[] } {
  const updated = { ...data };
  const changed: string[] = [];

  // Always set Wikidata and ULAN (new fields, no collision risk)
  if (row.wikidata_id && updated['Wikidata'] !== row.wikidata_id) {
    updated['Wikidata'] = row.wikidata_id;
    changed.push(`Wikidata → ${row.wikidata_id}`);
  }
  if (row.ulan_id && updated['ULAN'] !== row.ulan_id) {
    updated['ULAN'] = row.ulan_id;
    changed.push(`ULAN → ${row.ulan_id}`);
  }

  // Fill Born only if currently empty
  if (row.wikidata_born && isEmptyValue(updated['Born'])) {
    updated['Born'] = parseInt(row.wikidata_born);
    changed.push(`Born → ${row.wikidata_born}`);
  }

  // Fill Died only if currently empty
  if (row.wikidata_died && isEmptyValue(updated['Died'])) {
    updated['Died'] = parseInt(row.wikidata_died);
    changed.push(`Died → ${row.wikidata_died}`);
  }

  // Fill Nationality only if currently empty array/null
  if (row.wikidata_nationality && isEmptyValue(updated['Nationality'])) {
    updated['Nationality'] = [row.wikidata_nationality];
    changed.push(`Nationality → ${row.wikidata_nationality}`);
  }

  // Rebuild with Wikidata and ULAN positioned after Biography
  const ordered = insertAfter(updated, 'Biography', ['Wikidata', 'ULAN']);

  return { data: ordered, changed };
}

// Return a copy of `obj` with `keys` moved to immediately after `anchor`.
// Keys that don't exist in obj are skipped. If anchor isn't found, the keys
// stay at the end (their natural insertion position).
function insertAfter(
  obj: Record<string, unknown>,
  anchor: string,
  keys: string[],
): Record<string, unknown> {
  const keysSet = new Set(keys);
  const result: Record<string, unknown> = {};

  for (const k of Object.keys(obj)) {
    if (keysSet.has(k)) continue; // will be inserted at the anchor position
    result[k] = obj[k];
    if (k === anchor) {
      for (const extra of keys) {
        if (extra in obj) result[extra] = obj[extra];
      }
    }
  }

  // If anchor wasn't present, append any remaining keys at the end
  for (const k of keys) {
    if (!(k in result) && k in obj) result[k] = obj[k];
  }

  return result;
}

// ─── gray-matter stringify with stable field order ────────────────────────────

// Preserve the file's existing content and only modify frontmatter fields.
// We do this by using gray-matter to re-stringify, which keeps the body intact.
function rebuildFile(originalRaw: string, newData: Record<string, unknown>): string {
  const { content } = matter(originalRaw);
  // gray-matter stringify uses js-yaml under the hood
  return matter.stringify(content, newData);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found: ${CSV_PATH}`);
    console.error('Run enrich-lookup.ts first.');
    process.exit(1);
  }

  const csv = fs.readFileSync(CSV_PATH, 'utf-8');
  const rows = parseCsv(csv);

  const toApply = rows.filter(r => r.status === 'auto' || r.status === 'accept');
  const skipped = rows.length - toApply.length;

  console.log(`CSV: ${rows.length} rows total — ${toApply.length} to apply, ${skipped} skipped`);
  if (DRY_RUN) console.log('DRY RUN — no files will be written\n');

  let applied = 0;
  let unchanged = 0;
  let missing = 0;

  for (const row of toApply) {
    const filePath = path.join(ARTISTS_DIR, row.file);

    if (!fs.existsSync(filePath)) {
      console.warn(`  ⚠ File not found: ${row.file}`);
      missing++;
      continue;
    }

    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    const { data: newData, changed } = applyToFrontmatter(data, row);

    if (changed.length === 0) {
      unchanged++;
      continue;
    }

    console.log(`  ${row.artist_name}`);
    for (const c of changed) console.log(`    + ${c}`);

    if (!DRY_RUN) {
      const newRaw = rebuildFile(raw, newData);
      fs.writeFileSync(filePath, newRaw, 'utf-8');
    }

    applied++;
  }

  console.log(`\n${DRY_RUN ? '[dry run] would apply' : 'Applied'}: ${applied} files updated, ${unchanged} already complete, ${missing} not found`);

  if (DRY_RUN && applied > 0) {
    console.log('\nRun without --dry-run to apply changes.');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
