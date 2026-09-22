/**
 * Entry point for every page.
 *
 * Ground rules:
 * 1. The HTML is complete on its own. Everything here is an enhancement.
 * 2. Heavy libraries load only when they will actually be used, so a phone on
 *    a slow connection downloads as little as possible.
 * 3. If an enhancement fails to load, the page reveals itself and carries on.
 */
import '../css/main.css';

const root = document.documentElement;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* -------------------------------------------------------------- safety -- */
/* Reveal everything if the motion bundle never arrives. */
function releaseHiddenContent() {
  root.classList.add('motion-off');
  document.querySelectorAll('[data-reveal]').forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
  document.querySelectorAll('[data-hero-line] > span, [data-hero-fade], .hero__panel').forEach((el) => {
    el.style.opacity = '1';
    el.style.transform = 'none';
  });
  /* The wipe hides a photograph completely, so it has to come back too. */
  document.querySelectorAll('[data-reveal-img]').forEach((el) => {
    el.style.clipPath = 'none';
    el.style.transform = 'none';
  });
}

const failsafe = window.setTimeout(releaseHiddenContent, 2500);

/* ----------------------------------------------------------------- nav -- */
function initNav() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const nav = document.querySelector('[data-nav]');
  if (!toggle || !nav) return;

  const setOpen = (open) => {
    nav.dataset.open = String(open);
    toggle.setAttribute('aria-expanded', String(open));
  };

  setOpen(false);

  toggle.addEventListener('click', () => {
    setOpen(nav.dataset.open !== 'true');
  });

  nav.addEventListener('click', (event) => {
    if (event.target.closest('a') && window.innerWidth < 1024) setOpen(false);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && nav.dataset.open === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024) setOpen(false);
  });
}

/* --------------------------------------------------------------- misc  -- */
function initYear() {
  const slot = document.querySelector('[data-year]');
  if (slot) slot.textContent = String(new Date().getFullYear());
}

/* Keep only one artist story open at a time on wide screens, where the grid
   would otherwise jump around. Native details still works without this. */
function initArtistDisclosure() {
  const panels = Array.from(document.querySelectorAll('.artist__more'));
  if (panels.length === 0) return;

  panels.forEach((panel) => {
    panel.addEventListener('toggle', () => {
      if (!panel.open) return;
      window.dispatchEvent(new CustomEvent('layout:changed'));
    });
  });
}

/* ------------------------------------------------------------- startup -- */
initNav();
initYear();
initArtistDisclosure();

if (document.querySelector('[data-gallery]')) {
  import('./gallery.js')
    .then((mod) => mod.initGallery())
    .catch(() => {});
}

if (document.querySelector('[data-contact-form]')) {
  import('./form.js')
    .then((mod) => mod.initForm())
    .catch(() => {});
}

if (reducedMotion) {
  window.clearTimeout(failsafe);
  releaseHiddenContent();
} else {
  import('./motion.js')
    .then((mod) => {
      window.clearTimeout(failsafe);
      mod.initMotion();
    })
    .catch(() => {
      window.clearTimeout(failsafe);
      releaseHiddenContent();
    });
}
