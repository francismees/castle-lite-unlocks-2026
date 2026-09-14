import { useEffect, useRef, useState } from 'react'
import { now } from './serverTime'

/** True when the visitor has asked the OS to reduce motion (spec §4, accessibility). */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return reduced
}

/** Server-corrected clock, ticking once a second. Used by the tickets countdown. */
export function useTick(intervalMs = 1000): number {
  const [t, setT] = useState(() => now())
  useEffect(() => {
    const id = window.setInterval(() => setT(now()), intervalMs)
    return () => window.clearInterval(id)
  }, [intervalMs])
  return t
}

/**
 * Focus trap for the age-gate modal (spec §4: focus is trapped until answered).
 * Returns the ref to attach to the modal container.
 */
export function useFocusTrap(active: boolean) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active || !ref.current) return
    const node = ref.current

    const selector =
      'a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusables = () => Array.from(node.querySelectorAll<HTMLElement>(selector))

    focusables()[0]?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const items = focusables()
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active])

  return ref
}
