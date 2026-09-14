/**
 * Client-side normalisation + validation (spec §2.1, §2.2).
 *
 * This is UX only. The serverless proxy (api/submissions.ts) re-runs every one of
 * these checks, and the platform re-validates again — a client that skips this
 * must not be able to get a malformed payload accepted (spec §2.4).
 */
import { campaign } from '../config/campaign'

export type CodeErrorKey = 'E1' | 'E2' | 'E3' | 'E4'
export type PhoneErrorKey = 'E5'
export type FieldErrorKey = CodeErrorKey | PhoneErrorKey | 'E6'

/** trim → uppercase → strip internal spaces and hyphens. */
export function normaliseCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s-]/g, '')
}

/**
 * Strip formatting, drop a leading +, and render as 255XXXXXXXXX (12 digits).
 * Returns null when the input is not a recognisable Tanzanian mobile number.
 */
export function normaliseMsisdn(raw: string): string | null {
  const cleaned = raw.trim().replace(/[\s()\-.]/g, '').replace(/^\+/, '')

  // 07XXXXXXXX / 06XXXXXXXX
  const local = /^0([67]\d{8})$/.exec(cleaned)
  if (local) return `255${local[1]}`

  // 2557XXXXXXXX / 2556XXXXXXXX (with or without the + already removed)
  const intl = /^255([67]\d{8})$/.exec(cleaned)
  if (intl) return `255${intl[1]}`

  return null
}

/**
 * Error precedence follows the spec table order: empty → length → alphabet → prefix.
 * Returns null when the code is well-formed.
 */
export function validateCode(raw: string): CodeErrorKey | null {
  const code = normaliseCode(raw)
  if (code.length === 0) return 'E1'
  if (code.length !== campaign.code.length) return 'E2'

  // Anything outside the 28-character campaign alphabet — which is exactly the set
  // that excludes the ambiguous glyphs 0/O, 1/I, 2/Z, 8/B — plus any symbol.
  for (const char of code) {
    if (!campaign.code.alphabet.includes(char)) return 'E3'
  }

  if (!campaign.code.prefixes.includes(code.slice(0, 2) as never)) return 'E4'

  return null
}

export function validateMsisdn(raw: string): PhoneErrorKey | null {
  return normaliseMsisdn(raw) === null ? 'E5' : null
}

/** Derived regional reporting cut (spec §3.1 `region_prefix`). */
export function regionPrefix(code: string): string {
  return normaliseCode(code).slice(0, 2)
}
