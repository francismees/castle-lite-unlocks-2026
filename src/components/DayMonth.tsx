import type { Locale } from '../config/campaign'

/**
 * Day + month in the lineup-card style: "3RD OCTOBER" in English (ordinal as a
 * superscript), "3 Oktoba" in Swahili. Optionally with the weekday: "Friday 18th
 * September" / "Ijumaa, 18 Septemba". Case comes from CSS.
 *
 * Accepts a date ("2026-10-03") or a timestamp; dates are read at noon EAT so no
 * timezone can push them onto a neighbouring day.
 */
export function DayMonth({ iso, lang, weekday = false }: { iso: string; lang: Locale; weekday?: boolean }) {
  const at = new Date(iso.length === 10 ? `${iso}T12:00:00+03:00` : iso)
  const opts = { timeZone: 'Africa/Dar_es_Salaam' } as const
  const locale = lang === 'sw' ? 'sw-TZ' : 'en-GB'
  const day = Number(new Intl.DateTimeFormat('en-GB', { ...opts, day: 'numeric' }).format(at))
  const month = new Intl.DateTimeFormat(locale, { ...opts, month: 'long' }).format(at)
  const dayName = weekday ? new Intl.DateTimeFormat(locale, { ...opts, weekday: 'long' }).format(at) : ''

  if (lang === 'sw') return <span>{`${dayName ? `${dayName}, ` : ''}${day} ${month}`}</span>
  const suffix =
    day % 10 === 1 && day !== 11 ? 'st' : day % 10 === 2 && day !== 12 ? 'nd' : day % 10 === 3 && day !== 13 ? 'rd' : 'th'
  return (
    <span>
      {dayName ? `${dayName} ` : ''}
      {day}
      <sup>{suffix}</sup> {month}
    </span>
  )
}
