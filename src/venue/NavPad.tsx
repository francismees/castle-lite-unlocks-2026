import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent } from 'react'
import type { VenueScene } from './scene'

/**
 * The on-screen camera controls in the walkthrough's bottom-right corner.
 *
 * Built for someone who has never orbited a 3D model and will not discover that
 * dragging the canvas does it. So: two plainly named modes instead of an icon
 * vocabulary ("Move mode", the default, and "Turn mode"), one pad of four big arrows
 * whose meaning follows the mode (its hub shows which),
 * and + / − for closer and further. Every button can be held down to keep going,
 * which is what people do with an arrow they expect to work like a car's.
 *
 *  Move mode  ▲ ▼ walk forward / back, ◀ ▶ step sideways
 *  Turn mode  ◀ ▶ swing round the spot you're looking at, ▲ ▼ look from higher / lower
 *  + −   closer / further
 *
 * Speeds are per second of holding and scaled by frame time, so a slow phone moves at
 * the same pace as a fast laptop. A tap, or Enter / Space, gives one short step.
 */

type Mode = 'turn' | 'move'
type Dir = 'up' | 'down' | 'left' | 'right'

/** Per second of holding. Turn is in radians; Move is in pivot distances. */
const TURN_YAW = 1.1
const TURN_TILT = 0.6
const MOVE = 0.45
const ZOOM = 1.1
/** What one tap or key press is worth, in seconds of holding. */
const TAP_STEP = 0.22
/** How long a press waits before it starts repeating, in ms. */
const HOLD_DELAY = 220

export function NavPad({ scene }: { scene: VenueScene | null }) {
  const [mode, setMode] = useState<Mode>('move')
  const raf = useRef(0)
  const sceneRef = useRef(scene)
  sceneRef.current = scene

  const apply = useCallback((what: Dir | 'in' | 'out', dt: number, m: Mode) => {
    const sc = sceneRef.current
    if (!sc) return
    if (what === 'in') return sc.zoom(Math.exp(-ZOOM * dt))
    if (what === 'out') return sc.zoom(Math.exp(ZOOM * dt))
    const x = what === 'left' ? -1 : what === 'right' ? 1 : 0
    const y = what === 'up' ? 1 : what === 'down' ? -1 : 0
    if (m === 'turn') sc.turn(-x * TURN_YAW * dt, y * TURN_TILT * dt)
    else sc.move(x * MOVE * dt, y * MOVE * dt)
  }, [])

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    raf.current = 0
  }, [])
  useEffect(() => stop, [stop])

  const hold = (what: Dir | 'in' | 'out') => ({
    onPointerDown: (e: RPointerEvent<HTMLButtonElement>) => {
      if (e.button !== 0) return
      e.currentTarget.setPointerCapture(e.pointerId)
      stop()
      const m = mode
      // A quick tap lifts before the first frame, so it would do nothing at all: every
      // press moves one short step at once, and holding carries on from there after a
      // beat, the way a key repeats.
      apply(what, TAP_STEP, m)
      let last = performance.now() + HOLD_DELAY
      const tick = (now: number) => {
        // Capped, so a frame lost to a tab switch is not one enormous jump.
        if (now > last) {
          apply(what, Math.min(0.05, (now - last) / 1000), m)
          last = now
        }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: stop,
    // A click with detail 0 came from the keyboard; pointer presses are handled above.
    onClick: (e: React.MouseEvent) => {
      if (e.detail === 0) apply(what, TAP_STEP, mode)
    },
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
  })

  const label: Record<Mode, Record<Dir, string>> = {
    turn: { up: 'Look from higher', down: 'Look from lower', left: 'Turn left', right: 'Turn right' },
    move: { up: 'Move forward', down: 'Move back', left: 'Move left', right: 'Move right' },
  }

  return (
    <div className="venue__nav" role="group" aria-label="Move around the venue">
      <div className="venue__navmode" role="radiogroup" aria-label="What the arrows do">
        {(['move', 'turn'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={mode === m}
            className={`venue__navmodebtn${mode === m ? ' is-on' : ''}`}
            onClick={() => setMode(m)}
          >
            {m === 'move' ? 'Move mode' : 'Turn mode'}
          </button>
        ))}
      </div>

      <div className="venue__navbody">
        <div className={`venue__pad venue__pad--${mode}`}>
          {(['up', 'right', 'down', 'left'] as const).map((d) => (
            <button
              key={d}
              type="button"
              className={`venue__padbtn venue__padbtn--${d}`}
              aria-label={label[mode][d]}
              title={label[mode][d]}
              {...hold(d)}
            >
              <Chevron dir={d} />
            </button>
          ))}
          <span className="venue__padhub" aria-hidden="true">
            {mode === 'turn' ? <TurnIcon /> : <MoveIcon />}
          </span>
        </div>

        <div className="venue__zoom">
          <button type="button" className="venue__zoombtn" aria-label="Closer" title="Closer" {...hold('in')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button type="button" className="venue__zoombtn" aria-label="Further" title="Further" {...hold('out')}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}

function Chevron({ dir }: { dir: Dir }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir]
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" style={{ transform: `rotate(${rot}deg)` }}>
      <path d="M6 14.5 12 8.5l6 6" />
    </svg>
  )
}

function TurnIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
      <path d="M19.8 4.2v3.9h-3.9" />
    </svg>
  )
}

function MoveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v18M3 12h18" />
      <path d="M9.5 5.5 12 3l2.5 2.5M9.5 18.5 12 21l2.5-2.5M5.5 9.5 3 12l2.5 2.5M18.5 9.5 21 12l-2.5 2.5" />
    </svg>
  )
}
