/**
 * Single source of truth for every campaign value that legal, GBT or TBL can change.
 *
 * Spec §3.5 / assumption 4: dates, prize values, licence number and event content
 * must NOT be hard-coded in components. Everything a reissued legal document could
 * touch lives here so it can be lifted into a CMS/config source later without touching
 * component code. Headline-artist content lives in ./artists.ts.
 *
 * Decision log alignment (spec §0.1):
 *   D1 — on-page dates: 10 Aug – 31 Dec 2026, as in the signed T&Cs (clause 1). Changed
 *        from the spec's 24 Aug – 24 Nov in review, Sep 2026.
 *   D2 — all prizes are cash, disbursed via mobile money. No "airtime" language.
 *   D3 — promoter is TBL; Bluetrain is the UTC technology partner.
 *   D4 — web is a confirmed entry channel alongside SMS 15421.
 *   D5 — no ticket prizes: Mega Events is hype/experience content only.
 *   D6 — weekly draws only, every Monday. No grand draw.
 */

export type Locale = 'sw' | 'en'

export interface MegaEvent {
  id: string
  city: string
  venue: string
  /** ISO date (no time) — rendered with the active locale. Omit until confirmed. */
  date?: string
  /** [latitude, longitude]. Places the city pin on the Tanzania map artwork. */
  coords: [number, number]
  /**
   * Present once the lineup is announced. Without it the map shows the snowcastle
   * loading state for that city.
   */
  lineup?: {
    /** Artist ids from ./artists.ts — names and spellings live there, once. */
    headliners: string[]
    djs: string[]
    hosts: string[]
  }
}

export const campaign = {
  /**
   * D1 — campaign dates, matching T&C clause 1: opens 10 August 2026, and the instant
   * prize window closes 23:59 EAT on 31 December 2026. Entries close at campaignEnd.
   * [CONTENT-PENDING: confirm these match licence PML000004605]
   */
  campaignStart: '2026-08-10T00:00:00+03:00',
  campaignEnd: '2026-12-31T23:59:00+03:00',

  licenceNumber: 'PML000004605',
  licenceAuthority: 'Gaming Board of Tanzania',

  /** D4 — alternate entry channel. Rendered as plain text, never a link. */
  shortcode: '15421',
  smsRate: 'TZS 25',

  /** D2 — all cash. */
  currency: 'TZS',
  instantPrize: 2000,
  weeklyPrize1: 100000,
  weeklyPrize1Count: 10,
  weeklyPrize2: 1000000,
  weeklyPrize2Count: 1,

  /** Submission endpoint. The browser never talks to the platform directly (spec §3.5). */
  SUBMISSION_API_URL: '/api/submissions',

  /**
   * D5 — experience/hype content only. No "win tickets" language anywhere.
   *
   * Four Mega Events. Mwanza, Dar es Salaam and Arusha have confirmed dates, all inside
   * the entry window (campaignEnd, 31 Dec 2026); Mbeya is announced without one.
   *
   * Mwanza's lineup and venue are confirmed (lineup card, Sep 2026).
   * [CONTENT-PENDING: lineups and venues for Dar es Salaam and Arusha]
   */
  events: [
    {
      id: 'e1',
      city: 'Mwanza',
      venue: 'Elevate',
      date: '2026-10-03',
      coords: [-2.5164, 32.9175],
      lineup: {
        headliners: ['harmonize', 'scotts-maphuma', 'darassa'],
        djs: ['DJ Khally Racky', 'DJ K Flip', 'DJ Kidy Lax'],
        hosts: ['Kibo', 'Iddy Mula'],
      },
    },
    { id: 'e2', city: 'Dar es Salaam', venue: 'Venue TBC', date: '2026-12-05', coords: [-6.7924, 39.2083] },
    { id: 'e3', city: 'Arusha', venue: 'Venue TBC', date: '2026-12-31', coords: [-3.3869, 36.683] },
    // [CONTENT-PENDING: Mbeya date, venue and lineup] Shows the loading state until then.
    { id: 'e4', city: 'Mbeya', venue: 'Venue TBC', coords: [-8.9094, 33.4608] },
  ] as MegaEvent[],

  /**
   * Tickets band countdown target. Evaluated against server time.
   * [CONTENT-PENDING: confirm the on-sale time — midnight EAT assumed]
   */
  ticketsOnSaleAt: '2026-09-18T00:00:00+03:00',

  /** Section 4 — display-only chips, not filters. */
  regions: ['Arusha', 'Dar es Salaam', 'Mbeya', 'Mwanza'],

  /** §2.1 — code grammar. Server re-validates all of this (§2.4). */
  code: {
    length: 7,
    prefixes: ['CA', 'CD', 'CE', 'CM', 'CX', 'CY'],
    /** 28-char campaign alphabet. Ambiguous 0/O, 1/I, 2/Z, 8/B excluded at generation. */
    alphabet: '345679ACDEFGHJKLMNPQRSTUVWXY',
    example: 'CD7KQ4M',
  },

  /** D3 — attribution. */
  promoter: 'Tanzania Breweries PLC',
  promoterLong: 'Tanzania Breweries PLC (AB InBev)',
  technologyPartner: 'Bluetrain Consultancy Limited',
  copyrightYear: 2026,
} as const

/** Locale-aware money formatting: "TZS 2,000". */
export function formatPrize(amount: number, locale: Locale): string {
  return `${campaign.currency} ${new Intl.NumberFormat(
    locale === 'sw' ? 'sw-TZ' : 'en-GB',
  ).format(amount)}`
}

/** Long date for on-page copy, e.g. "24 November 2026" / "24 Novemba 2026". */
export function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === 'sw' ? 'sw-TZ' : 'en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Africa/Dar_es_Salaam',
  }).format(new Date(iso))
}
