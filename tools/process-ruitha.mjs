/**
 * Turns John Ruitha Maina's compiled images PDF into the web assets the gallery
 * uses, and resizes the portrait he supplied alongside it.
 *
 *   node tools/process-ruitha.mjs [path-to-works.pdf]
 *
 * The file is a plain compilation: eight pages, one embedded JPEG each, no
 * printed captions and no extractable text of any kind. pdftotext returns
 * nothing and there are no bookmarks, so unlike the Kabiaru catalogue and the
 * Ndegwa portfolio there is no supplied title, medium, size, year or sold mark
 * to transcribe. Everything written below the images on the site is therefore a
 * description read off the photograph, and the gallery note says so.
 *
 * Six of the eight pages are paintings. Two are photographs, and they go to
 * public/images/artists rather than into the gallery, because the gallery is
 * artwork and these are not:
 *
 *   page 1  his stand at a fair, with visitors whose faces are legible. Held
 *           back on the first pass for the same consent reason that keeps
 *           source/studio-group-photo.jpg unpublished, then published when the
 *           studio was asked and said to add all of them.
 *   page 2  a two part composite: a black and white photograph of someone in a
 *           bandana painting, next to a colour detail of the work in progress.
 *           Very likely him, but the face is turned away and nothing in the file
 *           says so, so nothing on the page names the person in it.
 *
 * The six paintings are edge to edge photographs with no surrounding wall, so
 * unlike the Ndegwa scans they need no trim.
 *
 * Signatures: pages 3, 4, 5 and 7 read "Ruitha 25" in the lower right. That is
 * almost certainly 2025, but reading a year off a brushstroke is not the same
 * as being told it, so no years are recorded. Ask him and add them.
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2] || join(root, 'source/works-john-ruitha.pdf');

if (!existsSync(source)) {
  console.error(`Compiled images not found at ${source}`);
  console.error('Usage: node tools/process-ruitha.mjs [path-to-works.pdf]');
  process.exit(1);
}

/* page is 1 based. One image per page here, so no index is needed. */
const WORKS = [
  { page: 3, slug: 'boarding-at-the-stage', title: 'Boarding at the stage',
    medium: 'Acrylic on a Kenya Horticultural Exporters carton',
    materials: 'cardboard packaging' },
  { page: 4, slug: 'number-28', title: 'Number 28',
    medium: 'Acrylic on a Marie Biscuits carton',
    materials: 'cardboard packaging' },
  { page: 5, slug: 'three-matatus', title: 'Three matatus',
    medium: 'Acrylic on printed packing cardboard',
    materials: 'cardboard packaging' },
  { page: 6, slug: 'two-on-stools', title: 'Two on stools',
    medium: 'Acrylic and pasted newsprint',
    materials: 'paper' },
  { page: 7, slug: 'resting-on-the-bike', title: 'Resting on the bike',
    medium: 'Acrylic and pasted newsprint',
    materials: 'paper' },
  { page: 8, slug: 'the-produce-stall', title: 'The produce stall',
    medium: 'Acrylic and pasted newsprint, two panels',
    materials: 'paper' }
];

/* The two photographs. Not artwork, so they carry no title or medium and are
   written beside the portrait rather than into the gallery. */
const PHOTOGRAPHS = [
  { page: 1, slug: 'john-ruitha-stand' },
  { page: 2, slug: 'john-ruitha-at-work' }
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
  const photo = photographsOn(objects.get(order[work.page - 1]).body)[0];

  if (!photo) {
    console.error(`  MISS  page ${work.page} for ${work.slug}`);
    process.exitCode = 1;
    continue;
  }

  const meta = await sharp(photo.bytes).rotate().metadata();
  const full = Math.min(FULL_WIDTH, meta.width);
  const half = Math.round(full / 2);
  const height = Math.round((meta.height / meta.width) * full);

  await sharp(photo.bytes).rotate().resize({ width: full }).webp({ quality: 80 })
    .toFile(join(outDir, `${work.slug}.webp`));
  await sharp(photo.bytes).rotate().resize({ width: half }).webp({ quality: 78 })
    .toFile(join(outDir, `${work.slug}-${half}.webp`));

  printed.push({ ...work, full, half, height });
  console.log(`  ${work.slug.padEnd(24)} ${full}x${height}  (page ${work.page}, image ${photo.num})`);
}

const portraitDir = join(root, 'public/images/artists');
mkdirSync(portraitDir, { recursive: true });

for (const photo of PHOTOGRAPHS) {
  const found = photographsOn(objects.get(order[photo.page - 1]).body)[0];

  if (!found) {
    console.error(`  MISS  page ${photo.page} for ${photo.slug}`);
    process.exitCode = 1;
    continue;
  }

  const meta = await sharp(found.bytes).rotate().metadata();
  const full = Math.min(FULL_WIDTH, meta.width);
  const half = Math.round(full / 2);
  const height = Math.round((meta.height / meta.width) * full);

  await sharp(found.bytes).rotate().resize({ width: full }).webp({ quality: 80 })
    .toFile(join(portraitDir, `${photo.slug}.webp`));
  await sharp(found.bytes).rotate().resize({ width: half }).webp({ quality: 78 })
    .toFile(join(portraitDir, `${photo.slug}-${half}.webp`));

  console.log(`  ${photo.slug.padEnd(24)} ${full}x${height}  (page ${photo.page}, image ${found.num})`);
}

/* The portrait came in the same handover. It is taller than it is wide and the
   head sits in the upper half, so it is cropped square from the top rather than
   from the centre, which would cut the forehead. */
const portraitSource = join(root, 'source/john-ruitha-portrait.png');
if (existsSync(portraitSource)) {
  const meta = await sharp(portraitSource).rotate().metadata();
  const side = Math.min(meta.width, meta.height);

  for (const width of [600, 300]) {
    const name = width === 600 ? 'john-ruitha.webp' : `john-ruitha-${width}.webp`;
    await sharp(portraitSource)
      .rotate()
      .extract({ left: Math.round((meta.width - side) / 2), top: 0, width: side, height: side })
      .resize({ width })
      .webp({ quality: 82 })
      .toFile(join(portraitDir, name));
  }
  console.log('  john-ruitha portrait     600 and 300 wide');
}

const manifest = printed.map((w) => ({
  slug: w.slug,
  title: w.title,
  medium: w.medium,
  materials: w.materials,
  width: w.full,
  height: w.height,
  src: `/images/gallery/${w.slug}.webp`,
  srcset: `/images/gallery/${w.slug}-${w.half}.webp ${w.half}w, /images/gallery/${w.slug}.webp ${w.full}w`
}));

writeFileSync(join(root, 'tools/ruitha-output.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${printed.length} works written. Markup data in tools/ruitha-output.json`);
