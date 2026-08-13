/**
 * Generates the stand in artwork for image slots with no photograph yet.
 * Run with: npm run placeholders
 *
 * Only the mentorship program still needs one. The artist portraits and the
 * gallery tiles this used to produce are gone, replaced by real photographs
 * and, on the artists page, by initial tiles that do not pretend to be
 * portraits. Earlier revisions are in the git history if they are wanted back.
 *
 * Swap policy: replace the file at the same path with a real photo and update
 * the src and dimensions in the markup.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Palette lifted from the studio materials: seed packets, maize meal sacks,
   flattened tins, terracotta floors, ochre walls. */
const PAPER = '#efe2cc';
const INK = '#231d17';
const PALETTE = [
  '#1f5c3a', // seed packet green
  '#a6432b', // terracotta
  '#e2691c', // maize sack orange
  '#7a6a58', // faded metal
  '#c9a227', // brass
  '#8c3a16', // rust
  '#d9a7a0', // washed pink
  '#2f4858', // cold steel
  '#5b4a3f', // scorched wood
  '#e8c26a'  // ochre wall
];

/* Small deterministic RNG so re-running the script does not churn the repo. */
function rng(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i += 1) s = (s * 31 + seed.charCodeAt(i)) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const pick = (rand, list) => list[Math.floor(rand() * list.length)];
const r2 = (n) => Math.round(n * 100) / 100;

/* A hand cut edge: a polygon whose outline wobbles like torn paper. */
function tornRect(rand, x, y, w, h, bite = 10) {
  const pts = [];
  const step = Math.max(w, h) / 14;
  const edge = (fromX, fromY, toX, toY) => {
    const dist = Math.hypot(toX - fromX, toY - fromY);
    const count = Math.max(2, Math.round(dist / step));
    for (let i = 0; i < count; i += 1) {
      const t = i / count;
      const px = fromX + (toX - fromX) * t + (rand() - 0.5) * bite;
      const py = fromY + (toY - fromY) * t + (rand() - 0.5) * bite;
      pts.push(`${r2(px)},${r2(py)}`);
    }
  };
  edge(x, y, x + w, y);
  edge(x + w, y, x + w, y + h);
  edge(x + w, y + h, x, y + h);
  edge(x, y + h, x, y);
  return pts.join(' ');
}

/* The zigzag machine stitching that holds the panels together. */
function stitch(rand, x, y, w, h) {
  const pts = [];
  const per = 12;
  const run = (fromX, fromY, toX, toY) => {
    const dist = Math.hypot(toX - fromX, toY - fromY);
    const count = Math.max(4, Math.round(dist / per));
    const nx = (toY - fromY) / dist;
    const ny = -(toX - fromX) / dist;
    for (let i = 0; i <= count; i += 1) {
      const t = i / count;
      const amp = i % 2 === 0 ? 4 : -4;
      pts.push(`${r2(fromX + (toX - fromX) * t + nx * amp)},${r2(fromY + (toY - fromY) * t + ny * amp)}`);
    }
  };
  run(x, y, x + w, y);
  run(x + w, y, x + w, y + h);
  run(x + w, y + h, x, y + h);
  run(x, y + h, x, y);
  return pts.join(' ');
}

/* Grid of repeated labels, the way flattened seed packets tile across a board.
   Cells alternate between a couple of colours and carry a printed bar, so the
   field reads as packaging rather than as a flat swatch. */
function packetGrid(rand, x, y, w, h, colors) {
  const set = Array.isArray(colors) ? colors : [colors];
  const cols = 3 + Math.floor(rand() * 2);
  const rows = 4 + Math.floor(rand() * 3);
  const cw = w / cols;
  const ch = h / rows;
  let out = '';
  for (let c = 0; c < cols; c += 1) {
    for (let rw = 0; rw < rows; rw += 1) {
      const px = x + c * cw + 3;
      const py = y + rw * ch + 3;
      const cellW = cw - 6;
      const cellH = ch - 6;
      const fill = set[(c + rw + Math.floor(rand() * 2)) % set.length];
      out += `<rect x="${r2(px)}" y="${r2(py)}" width="${r2(cellW)}" height="${r2(cellH)}" fill="${fill}" stroke="${INK}" stroke-width="1.5" stroke-opacity="0.35"/>`;
      out += `<rect x="${r2(px + cellW * 0.1)}" y="${r2(py + cellH * 0.16)}" width="${r2(cellW * 0.62)}" height="${r2(Math.max(4, cellH * 0.1))}" fill="${PAPER}" opacity="0.75"/>`;
      out += `<rect x="${r2(px + cellW * 0.1)}" y="${r2(py + cellH * 0.38)}" width="${r2(cellW * 0.34)}" height="${r2(Math.max(3, cellH * 0.06))}" fill="${PAPER}" opacity="0.45"/>`;
      if (rand() > 0.55) {
        out += `<rect x="${r2(px + cellW * 0.58)}" y="${r2(py + cellH * 0.58)}" width="${r2(cellW * 0.3)}" height="${r2(cellH * 0.26)}" fill="${INK}" opacity="0.28"/>`;
      }
    }
  }
  return out;
}

/* Two or three palette entries that are not the colour already on the board. */
function contrasting(rand, avoid, count = 2) {
  const pool = PALETTE.filter((c) => c !== avoid);
  const out = [];
  while (out.length < count && pool.length) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
}

function shell(w, h, body, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-hidden="true">` +
    `<defs><filter id="g"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2"/>` +
    `<feColorMatrix type="saturate" values="0"/></filter></defs>` +
    `<rect width="${w}" height="${h}" fill="${PAPER}"/>` +
    body +
    `<rect width="${w}" height="${h}" filter="url(#g)" opacity="0.16"/>` +
    `<text x="${w - 14}" y="${h - 14}" text-anchor="end" font-family="monospace" font-size="${Math.round(w / 46)}" fill="${INK}" opacity="0.34">placeholder</text>` +
    `</svg>`;
}

/* Panels laid over a rough grid with jitter, so the whole board is covered the
   way a finished piece covers its backing. */
function panelField(rand, w, h, cols, rows, inset) {
  let out = '';
  const cw = (w - inset * 2) / cols;
  const ch = (h - inset * 2) / rows;
  for (let c = 0; c < cols; c += 1) {
    for (let rw = 0; rw < rows; rw += 1) {
      const jitter = Math.min(cw, ch) * 0.18;
      const px = inset + c * cw + (rand() - 0.5) * jitter;
      const py = inset + rw * ch + (rand() - 0.5) * jitter;
      const pw = cw * (0.94 + rand() * 0.34);
      const ph = ch * (0.94 + rand() * 0.34);
      const fill = pick(rand, PALETTE);
      out += `<polygon points="${tornRect(rand, px, py, pw, ph, 15)}" fill="${fill}" opacity="${r2(0.9 + rand() * 0.1)}"/>`;
      if (rand() > 0.5) out += packetGrid(rand, px + 12, py + 12, pw - 24, ph - 24, contrasting(rand, fill, 2));
      out += `<polyline points="${stitch(rand, px, py, pw, ph)}" fill="none" stroke="${PAPER}" stroke-width="2.4" opacity="0.55"/>`;
    }
  }
  return out;
}

/* Programme block: overlapping salvaged panels, no figure. */
function program(seed) {
  const rand = rng(seed);
  const w = 1200;
  const h = 900;
  let b = `<rect width="${w}" height="${h}" fill="${pick(rand, PALETTE)}" opacity="0.4"/>`;
  b += panelField(rand, w, h, 3, 2, 24);
  return shell(w, h, b, seed);
}

function write(path, svg) {
  const full = resolve(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, svg);
  return `${path} ${(svg.length / 1024).toFixed(1)}kB`;
}

const log = [];

log.push(write('public/images/programs/mentorship.svg', program('mentorship')));

console.log(log.join('\n'));
