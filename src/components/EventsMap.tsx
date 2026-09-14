import { useEffect, useState } from 'react'
import type { CSSProperties, PointerEvent, ReactNode } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { campaign, type Locale, type MegaEvent } from '../config/campaign'
import { artists } from '../config/artists'
import { now } from '../lib/serverTime'
import { DayMonth } from './DayMonth'

/**
 * Mega Events — after Find Us On the Ground. A full-width dark band with an interactive map of Tanzania.
 *
 * The lineup panel rests on the city with a confirmed lineup (Mwanza). Hovering another
 * city's pin — or tapping it on a touch screen, or tabbing to it — previews that city,
 * which without a lineup is the snowcastle loading state. Moving off the pin, tapping
 * anywhere else or tabbing away returns the panel to Mwanza.
 *
 * The map is "00 - Assets/PNG/TZ MAP.png", cropped by scripts/build-assets.py (MAP_CROP).
 * Pins are placed from each event's real coordinates: the artwork is equirectangular,
 * and fitting its mainland extremes (1.0°S, 11.75°S, 29.33°E, 40.44°E) gives
 * 136.5 px/° across and 137.0 px/° down — square to within 0.4%, which is what
 * confirms the projection.
 */

/** Crop size in source pixels, and where 0.99°S / 29.33°E fall inside that crop. */
const MAP_ART = { width: 1740, height: 1570 }
const CAL = { x0: 75, lon0: 29.33, pxPerLon: 136.45, y0: 31, lat0: -0.99, pxPerLat: 136.99 }

const pinStyle = ([lat, lon]: [number, number]): CSSProperties => ({
  left: `${((CAL.x0 + (lon - CAL.lon0) * CAL.pxPerLon) / MAP_ART.width) * 100}%`,
  top: `${((CAL.y0 + (CAL.lat0 - lat) * CAL.pxPerLat) / MAP_ART.height) * 100}%`,
})

/** Which side of its pin a city label sits on, so labels stay clear of each other. */
const LABEL_SIDE: Record<string, 'left' | 'right' | 'top' | 'bottom'> = {
  e1: 'bottom',
  e2: 'left',
  e3: 'top',
  e4: 'right',
}

const MAP_WIDTHS = [560, 760, 1100]
const MAP_SIZES = '(min-width: 960px) 620px, min(640px, calc(100vw - 40px))'
const mapSrcset = (ext: 'avif' | 'webp') =>
  MAP_WIDTHS.map((w) => `/events/tz-map-${w}.${ext} ${w}w`).join(', ')

const artistName = (id: string) => artists.find((a) => a.id === id)?.name ?? id

export function EventsMap() {
  const { s, t, lang } = useLang()
  const events = campaign.events
  const restingId = (events.find((e) => e.lineup) ?? events[0]).id
  // The city being previewed, if any. Everything else shows the resting city.
  const [previewId, setPreviewId] = useState<string | null>(null)
  const activeId = previewId ?? restingId
  const active = events.find((e) => e.id === activeId) ?? events[0]

  const preview = (id: string | null) => setPreviewId(id === restingId ? null : id)

  // A tap outside the pins ends a touch preview (there is no pointer-leave to do it).
  useEffect(() => {
    if (!previewId) return
    const onDown = (e: Event) => {
      if (!(e.target instanceof Element && e.target.closest('.map__pin'))) setPreviewId(null)
    }
    document.addEventListener('pointerdown', onDown)
    return () => document.removeEventListener('pointerdown', onDown)
  }, [previewId])

  const onPointerEnter = (e: PointerEvent, id: string) => {
    if (e.pointerType === 'mouse') preview(id)
  }
  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') setPreviewId(null)
  }

  return (
    <section className="section mega on-dark" id="events" aria-labelledby="events-h2">
      <div className="wrap">
        <h2 id="events-h2" className="mega__title">
          {t(s.events.heading)}
        </h2>

        <div className="mega__layout">
          <div className="map">
            <div className="map__art">
              <picture>
                <source type="image/avif" srcSet={mapSrcset('avif')} sizes={MAP_SIZES} />
                <img
                  src="/events/tz-map-760.webp"
                  srcSet={mapSrcset('webp')}
                  sizes={MAP_SIZES}
                  width={MAP_ART.width}
                  height={MAP_ART.height}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                />
              </picture>

              {events.map((e) => (
                <button
                  key={e.id}
                  type="button"
                  className={`map__pin map__pin--${LABEL_SIDE[e.id] ?? 'right'}`}
                  style={pinStyle(e.coords)}
                  aria-pressed={e.id === activeId}
                  aria-controls="mega-lineup"
                  onPointerEnter={(ev) => onPointerEnter(ev, e.id)}
                  onPointerLeave={onPointerLeave}
                  onFocus={() => preview(e.id)}
                  onBlur={() => setPreviewId(null)}
                  onClick={() => preview(e.id)}
                >
                  <span className="map__dot" aria-hidden="true" />
                  <span className="map__label">{e.city}</span>
                </button>
              ))}
            </div>
            <p className="map__hint">{t(s.events.hint)}</p>
          </div>

          <div className="lineup" id="mega-lineup">
            <p className="visually-hidden" aria-live="polite">
              {`${t(s.events.showing)}: ${active.city}`}
            </p>
            {/* Every city's panel is rendered into the same grid cell, so the column is
                always as tall as the tallest lineup and switching cities never moves
                the layout. Only the active one is visible or exposed. */}
            {events.map((e) => (
              <CityPanel key={e.id} event={e} active={e.id === activeId} lang={lang} />
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

function CityPanel({ event, active, lang }: { event: MegaEvent; active: boolean; lang: Locale }) {
  const { s, t } = useLang()
  const { lineup } = event

  return (
    <div className={`lineup__panel${active ? ' is-active' : ''}`} aria-hidden={!active}>
      <h3 className="lineup__city">{event.city}</h3>

      {lineup ? (
        <ul className="lcards">
          {event.date && (
            <FlipCard variant="date" axis="x" label={t(s.events.date)} back={<DaysToGo date={event.date} lang={lang} />}>
              <p className="lcard__value lcard__value--strong">
                <DayMonth iso={event.date} lang={lang} />
              </p>
            </FlipCard>
          )}

          <FlipCard
            variant="venue"
            axis="x"
            label={t(s.events.venue)}
            back={
              <p className="lcard__meta">
                <IconPin /> {event.city}
              </p>
            }
          >
            <p className="lcard__value lcard__value--strong">{event.venue}</p>
          </FlipCard>

          <FlipCard
            variant="headliners"
            axis="y"
            label={t(s.events.headliners)}
            back={
              <span className="coin" aria-hidden="true">
                <span className="coin__inner">
                  {lineup.headliners.map((id) => {
                    const artist = artists.find((a) => a.id === id)
                    if (!artist) return null
                    const [fx, fy] = artist.face
                    return (
                      <img
                        key={id}
                        className="coin__img"
                        src={`/artists/${artist.image}-480.webp`}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        style={{ left: `${50 - fx * 300}%`, top: `${50 - fy * 300}%` }}
                      />
                    )
                  })}
                </span>
              </span>
            }
          >
            <p className="lcard__value lcard__value--strong">
              {lineup.headliners.map((id) => (
                <span key={id}>{artistName(id)}</span>
              ))}
            </p>
          </FlipCard>

          <FlipCard variant="djs" axis="y" label={t(s.events.djs)}>
            <p className="lcard__value">
              {lineup.djs.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </p>
          </FlipCard>

          <FlipCard variant="hosts" axis="y" label={t(s.events.hosts)}>
            <p className="lcard__value">
              {lineup.hosts.map((name) => (
                <span key={name}>{name}</span>
              ))}
            </p>
          </FlipCard>
        </ul>
      ) : (
        <div className="lineup__loading">
          <span className="loader" aria-hidden="true">
            <svg className="loader__ring" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="54" />
            </svg>
            <img className="loader__castle" src="/brand/snowcastle-white.svg" alt="" />
          </span>
          <p className="lineup__caption">{t(s.events.loading)}</p>
        </div>
      )}
    </div>
  )
}

/**
 * A lineup card that tumbles over on hover (tap on touch screens) to a glowing Jolt Blue
 * back. Both faces carry the full information — the back only adds a flourish — so
 * nothing is hidden behind the interaction, and the back face is aria-hidden.
 */
function FlipCard({
  variant,
  axis,
  label,
  back,
  children,
}: {
  variant: string
  axis: 'x' | 'y'
  label: string
  back?: ReactNode
  children: ReactNode
}) {
  const [flipped, setFlipped] = useState(false)
  return (
    <li
      className={`lcard lcard--${variant} lcard--${axis}${flipped ? ' is-flipped' : ''}`}
      onPointerUp={(e) => {
        if (e.pointerType !== 'mouse') setFlipped((f) => !f)
      }}
    >
      <div className="lcard__inner">
        <div className="lcard__side lcard__side--front">
          <h4 className="lcard__label">{label}</h4>
          {children}
        </div>
        <div className="lcard__side lcard__side--back" aria-hidden="true">
          <p className="lcard__label">{label}</p>
          {children}
          {back}
        </div>
      </div>
    </li>
  )
}

function DaysToGo({ date, lang }: { date: string; lang: Locale }) {
  const { s, t } = useLang()
  const days = Math.ceil((new Date(`${date}T00:00:00+03:00`).getTime() - now()) / 86_400_000)
  if (days <= 0) return null
  return <p className="lcard__meta">{lang === 'sw' ? `${t(s.countdown.days)} ${days}` : `${days} ${t(s.countdown.days)}`}</p>
}

const IconPin = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" fill="currentColor" />
  </svg>
)
