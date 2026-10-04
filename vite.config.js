import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, readdirSync, renameSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

/* The live hostname. Everything absolute on the site is built from this, so a
   domain change is a one line change here. */
export const SITE_URL = 'https://thikaartcollective.co.ke';

/* Pages in navigation order, with the clean URLs Netlify serves them at. */
const PAGES = [
  { file: 'index.html', path: '/', priority: '1.0' },
  { file: 'vision.html', path: '/vision', priority: '0.8' },
  { file: 'programs.html', path: '/programs', priority: '0.8' },
  { file: 'artists.html', path: '/artists', priority: '0.8' },
  { file: 'gallery.html', path: '/gallery', priority: '0.9' },
  { file: 'contact.html', path: '/contact', priority: '0.7' }
];

/**
 * Tiny include step so the header and footer live in one file each instead of
 * being copied across six pages. Syntax: <!-- include: partials/header.html -->
 *
 * It also marks the current page in the navigation and fills in the canonical
 * and Open Graph URLs, all of which keeps the markup accessible without any
 * client side work.
 */
function htmlIncludes() {
  return {
    name: 'thika-html-includes',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = basename(ctx.filename || ctx.path || 'index.html');
        const slug = file.replace(/\.html$/, '') || 'index';

        let out = html;
        for (let pass = 0; pass < 3 && /<!--\s*include:/.test(out); pass += 1) {
          out = out.replace(/<!--\s*include:\s*([\w./-]+)\s*-->/g, (_match, partial) =>
            readFileSync(resolve(root, partial), 'utf8')
          );
        }

        out = out.replace(`data-page="${slug}"`, `data-page="${slug}" aria-current="page"`);

        /* The site answers on both the custom domain and the netlify.app
           subdomain, so every page states which one is canonical. 404 is left
           out of it deliberately. */
        const entry = PAGES.find((p) => p.file === file);
        const canonical = entry
          ? `<link rel="canonical" href="${SITE_URL}${entry.path}" />\n<meta property="og:url" content="${SITE_URL}${entry.path}" />`
          : '<meta name="robots" content="noindex" />';

        return out
          .replace('<!-- canonical -->', canonical)
          .replace(/content="\/images\/share-card\.jpg"/, `content="${SITE_URL}/images/share-card.jpg"`);
      }
    }
  };
}

/* Search engines want absolute URLs in a sitemap, so it is written at build
   time from the same list the canonical tags come from. */
function sitemap() {
  return {
    name: 'thika-sitemap',
    apply: 'build',
    closeBundle() {
      const today = new Date().toISOString().slice(0, 10);
      const urls = PAGES.map(
        (p) =>
          `  <url>\n    <loc>${SITE_URL}${p.path}</loc>\n` +
          `    <lastmod>${today}</lastmod>\n    <priority>${p.priority}</priority>\n  </url>`
      ).join('\n');

      writeFileSync(
        resolve(root, 'dist/sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
      );
    }
  };
}

/**
 * Content hashes the images, the way Rollup already hashes the bundles.
 *
 * Why this exists. Everything in public/ is copied to dist verbatim, so an
 * image kept its name when its contents changed. On this site that happens
 * constantly: a crop gets corrected, a work is rephotographed, an artist sends
 * a better portrait. With a long cache header, a corrected image stayed
 * invisible for as long as the header said, to everybody who had already seen
 * the page, including the studio checking whether the fix had landed. The
 * header had to be short, which gave up caching on the heaviest part of the
 * site to work around a naming problem.
 *
 * Hashing solves both ends: a changed file is a new URL, so it is fetched
 * immediately, and an unchanged file keeps its URL forever, so it can be
 * immutable for a year. netlify.toml sets that header.
 *
 * It runs after the bundle is written, when Vite has already copied public/
 * into dist, and it rewrites the references in the built pages rather than in
 * the source. The source keeps plain readable paths, the dev server serves
 * those paths straight from public/, and nothing about authoring changes.
 */
function hashedImages() {
  return {
    name: 'thika-hashed-images',
    apply: 'build',
    enforce: 'post',
    closeBundle() {
      const dist = resolve(root, 'dist');
      const imagesDir = join(dist, 'images');

      const walk = (dir) =>
        readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
          const full = join(dir, entry.name);
          return entry.isDirectory() ? walk(full) : [full];
        });

      /* oldUrl -> newUrl, longest first so no key can be a prefix of another. */
      const renames = new Map();
      for (const file of walk(imagesDir)) {
        const bytes = readFileSync(file);
        const hash = createHash('sha256').update(bytes).digest('hex').slice(0, 8);
        const ext = extname(file);
        const hashed = `${basename(file, ext)}.${hash}${ext}`;
        renameSync(file, join(dirname(file), hashed));
        renames.set(
          `/images/${relative(imagesDir, file).split('\\').join('/')}`,
          `/images/${relative(imagesDir, join(dirname(file), hashed)).split('\\').join('/')}`
        );
      }

      const keys = [...renames.keys()].sort((a, b) => b.length - a.length);
      const rewritable = /\.(html|css|js|xml|txt|json|webmanifest)$/;
      let rewritten = 0;
      const seen = new Set();

      for (const file of walk(dist)) {
        if (!rewritable.test(file)) continue;
        const before = readFileSync(file, 'utf8');
        let after = before;
        for (const key of keys) {
          if (!after.includes(key)) continue;
          /* The Open Graph tag carries the absolute form of the same path. */
          after = after.split(SITE_URL + key).join(SITE_URL + renames.get(key));
          after = after.split(key).join(renames.get(key));
          seen.add(key);
        }
        if (after !== before) {
          writeFileSync(file, after);
          rewritten += 1;
        }
      }

      const unused = keys.length - seen.size;
      console.log(
        `images: ${keys.length} hashed, ${rewritten} files rewritten` +
          (unused ? `, ${unused} not referenced by any page` : '')
      );
      if (unused) {
        for (const key of keys.filter((k) => !seen.has(k))) console.log(`  unused  ${key}`);
      }
    }
  };
}

const page = (name) => resolve(root, name);

export default defineConfig({
  plugins: [htmlIncludes(), sitemap(), hashedImages()],
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: Object.fromEntries(
        [...PAGES.map((p) => p.file), '404.html'].map((f) => [f.replace(/\.html$/, ''), page(f)])
      )
    }
  },
  server: { host: true }
});
