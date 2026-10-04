/**
 * Re-crops "Veiled figure" from the only copy of it that still exists.
 *
 *   node tools/recrop-veiled-figure.mjs
 *
 * Every other gallery image is generated from an original the studio supplied,
 * and tools/process-photos.mjs still carries the JOBS entry that made this one
 * from `8d30568c-IMG_0669.jpeg`. That original is gone. Originals from that
 * first phone batch were never committed, on the reasoning that they could
 * always be re-supplied, and this is the one that could not.
 *
 * So the 1000px WebP the site was already serving is committed as
 * `source/veiled-figure-as-received.webp` and treated as the source. It is a
 * lossy file being re-encoded, which is not how anything else here works, and
 * the only reason it is acceptable is that the alternative is leaving a red
 * wall stripe down the edge of a gallery tile.
 *
 * What this fixes and what it cannot. The red of the wall ran down the left
 * edge of the frame and read as part of the work in a grid of thumbnails, so
 * it is cropped off. The rest cannot be fixed here: the work was photographed
 * leaning against a wall at an angle, and the top and right edges of the piece
 * were already outside the frame when the shutter went. No crop puts them back.
 *
 * This one wants re-shooting. The studio has a camera now, and everything that
 * has come through it is in a different class from this.
 */
import { existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'source/veiled-figure-as-received.webp');

if (!existsSync(source)) {
  console.error(`Not found: ${source}`);
  process.exit(1);
}

/* Fraction of the received frame to keep. Only the left edge moves. */
const CROP = { left: 0.062, top: 0, width: 0.938, height: 1 };

const img = await sharp(source).toBuffer({ resolveWithObject: true });
const { width: W, height: H } = img.info;

const body = await sharp(img.data).extract({
  left: Math.round(CROP.left * W),
  top: Math.round(CROP.top * H),
  width: Math.round(CROP.width * W),
  height: Math.round(CROP.height * H)
}).toBuffer();

const meta = await sharp(body).metadata();
const full = meta.width;
const half = Math.round(full / 2);
const outDir = join(root, 'public/images/gallery');

await sharp(body).webp({ quality: 82 }).toFile(join(outDir, 'veiled-figure.webp'));
await sharp(body).resize({ width: half }).webp({ quality: 78 })
  .toFile(join(outDir, `veiled-figure-${half}.webp`));

console.log(`  veiled-figure            ${full}x${meta.height} (and ${half} wide)`);
