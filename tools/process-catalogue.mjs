/**
 * Turns the studio's artist catalogue PDF into the web assets the gallery uses.
 *
 *   node tools/process-catalogue.mjs [path-to-catalogue.pdf]
 *
 * The catalogue is a Word export: one page per work, the photograph above a
 * printed caption giving title, medium, size and year. The page images are
 * flattened Letter sheets with white margins, so they are useless as-is. The
 * photographs themselves are embedded in the PDF as ordinary JPEG streams, and
 * those are what this script pulls out. It never rasterises a page.
 *
 * Crops are fractions of the extracted photograph, so they survive any
 * resampling of the source. Most photographs are already tight on the work and
 * take the whole frame. The ones shot framed on a wall carry a hand read crop
 * down to the board itself, so the gallery shows the work rather than the
 * gallery wall it was hanging on.
 *
 * Each entry produces two widths, a small one for phones and a full one for
 * wide screens, wired up in the markup with srcset. The script prints the
 * srcset and the intrinsic size of the full file for each image.
 *
 * Provenance: every title, medium, size and year below is transcribed from the
 * caption the studio printed under that work. Nothing here is inferred. The
 * attribution is Dan Kabiaru, who signs the work and whose portrait and
 * exhibition history came in the same catalogue.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || join(root, 'source/catalogue-dan-kabiaru.pdf');

if (!existsSync(source)) {
  console.error(`Catalogue not found at ${source}`);
  console.error('Usage: node tools/process-catalogue.mjs [path-to-catalogue.pdf]');
  process.exit(1);
}

/*
 * page   which catalogue page the work is on, and so which embedded photograph
 * crop   fraction of that photograph to keep. Omitted means the whole frame.
 * The two Pride in stride panels share a page, so they carry an index.
 */
const WORKS = [
  { page: 1,  slug: 'noa-kisu-nanasi-ni-mia', title: 'Noa kisu Nanasi ni mia',
    medium: 'Acrylic on canvas', size: '136 x 122 cm', year: 2025, materials: 'canvas' },
  { page: 2,  slug: 'a-mile-in-my-dads-saddle', title: 'A mile in my dads saddle',
    medium: 'Acrylic on canvas', size: '110 x 130 cm', year: 2025, materials: 'canvas' },
  { page: 3,  slug: 'as-we-fetch-water', title: 'As we fetch water',
    medium: 'Acrylic on canvas', size: '63 x 110 cm', year: 2025, materials: 'canvas' },
  { page: 4,  slug: 'untitled-10', title: 'Untitled 10',
    medium: 'Acrylic on canvas', size: '100 x 120 cm', year: 2024, materials: 'canvas' },
  { page: 5,  slug: 'border-to-border', title: 'Border to border',
    medium: 'Acrylic on canvas', size: '121 x 107 cm', year: 2025, materials: 'canvas' },
  { page: 6,  index: 0, slug: 'pride-in-stride-1', title: 'Pride in stride 1',
    medium: 'Acrylic on canvas', size: '40 x 40 cm', year: 2025, materials: 'canvas' },
  { page: 6,  index: 1, slug: 'pride-in-stride-2', title: 'Pride in stride 2',
    medium: 'Acrylic on canvas', size: '40 x 40 cm', year: 2025, materials: 'canvas' },
  { page: 7,  slug: 'untitled-6', title: 'Untitled 6',
    medium: 'Acrylic on canvas', size: '100 x 120 cm', year: 2024, materials: 'canvas' },
  { page: 8,  slug: 'untitled-9', title: 'Untitled 9',
    medium: 'Acrylic on canvas', size: '107 x 137 cm', year: 2024, materials: 'canvas' },
  { page: 9,  slug: 'untitled-11', title: 'Untitled 11',
    medium: 'Acrylic on canvas', size: '100 x 120 cm', year: 2024, materials: 'canvas' },
  { page: 10, slug: 'untitled-13', title: 'Untitled 13',
    medium: 'Acrylic on canvas', size: '210 x 240 cm', year: 2024, materials: 'canvas' },
  { page: 11, slug: 'fragrance-time-was-meant-to-tell', title: 'Fragrance (time was meant to tell)',
    medium: 'Acrylic on canvas', size: '70 x 80 cm', year: 2026, materials: 'canvas' },
  { page: 12, slug: 'fragrance', title: 'Fragrance',
    medium: 'Acrylic on canvas', size: '55 x 120 cm', year: 2026, materials: 'canvas' },

  { page: 13, slug: 'mama-mali-kwa-mali', title: 'Mama mali kwa mali',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard',
    crop: { left: 0.20, top: 0.17, width: 0.60, height: 0.65 } },
  { page: 14, slug: 'the-wait', title: 'The wait',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard',
    crop: { left: 0.19, top: 0.19, width: 0.63, height: 0.63 } },
  { page: 15, slug: 'krisi-ni-ocha', title: 'Krisi ni ocha',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard',
    crop: { left: 0.20, top: 0.19, width: 0.59, height: 0.62 } },
  { page: 16, slug: 'mali-kwa-mali-1', title: 'Mali kwa mali 1',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard',
    crop: { left: 0.255, top: 0.295, width: 0.595, height: 0.425 } },
  { page: 17, slug: 'the-dreamer', title: 'The dreamer',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard',
    crop: { left: 0.24, top: 0.31, width: 0.56, height: 0.44 } },
  { page: 18, slug: 'skuma-isonge-mbele', title: 'Skuma isonge mbele',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard',
    crop: { left: 0.28, top: 0.28, width: 0.59, height: 0.45 } },
  { page: 19, slug: 'all-the-hats', title: 'All the hats',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard' },
  { page: 20, slug: 'mama-chai', title: 'Mama chai',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard' },
  { page: 21, slug: 'the-sunglasses', title: 'The sunglasses',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard' },
  { page: 22, slug: 'ice-cream-man', title: 'Ice cream man',
    medium: 'Acrylic on cardboard', size: '30 x 30 cm', year: 2025, materials: 'cardboard' },
  { page: 23, slug: 'makaa-imepanda-bei', title: 'Makaa imepanda bei',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2025, materials: 'cardboard' },
  { page: 24, slug: 'coloured-pots', title: 'Coloured pots',
    medium: 'Acrylic on cardboard', size: '70 x 70 cm', year: 2026, materials: 'cardboard' },
  { page: 25, slug: 'my-grind', title: 'My grind',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2026, materials: 'cardboard' },
  { page: 26, slug: 'mahamri-ni-10', title: 'Mahamri ni 10',
    medium: 'Acrylic on cardboard', size: '75 x 75 cm', year: 2026, materials: 'cardboard' },
  { page: 27, slug: 'mama-mahamri', title: 'Mama mahamri',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2026, materials: 'cardboard',
    crop: { left: 0.26, top: 0.32, width: 0.50, height: 0.40 } },
  { page: 28, slug: 'mitumba', title: 'Mitumba',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2026, materials: 'cardboard',
    crop: { left: 0.26, top: 0.28, width: 0.575, height: 0.40 } },
  { page: 29, slug: 'my-love-for-soccer', title: 'My love for soccer',
    medium: 'Cardboard', size: '40 x 30 x 50 cm', year: 2025, materials: 'cardboard',
    crop: { left: 0.08, top: 0.03, width: 0.72, height: 0.94 } },
  { page: 30, slug: 'my-ride-awaits', title: 'My ride awaits',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2026, materials: 'cardboard' },
  { page: 31, slug: 'the-baskets-i-sell', title: 'The baskets I sell',
    medium: 'Acrylic on cardboard', size: '40 x 40 cm', year: 2026, materials: 'cardboard',
    crop: { left: 0.28, top: 0.30, width: 0.585, height: 0.43 } },

  /* Page 32 is the same work as page 27, photographed a second time. The
     larger of the two photographs is the one above. */

  /* Already in the gallery from a studio photograph, under a descriptive stand
     in title. The catalogue gives the real title and the catalogue photograph
     is the better one, so this entry replaces it. */
  { page: 33, slug: 'what-it-takes', title: 'What it takes',
    medium: 'Acrylic on canvas and cardboard', size: '50 x 50 cm', year: 2025,
    materials: 'canvas cardboard' }
];

const FULL_WIDTH = 1000;

/* ---------------------------------------------------------------- pdf reading
   Enough of the PDF object model to find each page and the photographs drawn
   on it. The photographs are DCTDecode streams, which are JPEG files already,
   so they come out byte for byte with no re-encoding. */
function readPdf(path) {
  const data = readFileSync(path);
  const objects = new Map();
  const re = /(\d+)\s+0\s+obj([\s\S]*?)endobj/g;
  let m;
  while ((m = re.exec(data.toString('latin1')))) {
    objects.set(Number(m[1]), { start: m.index, body: m[2], offset: m.index + m[0].indexOf(m[2]) });
  }
  return { data, objects };
}

function rawStream({ data }, entry) {
  const marker = /stream\r?\n/.exec(entry.body);
  if (!marker) return null;
  const from = entry.offset + marker.index + marker[0].length;
  const to = entry.offset + entry.body.lastIndexOf('endstream');
  return data.subarray(from, to).subarray(0, undefined);
}

function pageOrder({ objects }) {
  const pages = objects.get(2);
  const kids = /\/Kids\s*\[([\s\S]*?)\]/.exec(pages.body);
  return [...kids[1].matchAll(/(\d+)\s+0\s+R/g)].map((k) => Number(k[1]));
}

/* The photographs on a page, largest first, ignoring the hairline decorative
   slivers Word leaves behind. */
function photographsOn(pdf, pageObj) {
  const page = pdf.objects.get(pageObj);
  const block = /\/XObject<<([\s\S]*?)>>/.exec(page.body);
  if (!block) return [];

  const found = [];
  for (const ref of block[1].matchAll(/(\d+)\s+0\s+R/g)) {
    const num = Number(ref[1]);
    const entry = pdf.objects.get(num);
    if (!entry) continue;
    const head = entry.body.slice(0, entry.body.indexOf('stream'));
    if (!head.includes('/Image') || !head.includes('DCTDecode')) continue;
    const w = Number(/\/Width\s+(\d+)/.exec(head)[1]);
    const h = Number(/\/Height\s+(\d+)/.exec(head)[1]);
    if (w * h < 90000) continue;
    found.push({ num, w, h, bytes: rawStream(pdf, entry) });
  }
  return found;
}

/* ------------------------------------------------------------------- writing */
const pdf = readPdf(source);
const order = pageOrder(pdf);
const outDir = join(root, 'public/images/gallery');
mkdirSync(outDir, { recursive: true });

const printed = [];

for (const work of WORKS) {
  const photos = photographsOn(pdf, order[work.page - 1]);
  const photo = photos[work.index || 0];

  if (!photo) {
    console.error(`  MISS  page ${work.page} has no photograph for ${work.slug}`);
    process.exitCode = 1;
    continue;
  }

  const base = sharp(photo.bytes).rotate();
  const meta = await base.metadata();

  let pipeline = sharp(photo.bytes).rotate();
  if (work.crop) {
    pipeline = pipeline.extract({
      left: Math.round(work.crop.left * meta.width),
      top: Math.round(work.crop.top * meta.height),
      width: Math.round(work.crop.width * meta.width),
      height: Math.round(work.crop.height * meta.height)
    });
  } else {
    /* Several photographs were pasted into the document over a white card, so
       they carry a flat border that would read as inconsistent padding in a
       grid. A hand cropped entry has already excluded its surround, so this
       only applies to the rest. */
    pipeline = pipeline.trim({ threshold: 18 });
  }

  const cropped = await pipeline.toBuffer();
  const cropMeta = await sharp(cropped).metadata();
  const full = Math.min(FULL_WIDTH, cropMeta.width);
  const half = Math.round(full / 2);
  const height = Math.round((cropMeta.height / cropMeta.width) * full);

  await sharp(cropped).resize({ width: full }).webp({ quality: 80 })
    .toFile(join(outDir, `${work.slug}.webp`));
  await sharp(cropped).resize({ width: half }).webp({ quality: 78 })
    .toFile(join(outDir, `${work.slug}-${half}.webp`));

  printed.push({ ...work, full, half, height });
  console.log(`  ${work.slug.padEnd(34)} ${full}x${height}  (page ${work.page})`);
}

/* The artist's own photograph came with the catalogue, so it belongs to the
   same run. It is already square and tight, and only needs resizing. */
const portraitSource = join(root, 'source/dan-kabiaru-portrait.jpg');
if (existsSync(portraitSource)) {
  const portraitDir = join(root, 'public/images/artists');
  mkdirSync(portraitDir, { recursive: true });
  for (const width of [600, 300]) {
    const name = width === 600 ? 'dan-kabiaru.webp' : `dan-kabiaru-${width}.webp`;
    await sharp(portraitSource).rotate().resize({ width }).webp({ quality: 82 })
      .toFile(join(portraitDir, name));
  }
  console.log('  dan-kabiaru portrait               600 and 300 wide');
}

const manifest = printed.map((w) => ({
  slug: w.slug, title: w.title, medium: w.medium, size: w.size, year: w.year,
  materials: w.materials, width: w.full, height: w.height,
  src: `/images/gallery/${w.slug}.webp`,
  srcset: `/images/gallery/${w.slug}-${w.half}.webp ${w.half}w, /images/gallery/${w.slug}.webp ${w.full}w`
}));

writeFileSync(join(root, 'tools/catalogue-output.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${printed.length} works written. Markup data in tools/catalogue-output.json`);
