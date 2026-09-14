/**
 * Terms & Conditions content source.
 *
 * Spec §5 requires the full signed T&C text (17 clauses) rendered verbatim on-page —
 * no external link, because the GBT-approved copy must be verifiably present at the
 * point of entry.
 *
 * Source: "Castle Lite Unlock 2026 - Terms and conditions.pdf" (supplied 14 Sep 2026),
 * transcribed programmatically and checked word-for-word against the PDF. The PDF's
 * layout line breaks are removed, and clause 9's em dash is a semicolon (no em dashes
 * anywhere on the site, per review, Sep 2026). Otherwise wording, capitals and punctuation
 * are as signed.
 *
 * [CONTENT-PENDING: legal confirmation] This is the document spec v1.2 describes as
 * superseded. It still carries 10 Aug – 31 Dec 2026 dates, Grand Draw clauses (1, 7, 8,
 * 9), instant *airtime* prizes (6) and SMS-only entry (4) — which conflict with decisions
 * D2, D4 and D6, with the on-page summary (all prizes cash via mobile money) and with the
 * web entry form. Its dates are now the on-page dates too. Replace with the reissued copy when legal
 * provides it: paste each clause verbatim — do not paraphrase, summarise or reorder.
 */

export interface Clause {
  /** Clause number as it appears in the signed document. */
  n: number
  /** Verbatim clause text. */
  text: string
  /** Verbatim bulleted sub-list, for clauses that have one (clause 6). */
  list?: Array<{ label: string; items: string[] }>
}

export const TERMS_TITLE = 'Terms and Conditions: "Castle Lite Unlock" Under The Crown (UTC) Promotional Lottery'

export const termsClauses: Clause[] = [
  {
    n: 1,
    text:
      'This promotion commences on 10 August 2026 and closes on 31 December 2026. Any entries received after this date will be invalid. The instant prize window closes at 23:59 EAT on 31 December 2026. The Grand Draw will be held on or before 10 December 2026.',
  },
  {
    n: 2,
    text:
      'The promotion is open to all residents of the United Republic of Tanzania aged 18 years and above, except employees of Tanzania Breweries PLC (ABInBev), Bluetrain Consultancy Limited, Str8up Agency, Amplify Agency, Dentsu Tanzania, their respective advertising, media, and PR agencies, as well as family members, consultants, directors, associates, and trading partners of such organisations and persons.',
  },
  {
    n: 3,
    text:
      'All participants must be 18 years of age or older at the date of entry. New participants will be required to confirm their age via the SMS entry system before their first entry is validated. Winners will be required to present valid identification as proof of age upon claiming any prize.',
  },
  {
    n: 4,
    text:
      'To participate, consumers must purchase a Castle Lite returnable bottle (RB) from any authorised retail outlet in Tanzania. Participants must locate the unique alphanumeric code printed under the crown and send the code via SMS to shortcode 15421 at standard network rates (TZS 25 per message).',
  },
  {
    n: 5,
    text:
      'Valid codes will be confirmed via SMS within 60 seconds of submission. Invalid or duplicate codes will be rejected, and participants will be notified accordingly. Participants who submit three or more consecutive invalid codes may be blacklisted from further participation pending review by the campaign administrator.',
  },
  {
    n: 6,
    text: 'Prizes to be won are as follows:',
    list: [
      {
        label: 'INSTANT AIRTIME PRIZES:',
        items: [
          'Approximately 17,553 winners will receive TZS 2,000 airtime each credited to their registered mobile numbers upon successful submission.',
        ],
      },
      {
        label: 'WEEKLY DRAW PRIZES:',
        items: [
          '10 winners per week will receive TZS 100,000 through a random draw conducted weekly for 20 weeks of the campaign period.',
        ],
      },
      {
        label: 'WEEKLY TZS 1M PRIZES:',
        items: [
          'For 20 weeks, 1 winner will receive TZS 1,000,000 each week.',
        ],
      },
    ],
  },
  {
    n: 7,
    text:
      'Cash prizes will be disbursed to winners via mobile money (M-Pesa, Airtel Money, Mixx by Yas, Halopesa) to the phone number used to enter the promotion. For the weekly draw and grand draw, Tanzania Breweries PLC will disburse cash prizes via bank transfer or mobile money. All cash prizes will be paid in full by Tanzania Breweries PLC.',
  },
  {
    n: 8,
    text:
      'Weekly draws will be conducted every Monday during the campaign period for entries received during the preceding calendar week. A representative of the Gaming Board of Tanzania will oversee each draw. The Grand Draw will be conducted on or before 31 December 2026, under the supervision of a representative of the Gaming Board of Tanzania.',
  },
  {
    n: 9,
    text:
      'Each unique crown code may only be entered once. Participants may enter as many codes as they have purchased crowns; there is no limit on the number of entries per participant. However, only one weekly prize and one Grand Draw prize may be awarded per participant per draw.',
  },
  {
    n: 10,
    text:
      'If a selected prize winner cannot be contacted within 3 consecutive days from the date of the draw, or fails to claim their prize within 30 days of notification, the prize will be forfeited, and a redraw will take place.',
  },
  {
    n: 11,
    text:
      'Neither Tanzania Breweries PLC, Bluetrain Consultancy Limited, nor their advertising, media, and PR agencies, nor their trading partners shall be liable for any loss, damage, or costs, howsoever arising, suffered by an entrant in relation to this promotion, including but not limited to technical failures, mobile network outages, or prize disbursement delays outside the promoter\'s reasonable control.',
  },
  {
    n: 12,
    text:
      'The laws of the United Republic of Tanzania govern these terms and conditions. Participants agree to the exclusive jurisdiction of Tanzanian courts for any disputes arising from this promotion.',
  },
  {
    n: 13,
    text:
      'Winners may be required to participate in publicity related to this promotion. Participation in the promotion is conditional on agreement to such publicity without additional compensation. All publicity materials remain the property of Tanzania Breweries PLC.',
  },
  {
    n: 14,
    text:
      'Tanzania Breweries PLC shall handle any participant queries or complaints regarding this promotion. Contact details will be communicated via campaign above-the-line materials and the Castle Lite SMS channel.',
  },
  {
    n: 15,
    text:
      'Tanzania Breweries PLC reserves the right to suspend or terminate this promotion at any time in the event of unforeseen circumstances, technical failures, fraud, or other issues that compromise the integrity of the campaign, subject to prior approval and consent from the Gaming Board of Tanzania.',
  },
  {
    n: 16,
    text:
      'By entering this promotion, all participants accept and agree to abide by these rules, terms, and conditions. Tanzania Breweries PLC reserves the right to disqualify any participant found to be in breach of these terms and conditions.',
  },
  {
    n: 17,
    text:
      'The promoter of this campaign is Tanzania Breweries PLC (AB InBev), P.O. Box 9013, Dar es Salaam, Tanzania. The UTC technology partner is Bluetrain Consultancy Limited, Dar es Salaam, Tanzania.',
  },
]

export const TERMS_PLACEHOLDER = '[FULL APPROVED TERMS & CONDITIONS TEXT: TO BE PASTED VERBATIM]'
