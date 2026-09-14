import { useLang } from '../i18n/LanguageContext'
import { ArtistCarousel } from './ArtistCarousel'
import { CastleLiteLogo, UnlocksLockup } from './BrandMark'
import { LanguageToggle } from './LanguageToggle'

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
 * Section 1 — hero. The campaign headline ("Castle Lite Unlocks is back!") with the
 * headline-artist carousel beside it. Code entry is the next section (CodeEntry).
 *
 * The Unlocks lockup is the first half of the H1, so its alt text is the brand name
 * and the heading reads "Castle Lite Unlocks Is back!" to assistive tech.
 */
export function Hero() {
  const { s, t } = useLang()

  return (
    <section className="hero on-dark" aria-labelledby="hero-h1">
      <div className="wrap hero__inner">
        <div className="hero__headline">
          <h1 id="hero-h1" className="hero__title">
            <UnlocksLockup className="hero__brand" label={t(s.hero.brand)} />
            <span className="hero__back">{t(s.hero.comeback)}</span>
          </h1>
          <p className="hero__date">
            <span>{t(s.hero.nextShow)}</span>
          </p>
        </div>

        <ArtistCarousel />
      </div>
    </section>
  )
}
