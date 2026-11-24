/**
 * Cold entry: where the hero plate's ice castle sits on screen.
 *
 * The passage ends by landing the 3D Snowcastle on the castle photographed into the hero
 * plate, then fading the canvas away over the real hero. This file is the landing target.
 * Nothing imports it yet (Phase 0 of the cold-entry brief); it is data only and does not
 * reach the bundle until the passage does.
 *
 * MEASUREMENT, in two steps. Measured 15 Sep 2026 against main at 1deacdb.
 *
 * 1. Castle inside each plate image. The Snowcastle mark (brand/snowcastle-white.svg,
 *    byte-identical to the brand pack's WHITE_snowcastle.svg) was rasterised and
 *    template-matched against an ice mask of the plate (red channel, since the ground is
 *    saturated blue and the ice is pale), searching scale and centre: coarse at 1/4
 *    resolution, then refined at full resolution in 1px steps. Score is mean ice inside
 *    the silhouette minus mean ice in the rest of its box, so the loose shards around the
 *    arms count against a fit that is too large. Checked by eye with the silhouette
 *    overlaid on each plate: spoke tips, towers, gate and arm ends all sit on the ice.
 *    The box is the SVG viewBox fitted to the castle's front face. The photographed
 *    extrusion walls show as a pale rim below and right of each stroke and are outside
 *    it on purpose: the 3D mesh's front face is what has to land here.
 *
 * 2. Castle on screen. The plate is the background of .hero::before, which is inset
 *    -14% top and bottom (28% taller than the hero, for the parallax), sized `cover`,
 *    positioned by --plate-pos, and drifted by the scroll-driven plate-drift animation.
 *    For a live hero rect H at scroll 0:
 *
 *      layerTop = H.top - 0.14 * H.height        layerH = 1.28 * H.height
 *      s        = max(H.width / plate.w, layerH / plate.h)
 *      offX     = (H.width - plate.w * s) * posX  offY  = (layerH - plate.h * s) * posY
 *      ty       = translateY of getComputedStyle(hero, '::before').transform
 *      box      = { x: H.left + offX + castle.x * s,
 *                   y: layerTop + ty + offY + castle.y * s,
 *                   w: castle.w * s, h: castle.h * s }
 *
 *    Every row in VIEWPORT_REFERENCE was computed that way from the live page, then the
 *    375, 768 and 1440 rows were confirmed by drawing the silhouette as a fixed overlay
 *    at the computed box over the running site.
 *
 * WHY THE TABLE IS A REFERENCE AND NOT THE TARGET. The castle's screen box is not a
 * constant per breakpoint. On phones the hero's height follows its content (the 4:5
 * carousel tile scales with width), and `cover` there is height-driven, so the castle's
 * size and position shift with every phone width. From 960px the hero is locked at
 * 716px and the castle holds 597 x 553 px, but its x still follows the viewport. The
 * final camera pose should target the box computed from the live hero at the mask point,
 * when the site is already mounted underneath; these rows are what that computation must
 * reproduce at the reference sizes.
 *
 * Fractions are of innerWidth x innerHeight. With a classic scrollbar the hero is
 * narrower than innerWidth (1265 vs 1280 at the 1280 row), so a runtime version should
 * work from the hero rect, not from these fractions.
 *
 * Firefox has no animation-timeline, so ty is 0 there: use the noDrift y.
 */

export type PlateKey = 'mobile' | 'p1000' | 'p1600'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface Plate {
  src: string
  /** Intrinsic size of the WebP. */
  w: number
  h: number
  /** Viewport widths that load this plate, from the .hero media queries in styles.css. */
  minWidth: number
  maxWidth: number | null
  /** background-position as fractions, from --plate-pos. */
  posX: number
  posY: number
  /** Castle front face, in plate pixels. */
  castle: Box
}

// The three hero plates. castle.h is castle.w * 697.59 / 753.6, the mark's own aspect,
// because the fit scales the silhouette uniformly.
export const PLATES: Record<PlateKey, Plate> = {
  // < 720px. `center top`: the crop is anchored to the top of the layer, so on a phone
  // the castle sits lower than centre and the bottom of the plate is what gets cut.
  mobile: {
    src: '/brand/hero-castle-mobile.webp',
    w: 760,
    h: 1000,
    minWidth: 0,
    maxWidth: 719,
    posX: 0.5,
    posY: 0,
    castle: { x: 59, y: 253.2, w: 652, h: 603.5 },
  },
  // 720 to 1099px. `center`.
  p1000: {
    src: '/brand/hero-castle-1000.webp',
    w: 1000,
    h: 483,
    minWidth: 720,
    maxWidth: 1099,
    posX: 0.5,
    posY: 0.5,
    castle: { x: 344.5, y: 122.2, w: 315, h: 291.6 },
  },
  // >= 1100px. `center`.
  p1600: {
    src: '/brand/hero-castle-1600.webp',
    w: 1600,
    h: 773,
    minWidth: 1100,
    maxWidth: null,
    posX: 0.5,
    posY: 0.5,
    castle: { x: 552, y: 194.7, w: 504, h: 466.5 },
  },
}

interface ViewportRow {
  vw: number
  vh: number
  plate: PlateKey
  /** Hero rect at scroll 0. top is the sticky brand bar's 76px plus its 1px rule. */
  heroTop: number
  heroH: number
  /** plate-drift translateY at scroll 0, in px. */
  ty: number
  /** Castle box on screen, px, drift applied. */
  px: Box
  /** Same box as fractions of the viewport, drift applied. */
  frac: Box
  /** y fraction with ty removed (Firefox, or any browser without animation-timeline). */
  noDriftY: number
}

// Measured on the running dev build, scroll 0, gate cookie set, motion allowed.
export const VIEWPORT_REFERENCE: ViewportRow[] = [
  // Phones. The castle is wider than the screen (1.8x at 375) and bleeds off both edges.
  {
    vw: 375, vh: 812, plate: 'mobile', heroTop: 77, heroH: 813.1, ty: -8.94,
    px: { x: -146.6, y: 217.7, w: 678.5, h: 628.1 },
    frac: { x: -0.3909, y: 0.2682, w: 1.8095, h: 0.7735 },
    noDriftY: 0.2792,
  },
  {
    vw: 390, vh: 844, plate: 'mobile', heroTop: 77, heroH: 831.8, ty: -8.11,
    px: { x: -146.8, y: 222, w: 694.2, h: 642.6 },
    frac: { x: -0.3763, y: 0.2631, w: 1.78, h: 0.7613 },
    noDriftY: 0.2727,
  },
  // Tablet. The hero is only 484px tall here, so the castle fills the hero, not the screen.
  {
    vw: 768, vh: 1024, plate: 'p1000', heroTop: 77, heroH: 483.5, ty: 14.28,
    px: { x: 177.3, y: 180.2, w: 403.6, h: 373.6 },
    frac: { x: 0.2308, y: 0.1759, w: 0.5255, h: 0.3649 },
    noDriftY: 0.162,
  },
  {
    vw: 1024, vh: 768, plate: 'p1000', heroTop: 77, heroH: 716, ty: -5.67,
    px: { x: 209.4, y: 203, w: 597.7, h: 553.3 },
    frac: { x: 0.2045, y: 0.2643, w: 0.5837, h: 0.7204 },
    noDriftY: 0.2717,
  },
  // Desktop. Hero locked at 716px from 960px, so the castle is the same 597 x 553 px at
  // every width; only x moves.
  {
    vw: 1280, vh: 800, plate: 'p1600', heroTop: 77, heroH: 716, ty: -3.81,
    px: { x: 338.5, y: 203.8, w: 597.5, h: 553.1 },
    frac: { x: 0.2644, y: 0.2547, w: 0.4668, h: 0.6914 },
    noDriftY: 0.2595,
  },
  {
    vw: 1440, vh: 900, plate: 'p1600', heroTop: 77, heroH: 716, ty: 1.53,
    px: { x: 418.5, y: 209.1, w: 597.5, h: 553.1 },
    frac: { x: 0.2906, y: 0.2324, w: 0.415, h: 0.6145 },
    noDriftY: 0.2307,
  },
]

// How much of the castle a visitor can actually see at scroll 0: share of the mark's
// filled pixels (sampled on a 160px-wide raster) that are on screen, under the opaque
// artist carousel card, or in open space / behind headline type. This is what the
// hand-off to the plate has to read through.
export const CASTLE_VISIBILITY = {
  375: { offScreen: 28.5, underCarousel: 52.3, openOrBehindHeadline: 19.1 },
  1280: { offScreen: 0, underCarousel: 48.2, openOrBehindHeadline: 51.8 },
} as const
