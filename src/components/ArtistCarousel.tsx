import { memo, useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, FocusEvent, KeyboardEvent, PointerEvent, RefObject } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { ARTIST_WIDTHS, artists, type ArtistSlide } from '../config/artists'
import { usePrefersReducedMotion } from '../lib/hooks'
import { IconChevron, IconPause, IconPlay } from './Icons'

/**
 * Headline-artist carousel, in the hero beside the campaign headline.
 *
 * Every slide is one complete artwork — photo, scrim, snowcastle, both logos, name and
 * supporting line live inside the same slide element and move under one transform, so
 * one artist's copy or logo can never be on screen over another artist's photo.
 *
 * Motion runs on a single continuous position (`pos`, in slides). Drag, autoplay and
 * button presses all animate that one number, and a single rAF writer turns it into
 * transforms. Nothing per-frame goes through React state; state only changes when the
 * active slide changes (for the dots and aria) or when the user pauses.
 */

const HOLD_MS = 2000 // how long each artwork rests before the next one moves in
const SLIDE_MS = 780
const FADE_MS = 360 // prefers-reduced-motion: fade through, no movement
const RESUME_MS = 3500 // quiet period after the user swipes or presses a control
const PARALLAX = 14 // % of the slide width the photo lags behind its overlay
const DRAG_COMMIT = 0.15 // fraction of a slide the user must drag to change artist
const FLICK = 0.35 // px/ms — a faster release changes artist regardless of distance

const COUNT = artists.length
const wrap = (v: number) => ((v % COUNT) + COUNT) % COUNT
/** Slide i's offset from the viewport, folded into [-COUNT/2, COUNT/2) so the loop is seamless. */
const offsetOf = (i: number, pos: number) => {
  const o = wrap(i - pos)
  return o >= COUNT / 2 ? o - COUNT : o
}
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOut = (t: number) => 1 - (1 - t) ** 3

// Rendered width of the photo, not the tile: a square source under `cover` in the 4:5
// phone tile is as wide as the tile is tall. Tile widths are set by .hero__inner.
const SIZES = '(min-width: 960px) 540px, (min-width: 720px) calc(50vw - 35px), calc((100vw - 40px) * 1.25)'
const srcset = (image: string, ext: 'avif' | 'webp') =>
  ARTIST_WIDTHS.map((w) => `/artists/${image}-${w}.${ext} ${w}w`).join(', ')

type Hold = 'user' | 'focus' | 'drag' | 'hidden' | 'offscreen'

interface Drag {
  id: number
  x0: number
  y0: number
  base: number
  active: boolean
  lastX: number
  lastT: number
  v: number
}

export function ArtistCarousel() {
  const { s, t, lang } = useLang()
  const reduced = usePrefersReducedMotion()

  const [index, setIndex] = useState(0)
  const [userPaused, setUserPaused] = useState(false)
  const [focusPaused, setFocusPaused] = useState(false)
  const [nearView, setNearView] = useState(false)
  const [dragging, setDragging] = useState(false)

  const rootRef = useRef<HTMLElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const slideEls = useRef<(HTMLDivElement | null)[]>([])
  const photoEls = useRef<(HTMLDivElement | null)[]>([])
  const imgEls = useRef<(HTMLImageElement | null)[]>([])

  const pos = useRef(0)
  const raf = useRef(0)
  const timer = useRef(0)
  const holds = useRef(new Set<Hold>(['offscreen']))
  const nextDelay = useRef(HOLD_MS)
  const drag = useRef<Drag | null>(null)
  const reducedRef = useRef(reduced)

  const render = useCallback((p: number) => {
    const still = reducedRef.current
    for (let i = 0; i < COUNT; i++) {
      const slide = slideEls.current[i]
      const photo = photoEls.current[i]
      if (!slide || !photo) continue
      const o = offsetOf(i, p)
      if (still) {
        // Fade through the brand blue rather than cross-dissolving, so two artworks
        // are never superimposed.
        slide.style.transform = ''
        photo.style.transform = ''
        slide.style.opacity = String(Math.max(0, 1 - 2 * Math.abs(o)))
      } else {
        slide.style.opacity = ''
        slide.style.transform = `translate3d(${o * 100}%,0,0)`
        photo.style.transform = `translate3d(${-o * PARALLAX}%,0,0)`
      }
      slide.style.visibility = Math.abs(o) >= 1 ? 'hidden' : ''
    }
  }, [])

  const clearTimer = () => {
    window.clearTimeout(timer.current)
    timer.current = 0
  }

  // Declared as refs-backed functions so listeners and timers always see current logic
  // without re-subscribing. `schedule` is the only place a timer is ever created.
  const api = useRef({
    schedule: (_delay?: number) => {},
    animateTo: (_target: number, _ms: number, _ease?: (t: number) => number) => {},
  })

  api.current.schedule = (delay = nextDelay.current) => {
    clearTimer()
    if (holds.current.size > 0 || raf.current) return
    nextDelay.current = HOLD_MS
    timer.current = window.setTimeout(advance, delay)
  }

  const advance = async () => {
    timer.current = 0
    const base = Math.round(pos.current)
    const img = imgEls.current[wrap(base + 1)]
    // Never move to an artwork that hasn't loaded — check again shortly instead.
    if (!img || !(img.complete && img.naturalWidth > 0)) {
      api.current.schedule(400)
      return
    }
    try {
      await img.decode()
    } catch {
      /* already decoded, or decode unsupported — safe to proceed */
    }
    if (holds.current.size > 0 || raf.current || timer.current) return
    api.current.animateTo(base + 1, reducedRef.current ? FADE_MS : SLIDE_MS)
  }

  api.current.animateTo = (target, ms, ease = easeInOut) => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
    clearTimer()
    const from = pos.current
    setIndex(wrap(Math.round(target)))

    const settle = () => {
      raf.current = 0
      pos.current = wrap(Math.round(pos.current))
      render(pos.current)
      api.current.schedule()
    }

    if (Math.abs(target - from) < 1e-3) {
      pos.current = target
      settle()
      return
    }
    const start = performance.now()
    const frame = (now: number) => {
      const k = Math.min(1, (now - start) / ms)
      pos.current = from + (target - from) * ease(k)
      render(pos.current)
      if (k < 1) raf.current = requestAnimationFrame(frame)
      else settle()
    }
    raf.current = requestAnimationFrame(frame)
  }

  const hold = useCallback((reason: Hold) => {
    holds.current.add(reason)
    clearTimer()
  }, [])

  const release = useCallback((reason: Hold) => {
    if (!holds.current.delete(reason)) return
    if (holds.current.size === 0) api.current.schedule()
  }, [])

  /** Manual navigation: move, then give the user a longer quiet period before autoplay. */
  const go = useCallback((target: number, ms: number, ease?: (t: number) => number) => {
    nextDelay.current = RESUME_MS
    api.current.animateTo(target, ms, ease)
  }, [])

  const step = useCallback(
    (dir: 1 | -1) => go(Math.round(pos.current) + dir, reducedRef.current ? FADE_MS : SLIDE_MS),
    [go],
  )

  const showIndex = useCallback(
    (i: number) => {
      const base = Math.round(pos.current)
      go(base + offsetOf(i, base), reducedRef.current ? FADE_MS : SLIDE_MS)
    },
    [go],
  )

  // Reduced-motion preference can change live; repaint in the new mode.
  useEffect(() => {
    reducedRef.current = reduced
    render(pos.current)
  }, [reduced, render])

  // Initial paint + teardown. Every timer, frame and listener dies with the component.
  useEffect(() => {
    render(pos.current)
    return () => {
      cancelAnimationFrame(raf.current)
      raf.current = 0
      clearTimer()
    }
  }, [render])

  // Autoplay only while the carousel is on screen and the tab is visible.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) release('offscreen')
        else hold('offscreen')
      },
      { threshold: 0.2 },
    )
    io.observe(root)

    // Separate, wider observer: start fetching the other artworks before they're needed.
    const preload = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setNearView(true)
          preload.disconnect()
        }
      },
      { rootMargin: '400px 0px' },
    )
    preload.observe(root)

    const onVisibility = () => (document.hidden ? hold('hidden') : release('hidden'))
    onVisibility()
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      io.disconnect()
      preload.disconnect()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [hold, release])

  // Horizontal trackpad swipes. Native listener: it has to be non-passive to stop the
  // browser treating a two-finger swipe as back/forward navigation.
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    let acc = 0
    let lockUntil = 0
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return
      e.preventDefault()
      const now = performance.now()
      if (now < lockUntil) return
      acc += e.deltaX
      if (Math.abs(acc) > 40) {
        step(acc > 0 ? 1 : -1)
        acc = 0
        lockUntil = now + 650
      }
    }
    stage.addEventListener('wheel', onWheel, { passive: false })
    return () => stage.removeEventListener('wheel', onWheel)
  }, [step])

  /* ── Pointer drag ─────────────────────────────────────────────────────────── */

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    drag.current = {
      id: e.pointerId,
      x0: e.clientX,
      y0: e.clientY,
      base: pos.current,
      active: false,
      lastX: e.clientX,
      lastT: e.timeStamp,
      v: 0,
    }
  }

  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    const stage = stageRef.current
    if (!d || d.id !== e.pointerId || !stage) return

    if (!d.active) {
      const dx = e.clientX - d.x0
      const dy = e.clientY - d.y0
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      if (Math.abs(dy) > Math.abs(dx)) {
        drag.current = null // vertical intent — leave it to the page scroll
        return
      }
      d.active = true
      stage.setPointerCapture(e.pointerId)
      cancelAnimationFrame(raf.current) // catch the artwork mid-transition
      raf.current = 0
      d.base = pos.current
      d.x0 = e.clientX
      hold('drag')
      setDragging(true)
    }

    pos.current = d.base - (e.clientX - d.x0) / stage.clientWidth
    render(pos.current)
    const dt = e.timeStamp - d.lastT
    if (dt > 0) d.v = 0.7 * ((e.clientX - d.lastX) / dt) + 0.3 * d.v
    d.lastX = e.clientX
    d.lastT = e.timeStamp
  }

  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    drag.current = null
    if (!d.active) return
    setDragging(false)

    const moved = pos.current - d.base
    const flick = Math.abs(d.v) > FLICK
    let target = Math.round(d.base)
    if (!cancelled && (flick || Math.abs(moved) > DRAG_COMMIT)) {
      target += (flick ? -d.v : moved) > 0 ? 1 : -1
    }
    const remaining = Math.abs(target - pos.current)
    const ms = reducedRef.current ? FADE_MS : Math.max(260, Math.min(620, remaining * SLIDE_MS))
    holds.current.delete('drag')
    go(target, ms, easeOut)
  }

  /* ── Keyboard + focus ─────────────────────────────────────────────────────── */

  const onKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      step(1)
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      step(-1)
    }
  }

  // Keyboard focus inside the carousel stops rotation (WAI-ARIA carousel pattern), so
  // screen-reader and keyboard users aren't chasing a moving target. Mouse clicks on
  // the controls don't count — that would silently stop autoplay for pointer users.
  const onFocus = (e: FocusEvent<HTMLElement>) => {
    if (e.target instanceof HTMLElement && e.target.matches(':focus-visible')) {
      hold('focus')
      setFocusPaused(true)
    }
  }
  const onBlur = (e: FocusEvent<HTMLElement>) => {
    if (rootRef.current?.contains(e.relatedTarget as Node | null)) return
    setFocusPaused(false)
    release('focus')
  }

  const togglePause = () => {
    if (userPaused) {
      setUserPaused(false)
      release('user')
    } else {
      setUserPaused(true)
      hold('user')
    }
  }

  // Load the active artwork and both neighbours once the carousel is near the viewport;
  // before that only the first artwork is requested.
  const shouldLoad = (i: number) =>
    i === 0 || (nearView && (i === index || i === wrap(index + 1) || i === wrap(index - 1)))

  const announce = userPaused || focusPaused

  return (
    <article
      ref={rootRef}
      className="artist-carousel on-dark"
      aria-roledescription={t(s.carousel.roleCarousel)}
      aria-label={t(s.carousel.label)}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div
        ref={stageRef}
        className={`ac-stage${dragging ? ' is-dragging' : ''}`}
        aria-live={announce ? 'polite' : 'off'}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={(e) => endDrag(e, false)}
        onPointerCancel={(e) => endDrag(e, true)}
      >
        {artists.map((artist, i) => (
          <Slide
            key={artist.id}
            artist={artist}
            i={i}
            active={i === index}
            load={shouldLoad(i)}
            label={`${i + 1} ${t(s.carousel.of)} ${COUNT}`}
            roleSlide={t(s.carousel.roleSlide)}
            alt={artist.alt[lang]}
            copy={artist.copy[lang]}
            slideEls={slideEls}
            photoEls={photoEls}
            imgEls={imgEls}
          />
        ))}
      </div>

      <div className="ac-controls">
        <button
          type="button"
          className="ac-btn"
          onClick={togglePause}
          aria-label={t(userPaused ? s.carousel.play : s.carousel.pause)}
        >
          {userPaused ? <IconPlay /> : <IconPause />}
        </button>

        <div className="ac-dots">
          {artists.map((artist, i) => (
            <button
              key={artist.id}
              type="button"
              className="ac-dot"
              aria-label={`${t(s.carousel.show)} ${artist.name}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => showIndex(i)}
            />
          ))}
        </div>

        <button type="button" className="ac-btn" onClick={() => step(-1)} aria-label={t(s.carousel.prev)}>
          <IconChevron dir="left" />
        </button>
        <button type="button" className="ac-btn" onClick={() => step(1)} aria-label={t(s.carousel.next)}>
          <IconChevron dir="right" />
        </button>
      </div>
    </article>
  )
}

interface SlideProps {
  artist: ArtistSlide
  i: number
  active: boolean
  load: boolean
  label: string
  roleSlide: string
  alt: string
  copy: string
  slideEls: RefObject<(HTMLDivElement | null)[]>
  photoEls: RefObject<(HTMLDivElement | null)[]>
  imgEls: RefObject<(HTMLImageElement | null)[]>
}

/** One artwork. Memoised: a slide change re-renders only the two slides whose `active` flips. */
const Slide = memo(function Slide({
  artist,
  i,
  active,
  load,
  label,
  roleSlide,
  alt,
  copy,
  slideEls,
  photoEls,
  imgEls,
}: SlideProps) {
  const vars = {
    '--tone': artist.tone,
    '--focal-m': artist.focal.mobile,
    '--focal-t': artist.focal.tablet,
    '--focal-d': artist.focal.desktop,
  } as CSSProperties

  return (
    <div
      ref={(el) => {
        slideEls.current[i] = el
      }}
      className="ac-slide"
      role="group"
      aria-roledescription={roleSlide}
      aria-label={label}
      aria-hidden={!active}
      style={vars}
    >
      <div
        ref={(el) => {
          photoEls.current[i] = el
        }}
        className="ac-photo"
      >
        {load && (
          <picture>
            <source type="image/avif" srcSet={srcset(artist.image, 'avif')} sizes={SIZES} />
            <img
              ref={(el) => {
                imgEls.current[i] = el
              }}
              src={`/artists/${artist.image}-768.webp`}
              srcSet={srcset(artist.image, 'webp')}
              sizes={SIZES}
              width={1440}
              height={1440}
              alt={alt}
              // The first artwork is above the fold now — let it compete with the plate.
              fetchPriority={i === 0 ? 'high' : 'auto'}
              decoding="async"
              draggable={false}
            />
          </picture>
        )}
      </div>

      {/* Programmatic overlay, measured from "00 - Assets/Plate Style.png". */}
      <span className="ac-scrim" aria-hidden="true" />
      <img className="ac-castle" src="/brand/snowcastle-white.svg" alt="" draggable={false} />
      <img className="ac-banner" src="/brand/castle-lite-banner.svg" alt="" draggable={false} />
      <img
        className="ac-unlocks"
        src={artist.logoVariant === 'blue' ? '/brand/unlocks-blue.svg' : '/brand/unlocks-white.svg'}
        alt=""
        draggable={false}
      />
      <div className="ac-copy">
        <p className="ac-name">
          <span>{artist.name}</span>
        </p>
        <p className="ac-line">{copy}</p>
      </div>
    </div>
  )
})
