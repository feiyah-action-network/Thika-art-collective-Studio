/**
 * Turns George Kamiti's photographs into the web assets the gallery uses.
 *
 *   node tools/process-kamiti.mjs <source-directory>
 *
 * The studio shared two Drive folders. The second one is his: 26 photographs
 * whose filenames are the titles of the works, plus process shots of him making
 * them and a few frames of pieces that arrived with no title. The studio
 * confirmed both that the work is his and that he is the man in the process
 * photographs, which is what let any of this be published under his name.
 *
 * Point the script at a directory holding that folder, plus IMG_0551 from the
 * first folder, which is the frame his portrait is cut from. Originals are not
 * committed, the same arrangement as tools/process-photos.mjs.
 *
 * Provenance. The titles are exactly as the files are named, lowercased after
 * the first word to match the rest of the site. Two of them look like slips,
 * "Sunlt melanin" and "The matriach", and they are left as given rather than
 * corrected on his behalf. No medium, size or year came with any of them, so
 * the line under each title describes what is visible in the photograph and
 * says nothing it cannot see. That is the same rule the rest of the gallery
 * follows for work that arrived without a caption.
 *
 * Five of these were already in the gallery under descriptive stand in titles.
 * They keep their slug, so no link breaks, and gain the title he actually gave
 * them:
 *
 *   seed-packet-portrait  ->  Woven sun and copper
 *   tomato-paste-crown    ->  Obsidian flame
 *   bottle-top-portrait   ->  The matriach
 *   label-hair-on-blue    ->  The golden age
 *   stitched-profile      ->  The ancestral breath
 *
 * The last of those was also on its side. The old photograph was taken with the
 * work lying flat and nobody caught it, so the site has been describing a
 * "reclining figure" that is actually upright with its head tilted back.
 */
import { mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.argv[2];

if (!source) {
  console.error('Usage: node tools/process-kamiti.mjs <source-directory>');
  process.exit(1);
}

/*
 * file      the photograph, named for the work
 * slug      kept from the existing entry where there is one, so links hold
 * title     the filename, as given
 * blurb     what the photograph shows, written from the photograph
 * materials the gallery filter values
 * crop      fraction of the upright frame. Omitted means the whole frame.
 */
const WORKS = [
  /* ---------------------------------------------- already in the gallery */
  { file: 'WOVEN SUN AND COPPER.jpg', slug: 'seed-packet-portrait',
    title: 'Woven sun and copper', width: 900,
    blurb: 'Stitched panels, packaging and fabric',
    alt: 'A stitched portrait crowned with a grid of green packaging, the face and shoulders cut from scorched metal, in a deep red dress',
    materials: 'paper metal textile' },
  { file: 'OBSIDIAN FLAME.jpg', slug: 'tomato-paste-crown',
    title: 'Obsidian flame', width: 900,
    blurb: 'Tomato paste tin labels and cut metal, machine stitched',
    alt: 'A portrait whose hair is a dense grid of flattened yellow and black tomato paste labels, the face and bare shoulders in warm cut metal, against green',
    materials: 'metal packaging' },
  { file: 'THE MATRIACH.jpg', slug: 'bottle-top-portrait',
    title: 'The matriach', width: 900,
    blurb: 'Cut packaging and patterned paper, machine stitched',
    alt: 'A portrait with a wide halo of pink dotted paper, the face and body built from brightly printed packaging offcuts, on a black ground',
    materials: 'paper plastic packaging' },
  { file: 'THE GOLDEN AGE.jpg', slug: 'label-hair-on-blue',
    title: 'The golden age', width: 900,
    blurb: 'Stitched panels, netting and leather',
    alt: 'A figure in profile on a blue ground, face and body in scorched panels, a red leather bag at the shoulder, hair a cloud of green netting over pale labels',
    materials: 'metal packaging leather' },
  { file: 'THE ANCESTRAL BREATH.jpg', slug: 'stitched-profile',
    title: 'The ancestral breath', width: 1000,
    blurb: 'Scorched panels, machine stitched',
    alt: 'A figure with the head tilted back and eyes closed, built entirely from scorched and stitched panels in browns and golds',
    materials: 'metal' },

  /* ------------------------------------------------------------- new work */
  { file: 'BORN BENEATH THE STARS.jpg', slug: 'born-beneath-the-stars',
    title: 'Born beneath the stars', width: 900,
    blurb: 'Cut packaging on a printed ground, machine stitched',
    alt: 'A head and shoulders against a yellow honeycomb ground, the face assembled from red, green and printed packaging pieces',
    materials: 'paper packaging plastic' },
  { file: 'DISCO MATANGA.jpg', slug: 'disco-matanga',
    title: 'Disco matanga', width: 1000,
    blurb: 'Cut packaging, cloth and metal, machine stitched',
    alt: 'Two figures close together, one in a green patterned top, against a wall of gold dots and cherry printed cloth',
    materials: 'paper textile metal' },
  { file: 'GODDESS OF FERTILITY.jpg', slug: 'goddess-of-fertility',
    title: 'Goddess of fertility', width: 900,
    blurb: 'Cut packaging and printed paper, machine stitched',
    alt: 'A tall standing figure on a gold dotted ground with a group of smaller figures and a child gathered at the waist',
    materials: 'paper packaging' },
  { file: 'KATI.jpg', slug: 'kati',
    title: 'Kati', width: 1000,
    blurb: 'Cut tin labels on creased paper, machine stitched',
    alt: 'Four small figures spread across a sheet of creased pale pink paper, each built from cut tin labels and outlined in stitching',
    materials: 'metal paper' },
  { file: 'OPEN HANDS.jpg', slug: 'open-hands',
    title: 'Open hands', width: 900,
    blurb: 'Cut packaging and metal, machine stitched',
    alt: 'Dozens of open hands in packaging colours overlapping across the surface, red, green, blue and silver, on a grey ground',
    materials: 'paper metal plastic' },
  { file: 'PATANISHO.jpg', slug: 'patanisho',
    title: 'Patanisho', width: 900,
    blurb: 'Cut packaging and cloth, machine stitched',
    alt: 'Two seated figures turned away from each other, one in a pale flowered dress and one in yellow, on a mottled ground',
    materials: 'paper textile' },
  { file: 'RHUMBA JAPANI.jpg', slug: 'rhumba-japani',
    title: 'Rhumba japani', width: 1100,
    blurb: 'Cut packaging and printed cloth, machine stitched',
    alt: 'A band playing, drummers and dancers in printed cloth spread across a speckled ground',
    materials: 'paper textile' },
  { file: 'SAKATA.jpg', slug: 'sakata',
    title: 'Sakata', width: 900,
    blurb: 'Scorched panels and cut packaging, machine stitched',
    alt: 'A dancer thrown back mid movement, body in scorched panels, a green printed skirt, against pale paper and a black band',
    materials: 'metal paper' },
  { file: 'SAVAGE LIFE.jpg', slug: 'savage-life',
    title: 'Savage life', width: 1000,
    blurb: 'Cut packaging and printed paper, machine stitched',
    alt: 'A seated figure holding a child at the centre, a striding figure at either side, on a pale printed ground',
    materials: 'paper packaging' },
  { file: 'STARING INTO THE ABYSS.jpg', slug: 'staring-into-the-abyss',
    title: 'Staring into the abyss', width: 1000,
    blurb: 'Cut cloth and packaging on a scorched ground, machine stitched',
    alt: 'A seated figure in a white dress scattered with red flowers, leaning on one arm, against a smoky brown ground',
    materials: 'textile paper metal' },
  { file: 'SUNLT MELANIN.jpg', slug: 'sunlt-melanin',
    title: 'Sunlt melanin', width: 900,
    blurb: 'Scorched panels and cut packaging, machine stitched',
    alt: 'A portrait in scorched panels with a wide halo of blue dotted paper, in a white flowered top, against a bright green ground',
    materials: 'metal paper' },
  { file: 'SURROUNDED BY WHISPERS.jpg', slug: 'surrounded-by-whispers',
    title: 'Surrounded by whispers', width: 1000,
    blurb: 'Cut printed cloth and packaging, machine stitched',
    alt: 'A seated figure at the centre ringed by standing figures in patterned cloth, all turned inward',
    materials: 'textile paper' },
  { file: 'THE CATCH UP.jpg', slug: 'the-catch-up',
    title: 'The catch up', width: 1000,
    blurb: 'Cut packaging and scorched panels, machine stitched',
    alt: 'Two figures leaning together over cups, one in a pink printed top, against a mottled orange and blue ground',
    materials: 'paper metal' },
  { file: 'THE LAVA IN HER SOUL.jpg', slug: 'the-lava-in-her-soul',
    title: 'The lava in her soul', width: 900,
    blurb: 'Cut tin labels and scorched panels, machine stitched',
    alt: 'A portrait against a grid of green and red tin labels, the face in warm cut metal, in a striped wrap',
    materials: 'metal packaging' },
  { file: 'THE STAR WEAVER.jpg', slug: 'the-star-weaver',
    title: 'The star weaver', width: 900,
    blurb: 'Cut packaging on printed paper, machine stitched',
    alt: 'A portrait with a deep purple dotted halo, the face and shoulders assembled from brightly printed packaging',
    materials: 'paper plastic packaging' },
  { file: 'UNFILTERED RADIANCE.jpg', slug: 'unfiltered-radiance',
    title: 'Unfiltered radiance', width: 900,
    blurb: 'Scorched panels and cut packaging, machine stitched',
    alt: 'A smiling portrait in warm scorched panels, a green printed top, against pale paper with gold figures',
    materials: 'metal paper' },

  /* ------------------------------------------------- the G-avants wearables */
  { file: 'G-AVANTS.jpg', slug: 'g-avants', title: 'G-avants', width: 900,
    blurb: 'Leather, brass and salvaged fittings. Wearable',
    alt: 'A sleeveless leather bodice with two blue discs at the chest and a fan of pale spikes rising behind the shoulders',
    materials: 'leather metal' },
  { file: 'G-AVANTS 2.jpg', slug: 'g-avants-2', title: 'G-avants 2', width: 900,
    blurb: 'Leather, shell and salvaged fittings. Wearable',
    alt: 'A laced leather bodice in dark brown and burnt orange panels with a scallop shell set at the waist and cut discs across the chest',
    materials: 'leather metal' },
  { file: 'G-AVANTS 3.jpg', slug: 'g-avants-3', title: 'G-avants 3', width: 900,
    blurb: 'Leather and brass. Wearable',
    alt: 'A leather bodice in cream and oxblood panels with two curved brass plates at the chest and a brass rosette below',
    materials: 'leather metal' },
  { file: 'G-AVANTS 4.jpg', slug: 'g-avants-4', title: 'G-avants 4', width: 900,
    blurb: 'Leather, beadwork and salvaged fittings. Wearable',
    alt: 'A dark leather bodice on a hanger, two blue discs at the chest, beaded red and blue spikes fanning from each shoulder',
    materials: 'leather metal' },
  { file: 'G-AVANTS 5.jpg', slug: 'g-avants-5', title: 'G-avants 5', width: 900,
    blurb: 'Leather and brass. Wearable',
    alt: 'A leather bodice in tan and dark brown with three brass rosettes down the front and leather ties at the sides',
    materials: 'leather metal' }
];

/* His portrait comes from the other folder: at the bench, his own work on the
   wall behind him. Cropped square, which is what the artist cards take. */
const PORTRAIT = {
  file: 'IMG_0551.jpg',
  out: 'public/images/artists/george-kamiti',
  crop: { left: 0.42, top: 0.2, width: 0.42, height: 0.63 }
};

const outDir = join(root, 'public/images/gallery');
mkdirSync(outDir, { recursive: true });

async function upright(file) {
  const src = resolve(source, file);
  if (!existsSync(src)) return null;
  return sharp(src).rotate().toBuffer({ resolveWithObject: true });
}

const printed = [];

for (const work of WORKS) {
  const img = await upright(work.file);
  if (!img) {
    console.error(`  MISS  ${work.file}`);
    process.exitCode = 1;
    continue;
  }

  let pipeline = sharp(img.data);
  if (work.crop) {
    const { width: W, height: H } = img.info;
    pipeline = pipeline.extract({
      left: Math.round(work.crop.left * W),
      top: Math.round(work.crop.top * H),
      width: Math.min(Math.round(work.crop.width * W), W - Math.round(work.crop.left * W)),
      height: Math.min(Math.round(work.crop.height * H), H - Math.round(work.crop.top * H))
    });
  }

  const body = await pipeline.toBuffer();
  const meta = await sharp(body).metadata();
  const full = Math.min(work.width, meta.width);
  const half = Math.round(full / 2);
  const height = Math.round((meta.height / meta.width) * full);

  await sharp(body).resize({ width: full }).webp({ quality: 80 })
    .toFile(join(outDir, `${work.slug}.webp`));
  await sharp(body).resize({ width: half }).webp({ quality: 78 })
    .toFile(join(outDir, `${work.slug}-${half}.webp`));

  printed.push({ ...work, full, half, height });
  console.log(`  ${work.slug.padEnd(24)} ${full}x${height}  ${work.title}`);
}

const portrait = await upright(PORTRAIT.file);
if (portrait) {
  const { width: W, height: H } = portrait.info;
  const region = {
    left: Math.round(PORTRAIT.crop.left * W),
    top: Math.round(PORTRAIT.crop.top * H),
    width: Math.round(PORTRAIT.crop.width * W),
    height: Math.round(PORTRAIT.crop.height * H)
  };
  mkdirSync(join(root, 'public/images/artists'), { recursive: true });
  for (const width of [600, 300]) {
    const name = width === 600 ? `${PORTRAIT.out}.webp` : `${PORTRAIT.out}-${width}.webp`;
    await sharp(portrait.data).extract(region).resize(width, width, { fit: 'cover' })
      .webp({ quality: 82 }).toFile(join(root, name));
  }
  console.log('  george-kamiti portrait   600 and 300 wide');
} else {
  console.error(`  MISS  ${PORTRAIT.file} (the portrait frame, from the other folder)`);
  process.exitCode = 1;
}

const manifest = printed.map((w) => ({
  slug: w.slug,
  title: w.title,
  blurb: w.blurb,
  alt: w.alt,
  materials: w.materials,
  width: w.full,
  height: w.height,
  src: `/images/gallery/${w.slug}.webp`,
  srcset: `/images/gallery/${w.slug}-${w.half}.webp ${w.half}w, /images/gallery/${w.slug}.webp ${w.full}w`
}));

writeFileSync(join(root, 'tools/kamiti-output.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`\n${printed.length} works written. Markup data in tools/kamiti-output.json`);
