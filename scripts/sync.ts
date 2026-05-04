/**
 * Cabinet sync pipeline
 *
 * Reads the Obsidian vault, extracts public fields from each print/drawing note,
 * uploads images to Cloudflare R2, and writes JSON content collection entries.
 *
 * Run with: pnpm sync
 *
 * Required environment variables (set in .env):
 *   VAULT_PATH          - Absolute path to the vault root
 *   R2_ACCOUNT_ID       - Cloudflare account ID
 *   R2_ACCESS_KEY_ID    - R2 API token key ID
 *   R2_SECRET_ACCESS_KEY - R2 API token secret
 *   R2_BUCKET_NAME      - R2 bucket name
 *   R2_PUBLIC_URL       - Public base URL for R2 (e.g. https://pub-abc.r2.dev)
 */

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { glob } from 'node:fs/promises';
import matter from 'gray-matter';
import sharp from 'sharp';
import { S3Client, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// ─── Config ──────────────────────────────────────────────────────────────────

const VAULT = process.env.VAULT_PATH || '/Users/cgroskop/Documents/obsidian/life/Collections';
const PRINTS_DIR = path.join(VAULT, 'Prints & Drawings');
const ARTISTS_DIR = path.join(VAULT, 'Artists');
const CONTENT_DIR = path.join(import.meta.dirname, '..', 'src', 'content', 'works');
const MANIFEST_PATH = path.join(import.meta.dirname, '.image-manifest.json');

const R2_BUCKET = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL!;

// ─── R2 Client ───────────────────────────────────────────────────────────────

const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

// ─── Manifest ────────────────────────────────────────────────────────────────

type Manifest = Record<string, { url: string; mtime: number }>;

function loadManifest(): Manifest {
  try {
    return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
  } catch {
    return {};
  }
}

function saveManifest(manifest: Manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

// ─── Wikilink Parsing ────────────────────────────────────────────────────────

function extractWikilinkName(raw: string): string {
  // [[Collections/Artists/Salvator Rosa|Salvator Rosa]] → "Salvator Rosa"
  // [[Collections/Artists/Salvator Rosa]] → "Salvator Rosa"
  const match = raw.match(/\[\[(?:[^|]+\|)?([^\]]+)\]\]/);
  if (match) return match[1].trim();
  return raw.trim();
}

function extractWikilinkPath(raw: string): string | null {
  // [[Collections/Artists/Salvator Rosa|Salvator Rosa]] → "Collections/Artists/Salvator Rosa"
  const match = raw.match(/\[\[([^|\]]+)/);
  return match ? match[1].trim() : null;
}

function resolveImagePath(wikilink: string): string | null {
  const linkPath = extractWikilinkPath(wikilink);
  if (!linkPath) return null;
  // linkPath is like "Collections/Media/PXL_20230824.jpg"
  const filename = path.basename(linkPath);
  const abs = path.join(VAULT, 'Media', filename);
  return fs.existsSync(abs) ? abs : null;
}

// Normalise various YAML shapes into string[]
function toStringArray(val: unknown): string[] {
  if (!val) return [];
  if (typeof val === 'string') return val.length > 0 ? [val] : [];
  if (Array.isArray(val)) return val.flatMap(v => toStringArray(v));
  return [];
}

// ─── Artist Lookup ───────────────────────────────────────────────────────────

const artistCache: Record<string, { life: string | null }> = {};

function lookupArtist(name: string): { life: string | null } {
  if (artistCache[name]) return artistCache[name];

  const filePath = path.join(ARTISTS_DIR, `${name}.md`);
  if (!fs.existsSync(filePath)) {
    artistCache[name] = { life: null };
    return artistCache[name];
  }

  const { data } = matter(fs.readFileSync(filePath, 'utf-8'));
  const born = data['Born'] ?? data['born'];
  const died = data['Died'] ?? data['died'];
  let life: string | null = null;
  if (born || died) {
    life = [born, died].filter(Boolean).join('–');
  }
  artistCache[name] = { life };
  return artistCache[name];
}

// ─── Image Upload ─────────────────────────────────────────────────────────────

const hasR2 = !!(
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  R2_BUCKET &&
  R2_PUBLIC_URL
);

if (!hasR2) {
  console.warn('⚠️  R2 env vars not set — images will be skipped. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL in .env');
}

async function uploadImage(
  localPath: string,
  r2Key: string,
  manifest: Manifest
): Promise<string> {
  const stat = fs.statSync(localPath);
  const cached = manifest[localPath];

  if (cached && cached.mtime === stat.mtimeMs) {
    return cached.url;
  }

  // Resize with sharp
  const buf = await sharp(localPath)
    .rotate() // auto-orient from EXIF
    .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();

  await s3.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: r2Key,
    Body: buf,
    ContentType: 'image/jpeg',
    CacheControl: 'public, max-age=31536000, immutable',
  }));

  const url = `${R2_PUBLIC_URL.replace(/\/$/, '')}/${r2Key}`;
  manifest[localPath] = { url, mtime: stat.mtimeMs };
  return url;
}

async function resolveImages(
  wikilinkArray: string[],
  notionId: string,
  typeKey: string,
  manifest: Manifest,
  stats: { uploaded: number; skipped: number }
): Promise<string[]> {
  const urls: string[] = [];
  for (let i = 0; i < wikilinkArray.length; i++) {
    const wikilink = wikilinkArray[i];
    const localPath = resolveImagePath(wikilink);
    if (!localPath) continue;

    if (!hasR2) {
      continue; // skip — no R2 configured
    }

    const ext = path.extname(localPath).toLowerCase().replace('.', '') || 'jpg';
    const r2Key = `works/${notionId}/${typeKey}-${i}.jpg`;
    const stat = fs.statSync(localPath);
    const cached = manifest[localPath];

    if (cached && cached.mtime === stat.mtimeMs) {
      urls.push(cached.url);
      stats.skipped++;
    } else {
      const url = await uploadImage(localPath, r2Key, manifest);
      urls.push(url);
      stats.uploaded++;
    }
  }
  return urls;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  fs.mkdirSync(CONTENT_DIR, { recursive: true });

  const manifest = loadManifest();
  const stats = { works: 0, skipped: 0, images: { uploaded: 0, skipped: 0 } };

  // Glob all .md files in Prints & Drawings
  const files: string[] = [];
  for await (const f of glob('**/*.md', { cwd: PRINTS_DIR })) {
    files.push(path.join(PRINTS_DIR, f));
  }

  console.log(`Found ${files.length} notes in Prints & Drawings`);

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const { data } = matter(raw);

    // Skip deaccessioned works
    const deaccessioned = data['Deaccessioned'] ?? data['deaccessioned'];
    if (deaccessioned && typeof deaccessioned === 'string' && deaccessioned.trim().length > 0) {
      stats.skipped++;
      continue;
    }

    const notionId: string = data['notion-id'] ?? data['notionId'];
    if (!notionId) {
      console.warn(`  ⚠️  No notion-id in ${path.basename(filePath)}, skipping`);
      stats.skipped++;
      continue;
    }

    // Resolve artist
    const artistWikilinks = toStringArray(data['Artist'] ?? data['artist']);
    const artistName = artistWikilinks.length > 0
      ? extractWikilinkName(artistWikilinks[0])
      : 'Unknown';
    const { life: artistLife } = lookupArtist(artistName);

    // Resolve "after" artists
    const afterWikilinks = toStringArray(data['After'] ?? data['after']);
    const after = afterWikilinks.map(extractWikilinkName).filter(Boolean);

    // Resolve catalogue
    const catWikilinks = toStringArray(data['Catalogue'] ?? data['catalogue']);
    const catalogue = catWikilinks.length > 0
      ? extractWikilinkName(catWikilinks[0])
      : null;

    // Resolve medium
    const medium = toStringArray(data['Medium'] ?? data['medium']).filter(Boolean);

    // Resolve marks (filter "None")
    const marks = toStringArray(data['Marks'] ?? data['marks'])
      .filter(m => m && m.toLowerCase() !== 'none');

    // Resolve focus
    const focusWikilinks = toStringArray(data['Focus'] ?? data['focus']);
    const focus = focusWikilinks.map(extractWikilinkName).filter(Boolean);

    // Dimensions
    const supportH = data['Support H.'] ?? data['supportH'] ?? null;
    const supportW = data['Support W.'] ?? data['supportW'] ?? null;
    const imageH = data['Image H.'] ?? data['imageH'] ?? null;
    const imageW = data['Image W.'] ?? data['imageW'] ?? null;
    const dimensions = (supportH || supportW || imageH || imageW)
      ? { supportH: supportH ?? null, supportW: supportW ?? null, imageH: imageH ?? null, imageW: imageW ?? null }
      : null;

    // Images — all fields stored as arrays
    const imageFieldMap: Record<string, string> = {
      display: 'Image: Display',
      recto: 'Image: Recto',
      verso: 'Image: Verso',
      plateSig: 'Image: Plate Sig.',
      handSig: 'Image: Hand Sig.',
      watermark: 'Image: Watermark',
      other: 'Image: Other',
    };

    const images: Record<string, string[]> = {};
    for (const [key, vaultField] of Object.entries(imageFieldMap)) {
      const wikilinks = toStringArray(data[vaultField] ?? data[vaultField.toLowerCase()]);
      images[key] = await resolveImages(wikilinks, notionId, key, manifest, stats.images);
    }

    // Build public work object
    const work = {
      id: notionId,
      title: String(data['Title'] ?? path.basename(filePath, '.md')),
      titleAlt: data['Title Alt.'] ?? null,
      titleTrans: data['Title Trans.'] ?? null,
      artist: artistName,
      artistLife: artistLife ?? null,
      after,
      medium,
      support: data['Support'] ?? null,
      marks,
      yearCreated: String(data['Year Created'] ?? ''),
      yearPrinted: data['Year Printed'] ? String(data['Year Printed']) : null,
      sortYear: Number(data['Sort Year'] ?? 0),
      yearAcquired: data['Year Acquired'] ? Number(data['Year Acquired']) : null,
      handSig: Boolean(data['Hand Sig?'] ?? data['handSig'] ?? false),
      plateSig: Boolean(data['Plate Sig?'] ?? data['plateSig'] ?? false),
      dimensions,
      catalogue,
      catNum: data['Cat. Num.'] != null ? String(data['Cat. Num.']) : null,
      catPage: data['Cat. Page'] != null ? Number(data['Cat. Page']) : null,
      focus,
      images,
    };

    // Derive title from filename if not in frontmatter
    if (!work.title || work.title === 'undefined') {
      work.title = path.basename(filePath, '.md');
    }

    const outPath = path.join(CONTENT_DIR, `${notionId}.json`);
    fs.writeFileSync(outPath, JSON.stringify(work, null, 2));
    stats.works++;
  }

  saveManifest(manifest);

  console.log(`\n✓ Sync complete`);
  console.log(`  Works:  ${stats.works} written, ${stats.skipped} skipped`);
  if (hasR2) {
    console.log(`  Images: ${stats.images.uploaded} uploaded, ${stats.images.skipped} unchanged`);
  } else {
    console.log(`  Images: skipped (no R2 config)`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
