import { useLang } from '../i18n/LanguageContext'
import { useMediaQuery, usePrefersReducedMotion } from '../lib/hooks'
import { ArtistPopIn } from './ArtistPopIn'
import { revealable } from '../config/talents'
import { CastleLiteLogo, UnlocksLockup } from './BrandMark'
import { LanguageToggle } from './LanguageToggle'
import { Fireworks } from './Fireworks'

/** Sticky top bar: Castle Lite lockup left, language toggle pinned top-right. */
export function SiteHeader() {
  return (
    <header className="langbar on-dark">
      <div className="wrap langbar__inner">
        <CastleLiteLogo variant="header" />
        <LanguageToggle />
      </div>
    </header>
  )
}

/**
 * Section 1 — hero. The campaign lockup as set on the Arusha artboard (01 - ARUSHA/
 * LOCK UP.ai): the stacked Unlocks lockup, NYE, the date and ARUSHA on its green bar,
 * with the Arusha line-up popping in beside it. Code entry is the next section (CodeEntry).
 *
 * The Unlocks lockup is the first half of the H1, so its alt text is the brand name
 * and the heading reads "Castle Lite Unlocks NYE" to assistive tech.
 */
export function Hero() {
  const { s, t } = useLang()
  // Until a talent cut-out clears, the line-up renders nothing — so the hero
  // must drop to one column rather than hold open an empty second one.
  const hasLineUp = revealable().length > 0

  // The background loop is motion the reader cannot pause, so it is not rendered
  // at all under prefers-reduced-motion — not merely hidden, which would still
  // download and decode it. The still plate on .hero::before shows through.
  const reduced = usePrefersReducedMotion()
  // Phones get the portrait cut: `cover` on the 21:9 file would crop it to a
  // narrow centre strip, the same reason the still plate has a portrait crop.
  const tall = useMediaQuery('(max-width: 719px)')
  const loop = tall ? 'tunnel-tall' : 'tunnel-wide'

  return (
    <section className={`hero on-dark${reduced ? '' : ' hero--loop'}`} aria-labelledby="hero-h1">
      {!reduced && (
        // Decorative, so it is hidden from assistive tech and carries no label.
        // `key` remounts it on the breakpoint change so the browser re-reads src.
        <video
          key={loop}
          className="hero__video"
          poster={`/hero/${loop}-poster.webp`}
          src={`/hero/${loop}.mp4`}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
        />
      )}
      {/* New Year's Eve shells around the lock-up. The canvas spans the whole hero
          so no burst is clipped; motion the reader cannot pause, so like the loop
          it is not mounted under reduced motion. */}
      {!reduced && <Fireworks className="hero__fireworks" around=".hero__headline" />}
      <div className={`wrap hero__inner${hasLineUp ? '' : ' hero__inner--solo'}`}>
        <div className="hero__headline">
          <h1 id="hero-h1" className="hero__title">
            <UnlocksLockup stacked className="hero__brand" label={t(s.hero.brand)} />
            {/* NYE in carved ice (00 - Assets/Name Marks/nye.png), its depth hanging
                straight down. The alt keeps the H1 reading "Castle Lite Unlocks NYE". */}
            <span className="hero__back hero__back--ice">
              <img
                src="/brand/nye-ice-800.webp"
                srcSet="/brand/nye-ice-500.webp 500w, /brand/nye-ice-800.webp 800w, /brand/nye-ice-1200.webp 1200w"
                sizes="(min-width: 720px) 450px, 320px"
                width={1341}
                height={726}
                alt={t(s.hero.payoff)}
                fetchPriority="high"
              />
            </span>
          </h1>
          <p className="hero__date">
            <span aria-hidden="true">{t(s.hero.date)}</span>
            <span className="visually-hidden">{t(s.hero.dateFull)}</span>
          </p>
          <p className="hero__city">
            <span>{t(s.hero.nextShow)}</span>
          </p>
        </div>

        <ArtistPopIn />
      </div>
    </section>
  )
}
