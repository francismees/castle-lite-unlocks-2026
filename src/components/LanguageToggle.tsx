import { useLang } from '../i18n/LanguageContext'

/**
 * SW / EN toggle, pinned top-right (spec: Swahili-first, English one tap away).
 * Rendered as two aria-pressed buttons rather than a switch so screen-reader users
 * hear which language is active, not just that a control exists.
 */
export function LanguageToggle() {
  const { lang, setLang, s, t } = useLang()

  return (
    <div className="langtoggle" role="group" aria-label={t(s.meta.langToggleLabel)}>
      <button
        type="button"
        lang="sw"
        aria-pressed={lang === 'sw'}
        aria-label={t(s.meta.switchToSw)}
        onClick={() => setLang('sw')}
      >
        SW
      </button>
      <button
        type="button"
        lang="en"
        aria-pressed={lang === 'en'}
        aria-label={t(s.meta.switchToEn)}
        onClick={() => setLang('en')}
      >
        EN
      </button>
    </div>
  )
}
