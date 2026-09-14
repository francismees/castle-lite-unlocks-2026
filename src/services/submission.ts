/**
 * Submission service.
 *
 * ── INTEGRATION POINT ────────────────────────────────────────────────────────────
 * `submitCode()` is the only thing the UI calls. Today it routes to `mockSubmit()`
 * so the whole result-state surface is testable without the platform. To go live:
 *
 *   1. Deploy `api/submissions.ts` (the Vercel serverless proxy) and set
 *      PLATFORM_API_URL + PLATFORM_API_KEY in Vercel env vars.
 *   2. Set USE_MOCK to false below (or drive it from an env flag).
 *
 * The browser must never call utc.seebait.com directly — the API key lives only in
 * the serverless function's environment (spec §3.5).
 * ─────────────────────────────────────────────────────────────────────────────────
 */
import { campaign, type Locale } from '../config/campaign'
import { normaliseCode, normaliseMsisdn } from '../lib/validation'

/** Flip to false once the serverless proxy is wired to the platform. */
const USE_MOCK = true

export type ResultKey = 'S1' | 'S2' | 'E7' | 'E8' | 'E9' | 'E10' | 'E11' | 'E12'

export interface SubmissionRequest {
  utc_code: string
  msisdn: string
  channel: 'web'
  consent: true
  locale: Locale
  session_id: string
}

export interface SubmissionResult {
  /** Which microcopy block to render (maps 1:1 to strings.results). */
  messageKey: ResultKey
  instantWin: boolean
  submissionId?: string
  prize?: { type: 'cash'; amount_tzs: number; fulfilment: 'mobile_money' }
  retryAllowed: boolean
  retryAfterSeconds?: number
}

/** Stable per-tab id, mirrors `session_id` in the spec payload (§2.5). */
export function getSessionId(): string {
  const KEY = 'cl_session_id'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
}

export async function submitCode(input: {
  code: string
  phone: string
  locale: Locale
}): Promise<SubmissionResult> {
  const payload: SubmissionRequest = {
    utc_code: normaliseCode(input.code),
    // validateMsisdn() has already run in the form; the ?? is belt-and-braces.
    msisdn: normaliseMsisdn(input.phone) ?? '',
    channel: 'web',
    consent: true,
    locale: input.locale,
    session_id: getSessionId(),
  }

  if (USE_MOCK) return mockSubmit(payload)

  try {
    const res = await fetch(campaign.SUBMISSION_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = await res.json()
    return mapResponse(res.status, body)
  } catch {
    return { messageKey: 'E12', instantWin: false, retryAllowed: true }
  }
}

/** Translate the documented wire format (§2.5) into the UI's result shape. */
function mapResponse(status: number, body: Record<string, unknown>): SubmissionResult {
  const key = body.message_key as ResultKey | undefined

  if (status === 200 && body.status === 'accepted') {
    const win = body.result === 'instant_win'
    return {
      messageKey: key ?? (win ? 'S2' : 'S1'),
      instantWin: win,
      submissionId: body.submission_id as string | undefined,
      prize: body.prize as SubmissionResult['prize'],
      retryAllowed: true,
    }
  }

  return {
    messageKey: key ?? 'E12',
    instantWin: false,
    retryAllowed: body.retry_allowed !== false,
    retryAfterSeconds: body.retry_after_seconds as number | undefined,
  }
}

/* ───────────────────────────── Mock implementation ─────────────────────────────
 * Deterministic, so QA and stakeholder review can reach every state on demand
 * rather than resubmitting until the dice land. The trigger is the code's final
 * character (all of these are valid campaign-alphabet characters, so the codes
 * below pass client validation and exercise the server-state path):
 *
 *   …W  instant win (S2)      …X  code not found (E7)     …U  already used (E8)
 *   …R  rate limited (E9)     …L  account locked (E10)    …S  system error (E12)
 *   anything else             entered (S1)
 * ──────────────────────────────────────────────────────────────────────────────── */
async function mockSubmit(payload: SubmissionRequest): Promise<SubmissionResult> {
  await new Promise((r) => setTimeout(r, 900))

  const last = payload.utc_code.slice(-1)

  switch (last) {
    case 'W':
      return {
        messageKey: 'S2',
        instantWin: true,
        submissionId: `sub_${crypto.randomUUID().slice(0, 10)}`,
        prize: { type: 'cash', amount_tzs: campaign.instantPrize, fulfilment: 'mobile_money' },
        retryAllowed: true,
      }
    case 'X':
      return { messageKey: 'E7', instantWin: false, retryAllowed: true }
    case 'U':
      return { messageKey: 'E8', instantWin: false, retryAllowed: true }
    case 'R':
      return { messageKey: 'E9', instantWin: false, retryAllowed: true, retryAfterSeconds: 300 }
    case 'L':
      return { messageKey: 'E10', instantWin: false, retryAllowed: false }
    case 'S':
      return { messageKey: 'E12', instantWin: false, retryAllowed: true }
    default:
      return {
        messageKey: 'S1',
        instantWin: false,
        submissionId: `sub_${crypto.randomUUID().slice(0, 10)}`,
        retryAllowed: true,
      }
  }
}
