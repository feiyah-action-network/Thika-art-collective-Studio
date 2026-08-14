/**
 * Turns the studio's original photographs into the web assets the site uses.
 *
 *   node tools/process-photos.mjs <source-directory>
 *
 * Originals are not committed. Drop them in a directory, point the script at
 * it, and it writes optimised WebP into public/images. Crops are expressed as
 * fractions of the EXIF rotated frame so they survive any resampling of the
 * source, and each entry records what is actually in the picture.
 *
 * Each entry produces two widths, a small one for phones and a full one for
 * wide screens, wired up in the markup with srcset. The script prints the
 * srcset and the intrinsic size of the full file for each image.
 *
 * To add a new photo: add an entry below, run the script, then reference the
 * output path in the markup with its printed width and height.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];

if (!source) {
  console.error('Usage: node tools/process-photos.mjs <source-directory>');
  process.exit(1);
}

/* left, top, width and height are fractions of the upright frame. */
const JOBS = [
  {
    file: '88942778-418efa868cca4a30a6ef5b508fcfa8b5.jpeg',
    out: 'public/images/studio/at-the-bench.webp',
    crop: { left: 0, top: 0.07, width: 1, height: 0.5625 },
    width: 1400,
    note: 'Artist at the board, works pinned up, paints on the bench'
  },
  {
    file: '88942778-418efa868cca4a30a6ef5b508fcfa8b5.jpeg',
    out: 'public/images/programs/empowerment.webp',
    crop: { left: 0.02, top: 0.19, width: 0.8, height: 0.45 },
    width: 1200,
    note: 'The working wall, pinned studies and the paint bench'
  },
  {
    file: '88942778-418efa868cca4a30a6ef5b508fcfa8b5.jpeg',
    out: 'public/images/share-card.jpg',
    crop: { left: 0, top: 0.14, width: 1, height: 0.3926 },
    width: 1200,
    format: 'jpeg',
    note: 'Open Graph card, 1200 wide and close to 1.91:1'
  },
  {
    file: '88942778-418efa868cca4a30a6ef5b508fcfa8b5.jpeg',
    out: 'public/images/studio/artist-at-work.webp',
    crop: { left: 0.4, top: 0.04, width: 0.6, height: 0.72 },
    width: 800,
    note: 'Upright crop of the same session, for the portrait shaped tiles'
  },
  {
    file: '9e5c41d4-IMG_0561.jpeg',
    out: 'public/images/programs/recycling.webp',
    crop: { left: 0, top: 0.17, width: 1, height: 0.56 },
    width: 1200,
    note: 'Finished collage panels lined up along the studio wall'
  },
  {
    file: '2226836d-IMG_0586.jpeg',
    out: 'public/images/programs/exhibitions.webp',
    crop: { left: 0, top: 0.01, width: 1, height: 0.42 },
    width: 1200,
    note: 'Canvases hung and stacked, ready to move'
  },
  {
    file: 'c094268c-f0847aed043349b4b26f6d83f6e2bcc3.jpeg',
    out: 'public/images/programs/income.webp',
    crop: { left: 0.005, top: 0, width: 0.99, height: 1 },
    width: 1200,
    note: 'Rider and cargo painted on a Soko maize meal sack'
  },
  {
    file: '49ec66e0-531e2beec77342f6972a361b03d85a14.jpeg',
    out: 'public/images/gallery/rider-red-bike.webp',
    crop: { left: 0.01, top: 0.14, width: 0.97, height: 0.61 },
    width: 1100,
    note: 'Rider on a red bike, painted on a Soko sack, signed Bull'
  },
  {
    file: 'c094268c-f0847aed043349b4b26f6d83f6e2bcc3.jpeg',
    out: 'public/images/gallery/rider-with-cargo.webp',
    crop: { left: 0.005, top: 0, width: 0.99, height: 1 },
    width: 1100,
    note: 'Rider carrying boxes, painted on a Soko sack, signed Bull'
  },
  {
    file: 'ba7093cd-IMG_0560.jpeg',
    out: 'public/images/gallery/seed-packet-portrait.webp',
    crop: { left: 0.15, top: 0.16, width: 0.65, height: 0.69 },
    width: 900,
    note: 'Portrait with a seed packet crown, scorched metal face, fabric dress'
  },
  {
    file: '9e5c41d4-IMG_0561.jpeg',
    out: 'public/images/gallery/bottle-top-portrait.webp',
    crop: { left: 0.165, top: 0.19, width: 0.5, height: 0.55 },
    width: 900,
    note: 'Portrait on a patterned bottle top field, cut packaging features'
  },
  {
    file: '164586a8-IMG_0646.jpeg',
    out: 'public/images/gallery/matatu-on-gala-sack.webp',
    crop: { left: 0.13, top: 0.22, width: 0.84, height: 0.415 },
    width: 1100,
    note: 'A matatu painted across a flattened Gala maize meal sack'
  },
  {
    file: '43f1b0d9-IMG_0636.jpeg',
    out: 'public/images/gallery/shields-and-fire.webp',
    crop: { left: 0.05, top: 0.02, width: 0.94, height: 0.55 },
    width: 1200,
    note: 'Painting on canvas, riot shields, flames and a fleeing figure'
  },
  {
    file: '8d30568c-IMG_0669.jpeg',
    out: 'public/images/gallery/veiled-figure.webp',
    crop: { left: 0.02, top: 0.11, width: 0.77, height: 0.58 },
    width: 1000,
    note: 'Cardboard cut figure over a poured black and white ground'
  },
  {
    file: '9770759d-IMG_0660.jpeg',
    out: 'public/images/gallery/carrying-firewood.webp',
    crop: { left: 0.16, top: 0.39, width: 0.83, height: 0.3 },
    width: 1200,
    note: 'Three figures carrying firewood, on a Soko sack, signed Bull'
  }
];

const results = [];

for (const job of JOBS) {
  const src = resolve(source, job.file);
  if (!existsSync(src)) {
    console.error(`missing source: ${job.file}`);
    continue;
  }

  const pipeline = sharp(src).rotate();
  const { width: fullW, height: fullH } = await pipeline.metadata();

  /* Metadata reports the pre rotation size, so read it back after rotating. */
  const upright = await sharp(src).rotate().toBuffer({ resolveWithObject: true });
  const W = upright.info.width;
  const H = upright.info.height;

  const region = {
    left: Math.round(job.crop.left * W),
    top: Math.round(job.crop.top * H),
    width: Math.round(job.crop.width * W),
    height: Math.round(job.crop.height * H)
  };
  region.width = Math.min(region.width, W - region.left);
  region.height = Math.min(region.height, H - region.top);

  const target = resolve(root, job.out);
  mkdirSync(dirname(target), { recursive: true });

  const cropped = sharp(upright.data).extract(region);

  /* Social scrapers still handle JPEG more reliably than WebP. */
  if (job.format === 'jpeg') {
    const jpeg = await cropped
      .clone()
      .resize({ width: job.width, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(target);
    results.push({ out: job.out, w: jpeg.width, h: jpeg.height, kb: jpeg.size / 1024, smallKb: 0, srcset: 'n/a, share image', note: job.note });
    continue;
  }

  const info = await cropped
    .clone()
    .resize({ width: job.width, withoutEnlargement: true })
    .webp({ quality: 78, effort: 6 })
    .toFile(target);

  /* A phone sized copy, so a narrow screen never pulls the full file. */
  const smallWidth = Math.round(job.width / 2);
  const smallOut = job.out.replace(/\.webp$/, `-${smallWidth}.webp`);
  const small = await cropped
    .clone()
    .resize({ width: smallWidth, withoutEnlargement: true })
    .webp({ quality: 74, effort: 6 })
    .toFile(resolve(root, smallOut));

  results.push({
    out: job.out,
    w: info.width,
    h: info.height,
    kb: info.size / 1024,
    smallKb: small.size / 1024,
    srcset: `${'/' + smallOut.replace('public/', '')} ${small.width}w, ${'/' + job.out.replace('public/', '')} ${info.width}w`,
    note: job.note
  });
  void fullW;
  void fullH;
}

const pad = Math.max(...results.map((r) => r.out.length));
for (const r of results) {
  console.log(
    `${r.out.padEnd(pad)}  ${String(r.w).padStart(4)}x${String(r.h).padEnd(4)}  ` +
      `${r.kb.toFixed(0).padStart(3)} kB full, ${r.smallKb.toFixed(0).padStart(3)} kB small`
  );
  console.log(`${' '.repeat(pad)}  srcset="${r.srcset}"`);
}
console.log(
  `\n${results.length} images, ${(results.reduce((a, r) => a + r.kb + r.smallKb, 0) / 1024).toFixed(2)} MB on disk`
);
