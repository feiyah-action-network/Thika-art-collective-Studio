/**
 * Static check over the built site: every local asset a page asks for has to
 * exist in dist, and every internal link has to point at a real page.
 *
 * This is the cheap half of the test suite. It needs no browser, so it still
 * runs when the browser half cannot, and it catches the failure that is easiest
 * to introduce by accident: renaming or deleting an image and leaving a
 * reference behind.
 */
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

if (!existsSync(dist)) {
  console.error('dist not found. Run npm run build first.');
  process.exit(1);
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const pages = walk(dist).filter((f) => f.endsWith('.html'));
const failures = [];
let checked = 0;

/* Collect every local reference a page makes. */
function referencesIn(html) {
  const refs = [];

  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) refs.push(m[1]);
  for (const m of html.matchAll(/srcset="([^"]+)"/g)) {
    for (const candidate of m[1].split(',')) {
      const url = candidate.trim().split(/\s+/)[0];
      if (url) refs.push(url);
    }
  }
  for (const m of html.matchAll(/<meta property="og:image" content="([^"]+)"/g)) refs.push(m[1]);

  return refs;
}

for (const page of pages) {
  const html = readFileSync(page, 'utf8');
  const name = page.replace(dist + '/', '');

  for (const ref of referencesIn(html)) {
    if (/^(https?:|mailto:|tel:|data:|#)/.test(ref) || ref === '') continue;
    if (!ref.startsWith('/')) continue;

    checked += 1;
    let path = ref.split('#')[0].split('?')[0];
    /* A directory reference resolves to its index page. */
    if (path.endsWith('/')) path += 'index.html';
    const target = join(dist, path);
    const ok = existsSync(target) && statSync(target).isFile();
    if (!ok) failures.push(`${name} references ${ref}, which is not in dist`);
  }

  /* Every page should carry the shared chrome and its own description. */
  if (!html.includes('class="site-header"')) failures.push(`${name} is missing the header partial`);
  if (!html.includes('class="site-footer"')) failures.push(`${name} is missing the footer partial`);
  /* Attributes are often wrapped across lines, so match the tag not the line. */
  if (!/<meta[^>]*name="description"[^>]*>/s.test(html)) failures.push(`${name} has no meta description`);
  if (html.includes('<!-- include:')) failures.push(`${name} still has an unresolved include`);

  /* Copy rule for this project. */
  if (html.includes('—')) failures.push(`${name} contains an em dash`);
}

/* Nothing should point at the invented names the early draft used. */
const RETIRED = /Naomi Wanjiru|Brian Otieno|Faith Mueni|Kevin Kimani|Aisha Hassan|Samuel Njoroge/;
for (const page of pages) {
  if (RETIRED.test(readFileSync(page, 'utf8'))) {
    failures.push(`${page.replace(dist + '/', '')} still names a placeholder artist`);
  }
}

console.log(`asset check: ${pages.length} pages, ${checked} local references`);

if (failures.length) {
  for (const f of failures) console.error(`  FAIL  ${f}`);
  console.error(`\n${failures.length} problems`);
  process.exit(1);
}

console.log('asset check passed');
