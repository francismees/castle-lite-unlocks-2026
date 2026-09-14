# Lovable Build Prompt — Castle Lite Unlocks 2026 Microsite

Paste everything below the line into Lovable as your first prompt. After the first build, upload the Castle Lite brand elements (logo, key visual, fonts if available) and tell Lovable: *"Replace the placeholder branding with these uploaded Castle Lite assets."*

---

Build a single-page, mobile-first campaign microsite for **"Castle Lite Unlocks 2026"** — a beer promotion in Tanzania where consumers enter a code found under the bottle crown to win cash prizes. This is a production build, not a demo. Follow every detail below exactly, including all copy strings.

## Global rules

- One page, one route. Anchor scrolling only. **No external links anywhere** — the only outbound reference is a plain-text mention of SMS shortcode 15421 (not a link).
- **Bilingual: Swahili is the default language, with an EN/SW toggle** pinned in the top-right. Every string below is given as EN / SW — render SW by default. Store the language choice in localStorage.
- Mobile-first, fully responsive. Target low/mid-range Android: initial load under 1.5MB, lazy-load all imagery below the fold.
- All campaign values (dates, prize amounts, licence number) must live in a single config file (`src/config/campaign.ts`), never hard-coded in components.
- Design language: Castle Lite — deep navy and vivid green with a diagonal wedge motif, clean and premium. Use placeholder brand marks for now; I will upload official Castle Lite assets to swap in.
- Accessibility: WCAG 2.1 AA. Body text contrast ≥4.5:1; large text and UI components ≥3:1 (do not put text in green-on-navy or gold-on-cream combinations that fail this). All form fields have programmatic labels (not placeholder-only). Touch targets ≥44×44px. Respect prefers-reduced-motion for all animations.

## Section 0 — Age gate (full-screen modal, blocks everything)

Shown before any content. Logo only, no product imagery. Focus trapped inside the modal; keyboard order: confirm → decline.
- Heading: "Are you 18 or older?" / "Je, una umri wa miaka 18 au zaidi?"
- Body: "This site is for adults of legal drinking age in Tanzania." / "Tovuti hii ni kwa watu wazima wenye umri halali wa kunywa pombe Tanzania."
- Buttons: "YES, I'M 18+" / "NDIYO, NINA MIAKA 18+" and "NO" / "HAPANA"
- YES sets a session cookie and reveals the page. NO replaces the modal with a static message: "Come back when you're 18. Excessive drinking is harmful to your health." / "Rudi ukifikisha miaka 18. Unywaji pombe kupita kiasi ni hatari kwa afya yako." — with no way back to the gate in the same session.

## Section 1 — Hero with code submission form (above the fold)

The form IS the hero. Do not push it below feature content.
- H1: "Castle Lite Unlocks 2026 — Unlock the Experience" / "Castle Lite Unlocks 2026 — Fungua Uzoefu"
- Sub-head: "Grab a Castle Lite, find the code under the crown, enter it below — win instant cash and weekly draws." / "Chukua Castle Lite, angalia kodi chini ya kizibo, ingiza hapa chini — shinda pesa taslimu papo hapo na droo za kila wiki."
- Below the form, small text: "Or SMS your code to 15421 (TZS 25/SMS)." / "Au tuma kodi yako kwa SMS kwenda 15421 (TZS 25/SMS)."

### Form fields (in this order)

1. **Code input** — label "Your crown code" / "Kodi yako ya kizibo". Monospace font, generous letter-spacing, autocapitalize="characters", autocomplete="off", visible example beneath: "e.g. CD7KQ4M". Normalise on input: trim, uppercase, strip spaces and hyphens.
2. **Phone input** — label "Mobile money number" / "Namba yako ya mobile money". type="tel", placeholder "07XX XXX XXX". Accept 07XXXXXXXX, 06XXXXXXXX, or +2557/6XXXXXXXX; normalise to 255XXXXXXXXX (12 digits).
3. **Consent checkbox** (never pre-checked): "I confirm I am 18+ and accept the Terms & Conditions." / "Ninathibitisha nina miaka 18+ na ninakubali Sheria na Masharti." The words "Terms & Conditions" anchor-scroll to Section 5. **The submit button is disabled until this box is checked.**
4. **Submit button**: "SUBMIT CODE" / "TUMA KODI". Loading state: spinner + "Checking…" / "Inakaguliwa…"

### Client-side validation (validate on blur and on submit; show one inline error at a time, below the field, in an aria-live="polite" region referenced by aria-describedby)

Code rules: exactly 7 characters after normalisation; first 2 characters must be one of CA, CD, CE, CM, CX, CY; remaining 5 characters only from this set: 3 4 5 6 7 9 A C D E F G H J K L M N P Q R S T U V W X Y.

Error messages (exact copy):
- Empty code → "Enter the code found under your crown." / "Ingiza kodi iliyo chini ya kizibo chako."
- Wrong length → "Your code should be exactly 7 characters — 2 letters then 5 characters." / "Kodi yako inapaswa kuwa na herufi 7 — herufi 2 kisha herufi/namba 5."
- Invalid character (contains 0, O, 1, I, 2, Z, 8, B or symbols) → "That code contains a character we don't use. Check the crown — codes never include 0, O, 1, I, 2, Z, 8 or B." / "Kodi hiyo ina herufi tusiyotumia. Angalia kizibo — kodi hazina 0, O, 1, I, 2, Z, 8 au B."
- Invalid prefix → "That doesn't look like a Castle Lite Unlocks code. Check the first two letters and try again." / "Hiyo haionekani kama kodi ya Castle Lite Unlocks. Angalia herufi mbili za kwanza kisha jaribu tena."
- Invalid phone → "Enter a valid Tanzanian mobile number, e.g. 07XX XXX XXX." / "Ingiza namba sahihi ya simu ya Tanzania, mfano 07XX XXX XXX."
- Consent unchecked (on attempted submit) → "Please confirm you are 18+ and accept the Terms & Conditions." / "Tafadhali thibitisha una miaka 18+ na unakubali Sheria na Masharti."

### Submission handling

POST to an endpoint defined in the config file (`SUBMISSION_API_URL`, default `/api/submissions`) with JSON body: `{ utc_code, msisdn, channel: "web", consent: true, locale }`. For now, implement a mock service module (`src/services/submission.ts`) that simulates responses so the UI is fully testable, with a clearly commented integration point where the real API plugs in. Simulate these response states and render them as a result card replacing the form area (with a "Enter another code" / "Ingiza kodi nyingine" button to reset), announced via role="status":

- **accepted / entered** → "You're in! Code accepted — you're entered into the draws. Watch your phone." / "Umeingia! Kodi imekubaliwa — umeingizwa kwenye droo. Fuatilia simu yako."
- **accepted / instant_win** → celebratory state (confetti, respecting reduced-motion): "🎉 Winner! Your code just unlocked TZS 2,000 — it's on its way to your mobile money." / "🎉 Mshindi! Kodi yako imefungua TZS 2,000 — zinakuja kwenye mobile money yako."
- **CODE_NOT_FOUND** → "We couldn't find that code. Double-check every character against your crown and try again." / "Hatukuipata kodi hiyo. Hakiki kila herufi kwenye kizibo chako kisha jaribu tena."
- **CODE_ALREADY_USED** → "This code has already been entered. Each code works once — grab another Castle Lite for another chance." / "Kodi hii tayari imetumika. Kila kodi inatumika mara moja — chukua Castle Lite nyingine kwa nafasi nyingine."
- **RATE_LIMITED** → "Too many attempts. Take a break and try again in a few minutes." / "Majaribio mengi mno. Pumzika kidogo kisha jaribu tena baada ya dakika chache."
- **ACCOUNT_LOCKED** → "Submissions from this number are paused after repeated invalid codes. Contact the Castle Lite support line in campaign materials if you think this is a mistake." / "Uwasilishaji kutoka namba hii umesitishwa baada ya kodi zisizo sahihi mara kadhaa. Wasiliana na msaada wa Castle Lite kwenye matangazo ya kampeni kama unadhani ni kosa."
- **CAMPAIGN_CLOSED** (auto-triggered client-side after the campaign end date in config) → "The Unlocks 2026 promotion has ended. Thanks for playing — see you next time." / "Promosheni ya Unlocks 2026 imefungwa. Asante kwa kushiriki — tuonane wakati mwingine."
- **SYSTEM_ERROR** → "Something went wrong on our side. Your code was not used — please try again shortly." / "Hitilafu imetokea kwa upande wetu. Kodi yako haijatumika — tafadhali jaribu tena baadaye."

## Section 2 — What You Can Unlock

H2: "What You Can Unlock" / "Unachoweza Kufungua". Four cards:
1. **Instant Cash / Pesa Papo Hapo** — "Valid codes can win TZS 2,000 cash, sent straight to your mobile money on the number you entered with." / "Kodi sahihi zinaweza kushinda TZS 2,000 taslimu, zinatumwa moja kwa moja kwenye mobile money ya namba uliyotumia."
2. **Weekly Draws / Droo za Kila Wiki** — "Every valid code enters the weekly draws — 10 winners of TZS 100,000 and 1 winner of TZS 1,000,000, every week of the campaign." / "Kila kodi sahihi inaingia kwenye droo za kila wiki — washindi 10 wa TZS 100,000 na mshindi 1 wa TZS 1,000,000, kila wiki ya kampeni."
3. **Artist Reveal / Kufichuliwa kwa Wasanii** — a countdown card driven by a `revealAt` timestamp in config. Before reveal: "The headline acts are still locked. Keep checking — reveals drop here first." / "Wasanii wakuu bado wamefungwa. Endelea kufuatilia — watafichuliwa hapa kwanza." After reveal: the card flips to show artist photo, name, and city (from a config array). Countdown timer is aria-hidden with a static text alternative.
4. **Mega Events / Matukio Makubwa** — event schedule cards (city, venue, date) from a config array with placeholder entries for Arusha, Dar es Salaam, Mbeya, Mwanza. Pure hype/experience content — **do not include any "win tickets" language; there are no ticket prizes in this campaign.**

## Section 3 — How It Works

H2: "How It Works" / "Jinsi Inavyofanya Kazi". A 4-step horizontal stepper (stacks vertically on mobile):
1. "Buy — Buy a Castle Lite 330ml returnable bottle." / "Nunua — Nunua chupa ya Castle Lite 330ml inayorudishwa."
2. "Find — Look under the crown for your 7-character code." / "Tafuta — Angalia chini ya kizibo kwa kodi yako ya herufi 7."
3. "Enter — Submit the code here or SMS it to 15421." / "Ingiza — Tuma kodi hapa au kwa SMS kwenda 15421."
4. "Win — Instant confirmation. Valid codes enter every weekly draw." / "Shinda — Uthibitisho papo hapo. Kodi sahihi zinaingia kila droo ya wiki."

## Section 4 — Find Us On the Ground

H2: "Find Us On the Ground" / "Tukute Mtaani". One short paragraph: "Castle Lite brand ambassadors are out in bars and events across the campaign regions — find us and enter your code on the spot." / "Mabalozi wa Castle Lite wapo kwenye baa na matukio katika mikoa ya kampeni — tukute na uingize kodi yako papo hapo." Display-only region chips: Arusha • Dar es Salaam • Mbeya • Mwanza.

## Section 5 — Terms & Conditions

H2: "Terms & Conditions" / "Sheria na Masharti". A collapsed-by-default accordion. Inside, render a clearly marked placeholder block: "[FULL APPROVED TERMS & CONDITIONS TEXT — TO BE PASTED VERBATIM]" — I will supply the final legal text; build the accordion to render a long formatted rich-text block with numbered clauses. Above the accordion, one plain-language line: "Campaign runs 24 August – 24 November 2026. Open to Tanzania residents 18+. All prizes paid in cash via mobile money." / "Kampeni inaanza 24 Agosti hadi 24 Novemba 2026. Ni kwa wakazi wa Tanzania wenye miaka 18+. Zawadi zote zinalipwa taslimu kupitia mobile money." (Pull the dates from config.)

## Footer (persistent)

- Brand lockup (placeholder), then: "Excessive drinking is harmful to your health." / "Unywaji pombe kupita kiasi ni hatari kwa afya yako." with an 18+ roundel.
- "Promotional Lottery Licence No. PML000004605 — Gaming Board of Tanzania."
- "© Tanzania Breweries PLC 2026. Promoter: Tanzania Breweries PLC. UTC Technology Partner: Bluetrain Consultancy Limited."

## Config file contents (`src/config/campaign.ts`)

campaignStart: "2026-08-24", campaignEnd: "2026-11-24T23:59:00+03:00", licenceNumber: "PML000004605", shortcode: "15421", smsRate: "TZS 25", instantPrize: 2000, weeklyPrize1: 100000, weeklyPrize1Count: 10, weeklyPrize2: 1000000, weeklyPrize2Count: 1, SUBMISSION_API_URL: "/api/submissions", artistRevealAt: "<placeholder ISO date>", artists: [], events: [<4 placeholder entries>].

## Keyboard order

Age gate confirm → language toggle → code input → phone input → consent checkbox → submit → section content in DOM order → accordion header → footer. No keyboard traps outside the age-gate modal.
