/**
 * Square thumbnails for the scrolling work strips on the home and vision pages.
 *
 *   node tools/make-strip-thumbs.mjs
 *
 * The strip tiles are square and no wider than 240px, so pointing them at the
 * gallery images was wasteful twice over: those files are up to 500px on the
 * long edge, and they are not square, so the browser downloaded pixels that
 * CSS then cropped away. On a 390px phone that put roughly 400 kB of strip on
 * the home page and doubled its Slow 3G load time.
 *
 * These are cropped square at source and written at two widths, so a phone at
 * 1x pulls the 150px file and only a dense wide screen pulls the 300px one.
 *
 * Run it after adding a slug below, or after re-running either artwork
 * pipeline, since it reads their output.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Kept in step with the two [data-strip] sections. Two sets, no overlap, so a
   visitor moving from the home page to the vision page sees different work. */
export const STRIPS = {
  home: [
    'noa-kisu-nanasi-ni-mia', 'tumetoka-shopping', 'untitled-13', 'mama-chai',
    'boda-ya-stima', 'coloured-pots', 'early-morning-school-rush', 'the-sunglasses',
    'fragrance-time-was-meant-to-tell', 'makaa-imepanda-bei', 'baba-yao', 'pride-in-stride-2'
  ],
  vision: [
    'all-the-hats', 'hii-bill-yote', 'my-ride-awaits', 'mahamri-ni-10', 'untitled-9',
    'the-baskets-i-sell', 'ama-nirudi-chuo', 'mitumba', 'as-we-fetch-water', 'my-love-for-soccer'
  ]
};

const WIDTHS = [150, 300];
const outDir = join(root, 'public/images/strip');
mkdirSync(outDir, { recursive: true });

let written = 0;
let bytes = 0;

for (const slug of [...STRIPS.home, ...STRIPS.vision]) {
  const source = join(root, `public/images/gallery/${slug}.webp`);
  if (!existsSync(source)) {
    console.error(`  MISS  ${slug} has no gallery image`);
    process.exitCode = 1;
    continue;
  }

  for (const width of WIDTHS) {
    const file = join(outDir, `${slug}-${width}.webp`);
    const info = await sharp(source)
      .resize(width, width, { fit: 'cover', position: 'attention' })
      .webp({ quality: 72 })
      .toFile(file);
    written += 1;
    bytes += info.size;
  }
}

console.log(`${written} thumbnails, ${(bytes / 1024).toFixed(0)} kB total`);
console.log(`average ${(bytes / written / 1024).toFixed(1)} kB each`);
