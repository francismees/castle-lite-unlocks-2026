/**
 * Every consumer-facing string, EN / SW.
 *
 * Swahili is the default render (spec §0: "Swahili-first with English toggle").
 * Error microcopy is deliberately worded to point the consumer back at the physical
 * crown rather than at the system (spec §4).
 *
 * Swahili review, Sep 2026: every line now has real Swahili (nothing falls back to
 * English), terminology is consistent across the page — kodi (crown code), kizibo
 * (crown), droo (draw), mobile money, zawadi (prize) — and literal or unnatural
 * renderings were corrected. Brand names (Castle Lite, Unlocks, Extra Cold) stay in
 * English, as in-market. [CONTENT-PENDING: native-speaker / TBL sign-off on all SW]
 */

export interface Str {
  en: string
  sw: string
}

export const strings = {
  meta: {
    langToggleLabel: { en: 'Language', sw: 'Lugha' },
    switchToEn: { en: 'Switch to English', sw: 'Badilisha kwenda Kiingereza' },
    switchToSw: { en: 'Switch to Swahili', sw: 'Badilisha kwenda Kiswahili' },
    skipToForm: { en: 'Skip to code entry', sw: 'Rukia kuingiza kodi' },
  },

  ageGate: {
    heading: {
      en: 'Are you 18 or older?',
      sw: 'Je, una umri wa miaka 18 au zaidi?',
    },
    body: {
      en: 'This site is for adults of legal drinking age in Tanzania.',
      sw: 'Tovuti hii ni kwa watu wazima wenye umri halali wa kunywa pombe Tanzania.',
    },
    confirm: { en: "YES, I'M 18+", sw: 'NDIYO, NINA MIAKA 18+' },
    decline: { en: 'NO', sw: 'HAPANA' },
    declined: {
      en: "Come back when you're 18. Excessive drinking is harmful to your health.",
      sw: 'Rudi ukifikisha miaka 18. Unywaji pombe kupita kiasi ni hatari kwa afya yako.',
    },
  },

  hero: {
    // Headline beside the artist carousel. The date is the Mwanza Mega Event
    // (campaign.events e1) — update both together.
    brand: { en: 'Castle Lite Unlocks', sw: 'Castle Lite Unlocks' },
    comeback: { en: 'Is back!', sw: 'Imerudi!' },
    nextShow: { en: 'Mwanza 3rd October!', sw: 'Mwanza, 3 Oktoba!' },
  },

  // Code entry — the section directly below the hero. Heading renders uppercase (CSS).
  entry: {
    // SW supplied in review (Sep 2026). "Baridiii" is stylised — keep the triple i.
    heading: { en: 'Unlock the Experience', sw: 'Fungua Tajriba ya Baridiii' },
    // Supplied copy, capitals as supplied ("to" added after "stand a chance").
    // [CONTENT-PENDING: legal sign-off] "Extra cold prizes" and "tickets" conflict with
    // decision log D2 (all prizes are cash) and D5 (no ticket prizes) and with the
    // licensed T&Cs — confirm the prize structure changed before this goes live.
    sub: {
      en: 'Grab a Castle Lite, find the code under the crown, enter it below, and stand a chance to win instant cash, EXTRA COLD PRIZES and tickets to the COLDEST STAGE in TANZANIA!',
      sw: 'Chukua Castle Lite, angalia kodi chini ya kizibo, iingize hapa chini, na upate nafasi ya kushinda pesa taslimu papo hapo, ZAWADI ZA EXTRA COLD na tiketi za JUKWAA LENYE BARIDI ZAIDI TANZANIA!',
    },
    altChannel: {
      en: 'Or SMS your code to 15421 (TZS 25/SMS).',
      sw: 'Au tuma kodi yako kwa SMS kwenda namba 15421 (TZS 25 kwa SMS).',
    },
  },

  form: {
    codeLabel: { en: 'Your crown code', sw: 'Kodi yako ya kizibo' },
    codeHint: { en: 'e.g. CD7KQ4M', sw: 'mfano CD7KQ4M' },
    phoneLabel: { en: 'Mobile money number', sw: 'Namba yako ya mobile money' },
    phonePlaceholder: { en: '07XX XXX XXX', sw: '07XX XXX XXX' },
    consent: {
      en: 'I confirm I am 18+ and accept the Terms & Conditions.',
      sw: 'Ninathibitisha nina miaka 18+ na ninakubali Sheria na Masharti.',
    },
    // The linked fragment of the consent sentence — anchor-scrolls to Section 5.
    consentLinkText: { en: 'Terms & Conditions', sw: 'Sheria na Masharti' },
    submit: { en: 'SUBMIT CODE', sw: 'TUMA KODI' },
    submitting: { en: 'Checking…', sw: 'Tunakagua…' },
    reset: { en: 'Enter another code', sw: 'Ingiza kodi nyingine' },
  },

  /** §2.2 — client-side validation. One error at a time, aria-live="polite". */
  errors: {
    E1: {
      en: 'Enter the code found under your crown.',
      sw: 'Ingiza kodi iliyo chini ya kizibo chako.',
    },
    E2: {
      en: 'Your code should be exactly 7 characters: 2 letters, then 5 characters.',
      sw: 'Kodi yako inapaswa kuwa na alama 7 kamili: herufi 2, kisha herufi au namba 5.',
    },
    E3: {
      en: "That code contains a character we don't use. Check the crown: codes never include 0, O, 1, I, 2, Z, 8 or B.",
      sw: 'Kodi hiyo ina alama ambayo hatutumii. Angalia kizibo tena: kodi zetu hazina 0, O, 1, I, 2, Z, 8 wala B.',
    },
    E4: {
      en: "That doesn't look like a Castle Lite Unlocks code. Check the first two letters and try again.",
      sw: 'Hiyo haionekani kama kodi ya Castle Lite Unlocks. Angalia herufi mbili za kwanza kisha jaribu tena.',
    },
    E5: {
      en: 'Enter a valid Tanzanian mobile number, e.g. 07XX XXX XXX.',
      sw: 'Ingiza namba sahihi ya simu ya Tanzania, kwa mfano 07XX XXX XXX.',
    },
    E6: {
      en: 'Please confirm you are 18+ and accept the Terms & Conditions.',
      sw: 'Tafadhali thibitisha una miaka 18+ na unakubali Sheria na Masharti.',
    },
  },

  /** §2.3 — server-side result states. Rendered as a result card replacing the form. */
  results: {
    S1: {
      en: "You're in! Code accepted, and you're entered into the draws. Watch your phone.",
      sw: 'Umeingia! Kodi imekubaliwa na sasa uko kwenye droo. Endelea kufuatilia simu yako.',
    },
    S2: {
      en: "🎉 Winner! Your code just unlocked TZS 2,000, and it's on its way to your mobile money.",
      sw: '🎉 Hongera, umeshinda! Kodi yako imefungua TZS 2,000, zinatumwa kwenye mobile money yako.',
    },
    E7: {
      en: "We couldn't find that code. Double-check every character against your crown and try again.",
      sw: 'Hatukuipata kodi hiyo. Linganisha kila alama na kizibo chako kisha jaribu tena.',
    },
    E8: {
      en: 'This code has already been entered. Each code works once, so grab another Castle Lite for another chance.',
      sw: 'Kodi hii imeshatumika. Kila kodi inatumika mara moja tu, kwa hiyo chukua Castle Lite nyingine upate nafasi nyingine.',
    },
    E9: {
      en: 'Too many attempts. Take a break and try again in a few minutes.',
      sw: 'Umejaribu mara nyingi mno. Pumzika kidogo kisha jaribu tena baada ya dakika chache.',
    },
    E10: {
      en: 'Submissions from this number are paused after repeated invalid codes. Contact the Castle Lite support line in campaign materials if you think this is a mistake.',
      sw: 'Kodi kutoka namba hii zimesitishwa kwa muda baada ya kodi zisizo sahihi kuingizwa mara kadhaa. Kama unadhani ni makosa, wasiliana na huduma kwa wateja ya Castle Lite iliyo kwenye matangazo ya kampeni.',
    },
    E11: {
      en: 'The Unlocks 2026 promotion has ended. Thanks for playing, and see you next time.',
      sw: 'Promosheni ya Unlocks 2026 imekwisha. Asante kwa kushiriki, tukutane tena wakati ujao.',
    },
    E12: {
      en: 'Something went wrong on our side. Your code was not used, so please try again shortly.',
      sw: 'Hitilafu imetokea upande wetu. Kodi yako haijatumika, tafadhali jaribu tena baada ya muda mfupi.',
    },
    winnerBadge: { en: 'Instant win', sw: 'Ushindi papo hapo' },
  },

  // Cash prize cards (in How It Works).
  features: {
    instantTitle: { en: 'Instant Cash', sw: 'Pesa Papo Hapo' },
    instantBody: {
      en: 'Valid codes can win TZS 2,000 cash, sent straight to your mobile money on the number you entered with.',
      sw: 'Kodi sahihi inaweza kushinda TZS 2,000 taslimu, zinazotumwa moja kwa moja kwenye mobile money ya namba uliyoitumia kuingiza.',
    },
    weeklyTitle: { en: 'Weekly Draws', sw: 'Droo za Kila Wiki' },
    // One card per weekly prize tier. {count} comes from campaign.weeklyPrize*Count, so
    // the copy can't drift from the configured number of winners.
    weeklyTopBody: {
      en: '{count} winner every week. Every valid code you enter is in the draw, and the prize goes straight to your mobile money.',
      sw: 'Mshindi {count} kila wiki. Kila kodi sahihi unayoingiza inaingia kwenye droo, na zawadi inatumwa moja kwa moja kwenye mobile money yako.',
    },
    weeklyTierBody: {
      en: '{count} winners every week. Every valid code you enter is in the draw, and each prize goes straight to your mobile money.',
      sw: 'Washindi {count} kila wiki. Kila kodi sahihi unayoingiza inaingia kwenye droo, na kila zawadi inatumwa moja kwa moja kwenye mobile money yako.',
    },
  },

  // Countdown unit labels (the spec-approved set from the original Artist Reveal).
  countdown: {
    days: { en: 'days', sw: 'siku' },
    hours: { en: 'hrs', sw: 'saa' },
    minutes: { en: 'min', sw: 'dak' },
    seconds: { en: 'sec', sw: 'sek' },
  },

  // Tickets band under the hero. [CONTENT-PENDING: where tickets are sold once live]
  tickets: {
    heading: { en: 'Tickets available soon', sw: 'Tiketi zitapatikana hivi karibuni' },
    live: { en: 'Tickets available now', sw: 'Tiketi zinapatikana sasa' },
    onSale: { en: 'Tickets go on sale', sw: 'Tiketi zitaanza kuuzwa' },
  },

  // Mega Events map (after Find Us On the Ground). Lineup names come from src/config/campaign.ts.
  events: {
    // Renders uppercase (CSS).
    heading: { en: 'Extra Cold Refreshment Is Coming!', sw: 'Kiburudisho cha Extra Cold Kinakuja!' },
    hint: { en: "Hover or tap a city to see who's on stage.", sw: 'Chagua mji uone watakaopanda jukwaani.' },
    date: { en: 'Date', sw: 'Tarehe' },
    headliners: { en: 'Headline artists', sw: 'Wasanii wakuu' },
    djs: { en: 'DJs', sw: 'Ma-DJ' },
    hosts: { en: 'Hosts', sw: 'Washereheshaji' },
    venue: { en: 'Venue', sw: 'Ukumbi' },
    loading: { en: 'Lineup loading', sw: 'Wasanii wanakuja' },
    showing: { en: 'Showing', sw: 'Inaonyesha' },
  },

  // Prizes band in How It Works. Prize names are the products on the Extra Cold prize
  // sheet, described in Swahili rather than transliterated.
  // [CONTENT-PENDING: legal sign-off] Non-cash prizes conflict with decision log D2.
  prizes: {
    h2: { en: 'What You Can Unlock', sw: 'Unachoweza Kufungua' },
    cashTag: { en: 'Cash prize', sw: 'Zawadi ya pesa taslimu' },
    coldTag: { en: 'Extra Cold prize', sw: 'Zawadi ya Extra Cold' },
    // Badge on the back of every Extra Cold prize card.
    // Non-breaking hyphen in "in‑bar", so the badge never splits the word across lines.
    inBar: { en: 'Available during in\u2011bar activities', sw: 'Inapatikana wakati wa matukio ya baa' },
    pause: { en: 'Pause the prizes', sw: 'Simamisha zawadi' },
    play: { en: 'Play the prizes', sw: 'Endeleza zawadi' },
    prev: { en: 'Previous prize', sw: 'Zawadi iliyotangulia' },
    next: { en: 'Next prize', sw: 'Zawadi inayofuata' },
    neckFan: { en: 'Sleek Neck Fan', sw: 'Feni ya Shingoni' },
    coolbox: { en: 'Speaker Coolbox', sw: 'Kipoza chenye Spika' },
    jacket: { en: 'Silver Jacket', sw: 'Jaketi la Extra Cold' },
    chiller: { en: 'Rapid Chiller', sw: 'Kipoza cha Haraka' },
  },

  // Headline-artist carousel. Artist names and the supporting line come from
  // src/config/artists.ts; these are the control and screen-reader labels only.
  carousel: {
    label: { en: 'Headline artists', sw: 'Wasanii wakuu' },
    roleCarousel: { en: 'carousel', sw: 'onyesho la slaidi' },
    roleSlide: { en: 'slide', sw: 'slaidi' },
    of: { en: 'of', sw: 'kati ya' },
    prev: { en: 'Previous artist', sw: 'Msanii aliyetangulia' },
    next: { en: 'Next artist', sw: 'Msanii anayefuata' },
    pause: { en: 'Pause autoplay', sw: 'Simamisha mzunguko' },
    play: { en: 'Resume autoplay', sw: 'Endeleza mzunguko' },
    show: { en: 'Show', sw: 'Onyesha' },
  },

  how: {
    h2: { en: 'How It Works', sw: 'Jinsi Inavyofanya Kazi' },
    step1Title: { en: 'Buy', sw: 'Nunua' },
    step1Body: {
      en: 'Buy a Castle Lite 330ml returnable bottle.',
      sw: 'Nunua chupa ya Castle Lite 330ml inayorudishwa.',
    },
    step2Title: { en: 'Find', sw: 'Tafuta' },
    step2Body: {
      en: 'Look under the crown for your 7-character code.',
      sw: 'Angalia chini ya kizibo upate kodi yako yenye alama 7.',
    },
    step3Title: { en: 'Enter', sw: 'Ingiza' },
    step3Body: {
      en: 'Submit the code here or SMS it to 15421.',
      sw: 'Iingize hapa au itume kwa SMS kwenda namba 15421.',
    },
    step4Title: { en: 'Win', sw: 'Shinda' },
    step4Body: {
      en: 'Instant confirmation. Valid codes enter every weekly draw.',
      sw: 'Uthibitisho papo hapo. Kila kodi sahihi inaingia kwenye droo za kila wiki.',
    },
  },

  activation: {
    h2: { en: 'Find Us On the Ground', sw: 'Tukute Mtaani' },
    body: {
      en: 'Castle Lite brand ambassadors are out in bars and events across the campaign regions. Find us and enter your code on the spot.',
      sw: 'Mabalozi wa Castle Lite wapo kwenye baa na matukio katika mikoa ya kampeni. Tukute na uingize kodi yako papo hapo.',
    },
    regionsLabel: { en: 'Campaign regions', sw: 'Mikoa ya kampeni' },
    callCta: { en: 'Call for more information', sw: 'Piga simu kwa maelezo zaidi' },
    ambassadorsAlt: {
      en: 'Three Castle Lite brand ambassadors in silver Castle Lite jackets',
      sw: 'Mabalozi watatu wa Castle Lite wakiwa wamevaa jaketi za fedha za Castle Lite',
    },
  },

  terms: {
    h2: { en: 'Terms & Conditions', sw: 'Sheria na Masharti' },
    // {start} / {end} are interpolated from campaign config — the on-page dates must
    // follow the licence (D1) and change without a code edit if legal reissues them.
    plainSummary: {
      en: 'Campaign runs {start} – {end}. Open to Tanzania residents 18+. All prizes paid in cash via mobile money.',
      sw: 'Kampeni inaendeshwa kuanzia {start} hadi {end}. Ni kwa wakazi wa Tanzania wenye miaka 18+. Zawadi zote za pesa zinalipwa taslimu kupitia mobile money.',
    },
    accordionLabel: {
      en: 'Read the full Terms & Conditions',
      sw: 'Soma Sheria na Masharti kamili',
    },
    legalNote: {
      en: 'The signed Terms & Conditions are authoritative in English.',
      sw: 'Sheria na Masharti rasmi yaliyosainiwa ni ya lugha ya Kiingereza.',
    },
  },

  footer: {
    responsible: {
      en: 'Excessive drinking is harmful to your health.',
      sw: 'Unywaji pombe kupita kiasi ni hatari kwa afya yako.',
    },
    ageMark: { en: '18+ only', sw: 'Miaka 18+ pekee' },
  },
} as const

export type Strings = typeof strings
