import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { TALENT_WIDTHS, revealable } from '../config/talents'
import { ScrambleText } from './Scramble'
import { usePrefersReducedMotion } from '../lib/hooks'

/**
 * Hero line-up: one artist at a time, at full height, handing over to the next.
 *
 * The cut-outs are stacked on top of each other rather than set side by side, so
 * each one gets the whole column instead of a third of it. They are cropped waist-up
 * in the asset build, so the column buys face rather than legs. Only the current one
 * is visible; the swap is a crossfade where the outgoing artist drops back and
 * the incoming one rises into place, so the line-up reads as an introduction
 * rather than a slideshow.
 *
 * The transition is CSS on a single class, so the rotation costs the main thread
 * one class change every few seconds — which matters because this runs over the
 * hero's background video on mid-range Android.
 *
 * It only rotates while it is actually on screen. The observer is kept live
 * rather than disconnected after the first hit, so scrolling past the hero stops
 * the timer instead of leaving it running for the length of the page.
 *
 * prefers-reduced-motion stops the rotation outright and shows the first artist:
 * auto-advancing content is exactly the motion that preference asks us to drop,
 * and a crossfade on a timer would still be movement the reader cannot stop.
 */

/* The slot is the hero's right column: 660px from 1180, half the viewport between
   720 and 1180, and most of the width below that, where the line-up sits under the
   headline instead of beside it. No talent currently sets a `scale`, so the column
   is the widest the figure gets — if one does again, this has to allow for it, or
   the browser picks a rung off the scaled-up size. */
const SIZES = '(min-width: 1180px) 660px, (min-width: 720px) 46vw, 86vw'
const srcset = (stem: string, ext: 'avif' | 'webp') =>
  TALENT_WIDTHS.map((w) => `/talents/${stem}-${w}.${ext} ${w}w`).join(', ')


/** How long each artist holds the frame before handing over. */
const HOLD_MS = 2600
/** The surprise slot holds longer: ~2s of scramble and decode, then 4s to read it. */
const SURPRISE_HOLD_MS = 6000

export function ArtistPopIn() {
  const { s, t } = useLang()
  const reduced = usePrefersReducedMotion()
  const rootRef = useRef<HTMLDivElement>(null)
  const [inView, setInView] = useState(false)
  const [current, setCurrent] = useState(0)

  const line = revealable()

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    // No IntersectionObserver (old WebView): show it rather than never show it.
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true)
      return
    }
    const io = new IntersectionObserver((entries) => setInView(entries.some((e) => e.isIntersecting)), {
      rootMargin: '0px 0px -10% 0px',
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // A timeout per slide rather than one interval, so each can hold for its own time.
  useEffect(() => {
    if (reduced || !inView || line.length < 2) return
    const hold = line[current % line.length]?.surprise ? SURPRISE_HOLD_MS : HOLD_MS
    const id = window.setTimeout(() => setCurrent((n) => (n + 1) % line.length), hold)
    return () => window.clearTimeout(id)
  }, [reduced, inView, line, current])

  // Nothing cleared yet: render nothing at all rather than an empty frame.
  if (line.length === 0) return null

  const shown = reduced ? 0 : current

  return (
    <div ref={rootRef} className={`popin${inView ? ' is-in' : ''}`}>
      <ul className="popin__stack">
        {line.map((talent, i) => (
          <li key={talent.id} className={`popin__item${i === shown ? ' is-current' : ''}`}>
            <figure
              className="popin__fig"
              /* Per-talent size correction, not decoration — see `scale` in
                 config/talents. Left unset when it is 1 so the CSS default stands. */
              style={talent.scale ? ({ '--pop-scale': talent.scale } as CSSProperties) : undefined}
            >
              <picture>
                <source type="image/avif" srcSet={srcset(talent.cutout, 'avif')} sizes={SIZES} />
                <source type="image/webp" srcSet={srcset(talent.cutout, 'webp')} sizes={SIZES} />
                <img
                  className="popin__cut"
                  src={`/talents/${talent.cutout}-${TALENT_WIDTHS[1]}.webp`}
                  alt={talent.alt ? t(talent.alt) : talent.name}
                  /* Every cut-out is on screen within a few seconds of the hero
                     painting, so none of them is a candidate for lazy loading:
                     they are all in the viewport, and `lazy` would fetch them
                     immediately anyway. Priority is the lever that works here.
                     At the slot's 660 CSS px a 2x screen pulls the 1500 rung, so
                     the line-up is ~670 KB against the ~306 KB it was at the old
                     850 ceiling. Left to compete, all three load at once and the
                     hero paints a name over an empty frame — measured at ~1s.
                     Only the first is needed then; the others are 2.6s and 5.2s
                     out, which is several times their own download. */
                  loading="eager"
                  fetchPriority={i === 0 ? 'high' : 'low'}
                  decoding="async"
                />
              </picture>
              {/* One plate per line. The break comes from `nameLines` in
                  config/talents, never from the column width — see there. */}
              {talent.surprise ? (
                <figcaption className="popin__name popin__name--surprise">
                  {/* Restarts each time the slide comes round: it decodes on arrival. */}
                  {[t(s.events.surprise).split(' ')[0], `${t(s.events.surprise).split(' ').slice(1).join(' ')}?`].map((w, n) => (
                    <span key={n} className="popin__word">
                      <ScrambleText word={w.toUpperCase()} running={i === shown && inView && !reduced} loop={false} />
                    </span>
                  ))}
                  <span className="popin__load" aria-hidden="true" />
                  <span className="visually-hidden">{t(s.events.surpriseSr)}</span>
                </figcaption>
              ) : (
                <figcaption className="popin__name">
                  {(talent.nameLines ?? [talent.name]).map((lineText, n) => (
                    <span key={n} className="popin__word">{lineText}</span>
                  ))}
                </figcaption>
              )}
            </figure>
          </li>
        ))}
      </ul>
    </div>
  )
}
