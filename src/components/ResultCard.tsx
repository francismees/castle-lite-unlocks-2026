import { useLang } from '../i18n/LanguageContext'
import { formatPrize } from '../config/campaign'
import type { ResultKey, SubmissionResult } from '../services/submission'
import { Confetti } from './Confetti'

/**
 * §2.3 result states, rendered in place of the form and announced via role="status".
 *
 * Note the deliberate information discipline (spec §4): none of these messages say
 * *why* a code failed beyond used / not-found, and none hint at which part of the
 * code was close to correct. The response surface must not help anyone probe the
 * code space.
 */
const SUCCESS_KEYS: ResultKey[] = ['S1', 'S2']

export function ResultCard({
  result,
  onReset,
}: {
  result: SubmissionResult
  /** Omitted for terminal states (campaign closed, account locked). */
  onReset?: () => void
}) {
  const { s, t, lang } = useLang()
  const key = result.messageKey
  const isSuccess = SUCCESS_KEYS.includes(key)
  const isWin = key === 'S2'

  const tone = isWin ? 'win' : isSuccess ? 'ok' : 'err'
  const icon = isWin ? '🎉' : isSuccess ? '✓' : '!'

  return (
    <>
      {isWin && <Confetti />}
      <div className={`result result--${tone}`} role="status" aria-live="polite">
        <div className="result__icon" aria-hidden="true">
          {icon}
        </div>

        {isWin && <span className="result__badge">{t(s.results.winnerBadge)}</span>}

        <p className="result__msg">{t(s.results[key])}</p>

        {result.prize && (
          <p className="result__meta">
            {formatPrize(result.prize.amount_tzs, lang)} · mobile money
          </p>
        )}

        {onReset && result.retryAllowed && (
          <button type="button" className="btn btn--outline-dark btn--block" onClick={onReset}>
            {t(s.form.reset)}
          </button>
        )}
      </div>
    </>
  )
}
