/**
 * Vercel Edge Middleware — first line of the abuse controls (spec §2.4, §3.5).
 *
 * Per-IP throttling here sits *in addition to* the platform's per-MSISDN limits and
 * the serverless function's own check. Edge instances do not share memory, so this
 * catches broad bursts, not a distributed attack.
 *
 * [PRODUCTION] Replace the in-memory counter with Vercel KV / Upstash and wire the
 * CAPTCHA escalation path before launch — the spec treats abuse controls as
 * launch-blocking, not nice-to-have.
 */
export const config = {
  matcher: ['/api/:path*'],
}

const WINDOW_MS = 60_000
const MAX_PER_WINDOW = 12
const hits = new Map<string, number[]>()

export default function middleware(request: Request): Response | undefined {
  const ip =
    request.headers.get('x-real-ip') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'

  const nowMs = Date.now()
  const recent = (hits.get(ip) ?? []).filter((t) => nowMs - t < WINDOW_MS)
  recent.push(nowMs)
  hits.set(ip, recent)

  if (recent.length > MAX_PER_WINDOW) {
    return new Response(
      JSON.stringify({
        status: 'rejected',
        error_code: 'RATE_LIMITED',
        message_key: 'E9',
        retry_allowed: true,
        retry_after_seconds: 300,
      }),
      {
        status: 429,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '300', 'Cache-Control': 'no-store' },
      },
    )
  }

  return undefined
}
