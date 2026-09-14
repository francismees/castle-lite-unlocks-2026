import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type { Locale } from '../config/campaign'
import { strings, type Str } from './strings'

/**
 * Swahili-first (spec §0). The choice persists in localStorage; the age-gate
 * confirmation is a session cookie, so language preference survives a return visit
 * while the age gate correctly does not.
 */
const STORAGE_KEY = 'cl_lang'
const DEFAULT_LOCALE: Locale = 'sw'

interface LanguageValue {
  lang: Locale
  setLang: (l: Locale) => void
  toggle: () => void
  /** Resolve an EN/SW pair against the active locale. */
  t: (s: Str) => string
  s: typeof strings
}

const LanguageContext = createContext<LanguageValue | null>(null)

function readStored(): Locale {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'en' || v === 'sw' ? v : DEFAULT_LOCALE
  } catch {
    return DEFAULT_LOCALE
  }
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Locale>(readStored)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Private mode / storage blocked — the in-memory choice still applies.
    }
  }, [lang])

  const setLang = useCallback((l: Locale) => setLangState(l), [])
  const toggle = useCallback(() => setLangState((l) => (l === 'sw' ? 'en' : 'sw')), [])
  const t = useCallback((pair: Str) => pair[lang], [lang])

  const value = useMemo<LanguageValue>(
    () => ({ lang, setLang, toggle, t, s: strings }),
    [lang, setLang, toggle, t],
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLang(): LanguageValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLang must be used inside <LanguageProvider>')
  return ctx
}
