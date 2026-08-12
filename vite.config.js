import { readFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

/**
 * Tiny include step so the header and footer live in one file each instead of
 * being copied across six pages. Syntax: <!-- include: partials/header.html -->
 * It also marks the current page in the navigation, which keeps the markup
 * accessible without any client side work.
 */
function htmlIncludes() {
  return {
    name: 'thika-html-includes',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        const file = ctx.filename || ctx.path || 'index.html';
        const slug = basename(file).replace(/\.html$/, '') || 'index';

        let out = html;
        for (let pass = 0; pass < 3 && /<!--\s*include:/.test(out); pass += 1) {
          out = out.replace(/<!--\s*include:\s*([\w./-]+)\s*-->/g, (_match, partial) =>
            readFileSync(resolve(root, partial), 'utf8')
          );
        }

        return out.replace(`data-page="${slug}"`, `data-page="${slug}" aria-current="page"`);
      }
    }
  };
}

const page = (name) => resolve(root, name);

export default defineConfig({
  plugins: [htmlIncludes()],
  build: {
    target: 'es2019',
    cssCodeSplit: false,
    assetsInlineLimit: 2048,
    rollupOptions: {
      input: {
        index: page('index.html'),
        vision: page('vision.html'),
        programs: page('programs.html'),
        artists: page('artists.html'),
        gallery: page('gallery.html'),
        contact: page('contact.html')
      }
    }
  },
  server: { host: true }
});
