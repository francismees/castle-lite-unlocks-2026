import { useLang } from '../i18n/LanguageContext'
import { campaign } from '../config/campaign'

/**
 * Section 4 — the hotline (was "Find Us On the Ground" until 24 Nov 2026).
 *
 * One job: get people with a question, or stuck buying a ticket, onto the phone line.
 * The campaign-region chips were removed with the rewrite. Consumer-facing framing
 * only; it must not state or imply that Bluetrain directs or manages the activations
 * partner (spec §0 Section 4).
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

        {/* One link: the number and the call-to-action read as a single "call" target. */}
        <a className="callout" href={`tel:${campaign.infoPhone.replace(/\s+/g, '')}`}>
          <span className="callout__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="24" height="24" focusable="false">
              <path
                d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1Z"
                fill="currentColor"
              />
            </svg>
          </span>
          <span className="callout__text">
            <span className="callout__number">{campaign.infoPhone}</span>
            <span className="callout__cta">{t(s.activation.callCta)}</span>
          </span>
        </a>
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
