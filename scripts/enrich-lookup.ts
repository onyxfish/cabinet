/**
 * Artist enrichment — Phase 1: API lookup
 *
 * Queries Wikidata for each artist in the Obsidian vault, scores candidates,
 * extracts ULAN IDs via Wikidata property P245 (no separate ULAN search needed),
 * and writes a review CSV for human approval.
 *
 * Usage:
 *   pnpm tsx scripts/enrich-lookup.ts                    # process all artists
 *   pnpm tsx scripts/enrich-lookup.ts --resume           # skip artists already in CSV
 *   pnpm tsx scripts/enrich-lookup.ts --dry-run          # default test set, print to console
 *   pnpm tsx scripts/enrich-lookup.ts --dry-run "Name1" "Name2"
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
const RESUME = process.argv.includes('--resume');

const FILTER_NAMES = process.argv
  .slice(2)
  .filter(a => !a.startsWith('--'))
  .map(a => a.trim())
  .filter(Boolean);

const DRY_RUN_DEFAULT = [
  'Rembrandt van Rijn',
  'Albrecht Dürer',
  'James McNeill Whistler',
  'Käthe Kollwitz',
  'Childe Hassam',
];

// ─── Artist files to flag without API lookup ──────────────────────────────────

const FLAG_NAMES = new Set([
  'Alfred',               // incomplete name
  'C Sicard',             // initials only
  'W Marks',              // initials only
  'J G Wenig',            // initials only
  'J. Midgeon',           // initials only
  'Jean-Baptiste Le Prince 1', // numbered duplicate — needs manual resolution
  'Jean-Baptiste Le Prince 2',
  'Joseph-Marie Vien 1',
  'Joseph-Marie Vien 2',
  'Percy Delf Smith',     // apparent duplicate of Percy John Delf Smith
  'Bertha Jacques',       // apparent duplicate of Bertha Jaques
]);

// ─── Wikidata vocabulary ──────────────────────────────────────────────────────

// P106 (occupation) QIDs considered art-related
const ART_OCCUPATION_QIDS = new Set([
  'Q1028181',  // painter
  'Q1281618',  // printmaker
  'Q3805477',  // engraver
  'Q1925963',  // graphic artist
  'Q483501',   // artist
  'Q15296811', // draughtsperson
  'Q32571',    // illustrator
  'Q4610556',  // watercolor artist
  'Q1650915',  // sculptor
  'Q33231',    // photographer
  'Q644687',   // draftsman
  'Q1551650',  // etcher
  'Q1876552',  // landscape artist
  'Q22132980', // wood engraver
  'Q6579241',  // mezzotinter
]);

// P27 (country of citizenship) QID → nationality adjective
// Includes historical polities common for 16th–20th century European artists
const COUNTRY_TO_NATIONALITY: Record<string, string> = {
  // Modern states
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
  // Historical polities
  Q170072: 'Dutch',    // Dutch Republic
  Q47261:  'German',   // Duchy of Bavaria
  Q775899: 'German',   // Electorate of Bavaria
  Q12548:  'German',   // Holy Roman Empire
  Q161885: 'German',   // Electorate of Saxony
  Q153966: 'German',   // Margraviate of Brandenburg
  Q698721: 'German',   // Kingdom of Prussia
  Q152405: 'German',   // Kingdom of Württemberg
  Q41304:  'Flemish',  // Habsburg Netherlands (Spanish/Southern)
  Q23308:  'Flemish',  // Spanish Netherlands
  Q713750: 'Italian',  // Republic of Venice
  Q4948:   'Italian',  // Venetian Republic (alt)
  Q1425328:'Italian',  // Kingdom of Naples
  Q151624: 'Italian',  // Grand Duchy of Tuscany
  Q156199: 'Italian',  // Papal States
  Q836440: 'Italian',  // Duchy of Parma
  Q3975:   'Italian',  // Kingdom of Italy (unified)
  Q70972:  'French',   // Kingdom of France
  Q28513:  'Austrian', // Archduchy of Austria
  Q184199: 'Austrian', // Austrian Empire
  Q131964: 'Austrian', // Austro-Hungarian Empire
  Q5711:   'Spanish',  // Crown of Castile
  Q186318: 'Spanish',  // Kingdom of Spain (early modern)
  Q9266:   'British',  // Kingdom of England
  Q174193: 'British',  // Kingdom of Great Britain
  Q7318:   'British',  // United Kingdom of Great Britain and Ireland
  Q174745: 'Scottish', // Kingdom of Scotland
  Q43287:  'German',   // German Empire
  Q155:    'Brazilian', // Brazil
};


// ─── Types ───────────────────────────────────────────────────────────────────

interface ArtistRecord {
  file: string;
  name: string;
  currentBorn: number | null;
  currentDied: number | null;
  currentNationality: string | null;
  currentWikidata: string | null;
  currentUlan: string | null;
}

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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function normalise(s: string): string {
  return s.normalize('NFC').toLowerCase().trim();
}

function csvEscape(val: string | number | null | undefined): string {
  const s = val == null ? '' : String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toNum(val: unknown): number | null {
  if (val == null || val === '') return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

function toFirstStr(val: unknown): string | null {
  if (val == null || val === '') return null;
  if (Array.isArray(val)) return val.length > 0 ? String(val[0]) : null;
  return String(val);
}

// ─── Name matching (partial scoring to handle alternate labels) ───────────────

function nameMatchScore(wdLabel: string, artistName: string): number {
  const a = normalise(wdLabel);
  const b = normalise(artistName);
  if (a === b) return 40;
  // One name is a prefix of the other with a word boundary
  // handles "Rembrandt" vs "Rembrandt van Rijn"
  if (b.startsWith(a + ' ') || a.startsWith(b + ' ')) return 22;
  // One contains the other
  if (b.includes(a) || a.includes(b)) return 12;
  return 0;
}

function dateDiff(a: number | null, b: number | null): number | null {
  if (a == null || b == null) return null;
  return Math.abs(a - b);
}

// ─── API ─────────────────────────────────────────────────────────────────────

const UA = 'cabinet-enrich/1.0 (chrisgroskopf@gmail.com)';

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 429 || res.status === 503) {
        const wait = attempt * 2500;
        console.warn(`    ⚠ rate limited (${res.status}), waiting ${wait}ms…`);
        await sleep(wait);
        continue;
      }
      return res;
    } catch (e) {
      if (attempt === retries) throw e;
      await sleep(attempt * 1200);
    }
  }
  throw new Error(`Failed after ${retries} attempts: ${url}`);
}

async function wikidataSearch(name: string): Promise<Array<{ id: string; label: string }>> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('search', name);
  url.searchParams.set('language', 'en');
  url.searchParams.set('type', 'item');
  url.searchParams.set('limit', '7');
  url.searchParams.set('format', 'json');
  url.searchParams.set('uselang', 'en');

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) return [];
  const json = await res.json() as any;
  return (json.search || []).map((r: any) => ({
    id: r.id as string,
    label: String(r.label || ''),
  }));
}

interface EntityData {
  born: number | null;
  died: number | null;
  occupationIds: string[];
  citizenshipId: string | null;
  ulanId: string | null;
  isHuman: boolean;
}

async function wikidataEntity(id: string): Promise<EntityData> {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbgetentities');
  url.searchParams.set('ids', id);
  url.searchParams.set('props', 'claims');
  url.searchParams.set('format', 'json');

  const res = await fetchWithRetry(url.toString());
  if (!res.ok) return { born: null, died: null, occupationIds: [], citizenshipId: null, ulanId: null, isHuman: false };

  const json = await res.json() as any;
  const claims = json.entities?.[id]?.claims ?? {};

  const born = wikidataYear(claims.P569?.[0]?.mainsnak?.datavalue?.value?.time);
  const died = wikidataYear(claims.P570?.[0]?.mainsnak?.datavalue?.value?.time);
  const occupationIds: string[] = (claims.P106 || [])
    .map((c: any) => c.mainsnak?.datavalue?.value?.id as string)
    .filter(Boolean);
  const ulanId: string | null = claims.P245?.[0]?.mainsnak?.datavalue?.value ?? null;

  // P31 (instance of) — must include Q5 (human) to be a real person
  const instanceIds: string[] = (claims.P31 || [])
    .map((c: any) => c.mainsnak?.datavalue?.value?.id as string)
    .filter(Boolean);
  const isHuman = instanceIds.includes('Q5');

  // P27 (country of citizenship) — iterate all values, prefer one in our map
  const citizenshipIds: string[] = (claims.P27 || [])
    .map((c: any) => c.mainsnak?.datavalue?.value?.id as string)
    .filter(Boolean);
  // Try in reverse order (last claim often most specific/recent) then forward
  const orderedIds = [...citizenshipIds].reverse().concat(citizenshipIds);
  const citizenshipId = orderedIds.find(cid => COUNTRY_TO_NATIONALITY[cid]) ?? citizenshipIds[0] ?? null;

  return { born, died, occupationIds, citizenshipId, ulanId, isHuman };
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

interface Candidate {
  id: string;
  label: string;
  born: number | null;
  died: number | null;
  nationality: string | null;
  ulanId: string | null;
  hasArtOccupation: boolean;
  nameScore: number;
  dateScore: number;
  total: number;
}

function scoreCandidate(
  entity: EntityData,
  label: string,
  artist: ArtistRecord,
): Candidate {
  const nameScore = nameMatchScore(label, artist.name);

  let dateScore = 0;
  const bDiff = dateDiff(entity.born, artist.currentBorn);
  const dDiff = dateDiff(entity.died, artist.currentDied);

  // Bonus for matching dates; penalty for explicit contradictions
  if (bDiff != null) dateScore += bDiff <= 1 ? 25 : (bDiff <= 5 ? 0 : -20);
  if (dDiff != null) dateScore += dDiff <= 1 ? 15 : (dDiff <= 5 ? 0 : -15);

  const hasArtOccupation = entity.occupationIds.some(id => ART_OCCUPATION_QIDS.has(id));
  const occupationScore = hasArtOccupation ? 10 : 0;

  const nationality = entity.citizenshipId
    ? (COUNTRY_TO_NATIONALITY[entity.citizenshipId] ?? null)
    : null;

  return {
    id: '', label, born: entity.born, died: entity.died,
    nationality, ulanId: entity.ulanId, hasArtOccupation,
    nameScore, dateScore,
    total: nameScore + dateScore + occupationScore,
  };
}

// ─── Lookup one artist ────────────────────────────────────────────────────────

async function lookupArtist(artist: ArtistRecord): Promise<CsvRow> {
  const base = {
    file: artist.file,
    artist_name: artist.name,
    current_born: artist.currentBorn?.toString() ?? '',
    current_died: artist.currentDied?.toString() ?? '',
    current_nationality: artist.currentNationality ?? '',
  };
  const empty: CsvRow = {
    ...base,
    wikidata_id: '', wikidata_score: '', wikidata_born: '', wikidata_died: '', wikidata_nationality: '',
    ulan_id: '', ulan_score: '', ulan_born: '', ulan_died: '',
    status: 'skip', notes: '',
  };

  if (FLAG_NAMES.has(artist.name)) {
    return { ...empty, status: 'flag', notes: 'requires manual resolution' };
  }

  let best: (Candidate & { id: string }) | null = null;

  try {
    const searchResults = await wikidataSearch(artist.name);
    await sleep(350);

    for (const result of searchResults.slice(0, 5)) {
      const nScore = nameMatchScore(result.label, artist.name);
      if (nScore === 0) continue; // no name similarity at all — skip without fetching entity

      const entity = await wikidataEntity(result.id);
      await sleep(350);

      // Skip non-human entities (paintings, monuments, etc.)
      if (!entity.isHuman && entity.occupationIds.length === 0) continue;

      const candidate = scoreCandidate(entity, result.label, artist);
      candidate.id = result.id;

      if (!best || candidate.total > best.total) best = candidate as Candidate & { id: string };
    }
  } catch (e) {
    console.warn(`    ⚠ Wikidata error for "${artist.name}": ${e}`);
    return { ...empty, status: 'skip', notes: `wikidata error: ${e}` };
  }

  if (!best || best.nameScore === 0) {
    return { ...empty, status: 'skip' };
  }

  // ── Determine status ──────────────────────────────────────────────────────
  let status: string;
  let notes = '';

  const hasConflict = best.dateScore < -5;

  if (hasConflict) {
    status = 'review';
    notes = 'date conflict with existing data';
  } else if (best.nameScore === 40 && best.total >= 65) {
    // Exact name match + at least one date confirmed or art occupation
    status = 'auto';
  } else if (best.nameScore === 40 && best.total >= 50) {
    // Exact name match but no date confirmation (file had no dates)
    status = 'auto';
  } else if (best.nameScore >= 22 && best.total >= 40) {
    // Partial name match with supporting evidence
    status = 'review';
    notes = 'partial name match — verify';
  } else if (best.total >= 30) {
    status = 'review';
  } else {
    status = 'skip';
  }

  // Sanity: never auto-accept if it's a partial name match without date evidence
  if (status === 'auto' && best.nameScore < 40 && best.dateScore <= 0) {
    status = 'review';
    notes = 'partial name match, no date evidence';
  }
  // Always annotate partial name matches so the reviewer knows why
  if (best.nameScore < 40 && !notes) {
    notes = 'partial name match — verify';
  }

  return {
    ...base,
    wikidata_id: best.id,
    wikidata_score: String(best.total),
    wikidata_born: best.born?.toString() ?? '',
    wikidata_died: best.died?.toString() ?? '',
    wikidata_nationality: best.nationality ?? '',
    ulan_id: best.ulanId ?? '',
    ulan_score: best.ulanId ? String(best.total) : '',  // inherit Wikidata confidence
    ulan_born: '',
    ulan_died: '',
    status,
    notes,
  };
}

// ─── CSV ─────────────────────────────────────────────────────────────────────

const CSV_HEADERS: (keyof CsvRow)[] = [
  'file', 'artist_name', 'current_born', 'current_died', 'current_nationality',
  'wikidata_id', 'wikidata_score', 'wikidata_born', 'wikidata_died', 'wikidata_nationality',
  'ulan_id', 'ulan_score', 'ulan_born', 'ulan_died',
  'status', 'notes',
];

function rowToCsvLine(row: CsvRow): string {
  return CSV_HEADERS.map(h => csvEscape(row[h])).join(',');
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const files = fs.readdirSync(ARTISTS_DIR).filter(f => f.endsWith('.md')).sort();

  const allArtists: ArtistRecord[] = files.map(file => {
    const raw = fs.readFileSync(path.join(ARTISTS_DIR, file), 'utf-8');
    const { data } = matter(raw);
    const name = file.replace(/\.md$/, '');
    const natArr = data['Nationality'];
    const nationality = Array.isArray(natArr) && natArr.length > 0
      ? String(natArr[0])
      : (typeof natArr === 'string' && natArr ? natArr : null);
    return {
      file,
      name,
      currentBorn: toNum(data['Born']),
      currentDied: toNum(data['Died']),
      currentNationality: nationality,
      currentWikidata: toFirstStr(data['Wikidata']),
      currentUlan: toFirstStr(data['ULAN']),
    };
  });

  let toProcess = allArtists;

  if (DRY_RUN) {
    const names = FILTER_NAMES.length > 0 ? FILTER_NAMES : DRY_RUN_DEFAULT;
    toProcess = allArtists.filter(a => names.includes(a.name));
    if (toProcess.length === 0) {
      console.error('No matching artists found for:', names);
      process.exit(1);
    }
  } else if (FILTER_NAMES.length > 0) {
    toProcess = allArtists.filter(a => FILTER_NAMES.includes(a.name));
  } else if (RESUME) {
    const existing = new Set<string>();
    if (fs.existsSync(CSV_PATH)) {
      const lines = fs.readFileSync(CSV_PATH, 'utf-8').split('\n').slice(1);
      for (const line of lines) {
        if (line.trim()) existing.add(line.split(',')[0].replace(/^"|"$/g, ''));
      }
    }
    toProcess = allArtists.filter(a => !existing.has(a.file));
    console.log(`Resuming: ${existing.size} already done, ${toProcess.length} remaining`);
  }

  if (!DRY_RUN) {
    const before = toProcess.length;
    toProcess = toProcess.filter(a => !a.currentWikidata || !a.currentUlan);
    if (before !== toProcess.length) {
      console.log(`Skipping ${before - toProcess.length} artists already fully enriched`);
    }
  }

  console.log(`Processing ${toProcess.length} artists${DRY_RUN ? ' (dry run)' : ''}…\n`);

  let csvLines: string[] = [];
  let appendMode = false;

  if (!DRY_RUN) {
    if (RESUME && fs.existsSync(CSV_PATH)) {
      appendMode = true;
    } else {
      csvLines.push(CSV_HEADERS.join(','));
    }
  }

  for (let i = 0; i < toProcess.length; i++) {
    const artist = toProcess[i];
    process.stdout.write(`[${i + 1}/${toProcess.length}] ${artist.name}… `);

    const row = await lookupArtist(artist);

    const emoji = { auto: '✓', review: '?', skip: '–', flag: '⚑' }[row.status] ?? ' ';
    const ulanStr = row.ulan_id ? `ulan:${row.ulan_id}` : 'ulan:—';
    console.log(`${emoji}  wd:${row.wikidata_id || '—'} ${ulanStr} (score:${row.wikidata_score || '—'} ${row.status})${row.notes ? '  ' + row.notes : ''}`);

    if (DRY_RUN) {
      const out = {
        wikidata: row.wikidata_id || null,
        wikidata_score: row.wikidata_score ? Number(row.wikidata_score) : null,
        wikidata_born: row.wikidata_born || null,
        wikidata_died: row.wikidata_died || null,
        wikidata_nationality: row.wikidata_nationality || null,
        ulan: row.ulan_id || null,
        status: row.status,
        notes: row.notes || null,
      };
      console.log('  ', JSON.stringify(out));
    } else {
      csvLines.push(rowToCsvLine(row));
    }

    // Flush every 10 rows so a crash doesn't lose progress
    if (!DRY_RUN && csvLines.length >= 10) {
      if (appendMode) {
        fs.appendFileSync(CSV_PATH, csvLines.join('\n') + '\n');
      } else {
        fs.writeFileSync(CSV_PATH, csvLines.join('\n') + '\n');
        appendMode = true;
      }
      csvLines = [];
    }

    if (i < toProcess.length - 1) await sleep(400);
  }

  if (!DRY_RUN && csvLines.length > 0) {
    if (appendMode) {
      fs.appendFileSync(CSV_PATH, csvLines.join('\n') + '\n');
    } else {
      fs.writeFileSync(CSV_PATH, csvLines.join('\n') + '\n');
    }
  }

  if (!DRY_RUN) {
    console.log(`\n✓ Written to ${CSV_PATH}`);
    console.log('  Next: review the CSV, change status to "accept"/"reject", then run enrich-apply.ts');
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
