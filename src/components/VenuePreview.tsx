import { useLang } from '../i18n/LanguageContext'
import { VenueEntry } from '../venue/VenueEntry'

/**
 * The home-screen way into the venue: a band between the line-up and the ticket
 * sections, where someone deciding whether to come is already asking what it will
 * look like.
 *
 * The button matches the tickets band's "Buy tickets" in size and weight, so the two
 * calls to action read as a pair down the right-hand edge.
 *
 * [CONTENT-PENDING] Working copy in both languages, not yet approved campaign copy.
 */
export function VenuePreview() {
  const { s, t } = useLang()
  return (
    <section className="venue-band on-dark" aria-labelledby="venue-h2">
      <div className="wrap venue-band__inner">
        <div>
          <h2 id="venue-h2" className="venue-band__title">
            {t(s.venueBand.heading)}
          </h2>
          <p className="venue-band__copy">{t(s.venueBand.copy)}</p>
        </div>
        <VenueEntry label={t(s.venueBand.cta)} className="btn btn--jolt venue-band__cta" />
      </div>
    </section>
  )
}
