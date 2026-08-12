/**
 * Generates lightweight SVG placeholder images for artists, programs and gallery.
 * Every file is a few kB, so the image heavy pages stay fast until real photos
 * from the studio are dropped in. Run with: npm run placeholders
 *
 * Swap policy: replace the file at the same path with a real photo and update
 * the extension in the markup. Nothing else needs to change.
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

/* Portrait: a head and shoulders cut from packet grids and sheet metal. */
function artist(seed) {
  const rand = rng(seed);
  const w = 800;
  const h = 1000;
  const back = pick(rand, PALETTE);
  const skin = pick(rand, ['#7a6a58', '#5b4a3f', '#8c3a16', '#2f4858']);
  const cloth = pick(rand, PALETTE);
  /* Every portrait is built from the same parts, shifted enough that six of
     them side by side do not read as one repeated image. */
  const cx = w / 2 + (rand() - 0.5) * 110;
  const cy = 390 + rand() * 70;
  const rx = 145 + rand() * 40;
  const ry = rx * (1.15 + rand() * 0.16);
  const shoulderTop = cy + ry * 0.72;
  const shoulderInset = 110 + rand() * 90;

  let b = `<polygon points="${tornRect(rand, 40, 40, w - 80, h - 80, 14)}" fill="${back}" opacity="0.9"/>`;

  if (rand() > 0.3) {
    b += packetGrid(rand, 70, 70, w - 140, h - 140, contrasting(rand, back, 3));
  } else {
    const [bandA, bandB] = contrasting(rand, back, 2);
    for (let i = 0; i < 5; i += 1) {
      b += `<polygon points="${tornRect(rand, 70, 90 + i * 165, w - 140, 120, 13)}" fill="${i % 2 ? bandA : bandB}" opacity="0.9"/>`;
    }
  }

  b += `<polygon points="${tornRect(rand, shoulderInset, shoulderTop, w - shoulderInset * 2, h - shoulderTop - 40, 22)}" fill="${cloth}"/>`;
  b += `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(rx)}" ry="${r2(ry)}" fill="${skin}"/>`;

  /* Hair, cap or head wrap. */
  const crown = rand();
  if (crown > 0.66) {
    b += `<polygon points="${tornRect(rand, cx - rx * 1.1, cy - ry * 1.05, rx * 2.2, ry * 0.95, 16)}" fill="${INK}" opacity="0.85"/>`;
  } else if (crown > 0.33) {
    b += `<path d="M${r2(cx - rx * 1.05)} ${r2(cy - ry * 0.35)} A ${r2(rx * 1.05)} ${r2(ry * 0.95)} 0 0 1 ${r2(cx + rx * 1.05)} ${r2(cy - ry * 0.35)} Z" fill="${pick(rand, PALETTE)}" opacity="0.92"/>`;
  } else {
    b += `<polygon points="${tornRect(rand, cx - rx * 0.95, cy - ry * 1.02, rx * 1.9, ry * 0.6, 14)}" fill="${INK}" opacity="0.8"/>`;
    b += `<polygon points="${tornRect(rand, cx + rx * 0.5, cy - ry * 0.5, rx * 0.7, ry * 1.1, 14)}" fill="${INK}" opacity="0.55"/>`;
  }

  const eyeY = cy - ry * 0.08;
  b += `<circle cx="${r2(cx - rx * 0.36)}" cy="${r2(eyeY)}" r="16" fill="${PAPER}" opacity="0.85"/>`;
  b += `<circle cx="${r2(cx + rx * 0.36)}" cy="${r2(eyeY)}" r="16" fill="${PAPER}" opacity="0.85"/>`;

  b += `<polyline points="${stitch(rand, shoulderInset, shoulderTop, w - shoulderInset * 2, h - shoulderTop - 40)}" fill="none" stroke="${PAPER}" stroke-width="2.5" opacity="0.7"/>`;
  b += `<polyline points="${stitch(rand, 40, 40, w - 80, h - 80)}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.45"/>`;
  return shell(w, h, b, seed);
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

/* Gallery piece: tighter composition, sometimes a bottle top field. */
function artwork(seed, w, h) {
  const rand = rng(seed);
  const ground = pick(rand, PALETTE);
  let b = `<polygon points="${tornRect(rand, 20, 20, w - 40, h - 40, 12)}" fill="${ground}" opacity="0.95"/>`;
  const mode = Math.floor(rand() * 3);
  if (mode === 0) {
    const [dot, alt] = contrasting(rand, ground, 2);
    const cols = Math.round(w / 62);
    const rows = Math.round(h / 62);
    for (let c = 0; c < cols; c += 1) {
      for (let rw = 0; rw < rows; rw += 1) {
        const stroke = (c + rw) % 3 === 0 ? alt : dot;
        b += `<circle cx="${40 + c * 62}" cy="${40 + rw * 62}" r="21" fill="none" stroke="${stroke}" stroke-width="7" opacity="0.9"/>`;
      }
    }
  } else if (mode === 1) {
    b += packetGrid(rand, 50, 50, w - 100, h - 100, contrasting(rand, ground, 3));
  } else {
    b += panelField(rand, w, h, 2, 2, 34);
  }
  b += `<polyline points="${stitch(rand, 20, 20, w - 40, h - 40)}" fill="none" stroke="${INK}" stroke-width="2" opacity="0.5"/>`;
  return shell(w, h, b, seed);
}

function write(path, svg) {
  const full = resolve(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, svg);
  return `${path} ${(svg.length / 1024).toFixed(1)}kB`;
}

const log = [];

['naomi-wanjiru', 'brian-otieno', 'faith-mueni', 'kevin-kimani', 'aisha-hassan', 'samuel-njoroge']
  .forEach((slug) => log.push(write(`public/images/artists/${slug}.svg`, artist(slug))));

['empowerment', 'recycling', 'income', 'mentorship', 'exhibitions']
  .forEach((slug) => log.push(write(`public/images/programs/${slug}.svg`, program(slug))));

const sizes = [[900, 1200], [1200, 900], [1000, 1000]];
for (let i = 1; i <= 14; i += 1) {
  const [w, h] = sizes[i % sizes.length];
  log.push(write(`public/images/gallery/piece-${String(i).padStart(2, '0')}.svg`, artwork(`piece-${i}`, w, h)));
}

console.log(log.join('\n'));
