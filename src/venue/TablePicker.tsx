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

/**
 * Free looking (drag to orbit, pinch or wheel to zoom) is parked, not deleted, while the
 * rest of the 3D is reworked (Francis, 24 Nov 2026). With it off the camera only goes
 * where the picker sends it: the aerial opening, the overview, a framed table, the
 * seated view. Set true to hand the camera back to the visitor.
 */
const FREE_LOOK = false

/** How long the opening glide takes (establish in scene.ts), before the nudge appears. */
const NUDGE_AFTER_MS = 2600

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
  /**
   * The buyer tapped a table of the other package and asked to switch to it: the host
   * moves this ticket to that package and books the table. Without it the pop-up only
   * offers to stay.
   */
  onSwitch?: (t: VenueTable) => void
  onClose: () => void
  embedded: boolean
}

type Phase = 'loading' | 'ready' | 'error'

/** Where the hologram floats over a table's deck, matching BEACON_HEIGHT in scene.ts. */
const TAG_LIFT = 3.7

const TIER_NAME: Record<Tier, string> = { 'starr-castle': 'DND in My Castle', 'cold-rush': 'Extra Cold Charm' }
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
  nudge: { en: 'Tap to see your {tier} tables', sw: 'Gusa kuona meza zako za {tier}' },
  nudgeLook: { en: 'Tap to flip through the tables', sw: 'Gusa kupitia meza' },
  askHead: { en: '{id} is a {other} table', sw: '{id} ni meza ya {other}' },
  askBody: {
    en: 'Your ticket is for a {tier} table, rows {rows}. {other} tables are in rows {otherRows}, at {price} a table.',
    sw: 'Tiketi yako ni ya meza ya {tier}, safu {rows}. Meza za {other} ziko safu {otherRows}, kwa {price} kwa meza.',
  },
  askLess: { en: 'That is {diff} less.', sw: 'Ni {diff} pungufu.' },
  askMore: { en: 'That is {diff} more.', sw: 'Ni {diff} zaidi.' },
  askNote: {
    en: 'Switching updates your basket. You can change it again before you pay.',
    sw: 'Ukibadilisha, kikapu chako kitasasishwa. Unaweza kubadilisha tena kabla ya kulipa.',
  },
  askSwitch: { en: 'Switch to {other}, table {id}', sw: 'Badilisha kwenda {other}, meza {id}' },
  askStay: { en: 'Keep my {tier} ticket', sw: 'Baki na tiketi yangu ya {tier}' },
} as const

const tzs = (n: number) => `TZS ${n.toLocaleString('en-US')}`

const fill = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ''))

/** Platform, then row from the stage back, then seat: the order the numbers run in. */
const byNumber = (a: VenueTable, b: VenueTable) =>
  a.platform.localeCompare(b.platform) || a.row - b.row || a.seat - b.seat

export function TablePicker({ tier: tierProp, tableId, pick, n, of, taken, onChoose, onSwitch, onClose, embedded }: TablePickerProps) {
  const { lang } = useLang()
  const t = useCallback((k: keyof typeof L) => L[k][lang], [lang])
  const reduced = usePrefersReducedMotion()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const sceneRef = useRef<VenueScene | null>(null)
  const [phase, setPhase] = useState<Phase>('loading')
  const [venue, setVenue] = useState<Venue | null>(null)
  const [sel, setSel] = useState<VenueTable | null>(null)
  const [seated, setSeated] = useState(false)
  // The call to flip: shown once the opening has landed, gone after the first flip or pick.
  const [nudge, setNudge] = useState(false)
  const [started, setStarted] = useState(!!tableId)
  // A table of the other package the buyer tapped in pick mode: the switch pop-up.
  const [ask, setAsk] = useState<VenueTable | null>(null)
  const askRef = useRef<HTMLDivElement>(null)

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
  selRef.current = ask ?? sel

  const select = useCallback((x: VenueTable) => {
    setSel(x)
    setSeated(false)
    setStarted(true)
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
        if (!FREE_LOOK) sc.lockCamera()
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

  const askOpen = useRef(false)
  askOpen.current = !!ask
  const keepRef = useRef(() => {})
  useEffect(() => {
    const onResize = () => sceneRef.current?.resize()
    window.addEventListener('resize', onResize)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (askOpen.current) keepRef.current()
      else onClose()
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
    sc.paintTables({ focus: tier ?? null, selected: ask?.id ?? sel?.id ?? null, taken })
    sc.beacon(ask ?? (seated ? null : sel))
  }, [phase, sel, seated, tier, taken, ask])

  // The nudge waits for the opening glide to land, so it points at a still screen.
  useEffect(() => {
    if (phase !== 'ready' || started) return
    const id = window.setTimeout(() => setNudge(true), reduced ? 0 : NUDGE_AFTER_MS)
    return () => window.clearTimeout(id)
  }, [phase, started, reduced])
  useEffect(() => {
    if (started) setNudge(false)
  }, [started])

  // Taps on the map select. In pick mode a table of the other package is not chosen
  // silently or ignored: the camera shows it and a pop-up offers to switch packages.
  useEffect(() => {
    const sc = sceneRef.current
    const canvas = canvasRef.current
    if (!sc || !canvas || phase !== 'ready') return
    sc.setPickHandler((p) => {
      if (!p || ask) return
      if (pick && tier && p.table.tier !== tier) {
        if (taken.includes(p.table.id)) return
        setAsk(p.table)
        sc.frameTable(p.table)
        return
      }
      select(p.table)
    })
    canvas.addEventListener('pointerdown', sc.handleTap)
    return () => canvas.removeEventListener('pointerdown', sc.handleTap)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, pick, tier, ask, taken])

  // The pop-up takes focus, and Escape (or "keep") puts the camera back where it was.
  const keep = useCallback(() => {
    setAsk(null)
    const sc = sceneRef.current
    if (sel) sc?.frameTable(sel)
    else sc?.tablesOverview()
  }, [sel])
  keepRef.current = keep
  useEffect(() => {
    if (!ask) return
    askRef.current?.querySelector<HTMLButtonElement>('button')?.focus()
  }, [ask])

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
  // The table wearing the hologram: one being asked about, else the selection.
  const tagged = ask ?? (seated ? null : sel)
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

          {tagged && (
            <>
              <div ref={beamRef} className="tpick__beam" />
              <div ref={tagRef} className={`holo holo--${tagged.tier}${isTaken && !ask ? ' is-taken' : ''}`} key={tagged.id}>
                <span className="holo__tier">{TIER_NAME[tagged.tier]}</span>
                <span className="holo__id">{tagged.id}</span>
                <span className="holo__facts">
                  {fill(t('platform'), { p: tagged.platform })} · {fill(t('row'), { r: tagged.row })}
                </span>
                {isTaken && !ask && <span className="holo__flag">{t('inBasket')}</span>}
                {ask && <span className="holo__flag holo__flag--other">{t('notYours')}</span>}
              </div>
            </>
          )}
        </div>
      )}

      <div className="tpick__top" inert={!!ask}>
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
        <section className="tpick__panel" aria-label={head} inert={!!ask}>
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
            <span className="tpick__nextwrap">
              <button
                type="button"
                className={`tpick__arrow${nudge && !ask ? ' is-nudge' : ''}`}
                onClick={() => flip(1)}
                aria-label={t('next')}
                aria-describedby={nudge && !ask ? 'tpick-nudge' : undefined}
              >
                ›
              </button>
              {nudge && !ask && (
                <span id="tpick-nudge" className="tpick__nudge">
                  {tier ? fill(t('nudge'), { tier: TIER_NAME[tier] }) : t('nudgeLook')}
                  <span className="tpick__nudgehand" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                      <path d="M12 4v13M6.5 11.5 12 17l5.5-5.5" />
                    </svg>
                  </span>
                </span>
              )}
            </span>
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
      {ask && tier && (() => {
        const mine = list[0]?.price ?? 0
        const diff = Math.abs(mine - ask.price)
        return (
          <div className="tpick__ask" role="presentation" onClick={(e) => e.target === e.currentTarget && keep()}>
            <div
              ref={askRef}
              className="tpick__askcard"
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="tpick-ask-h"
              aria-describedby="tpick-ask-b"
            >
              <h2 id="tpick-ask-h" className="tpick__askhead">
                <span className={`tpick__dot tpick__dot--${ask.tier}`} aria-hidden="true" />
                {fill(t('askHead'), { id: ask.id, other: TIER_NAME[ask.tier] })}
              </h2>
              <p id="tpick-ask-b" className="tpick__askbody">
                {fill(t('askBody'), {
                  tier: TIER_NAME[tier],
                  rows: TIER_ROWS[tier],
                  other: TIER_NAME[ask.tier],
                  otherRows: TIER_ROWS[ask.tier],
                  price: tzs(ask.price),
                })}{' '}
                {diff > 0 && fill(t(ask.price < mine ? 'askLess' : 'askMore'), { diff: tzs(diff) })}
              </p>
              {onSwitch && <p className="tpick__asknote">{t('askNote')}</p>}
              <div className="tpick__askacts">
                {onSwitch && (
                  <button type="button" className="btn btn--primary" onClick={() => onSwitch(ask)}>
                    {fill(t('askSwitch'), { other: TIER_NAME[ask.tier], id: ask.id })}
                  </button>
                )}
                <button type="button" className="tpick__back tpick__askstay" onClick={keep}>
                  {fill(t('askStay'), { tier: TIER_NAME[tier] })}
                </button>
              </div>
            </div>
          </div>
        )
      })()}
    </div>
  )
}
