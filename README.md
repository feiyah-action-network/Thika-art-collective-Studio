# Thika Art Collective Studio

Website for Thika Art Collective Studio, a creative community in Thika, Kenya that
turns discarded material into artwork, paid work and new skills.

Six pages: home, vision and mission, programs, artists, gallery, contact and get
involved.

## Running it

```bash
npm install
npm run dev        # local dev server
npm run build      # production build into dist/
npm run preview    # serve the built site
npm test           # build, check assets, then run the browser checks
npm run test:assets    # the static half on its own, no browser needed
npm run placeholders   # regenerate the generated placeholder images
```

Node 20 or newer.

## Stack and why

| Piece | Choice | Reason |
| --- | --- | --- |
| Build | Vite, multi page | Six real HTML files, so the site works with JavaScript off |
| Scroll | Lenis | Smooth wheel scrolling, small and unopinionated |
| Animation | GSAP with ScrollTrigger | Hero entrance, section reveals, hero parallax |
| Hover states | Plain CSS transitions | No library needed for a hover |
| Fonts | Anton and Work Sans, self hosted | No third party font request on a slow connection |
| Images | WebP at two widths, `srcset` | A phone pulls roughly a third of the bytes a desktop does |

There is no React here, so Motion was not needed. The pages are static HTML and
progressive enhancement, which is the cheapest way to stay fast on a phone and the
only way to survive JavaScript being blocked or failing to load.

### Loading behaviour

- The animation bundle is loaded with a dynamic import, and never downloaded at all
  for visitors who ask for reduced motion.
- Gallery filtering and contact form scripts load only on the pages that use them.
- If the animation bundle fails to arrive, a 2.5 second failsafe reveals everything
  rather than leaving the page blank.
- Every image is lazy loaded, carries width and height so nothing shifts, and is
  decoded off the main thread. The one hero image is eager with high priority.

Measured on the built site, throttled, 390px mobile viewport, home page:

| Connection | First contentful paint | Load | Transferred |
| --- | --- | --- | --- |
| Slow 3G | 1.48s | 6.5s | 222 kB |
| Fast 3G | 0.61s | 1.4s | 152 kB |
| 4G | 0.30s | 0.26s | 152 kB |

First paint does not wait on photographs. Before `srcset` was added the same page
pulled 594 kB and took 14s to finish loading on Slow 3G.

The gallery holds 62 pieces and is the heaviest page. On Slow 3G it still paints
in 1.4s and transfers 359 kB, because only the 7 images near the viewport are
fetched. The rest arrive as you scroll, which is why going from 48 pieces to 62
changed those numbers by nothing at all. Image quality is deliberately not
traded down any further here: on a page whose entire purpose is showing
artwork, a few kilobytes per image is the wrong saving.

## Structure

```
index.html  vision.html  programs.html  artists.html  gallery.html  contact.html
404.html        not found page, picked up automatically by Netlify
partials/       head, header and footer, inlined at build time
src/css/        tokens, layout, components
src/js/         main entry, motion, gallery filter, contact form
public/images/  studio photographs plus the remaining generated placeholders
public/fonts/   Anton and Work Sans, latin subset
source/         originals the studio supplied, kept so the crops can be rerun
tools/          photo processing and placeholder generation
tests/          asset check, browser checks, and the runner that serves dist
```

`partials/` are pulled in by a small Vite plugin in `vite.config.js` using
`<!-- include: partials/header.html -->`. The same plugin marks the current page in
the navigation with `aria-current`, so no client side code is involved.

## Design language

The palette is sampled from the material the studio works with: seed packet green,
terracotta, maize sack orange, faded metal, brass, rust, washed pink, ochre wall. One
bright accent, `--flare`, is reserved for calls to action and nothing else. Sections
are separated by a torn paper edge cut with a CSS mask, cards sit on hard offset
shadows like panels resting on a bench, and a fixed grain layer keeps surfaces from
looking printed.

Type is Anton for display and Work Sans for body text. All copy avoids em dashes.

Motion is deliberately limited to three moments: the hero entrance, one reveal per
section on scroll, and card hovers. Nothing loops and nothing moves while the page is
idle.

## Photographs

Real studio photographs are in place on the home, vision, programs and gallery
pages. They are processed by `tools/process-photos.mjs`, which holds the crop for
each image as a fraction of the frame, writes WebP at two widths, and prints the
`srcset` to paste into the markup:

```bash
node tools/process-photos.mjs /path/to/original/photos
```

The loose studio photographs this script reads are not committed, so keep them
somewhere safe: the crops are reproducible only if the sources are. The artist
catalogue below is the exception. It arrived as two files rather than a folder of
originals, it is the only record of the titles and dimensions, and it was already
in the repository history, so it is kept in `source/` where the pipeline can find
it. That costs about 14 MB on clone and buys a gallery that can be rebuilt from
scratch.

To add a photograph: put it with the originals, add an entry to `JOBS` in that
script with its crop and target width, run the script, then use the printed path,
`srcset` and intrinsic size in the markup. Keep `loading="lazy"` and
`decoding="async"` on everything except the hero image.

### The artist catalogue

Daniel Kabiaru's work came as a Word export, one page per piece: the photograph
above a printed caption giving title, medium, size and year, plus an exhibition
history and a portrait. The page exports are useless as images, because each one
is a Letter sheet with white margins and text baked in. The photographs are
embedded in the PDF as ordinary JPEG streams, though, so the pipeline pulls those
out instead and never rasterises a page:

```bash
node tools/process-catalogue.mjs           # reads source/catalogue-dan-kabiaru.pdf
```

It writes 33 works into `public/images/gallery` at two widths each, plus the
portrait, and leaves the markup data in `tools/catalogue-output.json`.

Most of the photographs are already tight on the work. The ones shot framed on a
wall carry a hand read crop down to the board itself, recorded in the script as a
fraction of the frame, so the gallery shows the work rather than the wall it was
hanging on. Those crops were read off a labelled percentage grid rendered over
each photograph. Two automatic detectors were tried first and both mis-cropped
the wall-heavy shots, which is worth knowing before anyone tries again.

Every title, medium, size and year in `WORKS` is transcribed from the caption the
studio printed under that piece, including its spelling. Nothing is inferred.

### The artist portfolio

Dennis Bull Ndegwa's work came as a Canva export: an artist statement, an
exhibition list, one or two works per page with a printed caption, and a contact
page.

```bash
node tools/process-portfolio.mjs          # reads source/portfolio-dennis-ndegwa.pdf
```

It writes 14 works into `public/images/gallery` at two widths each and leaves the
markup data in `tools/portfolio-output.json`.

Getting the captions out took three passes, which is worth recording. Canva draws
text glyph by glyph through nested form XObjects, so naive extraction returns
nothing usable. The captions are also stored as PDF bookmarks, and those came out
cleanly, but there are only 11 bookmarks for 14 works because three pages hold two
paintings and are bookmarked once. Installing poppler and running `pdftotext` per
page gave the missing three, and rendering those three pages settled which caption
belongs to which painting. Resource order is not visual order: on each of those
pages the first image in the resource dictionary is the lower one on the page, so
`WORKS` records the pairing explicitly.

No years are recorded for these, because the portfolio does not state any. Six are
marked sold, which is transcribed from the portfolio and is a snapshot of when it
was written rather than live stock.

### Still generated placeholders

`tools/make-placeholders.mjs` now produces one file,
`public/images/programs/mentorship.svg`, for the single program with no photograph
yet. It carries a "placeholder" mark in its corner and a visible "Photograph
pending" tag on the page.

The artist portraits and gallery tiles this script used to generate are gone. The
artists page uses initial tiles instead, which read as a deliberate stand in rather
than a face that is not the person's. Earlier revisions are in the git history.

## Before launch

The following are placeholders and need the studio's real details:

- Portraits, mediums and biographies for John Ruitha and Peter Ndirangu in
  `artists.html`. Nothing is written on their behalf, so each card shows an initial
  tile, a "Medium to be confirmed" line and a profile panel saying what is still
  being collected. Daniel Kabiaru and Dennis Bull Ndegwa are filled in from the
  catalogue and portfolio they supplied. George Kamiti has work images and a short
  note but no portrait or biography yet, and Dennis has no portrait, because his
  portfolio does not contain one.
- Gallery titles for the 15 pieces that came from neither supplied document. Those
  are descriptive stand ins written from the photographs, with materials read off
  the images. Kabiaru's 33 and Ndegwa's 14 carry their own titles, mediums and
  sizes. Three older sack paintings are attributed to Dennis Bull Ndegwa on the
  strength of the Bull signature they carry but still have stand in titles, so they
  are the obvious ones to name next.
- Dennis Bull Ndegwa's portfolio ends with a contact page giving a personal mobile
  number, a personal Gmail address and three social handles. None of it is
  published. The handles are his artist accounts rather than the studio's, and
  publishing a personal mobile on an indexable site is his call to make, not one to
  make for him. Ask him which of it he wants on the site.
- "Veiled figure" in the gallery is unattributed, but it is cardboard, poured paint
  and a hard band of colour, which is exactly Daniel Kabiaru's cardboard series. It
  is not in his catalogue, so it has been left unattributed. Worth asking him.
- `source/studio-group-photo.jpg` shows identifiable people and came in with the
  catalogue upload. It is kept as a source and deliberately not published anywhere
  on the site, because nobody here can confirm the people in it agreed to that.
- All body copy is a draft for the studio to approve. The three pull quotes on the
  home, programs and gallery pages are illustrative lines, not anything anyone
  actually said, so either replace them with real quotations or cut them.
- Program tags on gallery pieces. Nothing is tagged yet, so the program filter hides
  itself. Add `data-program` values to the figures and it reappears with no code
  change.
- A photograph for the mentorship program.
- Phone number and street address in `contact.html`.
- Social accounts. The placeholder Instagram, Facebook and TikTok links pointed at
  `#` and have been removed rather than left dead. Add them back to
  `partials/footer.html` and `contact.html` when there are real accounts to link.
- The mailbox `dennisndegwabull@thikaartcollective.co.ke` has to exist in Zoho.
  It is published on every page, so if it is not a real user or alias there, mail
  sent to it bounces.
- The contact page carries a visible note about the placeholder details. Remove it
  once they are real.
- The site is indexable as of the launch on 2026 08 14. If anything above is still a
  placeholder when search engines crawl, it will be cached that way, so the contact
  details are the urgent ones.

## The contact form

The form is plain HTML carrying Netlify Forms attributes, so on Netlify it works with
JavaScript switched off. With JavaScript it validates inline and submits in the
background. If the endpoint is unreachable it says so and points the visitor at the
studio email address rather than silently dropping the message.

On a host other than Netlify, point the form `action` at whatever handler you use. The
fallback path means nothing is lost in the meantime.

## Tests

```bash
npm test
```

That builds, runs the static check, serves `dist`, and then runs the browser
checks, in that order. It exits non zero on the first failure. CI runs the same
thing on every push.

`tests/check-assets.mjs` is the static half. It walks the built HTML and fails if
a page references an image, stylesheet or internal link that is not in `dist`, if
a page lost its header or footer partial or its meta description, if an include
was left unresolved, or if any copy has picked up an em dash. It needs no browser,
so it still runs when the browser half cannot.

`tests/site.mjs` is the browser half, and it covers the behaviour the markup
cannot show on its own: the site rendering completely with JavaScript disabled on
both desktop and mobile, the gallery filter pruning categories nothing is tagged
with, two filter groups narrowing together rather than replacing each other, the
contact form validating and then handling both a working and an unreachable
endpoint, the mobile navigation, reduced motion skipping the animation download
entirely, and per page heading order, alt text and image sizing.

The filter groups are read from the markup rather than named in the script, so a
new group is a markup change: a set of chips carrying `data-filter="<name>"` and a
matching `data-<name>` attribute on the pieces. That is how the artist filter was
added, and it is how the program filter will start working once pieces carry
`data-program` values.

Playwright resolves its own Chromium. If you have one somewhere else, point
`CHROMIUM_PATH` at the binary.

## Deploying

Live at https://thikaartcollective.co.ke on the FEIYAH team. Project
`thika-art-collective`, site id `1882539e-2cd7-406c-9f7f-5d13d7cc4ea5`. The
`netlify.app` subdomain still answers and every page names the custom domain as
canonical, so the two are not indexed as duplicates.

`netlify.toml` drives it: build with `npm run build`, publish `dist`, and long
cache headers on fingerprinted assets and fonts. Any static host works, the build
output is plain files.

Mail is on Zoho. DNS lives in Netlify DNS and carries the three Zoho MX records,
an SPF record, a DKIM key on the selector `art`, and a DMARC policy of `p=none`
reporting to the studio. Outbound mail is signed.

The DKIM key is 1024 bit, which is what Zoho issues by default. RFC 8301 asks for
2048, and every major receiver still accepts 1024, so this is worth upgrading at
some point but is not urgent. Rotating it means generating a new key in Zoho and
replacing the `art._domainkey` TXT record.

### Continuous deployment

The first deploy was pushed from a working copy, so the project is not yet linked to
GitHub. To link it, in the Netlify UI open the project, go to Project configuration,
Build and deploy, Link repository, and pick `feiyahactionnetwork/Thika-art-collective-Studio`.
Netlify reads the build command and publish directory from `netlify.toml`, so nothing
needs typing. Set the production branch to `main` once this work is merged, otherwise
set it to the branch you want live.

### Custom domain

Once the domain is bought, add it under Domain management in the project, then either
delegate the nameservers to Netlify or add the records the UI shows at your registrar.
Netlify issues the certificate automatically, usually within a few minutes of DNS
resolving. Two things in the repo want the final domain:

- the Open Graph image path in `partials/head.html`, which should become absolute
- a `sitemap.xml`, which needs absolute URLs and so was not worth adding before now

### Forms

Form detection is enabled on the project and the contact form is registered, so
submissions land in the Netlify UI under Forms. Nothing sends them onward yet: add a
notification under Forms, notifications, to have them emailed to the studio.

## Accessibility

- Skip link, visible focus rings, and a keyboard reachable navigation.
- One `h1` per page and no skipped heading levels.
- Artist stories use `details` and `summary`, so they open without JavaScript.
- The gallery filter bar is hidden until its script loads, and the result count is
  announced through a live region.
- `prefers-reduced-motion` disables smooth scrolling and every reveal, and skips the
  animation download entirely.
- Text on the accent orange and on the clay sections is set dark or full strength to
  keep contrast above the AA threshold.
