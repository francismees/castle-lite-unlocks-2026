/**
 * Background warm-up for the 3D venue.
 *
 * Nobody opens the site and lands in the 3D: they read the hero, pick a ticket, and
 * only meet the venue further along. That gap is free bandwidth, so the assets are
 * fetched during it and the viewer opens from cache instead of from the network.
 *
 * Two deliberate limits. It waits for the main thread to go idle, so the warm-up can
 * never compete with the hero video or the cut-outs for the first paint. And it moves
 * bytes only — nothing is decoded, no WebGL context is created, no three.js module is
 * evaluated — because a GL context costs real memory on a mid-range Android and most
 * visitors never open the viewer at all.
 *
 * It opts out on Save-Data and on 2g, where a ~11 MB speculative fetch is rude; there
 * the viewer simply loads when asked.
 *
 * Once the bytes are in, the viewer's own code (three.js and the scene, ~640 KB) is
 * fetched and parsed too, still at idle. Parsing a module creates no GL context and
 * no geometry, so it costs a little CPU once instead of a second network wait at the
 * moment the visitor taps "The experience".
 */

/**
 * Small and always needed: the layout, the geometry, where the repeated objects go,
 * and which artwork belongs to which material.
 */
const ASSETS = [
  '/venue/venue.json',
  '/venue/placements.json',
  '/venue/textures.json',
  '/venue/arusha.glb',
  // The Draco decoder the GLB needs before it can show a single triangle.
  '/draco/draco_wasm_wrapper.js',
  '/draco/draco_decoder.wasm',
] as const

type Conn = { saveData?: boolean; effectiveType?: string }

let started = false

function thrifty(): boolean {
  const c = (navigator as Navigator & { connection?: Conn }).connection
  if (!c) return false
  return c.saveData === true || c.effectiveType === 'slow-2g' || c.effectiveType === '2g'
}

function idle(fn: () => void, timeout = 3000) {
  const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback
  if (ric) ric(fn, { timeout })
  else window.setTimeout(fn, 1200)
}

/**
 * Warm the HTTP cache. Safe to call repeatedly; only the first call does anything.
 * Failures are swallowed on purpose — this is an optimisation, never a dependency.
 */
export function warmVenue(): void {
  if (started || typeof window === 'undefined') return
  started = true
  if (thrifty()) return

  idle(() => {
    const pull = (url: string) =>
      fetch(url, { priority: 'low', cache: 'force-cache' } as RequestInit).catch(() => {})
    // Only the first-frame set is warmed. The model's 164 textures are deliberately
    // left to the viewer's own queue: speculatively pulling ~8 MB for a visitor who
    // may never open the 3D is exactly the rudeness this module exists to avoid.
    void Promise.all(ASSETS.map(pull)).then(() =>
      idle(() => {
        void import('./scene').catch(() => {})
      }),
    )
  })
}

/** True once the browser is likely to serve the model from cache. */
export function venueWarmed(): boolean {
  return started
}
