/**
 * Portraits for the people who have no artwork pipeline of their own.
 *
 *   node tools/process-portraits.mjs
 *
 * Most portraits are produced by the script that handles that person's work:
 * Daniel Kabiaru's by process-catalogue.mjs, John Ruitha Maina's by
 * process-ruitha.mjs, George Kamiti's by process-kamiti.mjs. Two people do not
 * fit that. Stacey Waithera Kamiti makes the photographs rather than the work
 * in them, and Peter Ndirangu has sent a biography and a portrait but no
 * pictures of his pieces yet. This handles both, and anyone else who arrives
 * the same way.
 *
 * It started as a one person script for the photographer. The second person
 * made the case for generalising it rather than adding another.
 *
 * Shapes are not the same for everyone, which is the point of the per person
 * entries. The artist grid takes squares. The photographer's section on the
 * artists page is a two column feature, so hers is 4:5: a portrait orientation
 * photograph should not be squared off to fit a component that was built for
 * pictures of paintings.
 */
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public/images/artists');

/*
 * file    the original, in source/
 * slug    the output name, with the smaller width appended for the half size
 * crop    fraction of the upright frame. Omitted means the whole frame.
 * square  cover crop to a square, for the artist grid
 */
const PEOPLE = [
  {
    /* She sits low and centred in a 960 x 1280 frame, so this takes the lower
       four fifths rather than the middle, which would cut the top of her head. */
    file: 'stacey-kamiti-portrait.webp',
    slug: 'stacey-kamiti',
    crop: { left: 0, top: 0.2, width: 1, height: 0.8 },
    widths: [800, 400]
  },
  {
    /* He is to the left of the frame with one of his woven technique paintings
       hanging behind him, so the whole frame is kept and squared. Cropping in
       on his face would lose the work, which is the better half of the picture
       given no photographs of his pieces have arrived yet. */
    file: 'peter-ndirangu-portrait.webp',
    slug: 'peter-ndirangu',
    widths: [600, 300],
    square: true
  }
];

mkdirSync(outDir, { recursive: true });

for (const person of PEOPLE) {
  const source = join(root, 'source', person.file);
  if (!existsSync(source)) {
    console.error(`  MISS  ${person.file}`);
    process.exitCode = 1;
    continue;
  }

  const upright = await sharp(source).rotate().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = upright.info;

  let base = sharp(upright.data);
  if (person.crop) {
    const region = {
      left: Math.round(person.crop.left * W),
      top: Math.round(person.crop.top * H),
      width: Math.round(person.crop.width * W),
      height: Math.round(person.crop.height * H)
    };
    region.width = Math.min(region.width, W - region.left);
    region.height = Math.min(region.height, H - region.top);
    base = base.extract(region);
  }
  const body = await base.toBuffer();

  for (const width of person.widths) {
    const file = width === person.widths[0] ? `${person.slug}.webp` : `${person.slug}-${width}.webp`;
    const pipeline = person.square
      ? sharp(body).resize(width, width, { fit: 'cover', position: 'top' })
      : sharp(body).resize({ width });
    const info = await pipeline.webp({ quality: 82 }).toFile(join(outDir, file));
    console.log(`  ${file.padEnd(28)} ${info.width}x${info.height}`);
  }
}
