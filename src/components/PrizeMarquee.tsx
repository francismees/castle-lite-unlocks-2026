import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { campaign, formatPrize } from '../config/campaign'
import type { Str } from '../i18n/strings'
import { usePrefersReducedMotion } from '../lib/hooks'
import { IconChevron, IconPause, IconPlay } from './Icons'

/**
 * What You Can Unlock — a full-width band on the Blue Jolt plate, with every prize on a
 * same-size glass card drifting slowly right to left in an endless loop.
 *
 * The card set is rendered twice and a single rAF loop drifts the track left, wrapping by
 * exactly one set so the loop has no seam. The second set is aria-hidden, so screen
 * readers meet each prize once; the cards contain nothing focusable, so the Tab key never
 * reaches it either. Not `inert`: inert also swallows pointer events, and the copies
 * would never flip on hover. The arrows glide one card
 * and land on a card boundary; drift picks up from there. Drift stops while hovered,
 * while keyboard focus is inside, while the band is off screen or the tab hidden, and
 * when paused (WCAG 2.2.2). With prefers-reduced-motion there is no drift and the arrows
 * step instantly.
 */

const SPEED = 33 // px per second
const STEP_MS = 520

const PRIZE_WIDTHS = [320, 640]
const PRIZE_SIZES = '(min-width: 720px) 250px, 220px'
const prizeSrcset = (stem: string, ext: 'avif' | 'webp') =>
  PRIZE_WIDTHS.map((w) => `/prizes/${stem}-${w}.${ext} ${w}w`).join(', ')

export function PrizeMarquee() {
  const { s, t, lang } = useLang()
  const reduced = usePrefersReducedMotion()
  const [paused, setPaused] = useState(false)

  const bandRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const setRef = useRef<HTMLUListElement>(null)
  const x = useRef(0)
  const setWidth = useRef(0)
  const holds = useRef(new Set<string>())
  const glide = useRef<{ from: number; to: number; start: number } | null>(null)
  const pausedRef = useRef(paused)
  const reducedRef = useRef(reduced)
  pausedRef.current = paused
  reducedRef.current = reduced

  const paint = useCallback(() => {
    const w = setWidth.current
    if (w > 0) x.current = ((x.current % w) - w) % w // keep within (-w, 0]
    if (trackRef.current) trackRef.current.style.transform = `translate3d(${x.current}px,0,0)`
  }, [])

  // One frame loop for the life of the band: glide if an arrow asked for it, otherwise
  // drift unless something is holding it still.
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    const frame = (nowMs: number) => {
      const dt = Math.min(64, nowMs - last)
      last = nowMs
      const g = glide.current
      if (g) {
        const k = Math.min(1, (nowMs - g.start) / STEP_MS)
        const e = 1 - (1 - k) ** 3
        x.current = g.from + (g.to - g.from) * e
        if (k >= 1) glide.current = null
        paint()
      } else if (!pausedRef.current && !reducedRef.current && holds.current.size === 0) {
        x.current -= (SPEED * dt) / 1000
        paint()
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [paint])

  // Measure one set; re-measure when the cards resize (breakpoints, font load).
  useEffect(() => {
    const el = setRef.current
    if (!el) return
    const measure = () => {
      setWidth.current = el.offsetWidth
      paint()
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [paint])

  // Hold still while off screen or in a hidden tab.
  useEffect(() => {
    const band = bandRef.current
    if (!band) return
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) holds.current.delete('offscreen')
      else holds.current.add('offscreen')
    })
    io.observe(band)
    const onVis = () => (document.hidden ? holds.current.add('hidden') : holds.current.delete('hidden'))
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const step = (dir: 1 | -1) => {
    const w = setWidth.current
    const count = items.length
    if (!w || !count) return
    const stepPx = w / count
    // Next (dir 1) moves the row left. Land on a card boundary.
    const base = glide.current ? glide.current.to : x.current
    const to = (Math.round(base / stepPx) - dir) * stepPx
    if (reducedRef.current) {
      glide.current = null
      x.current = to
      paint()
      return
    }
    glide.current = { from: x.current, to, start: performance.now() }
  }

  const cash: Array<{ id: string; card: ReactNode }> = [
    {
      id: 'instant',
      card: (
        <CashCard tag={t(s.prizes.cashTag)} title={t(s.features.instantTitle)}>
          <p className="pcard__amount">{formatPrize(campaign.instantPrize, lang)}</p>
          <p className="pcard__body">{t(s.features.instantBody)}</p>
        </CashCard>
      ),
    },
    {
      id: 'weekly-tier',
      card: (
        <CashCard tag={t(s.prizes.cashTag)} title={t(s.features.weeklyTitle)}>
          <p className="pcard__amount">{formatPrize(campaign.weeklyPrize1, lang)}</p>
          <p className="pcard__body">
            {t(s.features.weeklyTierBody).replace('{count}', String(campaign.weeklyPrize1Count))}
          </p>
        </CashCard>
      ),
    },
    {
      id: 'weekly-top',
      card: (
        <CashCard tag={t(s.prizes.cashTag)} title={t(s.features.weeklyTitle)}>
          <p className="pcard__amount">{formatPrize(campaign.weeklyPrize2, lang)}</p>
          <p className="pcard__body">
            {t(s.features.weeklyTopBody).replace('{count}', String(campaign.weeklyPrize2Count))}
          </p>
        </CashCard>
      ),
    },
  ]

  // Intrinsic sizes of the 640px rung, so each image reserves its space before loading.
  const cold: Array<{ stem: string; name: Str; w: number; h: number }> = [
    { stem: 'neck-fan', name: s.prizes.neckFan, w: 640, h: 519 },
    { stem: 'speaker-coolbox', name: s.prizes.coolbox, w: 640, h: 667 },
    { stem: 'silver-jacket', name: s.prizes.jacket, w: 640, h: 785 },
    { stem: 'rapid-chiller', name: s.prizes.chiller, w: 640, h: 977 },
  ]

  const items: Array<{ id: string; card: ReactNode; backNote?: string }> = [
    ...cash,
    ...cold.map((p) => ({
      id: p.stem,
      backNote: t(s.prizes.inBar),
      card: (
        <article className="pcard pcard--cold">
          <p className="pcard__tag">{t(s.prizes.coldTag)}</p>
          <h4 className="pcard__title">{t(p.name)}</h4>
          {/* The badge only shows on the flipped (aria-hidden) back, so say it here too. */}
          <p className="visually-hidden">{t(s.prizes.inBar)}</p>
          <picture className="pcard__media">
            <source type="image/avif" srcSet={prizeSrcset(p.stem, 'avif')} sizes={PRIZE_SIZES} />
            <img
              src={`/prizes/${p.stem}-320.webp`}
              srcSet={prizeSrcset(p.stem, 'webp')}
              sizes={PRIZE_SIZES}
              width={p.w}
              height={p.h}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          </picture>
        </article>
      ),
    })),
  ]

  const set = (copy: boolean) => (
    <ul
      ref={copy ? undefined : setRef}
      className="marquee__set"
      aria-hidden={copy || undefined}
    >
      {items.map((item) => (
        <li key={item.id}>
          <PrizeFlip card={item.card} backNote={item.backNote} />
        </li>
      ))}
    </ul>
  )

  return (
    <div ref={bandRef} className="prizes on-dark" id="unlock" role="region" aria-labelledby="unlock-h2">
      <div className="wrap prizes__head">
        <h2 id="unlock-h2">{t(s.prizes.h2)}</h2>
      </div>

      <div
        className="marquee"
        onPointerEnter={(e) => e.pointerType === 'mouse' && holds.current.add('hover')}
        onPointerLeave={() => holds.current.delete('hover')}
        onFocus={(e) => e.target.matches(':focus-visible') && holds.current.add('focus')}
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) holds.current.delete('focus')
        }}
      >
        <div ref={trackRef} className="marquee__track">
          {set(false)}
          {set(true)}
        </div>
      </div>

      <div className="prizes__controls">
        <button type="button" className="ac-btn prizes__btn" onClick={() => step(-1)} aria-label={t(s.prizes.prev)}>
          <IconChevron dir="left" />
        </button>
        <button
          type="button"
          className="ac-btn prizes__btn prizes__btn--pause"
          onClick={() => setPaused((p) => !p)}
          aria-label={t(paused ? s.prizes.play : s.prizes.pause)}
        >
          {paused ? <IconPlay /> : <IconPause />}
        </button>
        <button type="button" className="ac-btn prizes__btn" onClick={() => step(1)} aria-label={t(s.prizes.next)}>
          <IconChevron dir="right" />
        </button>
      </div>
    </div>
  )
}

/**
 * The lineup cards' 3D flip, on a prize: hover (tap on touch screens) turns the card over
 * to a Jolt Blue back. The back repeats the card and, for Extra Cold prizes, adds the
 * "available during in-bar activities" badge (also given to screen readers on the front).
 */
function PrizeFlip({ card, backNote }: { card: ReactNode; backNote?: string }) {
  const [flipped, setFlipped] = useState(false)
  return (
    <div
      className={`pflip${flipped ? ' is-flipped' : ''}`}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') setFlipped((f) => !f)
      }}
    >
      <div className="pflip__inner">
        <div className="pflip__side">{card}</div>
        <div className="pflip__side pflip__side--back" aria-hidden="true">
          {card}
          {backNote && <p className="pcard-note">{backNote}</p>}
        </div>
      </div>
    </div>
  )
}

function CashCard({ tag, title, children }: { tag: string; title: string; children: ReactNode }) {
  return (
    <article className="pcard pcard--cash">
      <p className="pcard__tag">{tag}</p>
      <h4 className="pcard__title">{title}</h4>
      {children}
    </article>
  )
}
