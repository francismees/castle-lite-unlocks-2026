import { useCallback, useEffect, useRef, useState } from 'react'
import { formatTzs, TIER_LABEL, type Tier, type Venue, type VenueTable } from './types'
import type { VenueScene } from './scene'
import { SCENE_THUMB_WIDTH, scenes } from '../config/scenes'
import { useLang } from '../i18n/LanguageContext'
import { usePrefersReducedMotion } from '../lib/hooks'
import { NavPad } from './NavPad'
import { VenueLoading } from './Loading'

/**
 * The table list (the setup card, tier filters and the A01-B30 grid) is parked, not
 * deleted: it is coming back as a pop-up behind a button. While it is off, tapping a
 * table does nothing either, since there would be no card to say what the camera just
 * flew to, and the bottom corner belongs to the nav pad.
 */
const TABLE_PANEL = false

/**
 * The venue viewer, as a full-screen overlay.
 *
 * Overlay rather than a route, deliberately. A VVIP buyer meets this in the middle of
 * checkout, and the one thing it must never do is cost them their basket: because the
 * page underneath is never unmounted, there is no state to save, restore or get wrong.
 * Closing it returns them to the exact pixel they left. That is also why it takes an
 * `onClose` and owns no navigation of its own — the host decides what "back" means.
 *
 * three.js is dynamically imported here, so ~600 KB of WebGL never enters the main
 * bundle for the many visitors who never open the viewer.
 */

export interface VenueViewerProps {
  open: boolean
  onClose: () => void
  /** Pre-select a table, e.g. the one a buyer is currently considering. */
  initialTableId?: string
  /** Fired when the viewer is used as a picker inside the purchase flow. */
  onChooseTable?: (t: VenueTable) => void
  /** Label for the confirm button; omit to run in look-around-only mode. */
  chooseLabel?: string
  /** Tables that can be looked at but not chosen, e.g. ones already in this basket. */
  unavailable?: string[]
}

type Phase = 'idle' | 'loading' | 'ready' | 'error'

export function VenueViewer({
  open,
  onClose,
  initialTableId,
  onChooseTable,
  chooseLabel,
  unavailable = [],
}: VenueViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<VenueScene | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [venue, setVenue] = useState<Venue | null>(null)
  const [sel, setSel] = useState<VenueTable | null>(null)
  const [filter, setFilter] = useState<Tier | 'all'>('all')
  // Which of the fourteen approved angles the camera is on. The scene owns the
  // sequence and pushes the index here, rather than React driving the camera, so a
  // visitor who grabs the canvas mid-opening cannot leave the rail pointing at a
  // stop the camera has already left.
  const [stop, setStop] = useState(0)
  const railRef = useRef<HTMLDivElement>(null)
  // Only the scene titles are translated here. The rest of this dialog is still
  // English working copy; wiring one and not the other is deliberate, because the
  // titles already carry both languages and hardcoding .en would throw that away.
  const { t } = useLang()
  const reduced = usePrefersReducedMotion()
  // Read through a ref inside the loader: the effect must not re-run and rebuild the
  // whole WebGL context because the visitor changed a system setting mid-session.
  const reducedRef = useRef(reduced)
  reducedRef.current = reduced

  // Build on open, tear down on close. The WebGL context is the expensive thing on
  // mobile, so it is created no earlier than the moment it is actually needed and
  // released the moment it is not.
  useEffect(() => {
    if (!open) return
    let alive = true
    setPhase('loading')

    ;(async () => {
      try {
        const [{ VenueScene }, manifest] = await Promise.all([
          import('./scene'),
          fetch('/venue/venue.json').then((r) => {
            if (!r.ok) throw new Error(`venue.json ${r.status}`)
            return r.json() as Promise<Venue>
          }),
        ])
        if (!alive || !canvasRef.current) return
        const sc = new VenueScene(canvasRef.current)
        sceneRef.current = sc
        await sc.load(manifest, '/venue/arusha.glb', '/venue/placements.json', '/venue/textures.json')
        if (!alive) return
        setVenue(manifest)
        setPhase('ready')
        if (TABLE_PANEL) sc.setPickHandler((p) => setSel(p?.table ?? null))
        sc.allowRoam()
        sc.onStop(setStop)
        // A camera that drives itself for forty seconds is the thing this setting is
        // for. Honouring it lands on the first angle and hands the rail over, rather
        // than removing the walk — the stops are the content, the motion is not.
        if (reducedRef.current) sc.goToStop(0)
        // Dev-only handle so the render budget can be read back in the browser.
        // import.meta.env.DEV is statically false in a production build, so both the
        // branch and the reference are dropped by the bundler.
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__venue = sc
        if (TABLE_PANEL) canvasRef.current.addEventListener('pointerdown', sc.handleTap)
        if (initialTableId) {
          const t = manifest.tables.find((x) => x.id === initialTableId)
          if (t) {
            if (TABLE_PANEL) setSel(t)
            sc.focusTable(t)
            sc.highlight(t.id)
          }
        }
      } catch {
        if (alive) setPhase('error')
      }
    })()

    return () => {
      alive = false
      const sc = sceneRef.current
      if (sc && canvasRef.current) canvasRef.current.removeEventListener('pointerdown', sc.handleTap)
      sc?.dispose()
      sceneRef.current = null
      setPhase('idle')
      setSel(null)
    }
  }, [open, initialTableId])

  useEffect(() => {
    if (!open) return
    const onResize = () => sceneRef.current?.resize()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [open])

  // Escape closes, and focus is trapped to the overlay while it is up.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  // The opening moves on its own, so the rail has to follow it rather than the other
  // way round — otherwise the active frame walks off the end of a phone-width rail.
  useEffect(() => {
    const rail = railRef.current
    const active = rail?.querySelector<HTMLElement>('[aria-current="true"]')
    if (!rail || !active) return
    rail.scrollTo({
      left: active.offsetLeft - (rail.clientWidth - active.clientWidth) / 2,
      behavior: reduced ? 'auto' : 'smooth',
    })
  }, [stop, reduced])

  const goStop = useCallback((i: number) => {
    setSel(null)
    sceneRef.current?.highlight(null)
    sceneRef.current?.goToStop(i)
  }, [])

  const choose = useCallback(
    (t: VenueTable) => {
      setSel(t)
      sceneRef.current?.focusTable(t)
      sceneRef.current?.highlight(t.id)
    },
    [],
  )

  const clear = useCallback(() => {
    setSel(null)
    sceneRef.current?.highlight(null)
    sceneRef.current?.overview()
  }, [])

  if (!open) return null

  const tables = venue?.tables ?? []
  const shown = filter === 'all' ? tables : tables.filter((t) => t.tier === filter)
  const counts = {
    'starr-castle': tables.filter((t) => t.tier === 'starr-castle').length,
    'cold-rush': tables.filter((t) => t.tier === 'cold-rush').length,
  }

  return (
    <div className="venue" role="dialog" aria-modal="true" aria-label="Arusha venue in 3D">
      <canvas ref={canvasRef} className="venue__canvas" />

      <div className="venue__top">
        <button type="button" className="venue__close" onClick={onClose}>
          <span aria-hidden="true">←</span> {chooseLabel ? 'Back to checkout' : 'Close'}
        </button>
        {phase === 'ready' && (
          <button type="button" className="venue__reset" onClick={clear}>
            Overview
          </button>
        )}
      </div>

      {phase === 'loading' && <VenueLoading />}

      {phase === 'error' && (
        <div className="venue__state">
          <p>The 3D view could not load.</p>
          <button type="button" className="btn" onClick={onClose}>
            Go back
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <div className="venue__dock">
          {!sel && (
            <div className="venue__walk">
              {/* -1 means the camera has been taken off the walk — the wide overview. The
                  rail stays, so stepping back in is one tap, but it stops naming an angle
                  the camera is no longer standing at. */}
              {stop >= 0 && (
                <p className="venue__walkhead">
                  <span className="venue__walknum">{String(stop + 1).padStart(2, '0')}</span>
                  <span className="venue__walkrule" aria-hidden="true" />
                  <span className="venue__walktitle">{t(scenes[stop].title)}</span>
                </p>
              )}
              <div
                className="venue__rail"
                ref={railRef}
                role="group"
                aria-label="Jump to a view"
                // Most mice only scroll vertically; turn that into the rail's direction.
                onWheel={(e) => {
                  if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) e.currentTarget.scrollLeft += e.deltaY
                }}
              >
                {scenes.map((sc, i) => (
                  <button
                    key={sc.frame}
                    type="button"
                    className="venue__thumb"
                    aria-current={i === stop}
                    aria-label={`View ${i + 1} of ${scenes.length} — ${t(sc.title)}`}
                    onClick={() => goStop(i)}
                  >
                    <picture>
                      <source
                        type="image/avif"
                        srcSet={`/scenes/arusha-${sc.frame}-${SCENE_THUMB_WIDTH}.avif`}
                      />
                      <img
                        src={`/scenes/arusha-${sc.frame}-${SCENE_THUMB_WIDTH}.webp`}
                        alt=""
                        width={240}
                        height={135}
                        loading="lazy"
                        decoding="async"
                        draggable={false}
                      />
                    </picture>
                  </button>
                ))}
              </div>
            </div>
          )}
          <NavPad scene={sceneRef.current} />
        </div>
      )}

      {phase === 'ready' && TABLE_PANEL && (
        <div className="venue__panel">
          {sel ? (
            <div className="venue__card">
              <div className="venue__cardhead">
                <div>
                  <p className={`venue__tier venue__tier--${sel.tier}`}>{TIER_LABEL[sel.tier]}</p>
                  <h3 className="venue__id">Table {sel.id}</h3>
                  <p className="venue__meta">
                    Platform {sel.platform} · Row {sel.row} of 10 ·{' '}
                    {sel.row <= 5 ? 'stage side' : 'rear'}
                  </p>
                </div>
                <p className="venue__price">{formatTzs(sel.price)}</p>
              </div>
              <p className="venue__hint">This is the view from your table.</p>
              {onChooseTable && chooseLabel && (
                <button
                  type="button"
                  className="btn btn--primary venue__choose"
                  onClick={() => onChooseTable(sel)}
                  disabled={unavailable.includes(sel.id)}
                >
                  {unavailable.includes(sel.id) ? `Table ${sel.id} is already in your basket` : `${chooseLabel} — Table ${sel.id}`}
                </button>
              )}
              <button type="button" className="venue__back" onClick={clear}>
                Back to the full setup
              </button>
            </div>
          ) : (
            <div className="venue__card">
              <h3 className="venue__id">Arusha setup</h3>
              <p className="venue__meta">
                {counts['starr-castle'] + counts['cold-rush']} VVIP tables across two platforms, plus the
                standing VIP section. Tap any table to see its view of the stage.
              </p>
              <div className="venue__legend">
                <span className="venue__dot venue__dot--starr-castle" /> DND in My Castle · 5M
                <span className="venue__dot venue__dot--cold-rush" /> Extra Cold Charm · 3M
              </div>
            </div>
          )}

          <div className="venue__filters" role="group" aria-label="Filter tables by tier">
            {(['all', 'starr-castle', 'cold-rush'] as const).map((f) => (
              <button
                key={f}
                type="button"
                className={`venue__filter${filter === f ? ' is-on' : ''}`}
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? `All ${tables.length}` : `${TIER_LABEL[f]} ${counts[f]}`}
              </button>
            ))}
          </div>

          <ul className="venue__list">
            {shown.map((t) => (
              <li key={t.id}>
                <button
                  type="button"
                  className={`venue__chip venue__chip--${t.tier}${sel?.id === t.id ? ' is-on' : ''}`}
                  onClick={() => choose(t)}
                >
                  {t.id}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
