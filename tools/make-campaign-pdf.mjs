/**
 * Builds a PDF pack of one or more artists' work, for use away from the site.
 *
 *   node tools/make-campaign-pdf.mjs ndegwa ruitha
 *   node tools/make-campaign-pdf.mjs kamiti --out kamiti-pack.pdf
 *
 * The arguments are the data-artist values used in gallery.html, so whatever
 * the gallery knows about an artist is what comes out. Titles, mediums, sizes
 * and sold marks are read from the markup rather than retyped, which means a
 * correction to the gallery is a correction here and the two cannot drift.
 *
 * One work per page, at the size the page allows, with the caption exactly as
 * the site states it. Each artist gets a divider carrying the same biography
 * the artists page carries. Nothing is written here that is not already on the
 * site, because this is the thing that gets forwarded to people who will not
 * check.
 *
 * Images are converted from WebP to JPEG because PDF readers handle JPEG
 * everywhere and WebP in a PDF is still a gamble. They are capped at 1800px on
 * the long edge: enough to look right at A4 and on a phone, small enough that
 * the file can be sent over WhatsApp.
 *
 * Output goes to the scratch directory given by --out, defaulting to
 * campaign-pack.pdf in the repository root. It is not committed.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { dirname, resolve, join, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tmpdir } from 'node:os';
import sharp from 'sharp';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const outIndex = args.indexOf('--out');
const outPath = outIndex === -1 ? join(root, 'campaign-pack.pdf') : resolve(args[outIndex + 1]);
const artists = (outIndex === -1 ? args : [...args.slice(0, outIndex), ...args.slice(outIndex + 2)])
  .filter(Boolean);

if (!artists.length) {
  console.error('Usage: node tools/make-campaign-pdf.mjs <artist> [artist...] [--out file.pdf]');
  console.error('Artists are the data-artist values in gallery.html, for example ndegwa ruitha.');
  process.exit(1);
}

/* The lead line for each artist, taken from their profile on the artists page.
   An artist with no entry here still gets their work, just no divider text. */
const INTROS = {
  ndegwa: {
    name: 'Dennis Bull Ndegwa',
    role: 'Acrylic on repurposed unga paper and canvas',
    body: [
      'Born in Nairobi in 1998, with more than five years in Kenya’s art scene. In his words his practice is rooted in capturing the rhythms, resilience and resourcefulness of everyday Kenyan life.',
      'His recent work combines acrylics with recycled unga paper, drawing on bodabodas as symbolic vessels for Kenya’s economic shifts, urban motion and the grit of people hustling for their daily bread, or kutafuta unga as he puts it. He signs his work Bull.'
    ]
  },
  ruitha: {
    name: 'John Ruitha Maina',
    role: 'Acrylic on salvaged cardboard and packaging',
    body: [
      'He is 27 and works from his home studio in Thika Town. He began with oil paints and moved to acrylics, and describes his style as a modern one built on urban narratives, human figures, emotions and contemporary fashion. He is self taught.',
      'Since early 2023 he has been painting on cardboard. In his words the approach seeks to raise awareness about recycling, since a great deal of cardboard is thrown away and only a small fraction of it is recycled. He collects it from bins, from shops and from friends’ homes. He signs his work Ruitha.'
    ]
  }
};

/* ------------------------------------------------------- read the gallery */
const html = readFileSync(join(root, 'gallery.html'), 'utf8');
const figures = [...html.matchAll(/<figure class="gallery__item"[^>]*data-artist="([a-z]+)"[\s\S]*?<\/figure>/g)];

const works = [];
for (const match of figures) {
  const artist = match[1];
  if (!artists.includes(artist)) continue;
  const block = match[0];
  works.push({
    artist,
    src: /src="([^"]+)"/.exec(block)[1],
    alt: /alt="([^"]+)"/.exec(block)[1],
    title: /<h3>([^<]+)<\/h3>/.exec(block)[1],
    caption: /<figcaption[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(block)[1].replace(/\s+/g, ' ').trim()
  });
}

if (!works.length) {
  console.error(`No works found for: ${artists.join(', ')}`);
  process.exit(1);
}

/* -------------------------------------------------------- convert the art */
const staging = mkdtempSync(join(tmpdir(), 'campaign-'));
const MAX_EDGE = 1800;

for (const work of works) {
  const source = join(root, 'public', work.src.replace(/^\//, ''));
  const name = basename(work.src).replace(/\.webp$/, '.jpg');
  const meta = await sharp(source).metadata();
  const scale = Math.min(1, MAX_EDGE / Math.max(meta.width, meta.height));
  await sharp(source)
    .resize({ width: Math.round(meta.width * scale) })
    .flatten({ background: '#ffffff' })
    .jpeg({ quality: 88, mozjpeg: true })
    .toFile(join(staging, name));
  work.file = pathToFileURL(join(staging, name)).href;
}

/* ------------------------------------------------------------ build pages */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fontUrl = (f) => pathToFileURL(join(root, 'public/fonts', f)).href;

const ordered = artists.flatMap((a) => works.filter((w) => w.artist === a));
const counts = Object.fromEntries(artists.map((a) => [a, works.filter((w) => w.artist === a).length]));

const cover = `
  <section class="page cover">
    <p class="eyebrow">Thika Art Collective Studio</p>
    <h1>${artists.map((a) => esc(INTROS[a]?.name || a)).join('<br />')}</h1>
    <p class="lede">
      ${ordered.length} works. Titles, mediums and sizes are as the studio records them.
    </p>
    <p class="foot">thikaartcollective.co.ke</p>
  </section>`;

let pages = cover;
for (const artist of artists) {
  const intro = INTROS[artist];
  if (intro) {
    pages += `
  <section class="page divider">
    <p class="eyebrow">${counts[artist]} works</p>
    <h2>${esc(intro.name)}</h2>
    <p class="role">${esc(intro.role)}</p>
    ${intro.body.map((p) => `<p class="body">${esc(p)}</p>`).join('\n    ')}
    <p class="foot">thikaartcollective.co.ke</p>
  </section>`;
  }
  for (const work of works.filter((w) => w.artist === artist)) {
    pages += `
  <section class="page work">
    <div class="art"><img src="${work.file}" alt="${esc(work.alt)}" /></div>
    <div class="label">
      <h3>${esc(work.title)}</h3>
      <p>${esc(work.caption)}</p>
    </div>
  </section>`;
  }
}

const doc = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<style>
  @font-face { font-family: Anton; src: url('${fontUrl('Anton-400.woff2')}') format('woff2'); font-weight: 400; }
  @font-face { font-family: 'Work Sans'; src: url('${fontUrl('WorkSans-400.woff2')}') format('woff2'); font-weight: 400; }
  @page { size: A4; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Work Sans', system-ui, sans-serif; color: #1d1b19; background: #fff; }
  .page {
    width: 210mm; height: 297mm; padding: 18mm 18mm 14mm;
    display: flex; flex-direction: column; page-break-after: always;
    background: #f5efe4;
  }
  .page:last-child { page-break-after: auto; }
  .eyebrow {
    font-size: 8.5pt; letter-spacing: 0.18em; text-transform: uppercase;
    color: #b4482a; font-weight: 600;
  }
  h1, h2, h3 { font-family: Anton, Impact, sans-serif; font-weight: 400; line-height: 1.02; }
  .cover { justify-content: center; }
  .cover h1 { font-size: 40pt; margin-top: 6mm; text-transform: uppercase; }
  .cover .lede { font-size: 11pt; margin-top: 8mm; max-width: 46ex; color: #4a443d; }
  .divider { justify-content: center; }
  .divider h2 { font-size: 30pt; margin-top: 4mm; text-transform: uppercase; }
  .divider .role { font-size: 10pt; color: #b4482a; margin-top: 2mm; letter-spacing: 0.04em; }
  .divider .body { font-size: 10.5pt; line-height: 1.55; margin-top: 5mm; max-width: 56ex; color: #4a443d; }
  /* The frame hugs the work. An earlier version stretched the bordered box to
     fill the page, which put a tall white band above and below every landscape
     piece and made them all look like they had been shot badly. */
  .work { justify-content: center; }
  .art {
    display: flex; align-items: center; justify-content: center;
    border: 1.5pt solid #1d1b19; background: #fff; padding: 5mm;
    align-self: center; max-width: 100%;
  }
  .art img { max-width: 100%; max-height: 205mm; width: auto; height: auto; display: block; }
  .label { padding-top: 7mm; }
  .label h3 { font-size: 20pt; text-transform: uppercase; }
  .label p { font-size: 10pt; color: #4a443d; margin-top: 2mm; }
  .foot {
    margin-top: auto; padding-top: 8mm; font-size: 8.5pt;
    letter-spacing: 0.1em; text-transform: uppercase; color: #8a8178;
  }
</style></head>
<body>${pages}</body></html>`;

const htmlFile = join(staging, 'pack.html');
writeFileSync(htmlFile, doc);

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
const page = await browser.newPage();
await page.goto(pathToFileURL(htmlFile).href, { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.pdf({ path: outPath, width: '210mm', height: '297mm', printBackground: true });
await browser.close();
rmSync(staging, { recursive: true, force: true });

console.log(`${ordered.length} works, ${artists.length} artists`);
for (const a of artists) console.log(`  ${(INTROS[a]?.name || a).padEnd(24)} ${counts[a]}`);
console.log(`\nWritten to ${outPath}`);
