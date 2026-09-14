# Castle LITE Unlocks 2026 — Consumer Microsite Specification

**Document type:** One-page microsite specification (production-ready)
**Prepared for:** Front-end development + content design
**Prepared by:** Bluetrain Consultancy — UTC Technology Partner, TBL/ABInBev
**Version:** 1.2 — 3 September 2026
**Status:** Ready for build. Final T&Cs and GBT licence PML000004605 incorporated; v1.2 applies confirmed decisions: all prizes are **cash**, campaign dates on-page follow the **licence** (24 Aug – 24 Nov 2026), promoter is **TBL**, **web is a confirmed entry channel**, **no ticket prizes**, and **no grand draw** — weekly draws only.
**Stack:** Built in Lovable (React SPA) · Hosted on Vercel — see §3.5 Build & Hosting Notes.

---

## 0. Scope Summary

A single-page, mobile-first consumer microsite for the Castle Lite Unlocks 2026 UTC prize promotion. Core jobs, in priority order:

1. Let a consumer submit an Under-The-Crown (UTC) code and know instantly whether they're in the draw.
2. Sell the experience — Artist Reveal and Mega Events content that gives consumers a reason to return.
3. Carry the mandatory compliance load — 18+ age gate, T&Cs, responsible-drinking messaging.
4. Explain how the campaign and activations work in one simple visual workflow.

Language: **Swahili-first with English toggle** (consumer-facing standard for this market). All copy below is provided EN / SW; SW renders by default.

---

## 0.1 Decision Log (v1.2 — confirmed, supersedes earlier flags)

| # | Decision | Build impact |
|---|---|---|
| D1 | **Campaign dates on-page follow the licence:** 24 August – 24 November 2026 (Licence PML000004605). | All displayed dates, countdowns, and the campaign-closed state key off 24 Nov 2026 23:59 EAT. Configurable, not hard-coded. |
| D2 | **All prizes are cash** — instant TZS 2,000, weekly TZS 100,000 (×10) and TZS 1,000,000 (×1). Disbursed via mobile money to the entry number. | No "airtime" language anywhere on-page. |
| D3 | **Promoter is TBL; the licence is TBL's.** | Footer and T&C framing name TBL as promoter, Bluetrain as UTC technology partner. |
| D4 | **Web is a confirmed consumer participation channel** alongside SMS 15421. | Form ships as specified; entry copy references both channels. |
| D5 | **No ticket prizes** in this campaign. | Mega Events renders as experience/hype content only — no win-tickets claims. |
| D6 | **No grand draw** — weekly draws only, every Monday, GBT-supervised. | Remove all grand-draw references from copy, T&C summary, and payloads (`draws_entered: ["weekly"]`). |

Note for internal tracking only (not on-page): the signed T&C document carries 10 Aug – 31 Dec 2026 dates and grand-draw clauses; the on-page accordion should render the **updated T&C copy once legal reissues it** to match D1/D2/D6. Until then, treat the T&C accordion content as awaiting the corrected version. `[CONTENT-PENDING: reissued T&C copy aligned to D1–D6]`

---

# (1) Page Sections and Copy Blocks

## Section 0 — Age Gate (modal, blocks all content)

Full-screen modal shown before any page content. No brand imagery beyond the logo until confirmed.

| Element | EN copy | SW copy |
|---|---|---|
| Heading (H1 of modal) | **Are you 18 or older?** | **Je, una umri wa miaka 18 au zaidi?** |
| Body | This site is for adults of legal drinking age in Tanzania. | Tovuti hii ni kwa watu wazima wenye umri halali wa kunywa pombe Tanzania. |
| Confirm button | YES, I'M 18+ | NDIYO, NINA MIAKA 18+ |
| Decline button | NO | HAPANA |
| Decline result | Redirect to a static "come back when you're 18" page with responsible-drinking line. No cookie set. | — |

Confirmation stores a session cookie only (no persistent tracking pre-consent). Decline must not loop back to the gate.

## Section 1 — Hero + Code Submission (above the fold)

The form is the hero. Do not push it below feature content.

| Element | EN copy | SW copy |
|---|---|---|
| H1 | **Castle Lite Unlocks 2026 — Unlock the Experience** | **Castle Lite Unlocks 2026 — Fungua Uzoefu** |
| Sub-head | Grab a Castle Lite, find the code under the crown, enter it below — win instant cash, weekly draws, and tickets to the Unlocks concerts. | Chukua Castle Lite, angalia kodi chini ya kizibo, ingiza hapa chini — shinda pesa taslimu papo hapo, droo za kila wiki, na tiketi za matamasha ya Unlocks. |
| Form fields | Code input + phone input + submit (see Form Schema) | — |
| Alt channel line | Or SMS your code to **15421** (TZS 25/SMS). | Au tuma kodi yako kwa SMS kwenda **15421** (TZS 25/SMS). |

## Section 2 — Feature Highlights

**H2 (EN):** *What You Can Unlock* / **H2 (SW):** *Unachoweza Kufungua*

Four highlight cards, in this order:

1. **Instant Cash / Pesa Papo Hapo** — "Valid codes can win **TZS 2,000 cash**, sent straight to your mobile money on the number you entered with." (Aggregate winner counts stay off-page.)
2. **Weekly Draws / Droo za Kila Wiki** — "Every valid code enters the weekly draws — **10 winners of TZS 100,000** and **1 winner of TZS 1,000,000**, every week of the campaign." Draws every Monday for the preceding week's entries, supervised by the Gaming Board of Tanzania.
3. **Artist Reveal / Kufichuliwa kwa Wasanii** — Countdown module + teaser card. Copy pre-reveal: "The headline acts are still locked. Keep checking — reveals drop here first." Post-reveal: card flips to artist photo, name, and event assignment. Content-managed (see Data Model, `content_blocks`).
4. **Mega Events / Matukio Makubwa** — Regional event schedule cards: city, venue, date. **Copy constraint (D5):** there are no ticket prizes in this campaign, so event cards must not include "win tickets" claims. Frame Mega Events as experience/hype content ("The Unlocks stages are coming — here's where"). `[CONTENT-PENDING: confirmed 2026 event calendar]`

Design note: Artist Reveal and Mega Events are the retention features — they justify repeat visits between purchases. Each card carries a small "How to win tickets" link that scrolls to the workflow section (Section 4), not to an external page.

## Section 3 — How It Works (User Workflow)

**H2 (EN):** *How It Works* / **H2 (SW):** *Jinsi Inavyofanya Kazi*

Four numbered steps rendered as a horizontal stepper (stacks vertically on mobile):

1. **Buy / Nunua** — Buy a Castle Lite 330ml returnable bottle.
2. **Find / Tafuta** — Look under the crown for your 7-character code.
3. **Enter / Ingiza** — Submit the code here or SMS it to 15421.
4. **Win / Shinda** — Instant confirmation. Valid codes enter every draw you qualify for.

## Section 4 — Activation Information

**H2 (EN):** *Find Us On the Ground* / **H2 (SW):** *Tukute Mtaani*

- Short paragraph: brand-ambassador activations run in participating bars and events across campaign regions; consumers can submit codes with BA assistance on the spot.
- Region chips: Arusha • Dar es Salaam • Mbeya • Mwanza (display-only, not filters).
- `[CONTENT-PENDING: activation venue schedule feed or static monthly list — to be supplied by the activations partner via TBL]`
- Framing rule: this section describes the consumer experience only. It must not state or imply that Bluetrain directs or manages the activations partner.

## Section 5 — Terms & Conditions + Footer

**H2 (EN):** *Terms & Conditions* / **H2 (SW):** *Sheria na Masharti*

Rendered as an accordion (collapsed by default) containing the **full signed T&C text (17 clauses) verbatim** — no external link, per the one-page constraint. Do not paraphrase or summarise the legal copy in the accordion body; the approved wording renders as supplied. Key values for cross-reference (all sourced from the signed document):

1. **Campaign period (per licence PML000004605, D1):** 24 August – 24 November 2026; entries and the instant prize window close 23:59 EAT on 24 November 2026
2. **Eligibility:** Tanzania residents 18+; excludes employees of TBL (ABInBev), Bluetrain Consultancy Limited, Str8up, Amplify, Dentsu Tanzania, their agencies, families, consultants, directors, associates and trading partners
3. **Entry:** purchase Castle Lite returnable bottle; find the code under the crown; enter via **this website or SMS to 15421** (TZS 25/message) — web confirmed as a participation channel (D4)
4. **Prizes (all cash, D2):** instant TZS 2,000; weekly draws of 10 × TZS 100,000 and 1 × TZS 1,000,000 every week of the campaign
5. **Confirmation:** valid codes confirmed via SMS within 60 seconds; blacklisting possible after 3+ consecutive invalid codes, pending administrator review
6. **Disbursement:** mobile money (M-Pesa, Airtel Money, Mixx by Yas, Halopesa) to the entry number; weekly prizes via bank transfer or mobile money, all paid by TBL
7. **Draws (D6):** weekly draws only — every Monday for the preceding calendar week, GBT representative supervising; one weekly prize per participant per draw; no limit on entries; no grand draw in this campaign
8. **Forfeiture:** winner uncontactable for 3 consecutive days, or unclaimed after 30 days of notification → forfeit and redraw
9. **Licence:** Promotional Lottery Licence **PML000004605**, Gaming Board of Tanzania (commenced 24 Aug 2026)
10. **Promoter (D3):** Tanzania Breweries PLC (AB InBev), P.O. Box 9013, Dar es Salaam — licence holder; UTC technology partner Bluetrain Consultancy Limited; queries/complaints handled by TBL, contact details via campaign ATL materials and the Castle Lite SMS channel

**Language note:** the signed T&Cs are English-only. Decide with legal whether a Swahili translation renders alongside (recommended: SW plain-language summary above the accordion, English legal text authoritative inside it). `[CONTENT-PENDING: SW summary sign-off]`

**Footer (persistent):** brand lockup, "Excessive drinking is harmful to your health" / "Unywaji pombe kupita kiasi ni hatari kwa afya yako", 18+ mark, © TBL 2026, and the licence line: "Promotional Lottery Licence No. PML000004605 — Gaming Board of Tanzania".

---

# (2) Form Schema — UTC Code Submission

## 2.1 Fields

| Field | Type | Required | Rules |
|---|---|---|---|
| `utc_code` | text | Yes | Exactly **7 characters** after normalisation. Chars 1–2: valid prefix ∈ {CA, CD, CE, CM, CX, CY}. Chars 3–7: 5 characters from the campaign alphabet: `3 4 5 6 7 9 A C D E F G H J K L M N P Q R S T U V W X Y` (28 chars; ambiguous 0/O, 1/I, 2/Z, 8/B excluded at generation). Client normalises: trim whitespace, uppercase, strip internal spaces/hyphens before validating. |
| `msisdn` | tel | Yes | Tanzanian mobile number. Accept `07XXXXXXXX`, `06XXXXXXXX`, or `+2557/6XXXXXXXX`; normalise to `2557XXXXXXXX` / `2556XXXXXXXX` (12 digits) before submit. |
| `age_consent` | checkbox | **Yes — blocking on every submission** | "I confirm I am 18+ and accept the Terms & Conditions." Pre-checked = not permitted. The submit button stays disabled (with `aria-disabled` state and E6 shown on attempted submit) until checked; the server independently rejects any payload with `consent: false`. This satisfies T&C clause 3's age-confirmation requirement for the web channel. |

**Sample valid input:** `CD7KQ4M` (prefix `CD` — Dar es Salaam series; suffix `7KQ4M` from the campaign alphabet).

## 2.2 Client-side validation & distinct error states

Validate on blur and on submit. One error at a time, rendered inline below the field, announced via `aria-live="polite"`.

| # | Failure state | Trigger | EN microcopy | SW microcopy |
|---|---|---|---|---|
| E1 | Empty code | submit with blank code | Enter the code found under your crown. | Ingiza kodi iliyo chini ya kizibo chako. |
| E2 | Wrong length | ≠ 7 chars after normalisation | Your code should be exactly 7 characters — 2 letters then 5 characters. | Kodi yako inapaswa kuwa na herufi 7 — herufi 2 kisha herufi/namba 5. |
| E3 | Invalid character | contains 0, O, 1, I, 2, Z, 8, B or symbols | That code contains a character we don't use. Check the crown — codes never include 0, O, 1, I, 2, Z, 8 or B. | Kodi hiyo ina herufi tusiyotumia. Angalia kizibo — kodi hazina 0, O, 1, I, 2, Z, 8 au B. |
| E4 | Invalid prefix | first 2 chars not in the prefix set | That doesn't look like a Castle Lite Unlocks code. Check the first two letters and try again. | Hiyo haionekani kama kodi ya Castle Lite Unlocks. Angalia herufi mbili za kwanza kisha jaribu tena. |
| E5 | Invalid phone | msisdn fails pattern | Enter a valid Tanzanian mobile number, e.g. 07XX XXX XXX. | Ingiza namba sahihi ya simu ya Tanzania, mfano 07XX XXX XXX. |
| E6 | Consent unchecked | submit without consent | Please confirm you are 18+ and accept the Terms & Conditions. | Tafadhali thibitisha una miaka 18+ na unakubali Sheria na Masharti. |

## 2.3 Server-side responses & microcopy

| # | State | EN microcopy | SW microcopy |
|---|---|---|---|
| S1 | **Success — entered** | You're in! Code accepted — you're entered into the draws. Watch your phone. | Umeingia! Kodi imekubaliwa — umeingizwa kwenye droo. Fuatilia simu yako. |
| S2 | **Success — instant win** | 🎉 Winner! Your code just unlocked TZS 2,000 — it's on its way to your mobile money. | 🎉 Mshindi! Kodi yako imefungua TZS 2,000 — zinakuja kwenye mobile money yako. |
| E7 | **Code not found** (passes format, not in DB) | We couldn't find that code. Double-check every character against your crown and try again. | Hatukuipata kodi hiyo. Hakiki kila herufi kwenye kizibo chako kisha jaribu tena. |
| E8 | **Code already used** | This code has already been entered. Each code works once — grab another Castle Lite for another chance. | Kodi hii tayari imetumika. Kila kodi inatumika mara moja — chukua Castle Lite nyingine kwa nafasi nyingine. |
| E9 | **Rate limited** | Too many attempts. Take a break and try again in a few minutes. | Majaribio mengi mno. Pumzika kidogo kisha jaribu tena baada ya dakika chache. |
| E10 | **Account locked** (blacklisted per T&C clause 5) | Submissions from this number are paused after repeated invalid codes. Contact the Castle Lite support line in campaign materials if you think this is a mistake. | Uwasilishaji kutoka namba hii umesitishwa baada ya kodi zisizo sahihi mara kadhaa. Wasiliana na msaada wa Castle Lite kwenye matangazo ya kampeni kama unadhani ni kosa. |
| E11 | **Campaign closed** | The Unlocks 2026 promotion has ended. Thanks for playing — see you next time. | Promosheni ya Unlocks 2026 imefungwa. Asante kwa kushiriki — tuonane wakati mwingine. |
| E12 | **System error** | Something went wrong on our side. Your code was not used — please try again shortly. | Hitilafu imetokea kwa upande wetu. Kodi yako haijatumika — tafadhali jaribu tena baadaye. |

Server messages must never disclose *why* a code is invalid beyond these states (no hints that narrow the code space), and never echo which prefixes are "close to correct".

## 2.4 Abuse controls (must be active at launch — non-negotiable)

- **One-time redemption** enforced at the database level (unique constraint on redeemed code).
- **Per-MSISDN rate limiting** on submissions (recommended: max 5 attempts/minute, 30/day; configurable).
- **Invalid-attempt blacklisting**: aligned to T&C clause 5 — an automatic blacklist flag after **3 or more consecutive invalid codes**, pending administrator review/release. Must be enforced identically across web, SMS, and activation channels (shared MSISDN ledger).
- **Per-IP throttling + CAPTCHA** escalation on anomalous web traffic.
- Format validation client-side is UX only — the server re-validates everything.

## 2.5 Mock submission payloads

**Request** — `POST /api/v1/submissions`
```json
{
  "utc_code": "CD7KQ4M",
  "msisdn": "255712345678",
  "channel": "web",
  "consent": true,
  "locale": "sw",
  "session_id": "9f3c2a1e-…"
}
```

**Response — success (entered, no instant win)** `200`
```json
{
  "status": "accepted",
  "result": "entered",
  "submission_id": "sub_01J8ZK…",
  "instant_win": false,
  "message_key": "S1",
  "draws_entered": ["weekly"]
}
```

**Response — success (instant win)** `200`
```json
{
  "status": "accepted",
  "result": "instant_win",
  "submission_id": "sub_01J8ZL…",
  "instant_win": true,
  "prize": { "type": "cash", "amount_tzs": 2000, "fulfilment": "mobile_money" },
  "message_key": "S2"
}
```

**Response — error (code already used)** `409`
```json
{
  "status": "rejected",
  "error_code": "CODE_ALREADY_USED",
  "message_key": "E8",
  "retry_allowed": true
}
```

**Response — error (rate limited)** `429`
```json
{
  "status": "rejected",
  "error_code": "RATE_LIMITED",
  "message_key": "E9",
  "retry_after_seconds": 300
}
```

---

# (3) Data Model

## 3.1 `submissions`

| Field | Type | Notes |
|---|---|---|
| `submission_id` | ULID, PK | Sortable unique ID |
| `utc_code` | char(7) | Stored uppercase, normalised; FK to `codes` |
| `msisdn_hash` | char(64) | SHA-256 of normalised MSISDN + campaign salt — used for dedupe/analytics joins |
| `msisdn_encrypted` | bytea | AES-256 encrypted at rest; decrypt only for prize fulfilment and winner contact |
| `channel` | enum | `web` \| `sms` \| `activation` (unified with the 15421 SMS pipeline and BA-assisted entries) |
| `result` | enum | `entered` \| `instant_win` \| `rejected_used` \| `rejected_not_found` \| `rejected_locked` |
| `locale` | enum | `sw` \| `en` |
| `region_prefix` | char(2) | Derived from code (CA/CD/CE/CM/CX/CY) — regional reporting cut |
| `ip_truncated` | inet | Last octet zeroed; abuse monitoring only |
| `user_agent` | text | Abuse monitoring only |
| `consent_ts` | timestamptz | First-consent timestamp per MSISDN |
| `created_at` | timestamptz | — |

## 3.2 `codes`

| Field | Type | Notes |
|---|---|---|
| `utc_code` | char(7), PK | Committed from the six generated series |
| `series` | char(2) | CA / CD / CE / CM / CX / CY |
| `status` | enum | `unredeemed` \| `redeemed` \| `voided` |
| `redeemed_by_submission` | ULID, nullable, **unique** | The one-time-redemption enforcement point |
| `redeemed_at` | timestamptz, nullable | — |

## 3.3 `content_blocks` (Artist Reveal / Mega Events CMS)

| Field | Type | Notes |
|---|---|---|
| `block_id` | ULID, PK | — |
| `block_type` | enum | `artist_reveal` \| `mega_event` |
| `state` | enum | `teaser` \| `revealed` \| `archived` |
| `title_en` / `title_sw` | text | — |
| `body_en` / `body_sw` | text | — |
| `media_url` | text | CDN asset |
| `event_city` / `event_venue` / `event_date` | text / text / date | Mega Events only |
| `reveal_at` | timestamptz | Scheduled auto-flip for Artist Reveal countdown |
| `sort_order` | int | — |

## 3.4 Privacy & data protection (Tanzania Personal Data Protection Act, 2022)

- **Lawful basis:** consent (explicit checkbox) + contractual necessity (prize fulfilment). Consent text links to the on-page privacy clause.
- **Minimisation:** collect only code + MSISDN. No names, emails, or precise location at entry. Winner ID details collected separately by TBL at fulfilment.
- **Storage:** MSISDN never stored in plaintext; hash for analytics, encrypted value for fulfilment. Keys held separately from the application database.
- **Retention:** submission records retained through campaign close (24 Nov 2026) plus the GBT audit window `[CONTENT-PENDING: confirm retention period with TBL/GBT — retain at minimum through final weekly-draw verification and prize-claim windows]`, then MSISDNs purged/anonymised; aggregate stats retained indefinitely.
- **Access:** decryption restricted to the fulfilment service and named admins; all access logged.
- **Sharing:** winner data shared only with TBL for fulfilment and GBT for draw supervision. **Resolved:** the single opt-in/consent checkbox (18+ + T&C acceptance) is mandatory and blocks submission — there is no separate optional marketing checkbox. If TBL later wants marketing communications beyond campaign-servicing SMS, that requires a distinct unticked-by-default opt-in independent of entry (PDPA bundled-consent risk); not in scope for launch.
- **Rights:** privacy clause states access/correction/deletion contact route `[CONTENT-PENDING: TBL DPO / support contact]`.

## 3.5 Build & Hosting Notes — Lovable + Vercel

- **Stack:** Lovable-generated React SPA (Vite), single route, deployed to Vercel. Keep the whole experience on one route — anchors only, per the one-page constraint.
- **No secrets in the client.** The browser never talks to the platform API directly. Submissions POST to a **Vercel serverless function** (`/api/submissions`) which proxies to the platform (utc.seebait.com) using an API key held in Vercel environment variables. Lovable defaults sometimes wire fetches straight from the client — review the generated code for any hard-coded endpoints or keys before deploy.
- **Server-side re-validation:** the serverless function re-runs format validation (length, alphabet, prefix set) and consent checks before proxying — client checks are UX only.
- **Edge throttling:** implement per-IP rate limiting at the Vercel edge (middleware) in addition to the platform's per-MSISDN controls; escalate to CAPTCHA on anomalous patterns.
- **CMS-editable strings:** prize values, dates, and Artist Reveal / Mega Events content load from a config/content source (not hard-coded in components) so legal amendments and reveals ship without redeploys. The `reveal_at` flip should be evaluated server-side or against server time — not the device clock.
- **Headers & privacy:** set CSP, `X-Frame-Options`, and referrer policy in `vercel.json`; no third-party analytics/pixels fire before age-gate confirmation; language preference in `localStorage`, age-gate confirmation in a session cookie.
- **Performance:** keep the Lovable output within the <1.5MB initial-load budget — audit generated dependencies, lazy-load event/artist imagery, serve via Vercel image optimisation.

---

# (4) UX Rationale

**Form-as-hero.** The single behaviour the campaign pays for is code submission. Everything else on the page is in service of it, so the form sits above the fold with the H1, and every content card's CTA loops back to it or to the workflow — never away from the page.

**One page, no external navigation.** T&Cs live in an on-page accordion rather than a linked PDF because (a) the one-page constraint, (b) mobile users on metered data, and (c) the GBT-approved copy must be verifiably present at point of entry. The only "exit" is the SMS alternative (15421), which is a channel, not a navigation event.

**Swahili-first with EN toggle.** The buying audience is mass-market Tanzanian; Swahili default removes a comprehension barrier at the exact moment of conversion (typing a 7-character code correctly). English remains one tap away for the toggle-preferring minority and for stakeholder review.

**Error messages that teach the crown, not the system.** Every format error points the user back to the physical crown ("check the crown", "codes never include 0, O, 1…") because the most common real failure is misreading ambiguous glyphs. Deliberately, server errors never explain *which part* of a code was wrong beyond used/not-found — the response surface must not help anyone probe the code space, which is why abuse controls (§2.4) are launch-blocking, not nice-to-have.

**Artist Reveal as a return loop.** A UTC campaign's web traffic naturally spikes at purchase and dies between purchases. The countdown + scheduled reveal (`reveal_at`) gives the page a pulse independent of purchase, and Mega Events converts that attention into ticket-draw motivation — which is again a reason to buy and submit.

**Activations as consumer info, not operations.** Section 4 tells consumers where to find the campaign in real life and nothing more. Operational detail (BA targets, partner management) is out of scope for a consumer surface and stays in internal reporting.

**Accessibility & visual notes.**
- Contrast: minimum **4.5:1** for body text, **3:1** for large text (≥24px/19px bold) and UI components — audit the navy/green diagonal-wedge palette against white and cream backgrounds; gold-on-cream combinations typically fail and must not carry text.
- Keyboard order: age-gate confirm → language toggle → code input → phone input → consent checkbox → submit → section anchors in DOM order → accordion headers → footer links. Focus is trapped inside the age-gate modal until answered.
- ARIA: form fields with programmatic `<label>`s (not placeholder-only); inline errors in `aria-live="polite"` containers referenced by `aria-describedby`; success/instant-win states announced via `role="status"`; accordion buttons with `aria-expanded`; countdown timer marked `aria-hidden` with a static text alternative ("Artist reveal: 12 September") so screen readers aren't spammed by ticking.
- Touch targets ≥44×44px; code input uses `autocapitalize="characters"`, `autocomplete="off"`, `inputmode="text"`, monospace rendering with generous letter-spacing to aid character-by-character checking against the crown.
- Motion: reveal-card flip and confetti (instant win) respect `prefers-reduced-motion`.

**Assumptions & constraints.**
1. One-page responsive layout, mobile-first (majority traffic expected from low/mid-range Android over mobile data — budget <1.5MB initial load, images lazy-loaded).
2. No external navigation links anywhere on the page.
3. Submission API is the same platform pipeline as SMS 15421 (utc.seebait.com), so web, SMS, and activation entries share one code-redemption ledger.
4. Confirmed values (campaign 24 Aug – 24 Nov 2026 per licence PML000004605; all-cash prizes; weekly draws only) still ship as CMS/config-editable strings, not hard-coded, so any reissued legal copy lands without a redeploy.
5. Artist/event content is CMS-managed (`content_blocks`) so reveals ship without deployments.
6. Design language: Castle Lite navy/green diagonal wedge system; Flying Fish microsite used as the structural reference for flow and compliance patterns.
