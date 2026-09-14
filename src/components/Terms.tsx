import { useId, useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { campaign, formatDate } from '../config/campaign'
import { TERMS_PLACEHOLDER, TERMS_TITLE, termsClauses } from '../config/terms'

/**
 * Section 5 — Terms & Conditions.
 *
 * On-page accordion rather than a linked PDF: the one-page constraint, mobile users on
 * metered data, and the requirement that GBT-approved copy is verifiably present at the
 * point of entry (spec §4).
 *
 * A Swahili plain-language summary sits above the accordion; the English legal text
 * inside it is authoritative. [CONTENT-PENDING: SW summary sign-off]
 */
export function Terms() {
  const { s, t, lang } = useLang()
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const buttonId = useId()

  const summary = t(s.terms.plainSummary)
    .replace('{start}', formatDate(campaign.campaignStart, lang))
    .replace('{end}', formatDate(campaign.campaignEnd, lang))

  return (
    <section className="section section--white" id="terms" aria-labelledby="terms-h2">
      <div className="wrap">
        <div className="section__head terms__head">
          <h2 id="terms-h2">{t(s.terms.h2)}</h2>
          <p className="section__lede terms__summary">{summary}</p>
        </div>

        <div className="acc">
          <h3 style={{ margin: 0 }}>
            <button
              type="button"
              id={buttonId}
              className="acc__btn"
              aria-expanded={open}
              aria-controls={panelId}
              onClick={() => setOpen((o) => !o)}
            >
              {t(s.terms.accordionLabel)}
              <svg
                className="acc__chev"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                aria-hidden="true"
                focusable="false"
              >
                <path
                  d="M6 9l6 6 6-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </h3>

          <div id={panelId} role="region" aria-labelledby={buttonId} className="acc__panel" hidden={!open}>
            {termsClauses.length > 0 ? (
              // The signed document is English-only; lang lets screen readers voice it
              // correctly when the page is in Swahili.
              <div className="terms__doc" lang="en">
                <h4 className="terms__title">{TERMS_TITLE}</h4>
                <ol className="terms__clauses">
                  {termsClauses.map((c) => (
                    <li key={c.n} value={c.n}>
                      {c.text}
                      {c.list && (
                        <ul className="terms__list">
                          {c.list.map((group) => (
                            <li key={group.label}>
                              {group.label}
                              <ul>
                                {group.items.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ) : (
              <p className="legal-placeholder">{TERMS_PLACEHOLDER}</p>
            )}

            <p className="legal-note" lang="en">
              {t(s.terms.legalNote)} Promotional Lottery Licence No. {campaign.licenceNumber} —{' '}
              {campaign.licenceAuthority}.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
