import { readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
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

const page = (name) => resolve(root, name);

export default defineConfig({
  plugins: [htmlIncludes(), sitemap()],
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
