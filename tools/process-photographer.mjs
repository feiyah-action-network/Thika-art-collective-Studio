/**
 * The studio photographer's portrait.
 *
 *   node tools/process-photographer.mjs
 *
 * Every other portrait on the site is produced by the pipeline that handles
 * that person's work: Daniel Kabiaru's by process-catalogue.mjs, John Ruitha
 * Maina's by process-ruitha.mjs, George Kamiti's by process-kamiti.mjs. Stacey
 * Waithera Kamiti has no artwork pipeline, because what she makes is the
 * photographs, so her portrait gets its own small script rather than being
 * wedged into somebody else's.
 *
 * The original is 960 x 1280 and she sits low and centred in it, so the crop
 * takes the lower four fifths of the frame rather than the middle, which would
 * cut the top of her head. One shape only, 4:5. Her section on the artists
 * page is a two column feature, and a portrait orientation photograph should
 * not be squared off or cropped to landscape to fit a component that was built
 * for pictures of paintings. A square was generated too at first and nothing
 * used it, which the build said out loud, so it is gone.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'source/stacey-kamiti-portrait.webp');

if (!existsSync(source)) {
  console.error(`Portrait not found at ${source}`);
  process.exit(1);
}

const outDir = join(root, 'public/images/artists');
mkdirSync(outDir, { recursive: true });

const upright = await sharp(source).rotate().toBuffer({ resolveWithObject: true });
const { width: W, height: H } = upright.info;

/* Fractions of the upright frame. */
const CROP = { left: 0, top: 0.2, width: 1, height: 0.8 };

const region = {
  left: Math.round(CROP.left * W),
  top: Math.round(CROP.top * H),
  width: Math.round(CROP.width * W),
  height: Math.round(CROP.height * H)
};

for (const width of [800, 400]) {
  const file = width === 800 ? 'stacey-kamiti.webp' : `stacey-kamiti-${width}.webp`;
  const info = await sharp(upright.data).extract(region).resize({ width })
    .webp({ quality: 82 }).toFile(join(outDir, file));
  console.log(`  ${file.padEnd(28)} ${info.width}x${info.height}`);
}
