/**
 * Smooth scrolling and scroll driven reveals.
 * Loaded on demand, and never loaded at all when the visitor asks for
 * reduced motion.
 *
 * Motion budget: hero entrance, one reveal per section, a wipe on feature
 * photographs, a slow parallax on the hero collage, and a band of work that
 * drifts sideways with the scroll. Nothing loops, and nothing moves while the
 * page is idle: every one of these is either a one shot or tied to scroll
 * position.
 */
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

function initSmoothScroll() {
  const lenis = new Lenis({
    duration: 1.05,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    touchMultiplier: 1.6
  });

  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  /* In page anchors should follow the same easing as the wheel. */
  document.addEventListener('click', (event) => {
    const link = event.target.closest('a[href^="#"]');
    if (!link) return;
    const id = link.getAttribute('href');
    if (!id || id === '#') return;
    const target = document.querySelector(id);
    if (!target) return;
    event.preventDefault();
    lenis.scrollTo(target, { offset: -90 });
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
  });

  return lenis;
}

function initHero() {
  const hero = document.querySelector('[data-hero]');
  if (!hero) return;

  const lines = hero.querySelectorAll('[data-hero-line] > span');
  const fades = hero.querySelectorAll('[data-hero-fade]');
  const panels = hero.querySelectorAll('.hero__panel');

  const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });

  if (lines.length) {
    /* The CSS start state is translateY(105%). GSAP reads that as a pixel
       offset, so both y and yPercent are declared here to keep the two
       transform components from stacking. */
    tl.fromTo(lines, { yPercent: 105, y: 0 }, { yPercent: 0, y: 0, duration: 0.9, stagger: 0.09 });
  }

  if (panels.length) {
    tl.fromTo(
      panels,
      { opacity: 0, scale: 0.94, rotation: (i) => (i === 0 ? -8 : 8) },
      { opacity: 1, scale: 1, rotation: (i) => (i === 0 ? -3 : 2.5), duration: 1, stagger: 0.12 },
      '-=0.55'
    );
  }

  if (fades.length) {
    tl.fromTo(fades, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.08 }, '-=0.7');
  }
}

function initReveals() {
  const items = gsap.utils.toArray('[data-reveal]');
  if (items.length === 0) return;

  ScrollTrigger.batch(items, {
    start: 'top 88%',
    once: true,
    onEnter: (batch) => {
      gsap.to(batch, {
        opacity: 1,
        y: 0,
        duration: 0.75,
        ease: 'power2.out',
        stagger: 0.09,
        overwrite: true,
        onStart: () => batch.forEach((el) => el.classList.add('is-revealed'))
      });
    }
  });

  /* Anything already in view when the page loads should not wait for a scroll. */
  ScrollTrigger.refresh();
}

function initParallax() {
  if (window.matchMedia('(max-width: 47.99em)').matches) return;

  gsap.utils.toArray('[data-parallax]').forEach((el) => {
    const strength = Number(el.dataset.parallax) || 40;
    gsap.to(el, {
      y: strength,
      ease: 'none',
      scrollTrigger: {
        trigger: el.closest('section') || el,
        start: 'top bottom',
        end: 'bottom top',
        scrub: true
      }
    });
  });
}

/* Feature photographs wipe up from nothing rather than fading in. The start
   state lives in CSS behind .js, so a visitor without this bundle sees the
   photograph normally. */
function initImageReveals() {
  gsap.utils.toArray('[data-reveal-img]').forEach((el) => {
    gsap.fromTo(
      el,
      { clipPath: 'inset(0% 0% 100% 0%)', scale: 1.06 },
      {
        clipPath: 'inset(0% 0% 0% 0%)',
        scale: 1,
        duration: 1,
        ease: 'power3.out',
        scrollTrigger: { trigger: el, start: 'top 86%', once: true },
        onStart: () => el.classList.add('is-revealed')
      }
    );
  });
}

/* The work strip moves with the scroll, never on its own. The class is added
   only once the animation is actually set up, because the CSS keeps the row
   hand scrollable until then. */
function initWorkStrips() {
  gsap.utils.toArray('[data-strip]').forEach((strip) => {
    const track = strip.querySelector('[data-strip-track]');
    if (!track) return;

    const setup = () => {
      const distance = track.scrollWidth - strip.clientWidth;
      if (distance <= 0) return;

      strip.classList.add('is-animated');
      gsap.fromTo(
        track,
        { x: 0 },
        {
          x: -distance,
          ease: 'none',
          scrollTrigger: {
            trigger: strip,
            start: 'top bottom',
            end: 'bottom top',
            scrub: 0.6,
            invalidateOnRefresh: true
          }
        }
      );
    };

    /* The track is built from lazy images, so its width is not final until
       they have arrived. */
    if (document.readyState === 'complete') setup();
    else window.addEventListener('load', setup, { once: true });
  });
}

export function initMotion() {
  initSmoothScroll();
  initHero();
  initReveals();
  initImageReveals();
  initWorkStrips();
  initParallax();

  /* Lazy images and filtered grids change the page height. Batch the
     recalculations so a gallery full of images cannot thrash layout. */
  let pending = 0;
  const refreshSoon = () => {
    window.clearTimeout(pending);
    pending = window.setTimeout(() => ScrollTrigger.refresh(), 180);
  };

  window.addEventListener('load', refreshSoon);
  window.addEventListener('layout:changed', refreshSoon);
  document.addEventListener(
    'load',
    (event) => {
      if (event.target.tagName === 'IMG') refreshSoon();
    },
    true
  );
}
