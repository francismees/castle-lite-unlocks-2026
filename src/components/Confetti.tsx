import { useEffect, useMemo, useState } from 'react'
import { usePrefersReducedMotion } from '../lib/hooks'

/**
 * Instant-win celebration. Purely decorative: aria-hidden, and skipped entirely
 * when the visitor prefers reduced motion (spec §4).
 */
const COLOURS = ['#3DED8B', '#C6D2E4', '#C9A227', '#57F39C']

export function Confetti({ pieces = 42 }: { pieces?: number }) {
  const reduced = usePrefersReducedMotion()
  const [visible, setVisible] = useState(true)

  const bits = useMemo(
    () =>
      Array.from({ length: pieces }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.9,
        duration: 2.4 + Math.random() * 1.6,
        colour: COLOURS[i % COLOURS.length],
        drift: Math.random() * 24 - 12,
      })),
    [pieces],
  )

  useEffect(() => {
    const id = window.setTimeout(() => setVisible(false), 4200)
    return () => window.clearTimeout(id)
  }, [])

  if (reduced || !visible) return null

  return (
    <div className="confetti" aria-hidden="true">
      {bits.map((b) => (
        <i
          key={b.id}
          style={{
            left: `${b.left}%`,
            background: b.colour,
            animationDelay: `${b.delay}s`,
            animationDuration: `${b.duration}s`,
            marginLeft: `${b.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
