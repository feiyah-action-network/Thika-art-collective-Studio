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

Measured on the built site, Slow 3G, 390px mobile viewport:

| Page | First contentful paint | Load | Transferred |
| --- | --- | --- | --- |
| Home | 1.56s | 8.8s | 316 kB |
| Vision | 1.45s | 5.4s | 156 kB |
| Gallery | 1.48s | 9.4s | 359 kB |

First paint does not wait on photographs anywhere. Before `srcset` was added the
home page pulled 594 kB and took 14s to finish loading.

The home and vision pages carry a scrolling strip of work, which costs the home
page about 56 kB and a second and a half. That is the strip's whole budget
because its tiles are square 150px and 300px thumbnails cut for the purpose. The
first attempt pointed them at the gallery images instead, which are up to 500px
on the long edge and not square, so the browser downloaded pixels CSS then
cropped away: 644 kB and 15s on the home page, more than double. If you add
tiles, regenerate the thumbnails rather than reusing gallery files.

The table above predates John Ruitha Maina's six works. Adding them was measured
as a before and after pair on one harness, which is the only way to compare: the
home page did not move at all, the vision page went up about 8 kB and the gallery
about 6 kB. Two of the home strip's tiles were swapped for his rather than simply
appended, and the two they displaced moved to the end of the row, so the strip
grew by two tiles on each page rather than by four.

The gallery holds 68 pieces and is still the heaviest page, but only the 7 images
near the viewport are fetched. The rest arrive as you scroll, which is why going
from 48 pieces to 62, and then to 68, barely moved those numbers. Image quality is deliberately not
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

Motion is deliberately limited: the hero entrance, one reveal per section on
scroll, a wipe on feature photographs, card hovers, a slow parallax on the hero
collage, and a band of work that drifts sideways as you scroll.

Nothing loops, and nothing moves while the page is idle. That rule is why the
work strip is tied to scroll position rather than running on a timer, and there
is a test that samples its offset twice while the page is still to prove it.

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

### The compiled images

John Ruitha Maina's work came as a compilation with nothing in it but pictures:
eight pages, one embedded JPEG each, no captions, no bookmarks and no extractable
text at all.

```bash
node tools/process-ruitha.mjs             # reads source/works-john-ruitha.pdf
```

It writes six works into `public/images/gallery` at two widths each, resizes the
portrait he sent into `public/images/artists`, and leaves the markup data in
`tools/ruitha-output.json`.

Six, not eight, because two of the pages are not artworks and are deliberately not
published. Page 1 is a photograph of his stand at a fair with visitors whose faces
are legible, which is the same consent problem as `source/studio-group-photo.jpg`.
Page 2 is a composite of a black and white photograph of someone painting and a
colour detail of the work in progress. It is very likely him, but the face is
turned away and nothing in the file says so, so it is not captioned as a portrait
of anyone.

Because there was no text to transcribe, every title and every support named under
these six is read off the photograph, and the gallery note says so in as many
words. Four of them are signed "Ruitha 25" in the lower right. That is almost
certainly 2025, but a year read off a brushstroke is not a year the artist stated,
so none is printed. His biography, which he supplied separately, states no
exhibition dates or venues, so his profile carries no exhibition list where Daniel
Kabiaru's and Dennis Bull Ndegwa's do.

The portrait is taller than it is wide with the head in the upper half, so it is
cropped square from the top rather than the centre, which would take off the
forehead.

### The work strips

The home and vision pages each carry a band of work that drifts sideways with the
scroll. The tiles are square thumbnails cut for the purpose rather than gallery
files:

```bash
node tools/make-strip-thumbs.mjs      # writes public/images/strip
```

The slug lists live in that script and have to stay in step with the two
`[data-strip]` sections. The two sets do not overlap, so moving from the home page
to the vision page shows different work.

It degrades in the right direction. The markup is a plain list in a horizontally
scrollable element, so no JavaScript, a failed bundle and reduced motion all leave
a row the visitor can push through by hand. Only once the scroll animation is
actually wired up does the script add `is-animated`, which is what takes the
scrollbar away.

### Still generated placeholders

`tools/make-placeholders.mjs` now produces one file,
`public/images/programs/mentorship.svg`, for the single program with no photograph
yet. It carries a "placeholder" mark in its corner and a visible "Photograph
pending" tag on the page.

The artist portraits and gallery tiles this script used to generate are gone. The
artists page uses an initial tile instead, which reads as a deliberate stand in
rather than a face that is not the person's. One card still carries one, Peter
Ndirangu's. Earlier revisions are in the git history.

## Before launch

The following are placeholders and need the studio's real details:

- A portrait, a medium and a biography for Peter Ndirangu in `artists.html`.
  Nothing is written on his behalf, so his card shows an initial tile, a "Medium to
  be confirmed" line and a profile panel saying what is still being collected.
  Daniel Kabiaru, Dennis Bull Ndegwa and John Ruitha Maina are filled in from the
  documents they supplied. George Kamiti has work images and a short note but no
  portrait or biography yet, and Dennis has no portrait, because his portfolio does
  not contain one.
- Gallery titles for the 21 pieces that came from no supplied caption. Those are
  descriptive stand ins written from the photographs, with materials read off the
  images. Kabiaru's 33 and Ndegwa's 14 carry their own titles, mediums and sizes.
  John Ruitha Maina's 6 do not, because the file he sent has no text in it at all,
  so naming those is a short conversation with an artist who is already reachable.
  Three older sack paintings are attributed to Dennis Bull Ndegwa on the strength
  of the Bull signature they carry but still have stand in titles, so they are the
  other obvious ones to name next.
- Dennis Bull Ndegwa's portfolio ends with a contact page giving a personal mobile
  number, a personal Gmail address and three social handles. None of it is
  published. The handles are his artist accounts rather than the studio's, and
  publishing a personal mobile on an indexable site is his call to make, not one to
  make for him. Ask him which of it he wants on the site.
- John Ruitha Maina's biography ends with a personal Gmail address, a personal
  mobile number, an Instagram handle and a LinkedIn name. None of it is published.
  That is the same call that was made for Dennis, whose details only went up once
  he asked for them to, so ask John which of his he wants on the site.
- Pages 1 and 2 of `source/works-john-ruitha.pdf` are not published. Page 1 shows
  visitors at a fair whose faces are legible, and page 2 is probably him at the
  easel but does not say so. Both would be worth having if he confirms them: an
  installation shot and a working portrait are the two pictures the site is most
  short of.
- "Veiled figure" in the gallery is unattributed, but it is cardboard, poured paint
  and a hard band of colour, which is exactly Daniel Kabiaru's cardboard series. It
  is not in his catalogue, so it has been left unattributed. Worth asking him.
- `source/studio-group-photo.jpg` shows identifiable people and came in with the
  catalogue upload. It is kept as a source and deliberately not published anywhere
  on the site, because nobody here can confirm the people in it agreed to that.
- All body copy is a draft for the studio to approve. It is written from the brief,
  not quoted from anyone. The four display pull quotes that used to sit on the home,
  programs, gallery and artists pages have been cut: they were lines nobody actually
  said, set in large type where they read as the studio's voice. The sections they
  sat beside are now single column. If the studio wants real quotations there, the
  layout takes them back easily, and the removed styling is in the git history.
- A photograph of a Saturday children's class. The class programme currently shows
  the studio bench with a visible note saying it is not a class photograph.
- Whether the studio runs anything like mentoring or paid teaching. An invented
  "Skills Development and Mentorship" programme was removed because nothing
  confirmed it. If it is real, it is a sixth programme waiting to be written.
- Confirmation of how sale proceeds are split. An earlier draft claimed the larger
  share goes to the maker. Nobody verified that, so it is gone from the programmes
  page, though it does still appear on the contact page under "Buyers and
  collectors" and should be checked or cut.
- A street address in `contact.html`. The page gives Thika, Kiambu County and the
  Saturday open studio, but no street or building.
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

Both published addresses are live and have been delivered to:
`hello@thikaartcollective.co.ke` and `dennisndegwabull@thikaartcollective.co.ke`.

The phone number and the three social accounts in the footer and on the contact
page are Dennis Bull Ndegwa's, taken from his portfolio and published at his
request. The contact page says whose they are, so the site does not imply the
studio holds accounts of its own.

The DKIM key is 1024 bit, which is what Zoho issues by default. RFC 8301 asks for
2048, and every major receiver still accepts 1024, so this is worth upgrading at
some point but is not urgent. Rotating it means generating a new key in Zoho and
replacing the `art._domainkey` TXT record.

### Continuous deployment

Pushing to `main` builds and deploys. The project is linked to
`feiyah-action-network/Thika-art-collective-Studio`, production branch `main`, and
Netlify reads the build command and publish directory from `netlify.toml`.

#### If deploys stop again

They did once, between 17 and 22 September 2026, and the cause is worth recording
because nothing looked broken.

**The repository was transferred from a personal account into the organisation.**
GitHub redirects the old URL forever after a transfer, so `git push` kept working and
gave no hint anything had changed. GitHub App installations do not follow a transfer,
though, so Netlify's app stayed behind on the personal account and simply stopped
receiving webhooks. The Claude GitHub App lost access the same day for the same
reason. One event, two symptoms, and no wrong setting to find.

The repair was to install the Netlify GitHub App on the organisation
(`https://github.com/apps/netlify`, Configure, pick the org, grant this repository)
and then unlink and relink the repository under Project configuration, Build and
deploy. Relinking is required rather than optional: the stored link still pointed at
the old owner. Both are UI actions in accounts a coding session holds no credentials
for.

Whatever the cause next time, diagnose it the same way: push a commit and watch the
project's **current deploy id**, not the page. A README only commit changes no page
content, so waiting for the site to look different proves nothing.

While a link is broken, every content change needs a manual deploy after the push or
the live site silently lags behind `main`:

```bash
npm test                 # do not skip, nothing else gates the deploy
npx -y @netlify/mcp@latest --site-id <site-id> --proxy-path "<proxy url>"
```

#### The remote in a fresh clone

`origin` may still read `feiyahactionnetwork/...`, the pre transfer owner. That keeps
working on GitHub's redirect, but the canonical path is
`feiyah-action-network/Thika-art-collective-Studio` and is what a new clone should
use.

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
