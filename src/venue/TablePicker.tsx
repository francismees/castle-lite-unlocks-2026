import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Tier, Venue, VenueTable } from './types'
import type { VenueScene } from './scene'
import { useLang } from '../i18n/LanguageContext'
import { usePrefersReducedMotion } from '../lib/hooks'

/**
 * The table scene: the ticket journey's 3D table picker.
 *
 * Same model as the walkthrough ("The experience"), different job. It opens on an
 * aerial shot of the whole site and settles on both VVIP platforms with the stage,
 * the buyer's package lit and the other dimmed, zones labelled. Flipping through
 * table numbers (or tapping a table) frames that table from behind, looking past it
 * to the stage, and tags it with a hologram: the number, its package, where it is
 * and how far from the stage. "See the view" drops into the seat.
 *
 * Modes, from the query string (see standalone.tsx):
 *   pick  tier + pick=1     choose a table of that package, sent back to checkout
 *   tier  tier only         see where a package's tables are, nothing to choose
 *   view  table only        look at one table already bought
 */

export interface TablePickerProps {
  tier?: Tier
  /** Open on this table (a slot being changed, or a table being viewed). */
  tableId?: string
  pick: boolean
  /** "Table n of N" for a buyer placing more than one table. */
  n?: number
  of?: number
  /** Tables in the basket already: visible, not choosable. */
  taken: string[]
  onChoose?: (t: VenueTable) => void
  onClose: () => void
  embedded: boolean
}

type Phase = 'loading' | 'ready' | 'error'

/** Where the hologram floats over a table's deck, matching BEACON_HEIGHT in scene.ts. */
const TAG_LIFT = 3.7

const TIER_NAME: Record<Tier, string> = { 'starr-castle': 'Starr Castle', 'cold-rush': 'Cold Rush' }
const TIER_ROWS: Record<Tier, string> = { 'starr-castle': '1–5', 'cold-rush': '6–10' }

const L = {
  back: { en: 'Back to checkout', sw: 'Rudi kwenye malipo' },
  close: { en: 'Close', sw: 'Funga' },
  loading: { en: 'Setting out the tables…', sw: 'Tunapanga meza…' },
  failed: { en: 'The 3D map could not load. Go back and try again.', sw: 'Ramani ya 3D imeshindwa kufunguka. Rudi ujaribu tena.' },
  pickHead: { en: 'Choose your {tier} table', sw: 'Chagua meza yako ya {tier}' },
  tierHead: { en: '{tier} tables', sw: 'Meza za {tier}' },
  viewHead: { en: 'Your table', sw: 'Meza yako' },
  slot: { en: 'Table {n} of {of}', sw: 'Meza {n} kati ya {of}' },
  intro: {
    en: 'Your package is lit. Tap a table or flip through the numbers to see where each one sits.',
    sw: 'Kifurushi chako kimewashwa. Gusa meza au pitia namba kuona kila meza ilipo.',
  },
  introLook: {
    en: 'Tap a table or flip through the numbers to see where each one sits.',
    sw: 'Gusa meza au pitia namba kuona kila meza ilipo.',
  },
  rows: { en: 'Rows {rows}', sw: 'Safu {rows}' },
  notYours: { en: 'Not in your package', sw: 'Si ya kifurushi chako' },
  inBasket: { en: 'In your basket', sw: 'Kwenye kikapu chako' },
  stage: { en: 'Stage', sw: 'Jukwaa' },
  platform: { en: 'Platform {p}', sw: 'Jukwaa {p}' },
  row: { en: 'Row {r}', sw: 'Safu {r}' },
  forTen: { en: 'Table for 10', sw: 'Meza ya watu 10' },
  prev: { en: 'Previous table', sw: 'Meza iliyotangulia' },
  next: { en: 'Next table', sw: 'Meza inayofuata' },
  ofCount: { en: '{i} of {n}', sw: '{i} kati ya {n}' },
  seat: { en: 'See the view from this table', sw: 'Ona mandhari kutoka meza hii' },
  unseat: { en: 'Back to table {id}', sw: 'Rudi kwenye meza {id}' },
  choose: { en: 'Choose table {id}', sw: 'Chagua meza {id}' },
  taken: { en: 'Table {id} is already in your basket', sw: 'Meza {id} tayari iko kwenye kikapu chako' },
  overview: { en: 'Back to overview', sw: 'Rudi kwenye ramani nzima' },
  pickFirst: { en: 'Pick a table to continue', sw: 'Chagua meza kuendelea' },
} as const

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))

/** Platform, then row from the stage back, then seat: the order the numbers run in. */
const byNumber = (a: VenueTable, b: VenueTable) =>
  a.platform.localeCompare(b.platform) || a.row - b.row || a.seat - b.seat

export function TablePicker({ tier: tierProp, tableId, pick, n, of, taken, onChoose, onClose, embedded }: TablePickerProps) {
  const { lang } = useLang()
  const t = useCallback((k: keyof typeof L) => L[k][lang], [lang])
  const reduced = usePrefersReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<VenueScene | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [venue, setVenue] = useState<Venue | null>(null)
  const [sel, setSel] = useState<VenueTable | null>(null)
  const [seated, setSeated] = useState(false)

  // Overlay anchors, written straight to the DOM each frame (never through React).
  const tagRef = useRef<HTMLDivElement>(null)
  const beamRef = useRef<HTMLDivElement>(null)
  const labelRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const tables = venue?.tables ?? []
  const tier: Tier | undefined = tierProp ?? tables.find((x) => x.id === tableId)?.tier
  const list = useMemo(() => tables.filter((x) => !tier || x.tier === tier).sort(byNumber), [tables, tier])

  // Zone labels: the stage, and each package on each platform.
  const zones = useMemo(() => {
    if (!venue) return []
    const out: Array<{ key: string; pos: [number, number, number]; tier?: Tier }> = []
    const d = venue.stage.deck
    out.push({ key: 'stage', pos: [d.centre[0], d.centre[1] + d.size[1] + 3.5, d.centre[2]] })
    for (const tr of ['starr-castle', 'cold-rush'] as Tier[]) {
      for (const p of ['A', 'B'] as const) {
        const ts = venue.tables.filter((x) => x.tier === tr && x.platform === p)
        if (!ts.length) continue
        const avg = (i: 0 | 1 | 2) => ts.reduce((s, x) => s + x.pos[i], 0) / ts.length
        // Outboard of the platform, so the label sits beside its tables, not on them.
        const side = p === 'A' ? -9 : 9
        out.push({ key: `${tr}-${p}`, pos: [avg(0) + side, 1.5, avg(2)], tier: tr })
      }
    }
    return out
  }, [venue])

  // Read by the per-frame overlay writer, which must not re-subscribe on every pick.
  const selRef = useRef<VenueTable | null>(null)
  selRef.current = sel

  const select = useCallback((x: VenueTable) => {
    setSel(x)
    setSeated(false)
    sceneRef.current?.frameTable(x)
  }, [])

  // ── build the scene
  useEffect(() => {
    let alive = true
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
        sc.tourOnLoad = false
        sc.tapFocus = false
        sceneRef.current = sc
        await sc.load(manifest, '/venue/arusha.glb', '/venue/placements.json', '/venue/textures.json')
        if (!alive) return
        sc.tablePads()
        setVenue(manifest)
        setPhase('ready')
        const start = tableId ? manifest.tables.find((x) => x.id === tableId) : undefined
        if (start) {
          setSel(start)
          sc.frameTable(start, 0)
        } else {
          sc.establish(reduced)
        }
      } catch {
        if (alive) setPhase('error')
      }
    })()
    return () => {
      alive = false
      sceneRef.current?.dispose()
      sceneRef.current = null
    }
    // Built once per open; selection changes drive the scene through the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onResize = () => sceneRef.current?.resize()
    window.addEventListener('resize', onResize)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('resize', onResize)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  // ── scene follows selection
  useEffect(() => {
    const sc = sceneRef.current
    if (!sc || phase !== 'ready') return
    sc.paintTables({ focus: tier ?? null, selected: sel?.id ?? null, taken })
    sc.beacon(seated ? null : sel)
  }, [phase, sel, seated, tier, taken])

  // Taps on the map select; taps on another package's table do nothing in pick mode.
  useEffect(() => {
    const sc = sceneRef.current
    const canvas = canvasRef.current
    if (!sc || !canvas || phase !== 'ready') return
    sc.setPickHandler((p) => {
      if (!p) return
      if (pick && tier && p.table.tier !== tier) return
      select(p.table)
    })
    canvas.addEventListener('pointerdown', sc.handleTap)
    return () => canvas.removeEventListener('pointerdown', sc.handleTap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pick, tier])

  // ── overlays track the camera
  useEffect(() => {
    const sc = sceneRef.current
    if (!sc || phase !== 'ready' || !venue) return
    return sc.onFrame(() => {
      for (const z of zones) {
        const el = labelRefs.current[z.key]
        if (!el) continue
        const p = sc.project(...z.pos)
        // Held inside the screen: on a phone the outboard labels would sit past the edge.
        const half = el.offsetWidth / 2 + 8
        const x = Math.min(Math.max(p.x, half), window.innerWidth - half)
        el.style.transform = `translate3d(${x}px, ${p.y}px, 0) translate(-50%, -50%)`
        el.style.visibility = p.visible ? '' : 'hidden'
      }
      const tag = tagRef.current
      const beam = beamRef.current
      const cur = selRef.current
      if (tag && beam && cur) {
        const plat = venue.platforms.find((pl) => pl.id === cur.platform)
        const deck = plat ? plat.centre[1] + plat.size[1] : cur.pos[1]
        const top = sc.project(cur.pos[0], deck + TAG_LIFT, cur.pos[2])
        const foot = sc.project(cur.pos[0], deck + 0.1, cur.pos[2])
        tag.style.transform = `translate3d(${top.x}px, ${top.y}px, 0) translate(-50%, -100%)`
        tag.style.visibility = top.visible ? '' : 'hidden'
        const len = Math.max(0, foot.y - top.y)
        beam.style.transform = `translate3d(${top.x}px, ${top.y}px, 0)`
        beam.style.height = `${len}px`
        beam.style.visibility = top.visible && foot.visible ? '' : 'hidden'
      }
    })
  }, [phase, venue, zones])

  const flip = (d: 1 | -1) => {
    if (!list.length) return
    const i = sel ? list.findIndex((x) => x.id === sel.id) : -1
    const next = list[(i + d + list.length) % list.length]
    select(next)
  }

  const toOverview = () => {
    setSel(null)
    setSeated(false)
    sceneRef.current?.tablesOverview()
  }

  const toggleSeat = () => {
    if (!sel) return
    const sc = sceneRef.current
    if (seated) sc?.frameTable(sel)
    else sc?.focusTable(sel)
    setSeated(!seated)
  }

  const isTaken = !!sel && taken.includes(sel.id)
  const head = pick && tier
    ? fill(t('pickHead'), { tier: TIER_NAME[tier] })
    : tier && !tableId
      ? fill(t('tierHead'), { tier: TIER_NAME[tier] })
      : t('viewHead')
  const index = sel ? list.findIndex((x) => x.id === sel.id) + 1 : 0

  return (
    <div className="tpick" role="dialog" aria-modal="true" aria-label={head}>
      <canvas ref={canvasRef} className="tpick__canvas" />

      {phase === 'ready' && (
        <div className="tpick__labels" aria-hidden="true">
          {zones.map((z) => (
            <div
              key={z.key}
              ref={(el) => {
                labelRefs.current[z.key] = el
              }}
              className={`tpick__zone${z.tier ? ` tpick__zone--${z.tier}` : ' tpick__zone--stage'}${
                z.tier && tier && z.tier !== tier ? ' is-dim' : ''
              }${sel && z.tier ? ' is-hidden' : ''}`}
            >
              {z.tier ? (
                <>
                  <b>{TIER_NAME[z.tier]}</b>
                  <span>{fill(t('rows'), { rows: TIER_ROWS[z.tier] })}</span>
                </>
              ) : (
                <b>{t('stage')}</b>
              )}
            </div>
          ))}

          {sel && !seated && (
            <>
              <div ref={beamRef} className="tpick__beam" />
              <div ref={tagRef} className={`holo holo--${sel.tier}${isTaken ? ' is-taken' : ''}`} key={sel.id}>
                <span className="holo__tier">{TIER_NAME[sel.tier]}</span>
                <span className="holo__id">{sel.id}</span>
                <span className="holo__facts">
                  {fill(t('platform'), { p: sel.platform })} · {fill(t('row'), { r: sel.row })}
                </span>
                {isTaken && <span className="holo__flag">{t('inBasket')}</span>}
              </div>
            </>
          )}
        </div>
      )}

      <div className="tpick__top">
        <button type="button" className="tpick__close" onClick={onClose}>
          <span aria-hidden="true">←</span> {pick && embedded ? t('back') : t('close')}
        </button>
        {phase === 'ready' && sel && (
          <button type="button" className="tpick__all" onClick={toOverview}>
            {t('overview')}
          </button>
        )}
      </div>

      {phase === 'loading' && (
        <div className="tpick__state" aria-live="polite">
          <span className="tpick__spin" aria-hidden="true" />
          <p>{t('loading')}</p>
        </div>
      )}
      {phase === 'error' && (
        <div className="tpick__state" role="alert">
          <p>{t('failed')}</p>
          <button type="button" className="btn" onClick={onClose}>
            {pick && embedded ? t('back') : t('close')}
          </button>
        </div>
      )}

      {phase === 'ready' && (
        <section className="tpick__panel" aria-label={head}>
          <header className="tpick__head">
            <h1 className="tpick__title">
              {tier && <span className={`tpick__dot tpick__dot--${tier}`} aria-hidden="true" />}
              {head}
            </h1>
            {pick && n && of && of > 1 && <p className="tpick__slot">{fill(t('slot'), { n, of })}</p>}
          </header>

          {!sel && (
            <>
              <p className="tpick__intro">{t(tier ? 'intro' : 'introLook')}</p>
              <ul className="tpick__legend">
                {(['starr-castle', 'cold-rush'] as Tier[]).map((tr) => (
                  <li key={tr} className={tier && tr !== tier ? 'is-dim' : undefined}>
                    <span className={`tpick__dot tpick__dot--${tr}`} aria-hidden="true" />
                    <b>{TIER_NAME[tr]}</b> {fill(t('rows'), { rows: TIER_ROWS[tr] })}
                    {pick && tier && tr !== tier && <em> · {t('notYours')}</em>}
                  </li>
                ))}
                {taken.length > 0 && (
                  <li>
                    <span className="tpick__dot tpick__dot--taken" aria-hidden="true" />
                    {t('inBasket')}
                  </li>
                )}
              </ul>
            </>
          )}

          <div className="tpick__flip" role="group" aria-label={head}>
            <button type="button" className="tpick__arrow" onClick={() => flip(-1)} aria-label={t('prev')}>
              ‹
            </button>
            <div className="tpick__num" aria-live="polite">
              <span className="tpick__id">{sel ? sel.id : '—'}</span>
              {sel && <span className="tpick__count">{fill(t('ofCount'), { i: index, n: list.length })}</span>}
            </div>
            <button type="button" className="tpick__arrow" onClick={() => flip(1)} aria-label={t('next')}>
              ›
            </button>
          </div>

          {sel && (
            <div className="tpick__links">
              <button type="button" className="tpick__seat" onClick={toggleSeat} aria-pressed={seated}>
                {seated ? fill(t('unseat'), { id: sel.id }) : t('seat')}
              </button>
              {/* Once a table is selected the arrows only move between tables; this is the
                  way back out to the whole ground, next to where the eye already is. */}
              <button type="button" className="tpick__back" onClick={toOverview}>
                <span aria-hidden="true">↖</span> {t('overview')}
              </button>
            </div>
          )}

          {pick && onChoose && (
            <button
              type="button"
              className="btn btn--primary tpick__choose"
              disabled={!sel || isTaken}
              onClick={() => sel && onChoose(sel)}
            >
              {!sel ? t('pickFirst') : isTaken ? fill(t('taken'), { id: sel.id }) : fill(t('choose'), { id: sel.id })}
            </button>
          )}
        </section>
      )}
    </div>
  )
}
