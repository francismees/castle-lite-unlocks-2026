import { useEffect, useState } from 'react'

/**
 * A word that "loads": its letters scramble, then lock in left to right, then hold.
 * Shared by the surprise headliner in the line-up card (EventsMap) and the surprise
 * slot in the hero line-up (ArtistPopIn), so the two read as the same device.
 *
 * `loop` repeats scramble → decode → hold for as long as `running` is true (the
 * line-up card); without it the word decodes once and stays (the hero, where the
 * slide itself hands over). Ticks at a terminal's pace, about 18 a second, not the
 * display's, and stops entirely when `running` goes false.
 */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ#?*+/<>0123456789'
export const SCRAMBLE_MS = 900
export const DECODE_MS = 1100
const HOLD_MS = 2600
const CYCLE_MS = SCRAMBLE_MS + DECODE_MS + HOLD_MS

export function useScramble(word: string, running: boolean, loop = true): string {
  const [text, setText] = useState(word)

  useEffect(() => {
    if (!running) {
      setText(word)
      return
    }
    let raf = 0
    let last = 0
    const start = performance.now()
    const rand = () => GLYPHS[(Math.random() * GLYPHS.length) | 0]
    const frame = (nowMs: number) => {
      const elapsed = nowMs - start
      if (!loop && elapsed >= SCRAMBLE_MS + DECODE_MS) {
        setText(word)
        return
      }
      raf = requestAnimationFrame(frame)
      if (nowMs - last < 55) return
      last = nowMs
      const k = loop ? elapsed % CYCLE_MS : elapsed
      const locked =
        k < SCRAMBLE_MS ? 0 : k < SCRAMBLE_MS + DECODE_MS ? Math.floor(((k - SCRAMBLE_MS) / DECODE_MS) * word.length) : word.length
      let out = ''
      for (let i = 0; i < word.length; i++) out += word[i] === ' ' || i < locked ? word[i] : rand()
      setText(out)
    }
    raf = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(raf)
  }, [word, running, loop])

  return text
}

/**
 * The scrambling word, with an invisible copy of the final word holding the width so
 * the narrower and wider glyphs never move the layout. aria-hidden: callers give
 * screen readers a plain sentence instead.
 */
export function ScrambleText({ word, running, loop, className }: { word: string; running: boolean; loop?: boolean; className?: string }) {
  const text = useScramble(word, running, loop)
  return (
    <span className={`scramble${className ? ` ${className}` : ''}`} aria-hidden="true">
      <span className="scramble__sizer">{word}</span>
      <span className="scramble__live">{text}</span>
    </span>
  )
}
