import { useEffect, useRef } from 'react'

/**
 * New Year's Eve fireworks behind the hero lock-up.
 *
 * A canvas that sits under the headline (z-index below the type, above the scrim) and
 * keeps its transparency: trails fade by erasing a little of the previous frame each
 * tick (destination-out), not by painting a colour over it, so the tunnel loop behind
 * still shows through. Bursts are additive, in the campaign's ice palette with the
 * odd Play Green and warm gold shell for celebration.
 *
 * It costs nothing when it cannot be seen: the loop stops while the hero is off
 * screen or the tab is hidden, and the parent does not mount it at all under
 * prefers-reduced-motion.
 */
const PALETTE = [
  [255, 255, 255], // crisp white
  [178, 222, 255], // ice
  [96, 170, 255],  // cold blue
  [47, 111, 255],  // cobalt
  [0, 200, 120],   // play green
  [255, 214, 120], // champagne gold
]
// White and ice dominate; green and gold are accents.
const WEIGHTS = [4, 4, 3, 2, 1, 1]

type Rocket = { x: number; y: number; vx: number; vy: number; ty: number; c: number[] }
type Spark = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: number[]; size: number }

function pick(): number[] {
  const total = WEIGHTS.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < WEIGHTS.length; i++) {
    r -= WEIGHTS[i]
    if (r <= 0) return PALETTE[i]
  }
  return PALETTE[0]
}

/**
 * `around` is the element the shells gather round (the lock-up). The canvas itself
 * covers the whole hero so no burst is ever clipped by a box edge; launches are aimed
 * at the lock-up's area, and each burst is sized so its sparks stay inside the canvas.
 */
export function Fireworks({ className, around }: { className?: string; around?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let w = 0
    let h = 0
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = () => {
      const r = canvas.getBoundingClientRect()
      w = r.width
      h = r.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const rockets: Rocket[] = []
    const sparks: Spark[] = []
    let nextLaunch = 0

    // Where to aim: the lock-up's box in canvas coordinates, widened a little so
    // shells open around the type, not only behind it. Falls back to the centre.
    const zone = () => {
      const a = around ? document.querySelector(around) : null
      const c = canvas.getBoundingClientRect()
      if (!a) return { x0: w * 0.15, x1: w * 0.85, y0: h * 0.12, y1: h * 0.5 }
      const r = a.getBoundingClientRect()
      const padX = r.width * 0.25
      return {
        x0: Math.max(0, r.left - c.left - padX),
        x1: Math.min(w, r.right - c.left + padX),
        y0: Math.max(0, r.top - c.top - r.height * 0.05),
        y1: Math.min(h, r.top - c.top + r.height * 0.6),
      }
    }

    const launch = (t: number) => {
      const z = zone()
      const x = z.x0 + Math.random() * (z.x1 - z.x0)
      const ty = z.y0 + Math.random() * (z.y1 - z.y0)
      // Speed to just reach ty under gravity: v = sqrt(2 g d).
      const g = 0.06
      const vy = -Math.sqrt(2 * g * (h - ty))
      rockets.push({ x, y: h, vx: (Math.random() - 0.5) * 0.6, vy, ty, c: pick() })
      // Occasional double launch, like a real show building to a peak.
      nextLaunch = t + 380 + Math.random() * 700
    }

    const burst = (r: Rocket) => {
      const n = 60 + Math.floor(Math.random() * 36)
      const scale = Math.min(1, w / 1400) + 0.35
      // A spark launched at speed v travels about v * REACH before it dies (drag
      // 0.975 per frame), plus a little gravity sag. Cap the shell so that reach
      // never crosses the nearest canvas edge: near an edge it opens smaller
      // instead of being cut off.
      const REACH = 36
      const room = Math.min(r.x, w - r.x, r.y, h - r.y) - 12
      const cap = Math.max(0.6, room / (REACH * scale))
      const speed = Math.min(2.6 + Math.random() * 1.8, cap)
      const second = Math.random() < 0.3 ? pick() : null
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + Math.random() * 0.1
        const s = speed * scale * (0.7 + Math.random() * 0.3)
        const max = 60 + Math.random() * 40
        sparks.push({
          x: r.x, y: r.y,
          vx: Math.cos(a) * s, vy: Math.sin(a) * s,
          life: max, max,
          c: second && i % 2 ? second : r.c,
          size: 1.6 + Math.random() * 1.4,
        })
      }
    }

    let raf = 0
    let running = false
    let last = 0
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame)
      // Fixed-step feel at any refresh rate: scale motion by elapsed 60fps frames.
      const k = last ? Math.min((t - last) / 16.67, 3) : 1
      last = t

      // Fade the previous frame towards transparent, which leaves the trails.
      ctx.globalCompositeOperation = 'destination-out'
      ctx.fillStyle = `rgba(0,0,0,${0.12 * k})`
      ctx.fillRect(0, 0, w, h)
      ctx.globalCompositeOperation = 'lighter'

      if (t > nextLaunch) {
        launch(t)
        if (Math.random() < 0.25) launch(t)
      }

      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]
        r.x += r.vx * k
        r.y += r.vy * k
        r.vy += 0.06 * k
        ctx.fillStyle = `rgba(${r.c[0]},${r.c[1]},${r.c[2]},0.9)`
        ctx.beginPath()
        ctx.arc(r.x, r.y, 1.6, 0, Math.PI * 2)
        ctx.fill()
        if (r.vy >= -0.4 || r.y <= r.ty) {
          burst(r)
          rockets.splice(i, 1)
        }
      }

      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i]
        s.vx *= Math.pow(0.975, k)
        s.vy = s.vy * Math.pow(0.975, k) + 0.035 * k
        s.x += s.vx * k
        s.y += s.vy * k
        s.life -= k
        if (s.life <= 0) {
          sparks.splice(i, 1)
          continue
        }
        const f = s.life / s.max
        // A late flicker as each spark dies, the way real stars twinkle out.
        const a = f < 0.3 && Math.random() < 0.35 ? 0 : Math.min(1, f * 1.4)
        ctx.fillStyle = `rgba(${s.c[0]},${s.c[1]},${s.c[2]},${a})`
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.size * (0.5 + f * 0.5), 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const start = () => {
      if (running) return
      running = true
      last = 0
      raf = requestAnimationFrame(frame)
    }
    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    let onScreen = true
    const sync = () => (onScreen && !document.hidden ? start() : stop())
    const io = new IntersectionObserver(([e]) => {
      onScreen = e.isIntersecting
      sync()
    })
    io.observe(canvas)
    document.addEventListener('visibilitychange', sync)
    sync()

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', sync)
    }
  }, [around])

  return <canvas ref={ref} className={className} aria-hidden="true" />
}
