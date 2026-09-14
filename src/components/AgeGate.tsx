import { useCallback, useState } from 'react'
import { useLang } from '../i18n/LanguageContext'
import { useFocusTrap } from '../lib/hooks'
import { UnlocksLockup } from './BrandMark'
import { LanguageToggle } from './LanguageToggle'

/**
 * Section 0 — age gate.
 *
 * Blocks every byte of page content until answered. Logo only: no product imagery
 * before confirmation. Confirmation is a *session* cookie — no persistent tracking
 * before consent (spec §0 Section 0). Decline is terminal for the session: the gate
 * must not loop back.
 */
export type GateState = 'pending' | 'confirmed' | 'declined'

const COOKIE = 'cl_age_ok'
const DECLINED_KEY = 'cl_age_declined'

export function readGateState(): GateState {
  try {
    if (sessionStorage.getItem(DECLINED_KEY) === '1') return 'declined'
  } catch {
    /* storage blocked — fall through to the cookie check */
  }
  return document.cookie.split('; ').some((c) => c.startsWith(`${COOKIE}=1`))
    ? 'confirmed'
    : 'pending'
}

export function AgeGate({ onResolve }: { onResolve: (state: GateState) => void }) {
  const { s, t } = useLang()
  const [declined, setDeclined] = useState(false)
  const trapRef = useFocusTrap(true)

  const confirm = useCallback(() => {
    // Session cookie: no Expires/Max-Age, so it dies with the browser session.
    const secure = window.location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${COOKIE}=1; path=/; SameSite=Lax${secure}`
    onResolve('confirmed')
  }, [onResolve])

  const decline = useCallback(() => {
    try {
      sessionStorage.setItem(DECLINED_KEY, '1')
    } catch {
      /* storage blocked — the in-memory state below still holds for this view */
    }
    setDeclined(true)
    onResolve('declined')
  }, [onResolve])

  return (
    <div
      className="gate"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gate-heading"
      aria-describedby="gate-body"
      ref={trapRef}
    >
      <div className="gate__panel">
        <div className="gate__logo">
          <UnlocksLockup className="unlocks-lockup unlocks-lockup--gate" label="Castle Lite Unlocks" />
        </div>

        {declined ? (
          <>
            <h1 id="gate-heading">{t(s.ageGate.declined)}</h1>
            <p id="gate-body" className="visually-hidden">
              {t(s.ageGate.body)}
            </p>
          </>
        ) : (
          <>
            <h1 id="gate-heading">{t(s.ageGate.heading)}</h1>
            <p id="gate-body">{t(s.ageGate.body)}</p>

            <div className="gate__actions">
              <button type="button" className="btn btn--primary btn--block" onClick={confirm}>
                {t(s.ageGate.confirm)}
              </button>
              <button type="button" className="btn btn--ghost btn--block" onClick={decline}>
                {t(s.ageGate.decline)}
              </button>
            </div>

            <div className="gate__note">
              <LanguageToggle />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
