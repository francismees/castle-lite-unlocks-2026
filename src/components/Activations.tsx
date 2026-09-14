import { useLang } from '../i18n/LanguageContext'
import { campaign } from '../config/campaign'

/**
 * Section 4 — Find Us On the Ground.
 *
 * Consumer-facing framing only. This section describes where to find the campaign in
 * real life; it must not state or imply that Bluetrain directs or manages the
 * activations partner (spec §0 Section 4). Region chips are display-only, not filters.
 *
 * The ambassadors cut-out sits on the section's bottom edge, to the right of the copy on
 * desktop (where the centre ambassador's head rises slightly into the section above) and
 * below it on phones.
 */

const ART_WIDTHS = [640, 1000, 1400]
const ART_SIZES = '(min-width: 960px) 680px, min(100vw, 560px)'
const artSrcset = (ext: 'avif' | 'webp') =>
  ART_WIDTHS.map((w) => `/brand/ambassadors-${w}.${ext} ${w}w`).join(', ')
export function Activations() {
  const { s, t } = useLang()

  return (
    <section className="section section--ice activations" id="activations" aria-labelledby="act-h2">
      <div className="wrap activations__copy">
        <div className="section__head">
          <h2 id="act-h2">{t(s.activation.h2)}</h2>
          <p className="section__lede">{t(s.activation.body)}</p>
        </div>

        <ul className="chips" aria-label={t(s.activation.regionsLabel)}>
          {campaign.regions.map((r) => (
            <li className="chip" key={r}>
              {r}
            </li>
          ))}
        </ul>
      </div>

      <div className="activations__art">
        <picture>
          <source type="image/avif" srcSet={artSrcset('avif')} sizes={ART_SIZES} />
          <img
            src="/brand/ambassadors-1000.webp"
            srcSet={artSrcset('webp')}
            sizes={ART_SIZES}
            width={1400}
            height={964}
            alt={t(s.activation.ambassadorsAlt)}
            loading="lazy"
            decoding="async"
            draggable={false}
          />
        </picture>
      </div>
    </section>
  )
}
