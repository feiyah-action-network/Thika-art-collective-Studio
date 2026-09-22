/**
 * Browser checks against the built site.
 *
 * These exist because most of what this site promises is behavioural: it has to
 * work with JavaScript switched off, it has to skip the animation bundle for
 * reduced motion, the filter bar has to hide categories nothing is tagged with,
 * and the contact form has to say something useful when its endpoint is not
 * reachable. None of that is visible in the markup alone.
 *
 * Run with: npm test
 * Set CHROMIUM_PATH to point at a Chromium binary Playwright did not install.
 */
import { chromium } from 'playwright';

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:4173';
const PAGES = ['', 'vision.html', 'programs.html', 'artists.html', 'gallery.html', 'contact.html', '404.html'];

const results = [];
const check = (name, pass, detail = '') =>
  results.push({ name, pass, detail: detail ? String(detail).slice(0, 90) : '' });

const launch = {};
if (process.env.CHROMIUM_PATH) launch.executablePath = process.env.CHROMIUM_PATH;

const browser = await chromium.launch(launch);

/* ------------------------------------------------- 1. no JavaScript ----- */
{
  const ctx = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const home = await page.evaluate(() => ({
    hidden: [...document.querySelectorAll('[data-reveal], [data-hero-line] > span')].filter(
      (e) => parseFloat(getComputedStyle(e).opacity) < 0.9 || getComputedStyle(e).transform !== 'none'
    ).length,
    font: getComputedStyle(document.body).fontFamily,
    nav: getComputedStyle(document.querySelector('.nav')).display,
    toggle: getComputedStyle(document.querySelector('.nav-toggle')).display
  }));
  check('no JS: nothing is left hidden', home.hidden === 0, `hidden=${home.hidden}`);
  check('no JS: stylesheet still applies', home.font.includes('Work Sans'), home.font);
  check('no JS: nav visible and toggle suppressed', home.nav === 'flex' && home.toggle === 'none', `${home.nav}/${home.toggle}`);

  await page.goto(`${BASE}/gallery.html`, { waitUntil: 'load' });
  const gallery = await page.evaluate(() => ({
    items: document.querySelectorAll('.gallery__item:not([hidden])').length,
    barHidden: document.querySelector('[data-filters]').hidden
  }));
  check('no JS: every gallery piece is listed', gallery.items > 0, `items=${gallery.items}`);
  check('no JS: filter bar stays hidden', gallery.barHidden === true);

  await page.goto(`${BASE}/`, { waitUntil: 'load' });
  const strip = await page.evaluate(() => {
    const el = document.querySelector('[data-strip]');
    if (!el) return null;
    return {
      items: el.querySelectorAll('.work-strip__item').length,
      overflow: getComputedStyle(el).overflowX,
      animated: el.classList.contains('is-animated')
    };
  });
  check('no JS: the work strip is present', strip && strip.items > 0, JSON.stringify(strip));
  check(
    'no JS: the work strip can still be scrolled by hand',
    strip && strip.overflow !== 'hidden' && strip.animated === false,
    `overflow=${strip && strip.overflow} animated=${strip && strip.animated}`
  );

  await page.goto(`${BASE}/artists.html`, { waitUntil: 'load' });
  const disclosure = await page.evaluate(() => {
    const d = document.querySelector('.artist__more');
    d.open = true;
    return getComputedStyle(d.querySelector('.artist__panel')).display !== 'none';
  });
  check('no JS: artist profile opens', disclosure);

  await ctx.close();

  const mobile = await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 } });
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/`, { waitUntil: 'load' });
  check('no JS on mobile: nav links reachable', (await mp.evaluate(() => getComputedStyle(document.querySelector('.nav')).display)) === 'flex');
  await mobile.close();
}

/* ------------------------------------------------- 2. gallery filter ---- */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/gallery.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  check('filter bar appears once its script runs', !(await page.locator('[data-filters]').isHidden()));

  /* The bar prunes itself, so this depends on how pieces are tagged today. */
  const tagged = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-material]')];
    const used = (group, value) => items.some((i) => (i.dataset[group] || '').split(' ').includes(value));
    return {
      materials: [...new Set(items.flatMap((i) => (i.dataset.material || '').split(' ').filter(Boolean)))],
      woodUsed: used('material', 'wood')
    };
  });

  check(
    'unused material chip is hidden',
    tagged.woodUsed || (await page.locator('[data-filter="material"][data-value="wood"]').isHidden())
  );

  const material = tagged.materials[0];
  const expected = await page.evaluate(
    (m) => [...document.querySelectorAll('[data-material]')].filter((i) => i.dataset.material.split(' ').includes(m)).length,
    material
  );
  await page.locator(`[data-filter="material"][data-value="${material}"]`).click();
  await page.waitForTimeout(200);
  const shown = await page.locator('.gallery__item:not([hidden])').count();
  check(`filtering by ${material} narrows the grid`, shown === expected, `shown=${shown} expected=${expected}`);

  const status = (await page.locator('[data-gallery-status]').textContent()).trim();
  check('result count is announced', status === `${shown} ${shown === 1 ? 'piece' : 'pieces'} shown`, status);

  const total = await page.locator('.gallery__item').count();
  await page.locator('[data-filter="material"][data-value="all"]').click();
  await page.waitForTimeout(200);
  check('reset restores every piece', (await page.locator('.gallery__item:not([hidden])').count()) === total);

  /* The groups come from the markup rather than the script, so a second group
     has to work the same way, and two of them have to narrow together rather
     than one replacing the other. */
  const artist = await page.evaluate(
    () => document.querySelector('[data-filter="artist"]:not([data-value="all"])')?.dataset.value ?? null
  );

  if (artist) {
    const expectedByArtist = await page.evaluate(
      (a) => [...document.querySelectorAll('[data-artist]')].filter((i) => i.dataset.artist === a).length,
      artist
    );
    await page.locator(`[data-filter="artist"][data-value="${artist}"]`).click();
    await page.waitForTimeout(200);
    const byArtist = await page.locator('.gallery__item:not([hidden])').count();
    check(
      `filtering by artist ${artist} narrows the grid`,
      byArtist === expectedByArtist && byArtist > 0,
      `shown=${byArtist} expected=${expectedByArtist}`
    );

    /* Pick a material that artist actually uses, otherwise the combination is
       trivially empty and proves nothing. */
    const shared = await page.evaluate(
      (a) =>
        [...document.querySelectorAll('[data-artist]')]
          .filter((i) => i.dataset.artist === a)
          .flatMap((i) => (i.dataset.material || '').split(' ').filter(Boolean))[0] ?? null,
      artist
    );
    const expectedBoth = await page.evaluate(
      ([a, m]) =>
        [...document.querySelectorAll('[data-artist]')].filter(
          (i) => i.dataset.artist === a && (i.dataset.material || '').split(' ').includes(m)
        ).length,
      [artist, shared]
    );
    await page.locator(`[data-filter="material"][data-value="${shared}"]`).click();
    await page.waitForTimeout(200);
    const both = await page.locator('.gallery__item:not([hidden])').count();
    check(
      `artist ${artist} and material ${shared} narrow together`,
      both === expectedBoth && both > 0 && both <= byArtist,
      `shown=${both} expected=${expectedBoth} artistOnly=${byArtist}`
    );
  } else {
    check('artist filter chips are present', false, 'no artist chips found');
  }

  await page.close();
}

/* ------------------------------------------------- 3. contact form ------ */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.route('**/', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 200, body: 'ok' }) : route.continue()
  );
  await page.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);

  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(250);
  check('empty submit is blocked with a message', (await page.locator('[data-error-for="name"]').textContent()).trim().length > 0);
  check('focus lands on the first invalid field', (await page.evaluate(() => document.activeElement.id)) === 'name');

  await page.fill('#name', 'Wanjiku');
  await page.fill('#email', 'not-an-email');
  await page.locator('#message').click();
  await page.waitForTimeout(150);
  check('email is validated on blur', (await page.locator('[data-error-for="email"]').textContent()).trim().length > 0);

  await page.fill('#email', 'wanjiku@example.com');
  await page.selectOption('#reason', 'buyer');
  await page.fill('#message', 'I would like to ask about a piece in the gallery.');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(700);
  check('a valid submit confirms', /Thank you/.test(await page.locator('[data-form-status]').textContent()));
  check('the form resets after sending', (await page.inputValue('#name')) === '');
  await page.close();
}

/* ------------------------------------------------- 4. form fallback ----- */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } });
  await page.route('**/', (route) =>
    route.request().method() === 'POST' ? route.fulfill({ status: 404, body: '' }) : route.continue()
  );
  await page.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
  await page.fill('#name', 'Wanjiku');
  await page.fill('#email', 'wanjiku@example.com');
  await page.selectOption('#reason', 'donor');
  await page.fill('#message', 'I would like to donate material to the studio.');
  await page.locator('button[type="submit"]').click();
  await page.waitForTimeout(700);
  check('an unreachable endpoint offers the email address', /@/.test(await page.locator('[data-form-status]').textContent()));
  check('submit button is usable again', (await page.locator('button[type="submit"]').textContent()).trim() === 'Send message');
  await page.close();
}

/* ------------------------------------------------- 5. mobile nav -------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);

  check('mobile: nav starts closed', await page.locator('.nav').isHidden());
  await page.locator('[data-nav-toggle]').tap();
  await page.waitForTimeout(250);
  check('mobile: the toggle opens it', await page.locator('.nav').isVisible());
  check('mobile: aria-expanded tracks state', (await page.locator('[data-nav-toggle]').getAttribute('aria-expanded')) === 'true');
  await page.locator('.nav a[href="/artists.html"]').tap();
  await page.waitForTimeout(800);
  check('mobile: a nav link navigates', page.url().endsWith('/artists.html'));
  await ctx.close();
}

/* ------------------------------------------------- 6. reduced motion ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const requested = [];
  page.on('request', (r) => requested.push(r.url()));
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);

  const hidden = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-reveal], [data-hero-line] > span')].filter(
        (e) => parseFloat(getComputedStyle(e).opacity) < 0.9
      ).length
  );
  check('reduced motion: everything is visible at once', hidden === 0, `hidden=${hidden}`);
  check('reduced motion: the animation bundle is never fetched', !requested.some((u) => /motion-/.test(u)));
  check('reduced motion: smooth scrolling is not attached', !(await page.evaluate(() => document.documentElement.classList.contains('lenis'))));

  const rmStrip = await page.evaluate(() => {
    const el = document.querySelector('[data-strip]');
    return el ? { animated: el.classList.contains('is-animated'), overflow: getComputedStyle(el).overflowX } : null;
  });
  check(
    'reduced motion: the work strip stays hand scrollable',
    rmStrip && !rmStrip.animated && rmStrip.overflow !== 'hidden',
    JSON.stringify(rmStrip)
  );

  await page.goto(`${BASE}/programs.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(400);
  const clipped = await page.evaluate(
    () =>
      [...document.querySelectorAll('[data-reveal-img]')].filter((e) => {
        const c = getComputedStyle(e).clipPath;
        return c && c !== 'none' && !c.includes('0px 0px 0px 0px');
      }).length
  );
  check('reduced motion: no photograph is left wiped out', clipped === 0, `clipped=${clipped}`);
  await ctx.close();
}

/* ------------------------------------------- 6b. the work strip moves --- */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);

  const armed = await page.evaluate(() => {
    const el = document.querySelector('[data-strip]');
    return el ? el.classList.contains('is-animated') : null;
  });
  check('work strip is taken over by the scroll animation', armed === true, `animated=${armed}`);

  /* It must move with the scroll and not on its own: sample the offset twice
     while the page is still, then once after scrolling past it. */
  const readX = () =>
    page.evaluate(() => {
      const t = document.querySelector('[data-strip-track]');
      return t ? new DOMMatrixReadOnly(getComputedStyle(t).transform).m41 : null;
    });
  const idleA = await readX();
  await page.waitForTimeout(700);
  const idleB = await readX();
  check('work strip does not move while the page is idle', idleA === idleB, `${idleA} then ${idleB}`);

  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight * 0.5));
  await page.waitForTimeout(900);
  const afterScroll = await readX();
  check(
    'work strip moves once the page is scrolled',
    afterScroll !== null && idleB !== null && afterScroll < idleB,
    `${idleB} then ${afterScroll}`
  );

  await page.close();
}

/* ------------------------------------------------- 7. per page ---------- */
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

  await page.goto(`${BASE}/contact.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.locator('a[href="#contact-form"]').first().click();
  await page.waitForTimeout(1400);
  check('an in page anchor scrolls', (await page.evaluate(() => window.scrollY)) > 200);

  for (const path of PAGES) {
    const label = path || 'index';
    await page.goto(`${BASE}/${path}`, { waitUntil: 'domcontentloaded' });

    const headings = await page.evaluate(() => {
      const levels = [...document.querySelectorAll('h1,h2,h3,h4')].map((e) => Number(e.tagName[1]));
      let ordered = true;
      for (let i = 1; i < levels.length; i += 1) if (levels[i] - levels[i - 1] > 1) ordered = false;
      return { h1: document.querySelectorAll('h1').length, ordered };
    });
    check(`${label}: one h1 and no skipped levels`, headings.h1 === 1 && headings.ordered, JSON.stringify(headings));

    const images = await page.evaluate(() => {
      const all = [...document.querySelectorAll('img')];
      return {
        total: all.length,
        noAlt: all.filter((i) => i.getAttribute('alt') === null).length,
        eager: all.filter((i) => i.getAttribute('loading') !== 'lazy').length,
        unsized: all.filter((i) => !i.getAttribute('width') || !i.getAttribute('height')).length
      };
    });
    check(`${label}: every image has alt text`, images.noAlt === 0, JSON.stringify(images));
    check(`${label}: at most one eager image`, images.eager <= 1, `eager=${images.eager}`);
    check(`${label}: every image is sized`, images.unsized === 0, `unsized=${images.unsized}`);
  }

  await page.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
for (const r of results) {
  console.log(`${r.pass ? 'pass' : 'FAIL'}  ${r.name}${r.detail ? '  :: ' + r.detail : ''}`);
}
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);

if (failed.length) process.exit(1);
