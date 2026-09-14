import { useLang } from '../i18n/LanguageContext'
import { campaign } from '../config/campaign'
import { CodeForm } from './CodeForm'

/**
 * Section 2 — code entry. Moved out of the hero so the artist carousel can lead; this
 * is the first section below it, and the skip link still lands on the form (#entry).
 *
 * Layout notes:
 *  - One centred column at every width: heading, intro, then the form card.
 *  - The alternate-channel line renders *below* the form card, not above it. On a
 *    375px phone every pixel spent above the card pushes the code input further down,
 *    and the SMS shortcode is the fallback for people the form did not convert — it
 *    belongs after the thing it is a fallback for.
 *  - White snow plate, with the form on blue glass (see .entry in styles.css).
 */
export function CodeEntry() {
  const { s, t } = useLang()

  return (
    <section className="entry" aria-labelledby="entry-h2">
      <div className="wrap entry__inner">
        <div className="entry__copy">
          <h2 id="entry-h2">{t(s.entry.heading)}</h2>
          <p className="entry__sub">{t(s.entry.sub)}</p>
        </div>

        <div className="entry__form">
          <CodeForm />
          <p className="entry__alt">
            {/* Plain text, deliberately not a link — the shortcode is a channel, not
                navigation (spec §4, "one page, no external navigation"). */}
            {renderShortcode(t(s.entry.altChannel))}
          </p>
        </div>
      </div>
    </section>
  )
}

/** Emphasise the shortcode inside the alternate-channel sentence without linking it. */
function renderShortcode(sentence: string) {
  const at = sentence.indexOf(campaign.shortcode)
  if (at === -1) return sentence
  return (
    <>
      {sentence.slice(0, at)}
      <strong>{campaign.shortcode}</strong>
      {sentence.slice(at + campaign.shortcode.length)}
    </>
  )
}
