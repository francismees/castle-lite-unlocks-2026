# Castle Lite Unlocks 2026 — consumer microsite

One-page, mobile-first, Swahili-first microsite for the Castle Lite Unlocks 2026 UTC
prize promotion. Built to `docs/Castle Lite Unlocks 2026 Microsite Spec.md` (v1.2).

Promoter: Tanzania Breweries PLC · UTC technology partner: Bluetrain Consultancy
Limited · Promotional Lottery Licence PML000004605 (Gaming Board of Tanzania).

## Run it

```bash
npm install && npm run dev
```

`npm run build` typechecks then builds to `dist/`. `npm run preview` serves the build.

## Where things live

| Path | What it is |
|---|---|
| `src/config/campaign.ts` | **Every** campaign value — dates, prizes, licence no., events, code grammar. Nothing here is hard-coded in a component. |
| `src/config/artists.ts` | Headline-artist carousel slides — name, supporting line, photo, focal points, logo variant. |
| `src/components/ArtistCarousel.tsx` | The carousel. One slide component, driven entirely by `artists.ts`. |
| `src/components/Tickets.tsx` | Tickets band under the hero, counting down to `campaign.ticketsOnSaleAt` on server time. |
| `src/components/EventsMap.tsx` | Mega Events: Tanzania map with city pins and the lineup panel. Data in `campaign.events`. |
| `src/components/PrizeMarquee.tsx` | What You Can Unlock: the drifting band of cash and Extra Cold prize cards. |
| `src/config/terms.ts` | T&C clause array. Empty today, so the accordion renders the marked placeholder. |
| `src/i18n/strings.ts` | All consumer copy, EN/SW, verbatim from the spec. |
| `src/lib/validation.ts` | Code + MSISDN normalisation and the E1–E5 error ladder. |
| `src/services/submission.ts` | Submission service. **The integration point is here.** |
| `api/submissions.ts` | Vercel serverless proxy — holds the platform key, re-validates everything. |
| `middleware.ts` | Edge per-IP throttle. |
| `scripts/build-assets.py` | Regenerates everything in `public/` (fonts, brand, artists, events, prizes) from `00 - Assets`. |

## Going live

1. **Wire the platform.** Set `USE_MOCK = false` in `src/services/submission.ts`, then
   set `PLATFORM_API_URL` and `PLATFORM_API_KEY` in Vercel env vars (see `.env.example`).
   The browser never talks to the platform directly — it posts to `/api/submissions`,
   which proxies. Nothing prefixed `VITE_` may ever hold the key: that gets inlined
   into the client bundle.
2. **Confirm the T&Cs.** The signed PDF supplied on 14 Sep 2026 is on the page verbatim
   (`src/config/terms.ts`), except that clause 9's em dash is a semicolon (the site uses
   no em dashes). It is the version the spec calls superseded — Grand Draw,
   airtime instant prizes, SMS-only entry — and contradicts the on-page prizes. The
   campaign dates now follow it (10 Aug – 31 Dec 2026); confirm they match the licence. Swap in the reissued clauses, verbatim, when legal has
   them.
3. **Harden the rate limits.** The throttles in `api/submissions.ts` and `middleware.ts`
   are in-memory, so they only catch bursts hitting the same warm instance. Back them
   with Vercel KV / Upstash and wire the CAPTCHA escalation before launch — the spec
   treats abuse controls as launch-blocking (§2.4).
4. **Fill the content placeholders.** Search for `CONTENT-PENDING`.

## Testing the result states

The mock service is deterministic — the code's **final character** selects the
response, so every state is reachable on demand:

| suffix | state | | suffix | state |
|---|---|---|---|---|
| `…W` | instant win (S2) | | `…R` | rate limited (E9) |
| `…X` | not found (E7) | | `…L` | account locked (E10) |
| `…U` | already used (E8) | | `…S` | system error (E12) |

Anything else returns *entered* (S1). Try `CD7KQ4M` and `CD7KQ4W`. Campaign-closed
(E11) triggers off `campaignEnd` in config.

## Design system

Official Castle Lite palette only — Jolt Blue `#1335d8`, Impact Blue `#010923`,
Play Green `#06804a`, Impact Green `#065630`, Dynamic Red `#e81c26`, Premium Silver
`#eceff0`, Premium Grey `#58595b`, Crisp White. Typeface is Ciutadella, self-hosted.

### The form card is frosted glass on snow

The code-entry section sits on the white snow plate, and the form card is colourless
frosted glass: 50% white, a 28px backdrop blur and a fine SVG grain, with a Jolt Blue top
edge. On a light card every colour inside is re-themed (see `.entry .card-form` in
`styles.css`), measured against the darkest washed plate pixel with no blur behind:
Impact Blue text 15.1:1, Premium Grey hints 5.4:1, `--error-text` 4.8:1, Jolt Blue links
6.4:1, and the Play Green CTA fill 3.8:1 against the card (white on it 5.0:1). Play Green
fails as link text there, which is why the T&C link is Jolt Blue.

Nothing animates the card or its ancestors on scroll: opacity on an ancestor of a
`backdrop-filter` element cuts the blur off mid-animation.

The prize cards in What You Can Unlock are glass *without* backdrop blur — see that
section below for why.

### Other measured values

These are **measured, not aesthetic**, all commented in place, and all will break AA
if adjusted casually:

- The hero scrim (`0.55 → 0.78` over the ice-castle plate) puts white body copy at
  5.5:1. Lightening it to show more of the image drops `--ice` to 3.2:1.
- Hero body copy is white rather than `--ice` for that same reason. `--ice-dim` is
  fine on the footer's solid Impact Blue (7.7:1) but fails over any image plate.
- The white-ice plate behind the light bands carries a `0.38 → 0.56` white wash.
  Unwashed, the plate's dark blue ice chunks put even Impact Blue text at 2.01:1, so
  some wash is mandatory; at this strength the snow reads and Impact Blue is ~7.8:1.
  Premium Grey is only 2.6:1 there, which is why `.section--ice .section__lede`
  overrides it to Impact Blue. Copy inside the opaque white cards is unaffected.

Both photographic plates ship as a three-step ladder — a portrait crop for phones, a
landscape plate for tablets, and a 1600px plate only above 1100px. The portrait crops
exist because these sections run 1600–2500px tall on a phone, where `cover` on a 16:9
plate crops down to flat empty sky.

## Assets

`00 - Assets/` is the raw brand pack and is **not** shipped — or committed: it is
git-ignored (141 MB, including unreleased artist photography). Get it from the project
drive to run `scripts/build-assets.py`; the generated `public/` assets are in the repo,
so the site builds from a fresh clone without it.
`scripts/build-assets.py` turns it into `public/`: fonts subset to Latin and converted
to WOFF2 (604 KB → 53 KB across four weights), plates resized to WebP at the widths
the CSS actually requests. Mobile initial load is ~480 KB against the spec's 1.5 MB
budget, ~310 KB over the wire once text assets gzip.

`snowcastle-blue.svg` and `castle-lite-lockup-on-white.svg` are the light-ground
counterparts. Nothing references them yet; they are there for any section that flips
to a light background. `castle-lite-banner.svg` is derived, not supplied: the lockup's
own vector paths with the snowcastle group removed, for the artist artwork.

## Headline-artist carousel

Leads the hero, beside the "Castle Lite Unlocks is back! Mwanza 3rd October!"
headline. It replaced the Artist Reveal countdown card. The art direction comes from `00 - Assets/Plate Style.png`; nothing is baked into the
photography. Photo, scrim, snowcastle, both logos and the copy are live layers inside
one slide element, so they always move together.

- **Content.** Add, remove or reorder artists in `src/config/artists.ts`. New photos go
  in `00 - Assets` and the `ARTISTS` list in `scripts/build-assets.py`, then run
  `python3 scripts/build-assets.py artists` (AVIF + WebP at 480/768/1024/1440).
- **Overlay geometry** is measured off the plate as fractions of the artwork width and
  written against `--w` (container width) in `styles.css`, so it scales as one piece.
  Type and logos are fluid: plate-exact at the 540px desktop tile, proportionally
  larger on phones. Square tile from 720px up; 4:5 portrait on phones.
- **Logo variant** is per slide, chosen by measurement: Jolt Blue on Harmonize and
  Scotts Maphuma (~7:1 on their light corners), white on Darassa (6.5–11:1).
- **Legibility.** The plate is a template on black; on these photos the copy lands on
  white tailoring, so an Impact Blue scrim rises from the bottom. White copy is 9–18:1
  on it and ≥3.5:1 where it crosses the 36% snowcastle watermark (large-text AA is 3:1).
- **Motion.** Holds 2s, slides for 0.78s, loops. Swipe or drag on touch and mouse,
  horizontal trackpad swipes, arrow keys, pause button. Pauses while dragging, while
  keyboard focus is inside, while off screen and while the tab is hidden; waits 3.5s
  after manual input. `prefers-reduced-motion` fades through instead of sliding.
- **Loading.** The first artwork loads at high priority (it is above the fold); the
  neighbours follow as soon as the carousel is within 400px of the viewport, which in
  the hero is immediately. Autoplay never advances onto an image that hasn't decoded.
  About 93 KB for all three on a 2x phone.
- **Font.** Ciutadella Bold, declared a second time as `Ciutadella Artwork` with pinned
  vertical metrics so the name bar lands at the same height on macOS and Windows. Same
  file, no extra download.

## Mega Events map

A full-width dark band headed "Extra Cold Refreshment Is Coming!". The map is
`00 - Assets/PNG/TZ MAP.png`, cropped and served as AVIF/WebP with transparency. City
pins are placed from real coordinates (`coords` on each event): the artwork turned out to
be equirectangular at 136.5 × 137.0 px per degree, so a two-line calibration in
`EventsMap.tsx` places any city.

The lineup is a bento of 3D cards (Date, Venue, Headline Artists, DJs, Hosts). Each tumbles
over on hover — tap on touch screens — to a Jolt Blue back that repeats the card, so no
information hides behind the interaction; the back face is `aria-hidden`. The Headline
Artists back carries one coin that spins edge-on between the three headliners' faces,
1s each (faces are cropped from the carousel photos via `face` in `artists.ts`).

The panel rests on the city with a confirmed `lineup` (Mwanza). Hovering, tapping or
tabbing to Dar es Salaam or Arusha previews them — the snowcastle loading state until a
lineup is added to their event in `campaign.ts` — and leaving returns to Mwanza.

## What You Can Unlock band

The last part of How It Works: a full-bleed Blue Jolt plate with all six prizes (two
cash, four Extra Cold) on identical glass cards, drifting right to left in an endless
loop driven by one rAF loop (the set is rendered twice; the copy is `aria-hidden` but
deliberately not `inert`, which would stop its cards flipping). Cards flip to a Jolt
Blue back on hover, like the lineup cards. Hover or keyboard focus stops the drift;
‹ pause › controls under the row step one card at a time and pause it for touch screens. Glass tint is 60% Impact Blue — measured, see the comment in `styles.css`.
The cards deliberately have no `backdrop-filter`: blur on a card that scales inside an
animated, masked track rendered as a hard square with the content missing. Reduced
motion turns the band into a still, swipeable row.

## Find Us On the Ground

`00 - Assets/Hostesses 2.png` (trimmed to its alpha bounds, AVIF/WebP) stands on the
section's bottom edge. Desktop: to the right of the copy, one section-height plus 30px
tall, so the centre ambassador's head rises 30px into the prize band above; below
~1200px the column is too narrow for that height and the image scales down beside the
copy instead of covering it. Phones: full width under the region chips. Between the
copy and the chips, a Jolt Blue "Call for more information" line dials
`campaign.infoPhone` (currently the placeholder +255 123 456 789). The overlap
needs the section unclipped on desktop, so its background doesn't parallax there.

## Tickets band

Directly under the hero: "Tickets available soon", the on-sale date, and a days / hours /
minutes / seconds countdown to `campaign.ticketsOnSaleAt` (Friday 18 September 2026,
00:00 EAT assumed — confirm the time). It reads the server-corrected clock, like the
campaign-closed state. At zero the heading switches to "Tickets available now"; there is
no ticket link yet.

## Motion and hover

Parallax and scroll reveals are CSS scroll-driven animations (`animation-timeline`),
so they run on the compositor with no JavaScript; browsers without support (Firefox
today) show the page still, and none of it runs with `prefers-reduced-motion`. Section
backgrounds live on a `::before` layer 28% taller than the section (`--plate`), which
drifts slower than the page. Hover effects move things with the individual `translate`
/ `scale` properties so they compose with those `transform` animations, and anything
that moves on hover is limited to `(hover: hover) and (pointer: fine)`. A reading-progress
bar runs under the brand bar.

## Swahili

Swahili is the default locale, and every string in `src/i18n/strings.ts` has real Swahili —
nothing falls back to English except the brand name and the phone placeholder. The Sep
2026 review kept terminology consistent (kodi, kizibo, droo, mobile money, zawadi),
kept brand names in English (Castle Lite, Unlocks, Extra Cold), and fixed literal
renderings — e.g. "Unlock the Experience" was *Fungua Uzoefu* (uzoefu is expertise),
now *Fungua Tajriba ya Baridiii* (supplied in review). The carousel artwork line ("Live in Mwanza") stays in English in
both locales. The Terms & Conditions and licence lines stay in
English: the signed document is authoritative in English. All Swahili still needs
native-speaker / TBL sign-off.

## Known deviations from the spec

- **The form is no longer in the hero.** Spec §4 puts the form beside the H1, above
  the fold. Following review, the hero now carries the artist carousel and the
  "is back!" headline, and code entry is the section directly below it. The skip link
  still jumps straight to the form.
- **The weekly-draw schedule line is gone from the page.** "Draws every Monday for the
  preceding week, supervised by the Gaming Board of Tanzania" was removed in review. The
  draw schedule should still be stated in the T&Cs.
- **The entry intro promises tickets and "extra cold prizes".** Following review it
  reads "…stand a chance to win instant cash, EXTRA COLD PRIZES and tickets to the
  COLDEST STAGE in TANZANIA!". That contradicts decision D2 (all prizes are cash) and
  D5 (no ticket prizes), and the licensed T&Cs. Needs legal sign-off before launch.
- **Feature cards link to "How it works", not "How to win tickets".** Spec §2's design
  note describes a "How to win tickets" link — same D5 contradiction.
- **The SMS line renders below the form card**, not above it. On a 375 px phone every
  pixel above the card pushes the code input towards the fold, and the shortcode is a
  fallback for people the form did not convert.
