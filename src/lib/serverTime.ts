/**
 * Server-clock reference.
 *
 * Spec §3.5: the campaign-closed state must be evaluated
 * against server time, not the device clock — a consumer with a wrong phone clock
 * (common on low-end Android) must not see an open form after close.
 *
 * A HEAD against our own origin gives us the `Date` response header for free; no extra
 * endpoint, and it works identically on the Vercel edge and the Vite dev server.
 * If it fails we fall back to the device clock and simply behave as before.
 */

let offsetMs = 0
let synced = false

export async function syncServerTime(): Promise<void> {
  try {
    const res = await fetch(`${window.location.origin}/?t=${Date.now()}`, {
      method: 'HEAD',
      cache: 'no-store',
    })
    const header = res.headers.get('date')
    if (!header) return
    const serverNow = new Date(header).getTime()
    if (Number.isNaN(serverNow)) return
    offsetMs = serverNow - Date.now()
    synced = true
  } catch {
    // Offline or blocked — keep offsetMs at 0 and use the device clock.
  }
}

/** Current time in ms, corrected towards server time once sync has landed. */
export function now(): number {
  return Date.now() + offsetMs
}

export function isServerSynced(): boolean {
  return synced
}
