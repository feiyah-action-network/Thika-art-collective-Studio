/**
 * Turns Dennis Bull Ndegwa's portfolio PDF into the web assets the gallery uses.
 *
 *   node tools/process-portfolio.mjs [path-to-portfolio.pdf]
 *
 * The portfolio is a Canva export: an artist statement, an exhibition list, one
 * or two works per page with a printed caption, and a contact page. The
 * photographs are embedded as ordinary JPEG streams, so this pulls those out
 * rather than rasterising anything.
 *
 * Unlike the Canva text, which is drawn glyph by glyph through nested form
 * XObjects and does not survive naive extraction, the captions are also stored
 * as PDF bookmarks. Those were the reliable source for the titles, and
 * pdftotext on the rendered pages confirmed them and supplied the two works per
 * page that the bookmarks only name once.
 *
 * Images are addressed by page and by their order within that page's resources.
 * That order is not the visual order: on the three pages holding two works, the
 * first image in the resource dictionary is the lower one on the page. Each
 * entry below records which work it actually is, checked against a render of
 * the page, so the titles cannot drift onto the wrong painting.
 *
 * Provenance: every title, medium, size and sold mark is transcribed from the
 * caption printed under that work. No years are recorded because the portfolio
 * does not state any.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || join(root, 'source/portfolio-dennis-ndegwa.pdf');

if (!existsSync(source)) {
  console.error(`Portfolio not found at ${source}`);
  process.exit(1);
}

/* page is 1 based. index is the position within that page's image resources. */
const WORKS = [
  { page: 2,  index: 0, slug: 'boda-ya-stima', title: 'Boda ya stima',
    medium: 'Acrylic on repurposed paper', size: '35 x 35 cm', framed: true, sold: true,
    materials: 'packaging paper' },
  { page: 3,  index: 0, slug: 'tough-times', title: 'Tough times',
    medium: 'Acrylic on repurposed paper', size: '45 x 45 cm', framed: true,
    materials: 'packaging paper' },
  { page: 4,  index: 0, slug: 'hii-bill-yote', title: 'Hii bill yote',
    medium: 'Acrylic on repurposed paper', size: '45 x 45 cm', framed: true,
    materials: 'packaging paper' },
  { page: 5,  index: 0, slug: 'rada-ya-wale-gen-z', title: 'Rada ya wale Gen z',
    medium: 'Acrylic on repurposed paper', size: '55 x 45 cm', framed: true,
    materials: 'packaging paper' },

  /* Page 6 holds two works. Resource order puts the lower one first. */
  { page: 6,  index: 0, slug: 'lala-nayo', title: 'Lala nayo',
    medium: 'Acrylic on repurposed paper', size: '47 x 35 cm', framed: true, sold: true,
    materials: 'packaging paper' },
  { page: 6,  index: 1, slug: 'nipeleke-juja', title: 'Nipeleke Juja',
    medium: 'Acrylic on repurposed paper', size: '35 x 35 cm', framed: true, sold: true,
    materials: 'packaging paper' },

  { page: 7,  index: 0, slug: 'masaa-ni-ya-shuksha', title: 'Masaa ni ya shuksha',
    medium: 'Acrylic on repurposed paper', size: '35 x 35 cm', framed: true, sold: true,
    materials: 'packaging paper' },
  { page: 7,  index: 1, slug: 'namba-yako-ni', title: 'Namba yako ni??',
    medium: 'Acrylic on repurposed paper', size: '47 x 35 cm', framed: true,
    materials: 'packaging paper' },

  { page: 8,  index: 0, slug: 'breadman', title: 'Breadman',
    medium: 'Acrylic on repurposed paper', size: '35 x 35 cm',
    materials: 'packaging paper' },
  { page: 9,  index: 0, slug: 'tumetoka-shopping', title: 'Tumetoka shopping',
    medium: 'Acrylic on canvas', size: '70 x 70 cm', materials: 'canvas' },

  { page: 10, index: 0, slug: 'ndo-kuingia', title: 'Ndo kuingia',
    medium: 'Acrylic on repurposed paper', size: '47 x 35 cm', framed: true, sold: true,
    materials: 'packaging paper' },
  { page: 10, index: 1, slug: 'baba-yao', title: 'Baba yao',
    medium: 'Acrylic on repurposed paper', size: '47 x 35 cm', framed: true, sold: true,
    materials: 'packaging paper' },

  { page: 11, index: 0, slug: 'ama-nirudi-chuo', title: 'Ama nirudi chuo',
    medium: 'Acrylic on repurposed paper', size: '45 x 45 cm', framed: true,
    materials: 'packaging paper' },
  { page: 12, index: 0, slug: 'early-morning-school-rush', title: 'Early morning school rush',
    medium: 'Acrylic on canvas', size: '50 x 70 cm', materials: 'canvas' }
];

const FULL_WIDTH = 1000;

/* ---------------------------------------------------------------- pdf reading */
const data = readFileSync(source);
const latin = data.toString('latin1');
const objects = new Map();
for (const m of latin.matchAll(/(\d+)\s+0\s+obj([\s\S]*?)endobj/g)) {
  objects.set(Number(m[1]), { body: m[2], offset: m.index + m[0].indexOf(m[2]) });
}

function rawStream(entry) {
  const marker = /stream\r?\n/.exec(entry.body);
  if (!marker) return null;
  const from = entry.offset + marker.index + marker[0].length;
  const to = entry.offset + entry.body.lastIndexOf('endstream');
  return data.subarray(from, to);
}

function resourcesOf(body) {
  const ref = /\/Resources\s*(\d+)\s+0\s+R/.exec(body);
  if (ref) return objects.get(Number(ref[1])).body;
  const inline = /\/Resources\s*<</.exec(body);
  if (!inline) return '';
  let depth = 0;
  const start = inline.index + inline[0].length - 2;
  for (let i = start; i < body.length; i++) {
    if (body.startsWith('<<', i)) depth++;
    else if (body.startsWith('>>', i)) {
      depth--;
      if (depth === 0) return body.slice(start, i + 2);
    }
  }
  return '';
}

/* Images on a page, following nested form XObjects, in resource order. */
function photographsOn(body, seen = new Set(), depth = 0) {
  if (depth > 6) return [];
  const block = /\/XObject\s*<<([\s\S]*?)>>/.exec(resourcesOf(body));
  if (!block) return [];
  const out = [];
  for (const ref of block[1].matchAll(/\/([A-Za-z0-9_]+)\s+(\d+)\s+0\s+R/g)) {
    const num = Number(ref[2]);
    if (seen.has(num)) continue;
    seen.add(num);
    const entry = objects.get(num);
    if (!entry) continue;
    const head = entry.body.slice(0, entry.body.indexOf('stream'));
    if (head.includes('/Image') && head.includes('DCTDecode')) {
      out.push({ num, bytes: rawStream(entry) });
    } else if (head.includes('/Form')) {
      out.push(...photographsOn(entry.body, seen, depth + 1));
    }
  }
  return out;
}

const pagesRoot = [...objects].find(
  ([, e]) => /\/Type\s*\/Pages/.test(e.body) && e.body.includes('/Kids')
)[1];
const order = [...(/\/Kids\s*\[([\s\S]*?)\]/.exec(pagesRoot.body)[1]).matchAll(/(\d+)\s+0\s+R/g)]
  .map((m) => Number(m[1]));

/* ------------------------------------------------------------------- writing */
const outDir = join(root, 'public/images/gallery');
mkdirSync(outDir, { recursive: true });
const printed = [];

for (const work of WORKS) {
  const photos = photographsOn(objects.get(order[work.page - 1]).body);
  const photo = photos[work.index];

  if (!photo) {
    console.error(`  MISS  page ${work.page} index ${work.index} for ${work.slug}`);
    process.exitCode = 1;
    continue;
  }

  /* The works were photographed against a plain surface and pasted onto a white
     page, so several carry a flat border that would read as uneven padding in a
     grid. */
  const cropped = await sharp(photo.bytes).rotate().trim({ threshold: 18 }).toBuffer();
  const meta = await sharp(cropped).metadata();
  const full = Math.min(FULL_WIDTH, meta.width);
  const half = Math.round(full / 2);
  const height = Math.round((meta.height / meta.width) * full);

  await sharp(cropped).resize({ width: full }).webp({ quality: 80 })
    .toFile(join(outDir, `${work.slug}.webp`));
  await sharp(cropped).resize({ width: half }).webp({ quality: 78 })
    .toFile(join(outDir, `${work.slug}-${half}.webp`));

  printed.push({ ...work, full, half, height });
  console.log(`  ${work.slug.padEnd(28)} ${full}x${height}  (page ${work.page}, image ${photo.num})`);
}

const manifest = printed.map((w) => ({
  slug: w.slug,
  title: w.title,
  medium: w.medium,
  size: w.framed ? `${w.size} (framed)` : w.size,
  sold: Boolean(w.sold),
  materials: w.materials,
  width: w.full,
  height: w.height,
  src: `/images/gallery/${w.slug}.webp`,
  srcset: `/images/gallery/${w.slug}-${w.half}.webp ${w.half}w, /images/gallery/${w.slug}.webp ${w.full}w`
}));

writeFileSync(join(root, 'tools/portfolio-output.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${printed.length} works written. Markup data in tools/portfolio-output.json`);
