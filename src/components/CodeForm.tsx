import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { campaign } from '../config/campaign'
import { now } from '../lib/serverTime'
import { normaliseCode, validateCode, validateMsisdn, type FieldErrorKey } from '../lib/validation'
import { submitCode, type SubmissionResult } from '../services/submission'
import { ResultCard } from './ResultCard'

/**
 * Section 1 — the form IS the hero (spec §4, "form-as-hero").
 *
 * Validation runs on blur and on submit, one error at a time, rendered inline below
 * the field it belongs to inside an aria-live="polite" region wired up through
 * aria-describedby. Client validation is UX only — the serverless proxy re-runs all
 * of it (spec §2.4).
 */

type ErrorField = 'code' | 'phone' | 'consent'
interface FieldError {
  field: ErrorField
  key: FieldErrorKey
}

export function CodeForm() {
  const { s, t, lang } = useLang()

  const [code, setCode] = useState('')
  const [phone, setPhone] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SubmissionResult | null>(null)

  const consentRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLInputElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)

  /**
   * D1 — the campaign-closed state keys off campaignEnd, read from config and
   * evaluated against server time so a wrong device clock can't reopen the form.
   */
  const campaignClosed = now() > new Date(campaign.campaignEnd).getTime()

  useEffect(() => {
    if (result) resultRef.current?.focus()
  }, [result])

  function showError(field: ErrorField, key: FieldErrorKey) {
    setError({ field, key })
  }

  function clearErrorFor(field: ErrorField) {
    setError((e) => (e?.field === field ? null : e))
  }

  function handleCodeBlur() {
    if (code.trim() === '') return clearErrorFor('code')
    const key = validateCode(code)
    if (key) showError('code', key)
    else clearErrorFor('code')
  }

  function handlePhoneBlur() {
    if (phone.trim() === '') return clearErrorFor('phone')
    const key = validateMsisdn(phone)
    if (key) showError('phone', key)
    else clearErrorFor('phone')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return

    // Field order mirrors the DOM and the spec's error table: code → phone → consent.
    const codeErr = validateCode(code)
    if (codeErr) {
      showError('code', codeErr)
      codeRef.current?.focus()
      return
    }

    const phoneErr = validateMsisdn(phone)
    if (phoneErr) {
      showError('phone', phoneErr)
      return
    }

    // The submit button carries aria-disabled rather than `disabled` precisely so an
    // attempted submit still reaches here and can explain itself (spec §2.1).
    if (!consent) {
      showError('consent', 'E6')
      consentRef.current?.focus()
      return
    }

    setError(null)
    setBusy(true)
    try {
      const res = await submitCode({ code, phone, locale: lang })
      setResult(res)
    } finally {
      setBusy(false)
    }
  }

  function reset() {
    setResult(null)
    setCode('')
    // The phone number is kept — a second bottle is entered on the same number — but
    // consent is re-taken, because it is blocking on *every* submission (spec §2.1).
    setConsent(false)
    setError(null)
    window.requestAnimationFrame(() => codeRef.current?.focus())
  }

  /* ── Campaign closed (E11) — terminal, no retry ───────────────────────── */
  if (campaignClosed) {
    return (
      <div className="card-form" id="entry">
        <div ref={resultRef} tabIndex={-1}>
          <ResultCard
            result={{ messageKey: 'E11', instantWin: false, retryAllowed: false }}
          />
        </div>
      </div>
    )
  }

  /* ── Result state replaces the form area ──────────────────────────────── */
  if (result) {
    // ACCOUNT_LOCKED is terminal for this number: offering "enter another code"
    // would invite exactly the retry behaviour the blacklist exists to stop.
    const terminal = result.messageKey === 'E10'
    return (
      <div className="card-form" id="entry">
        <div ref={resultRef} tabIndex={-1}>
          <ResultCard result={result} onReset={terminal ? undefined : reset} />
        </div>
      </div>
    )
  }

  const codeError = error?.field === 'code' ? error.key : null
  const phoneError = error?.field === 'phone' ? error.key : null
  const consentError = error?.field === 'consent' ? error.key : null

  return (
    <form className="card-form" id="entry" onSubmit={handleSubmit} noValidate>
      {/* ── Code ── */}
      <div className="field">
        <label htmlFor="utc-code">{t(s.form.codeLabel)}</label>
        <input
          id="utc-code"
          ref={codeRef}
          className="input input--code"
          type="text"
          value={code}
          // Normalise as the consumer types: trim, uppercase, strip spaces/hyphens.
          onChange={(e) => {
            setCode(normaliseCode(e.target.value))
            clearErrorFor('code')
          }}
          onBlur={handleCodeBlur}
          autoCapitalize="characters"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          inputMode="text"
          aria-invalid={codeError ? true : undefined}
          aria-describedby="code-hint code-err"
        />
        <p className="hint hint--mono" id="code-hint">
          {t(s.form.codeHint)}
        </p>
        <span className="err" id="code-err" aria-live="polite">
          {codeError ? t(s.errors[codeError]) : ''}
        </span>
      </div>

      {/* ── Phone ── */}
      <div className="field">
        <label htmlFor="msisdn">{t(s.form.phoneLabel)}</label>
        <input
          id="msisdn"
          className="input"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder={t(s.form.phonePlaceholder)}
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            clearErrorFor('phone')
          }}
          onBlur={handlePhoneBlur}
          aria-invalid={phoneError ? true : undefined}
          aria-describedby="phone-err"
        />
        <span className="err" id="phone-err" aria-live="polite">
          {phoneError ? t(s.errors[phoneError]) : ''}
        </span>
      </div>

      {/* ── Consent (never pre-checked) ── */}
      <div className="consent">
        <input
          id="age-consent"
          ref={consentRef}
          type="checkbox"
          checked={consent}
          onChange={(e) => {
            setConsent(e.target.checked)
            clearErrorFor('consent')
          }}
          aria-describedby="consent-err"
        />
        <label htmlFor="age-consent">
          <ConsentLabel />
        </label>
      </div>
      <span className="err" id="consent-err" aria-live="polite" style={{ marginTop: -14 }}>
        {consentError ? t(s.errors[consentError]) : ''}
      </span>

      <button
        type="submit"
        className="btn btn--primary btn--block"
        aria-disabled={!consent || busy}
      >
        {busy ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {t(s.form.submitting)}
          </>
        ) : (
          t(s.form.submit)
        )}
      </button>

    </form>
  )
}

/**
 * The consent sentence carries an in-page anchor on the words "Terms & Conditions"
 * so the consumer can read what they are accepting without leaving the page.
 */
function ConsentLabel() {
  const { s, t } = useLang()
  const full = t(s.form.consent)
  const linkText = t(s.form.consentLinkText)
  const at = full.indexOf(linkText)

  if (at === -1) return <>{full}</>

  return (
    <>
      {full.slice(0, at)}
      <a href="#terms">{linkText}</a>
      {full.slice(at + linkText.length)}
    </>
  )
}

