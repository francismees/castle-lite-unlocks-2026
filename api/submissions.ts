/**
 * POST /api/submissions — Vercel serverless proxy to the UTC platform.
 *
 * Why this exists (spec §3.5): the browser must never talk to utc.seebait.com
 * directly. The platform API key lives only in this function's environment, and the
 * client bundle contains no endpoint or credential for the platform.
 *
 * Responsibilities:
 *   1. Re-run every format check the client ran — client validation is UX only (§2.4).
 *   2. Independently reject any payload with consent !== true (§2.1).
 *   3. Best-effort per-IP throttling on top of the platform's per-MSISDN controls.
 *   4. Never echo the key, never leak upstream detail, never widen the error surface
 *      beyond the documented message keys (§2.3 — responses must not help anyone
 *      probe the code space).
 */
import { campaign } from '../src/config/campaign'
import { normaliseCode, normaliseMsisdn, validateCode } from '../src/lib/validation'

interface VercelRequest {
  method?: string
  body?: unknown
  headers: Record<string, string | string[] | undefined>
}

interface VercelResponse {
  status: (code: number) => VercelResponse
  setHeader: (name: string, value: string) => void
  json: (body: unknown) => void
}

/**
 * Best-effort in-memory throttle. A serverless instance is not a shared store, so
 * this only catches bursts hitting the same warm instance.
 * [PRODUCTION] Back this with Vercel KV / Upstash before launch so the limit holds
 * across instances and regions — abuse controls are launch-blocking (spec §2.4).
 */
const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 5
const hits = new Map<string, number[]>()

function throttled(key: string): boolean {
  const nowMs = Date.now()
  const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < WINDOW_MS)
  recent.push(nowMs)
  hits.set(key, recent)
  return recent.length > MAX_PER_WINDOW
}

/** Abuse monitoring only — the last octet is zeroed before it is used or logged (§3.1). */
function truncateIp(raw: string): string {
  const ip = raw.split(',')[0].trim()
  if (ip.includes('.')) {
    const parts = ip.split('.')
    if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`
  }
  if (ip.includes(':')) return `${ip.split(':').slice(0, 4).join(':')}::`
  return ip
}

function reject(
  res: VercelResponse,
  status: number,
  errorCode: string,
  messageKey: string,
  extra: Record<string, unknown> = {},
) {
  res.status(status).json({
    status: 'rejected',
    error_code: errorCode,
    message_key: messageKey,
    retry_allowed: status !== 403,
    ...extra,
  })
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store')

  if (req.method !== 'POST') {
    return reject(res, 405, 'METHOD_NOT_ALLOWED', 'E12')
  }

  const header = req.headers['x-forwarded-for']
  const ip = truncateIp(Array.isArray(header) ? header[0] : (header ?? 'unknown'))

  const body = (req.body ?? {}) as Record<string, unknown>
  const rawCode = typeof body.utc_code === 'string' ? body.utc_code : ''
  const rawMsisdn = typeof body.msisdn === 'string' ? body.msisdn : ''

  // 2 — consent is blocking on every submission, checked here independently of the UI.
  if (body.consent !== true) {
    return reject(res, 400, 'CONSENT_REQUIRED', 'E6')
  }

  // D1 — entries close at campaignEnd, enforced server-side so a wrong device clock
  // (or a tampered client) cannot submit into a closed campaign.
  if (Date.now() > new Date(campaign.campaignEnd).getTime()) {
    return reject(res, 403, 'CAMPAIGN_CLOSED', 'E11')
  }

  // 3 — throttle before doing any work, and before touching the upstream.
  if (throttled(ip)) {
    return reject(res, 429, 'RATE_LIMITED', 'E9', { retry_after_seconds: 300 })
  }

  // 1 — re-run the client's format checks. A malformed code is reported as
  // "not found" rather than as a format error: the response must not tell an attacker
  // which part of the code space is shaped correctly.
  const code = normaliseCode(rawCode)
  const msisdn = normaliseMsisdn(rawMsisdn)
  if (validateCode(code) !== null || msisdn === null) {
    return reject(res, 404, 'CODE_NOT_FOUND', 'E7')
  }

  const upstream = process.env.PLATFORM_API_URL
  const key = process.env.PLATFORM_API_KEY
  if (!upstream || !key) {
    // Fail closed and say nothing about the configuration.
    return reject(res, 503, 'SERVICE_UNAVAILABLE', 'E12')
  }

  try {
    const platformRes = await fetch(upstream, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        utc_code: code,
        msisdn,
        channel: 'web',
        consent: true,
        locale: body.locale === 'en' ? 'en' : 'sw',
        session_id: typeof body.session_id === 'string' ? body.session_id : undefined,
        ip_truncated: ip,
      }),
    })

    const payload = await platformRes.json()

    // Pass the platform's documented envelope through unchanged (§2.5). Anything the
    // platform did not shape into that envelope collapses to the generic system error.
    if (typeof payload?.status === 'string' && typeof payload?.message_key === 'string') {
      res.status(platformRes.status).json(payload)
      return
    }

    return reject(res, 502, 'UPSTREAM_ERROR', 'E12')
  } catch {
    return reject(res, 502, 'UPSTREAM_ERROR', 'E12')
  }
}
