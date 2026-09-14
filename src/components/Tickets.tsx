import { useLang } from '../i18n/LanguageContext'
import { campaign } from '../config/campaign'
import { useTick } from '../lib/hooks'
import { DayMonth } from './DayMonth'

/**
 * Tickets band, directly under the hero: "Tickets available soon" with a live countdown
 * to campaign.ticketsOnSaleAt. Time comes from the server-corrected clock, so a phone
 * with a wrong clock can't show tickets as live early.
 *
 * The ticking digits are aria-hidden (a screen reader would otherwise be read a new
 * number every second); the visible date line carries the same information, and a
 * visually hidden sentence spells it out.
 */
export function Tickets() {
  const { s, t, lang } = useLang()
  const tick = useTick()
  const remaining = Math.max(0, new Date(campaign.ticketsOnSaleAt).getTime() - tick)
  const live = remaining === 0

  const units: Array<[number, string]> = [
    [Math.floor(remaining / 86_400_000), t(s.countdown.days)],
    [Math.floor((remaining % 86_400_000) / 3_600_000), t(s.countdown.hours)],
    [Math.floor((remaining % 3_600_000) / 60_000), t(s.countdown.minutes)],
    [Math.floor((remaining % 60_000) / 1000), t(s.countdown.seconds)],
  ]

  return (
    <section className="tickets on-dark" aria-labelledby="tickets-h2">
      <img className="tickets__castle" src="/brand/snowcastle-white.svg" alt="" aria-hidden="true" />
      <div className="wrap tickets__inner">
        <div className="tickets__copy">
          <h2 id="tickets-h2" className="tickets__title">
            {t(live ? s.tickets.live : s.tickets.heading)}
          </h2>
          <p className="tickets__date">
            <span className="visually-hidden">{t(s.tickets.onSale)}: </span>
            <span className="tickets__date-text">
              <DayMonth iso={campaign.ticketsOnSaleAt} lang={lang} weekday />
            </span>
          </p>
        </div>

        {!live && (
          <div className="countdown" aria-hidden="true">
            {units.map(([value, label]) => (
              <div className="countdown__unit" key={label}>
                {/* Keyed on the value: only the digits that change remount and roll in. */}
                <span className="countdown__num" key={value}>
                  {String(value).padStart(2, '0')}
                </span>
                <span className="countdown__label">{label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
