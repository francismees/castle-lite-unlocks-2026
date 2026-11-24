import { useId, type ReactElement } from 'react'
import { SNOWCASTLE_H, SNOWCASTLE_PATH, SNOWCASTLE_W } from '../brand/snowcastle'

/**
 * A stack of Castle Lite notes for a prize card, drawn in isometric so the amounts read as
 * size: the TZS 2,000 instant win is a small fan of loose notes, the TZS 100,000 draw a
 * stack of bundles, the TZS 1,000,000 draw a block of them. All three share one viewBox
 * and one scale, so the difference between the cards is real, not resized.
 *
 * The note is a campaign note, not a copy of any real currency, and carries no currency
 * sign or figure (Francis, 24 Nov 2026): Jolt Blue paper, a white frame, fine line-work,
 * and the snowcastle mark in a roundel at its centre. It is drawn flat once, then laid
 * onto every top face with the isometric matrix, so each note is the same artwork.
 */

type Level = 1 | 2 | 3

const COS = Math.cos(Math.PI / 6)
const SIN = 0.5
// One note / bundle footprint (x along the note's length, z across it) and bundle depth.
const W = 64
const D = 30
const H = 7
// The flat note is drawn at 10× and scaled down onto the face.
const NW = W * 10
const ND = D * 10

/** Columns of bundles as [x, z, count], back to front so the painting order is right. */
const LAYOUT: Record<Level, Array<[number, number, number]>> = {
  1: [],
  2: [[0, 0, 5]],
  3: [
    [0, -D - 4, 9],
    [W + 4, -D - 4, 7],
    [0, 0, 8],
    [W + 4, 0, 10],
  ],
}

/**
 * 182 wide fits the big block's footprint (±85). 182 tall fits it too: its back corner
 * rises 49 above the ground line and the bundles another 70, its front corner drops 49
 * below. Each level sets its own ground line from its footprint, so every stack's front
 * corner lands just inside the foot of the box and nothing is clipped.
 */
const VB = { w: 182, h: 182 }
const FOOT_PAD = 5

export function MoneyStack({ level }: { level: Level }) {
  const id = useId().replace(/:/g, '')
  const spanX = level === 3 ? 2 * W + 4 : W
  const spanZ = level === 3 ? 2 * D + 4 : D
  const zMin = level === 3 ? -D - 4 : 0
  const cx = spanX / 2
  const cz = zMin + spanZ / 2
  // How far the nearest corner sits below the ground point; the loose fan is turned up to
  // 16°, which reaches a little further.
  const drop = (spanX / 2 + spanZ / 2) * SIN + (level === 1 ? 8 : 0)
  const groundY = VB.h - FOOT_PAD - drop

  const xy = (x: number, y: number, z: number): [number, number] => {
    const dx = x - cx
    const dz = z - cz
    return [VB.w / 2 + (dx - dz) * COS, groundY + (dx + dz) * SIN - y]
  }
  const pts = (...ps: Array<[number, number, number]>) =>
    ps.map((q) => xy(...q).map((n) => n.toFixed(2)).join(',')).join(' ')

  /** The flat note laid on the plane at height y, its corner at (x, z), turned by deg. */
  const note = (x: number, y: number, z: number, key: string, deg = 0) => {
    const [ox, oy] = xy(x, y, z)
    const k = 0.1
    const iso = `matrix(${COS * k} ${SIN * k} ${-COS * k} ${SIN * k} ${ox} ${oy})`
    const turn = deg ? ` rotate(${deg} ${NW / 2} ${ND / 2})` : ''
    return <use key={key} href={`#${id}-note`} transform={iso + turn} />
  }

  /** A bundle: front (z + D) and right (x + W) edges of stacked paper, the note on top, a band. */
  const bundle = (x: number, y: number, z: number, key: string) => {
    const front = pts([x, y, z + D], [x + W, y, z + D], [x + W, y + H, z + D], [x, y + H, z + D])
    const right = pts([x + W, y, z], [x + W, y, z + D], [x + W, y + H, z + D], [x + W, y + H, z])
    const b0 = x + W * 0.14
    const b1 = x + W * 0.24
    return (
      <g key={key}>
        <polygon points={front} fill={`url(#${id}-edgeF)`} />
        <polygon points={front} fill={`url(#${id}-sheets)`} />
        <polygon points={right} fill={`url(#${id}-edgeR)`} />
        <polygon points={right} fill={`url(#${id}-sheetsR)`} opacity="0.6" />
        {note(x, y + H, z, `${key}-top`)}
        {/* Paper band, off-centre so the snowcastle stays clear. */}
        <polygon points={pts([b0, y + H, z], [b1, y + H, z], [b1, y + H, z + D], [b0, y + H, z + D])} fill="#f4f7ff" />
        <polygon points={pts([b0, y, z + D], [b1, y, z + D], [b1, y + H, z + D], [b0, y + H, z + D])} fill="#d5def6" />
      </g>
    )
  }

  const shapes: ReactElement[] = []
  if (level === 1) {
    // A small fan of loose notes, as if just paid out.
    const x = cx - W / 2
    const z = cz - D / 2
    shapes.push(note(x, 0, z, 'n1', -16), note(x, 0.8, z, 'n2', -4), note(x, 1.6, z, 'n3', 9))
  } else {
    // Paint far to near: in this projection nearness is x + z.
    const cols = [...LAYOUT[level]].sort((a, b) => a[0] + a[1] - (b[0] + b[1]))
    for (const [x, z, n] of cols) for (let i = 0; i < n; i++) shapes.push(bundle(x, i * H, z, `${x}_${z}_${i}`))
  }

  const glow = level === 3 ? 0.8 : level === 2 ? 0.55 : 0.4
  const glowR = level === 3 ? 90 : level === 2 ? 56 : 46
  const logoW = 150
  const logoH = (logoW * SNOWCASTLE_H) / SNOWCASTLE_W

  return (
    <svg className={`money money--${level}`} viewBox={`0 0 ${VB.w} ${VB.h}`} preserveAspectRatio="xMidYMax meet" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-paper`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3d5cf0" />
          <stop offset="0.5" stopColor="#1335d8" />
          <stop offset="1" stopColor="#0e28a6" />
        </linearGradient>
        <radialGradient id={`${id}-sheen`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
        {/* Fine engraving: two sets of hairlines crossing, the note's security work. */}
        <pattern id={`${id}-guilloche`} width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <path d="M0 7h14" stroke="#ffffff" strokeOpacity="0.09" strokeWidth="1.2" />
          <path d="M7 0v14" stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1.2" />
        </pattern>
        {/* Bundle edges: a stack of thin blue sheets, lit from the left. */}
        {/* Sheet lines run along each face's long edge: +30° on the front, −30° on the right. */}
        <pattern id={`${id}-sheets`} width="3" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
          <rect y="0.75" width="3" height="0.35" fill="#0b1f86" fillOpacity="0.55" />
        </pattern>
        <pattern id={`${id}-sheetsR`} width="3" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(-30)">
          <rect y="0.75" width="3" height="0.35" fill="#0b1f86" fillOpacity="0.55" />
        </pattern>
        <linearGradient id={`${id}-edgeF`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#b4c3ff" />
          <stop offset="1" stopColor="#7f97f7" />
        </linearGradient>
        <linearGradient id={`${id}-edgeR`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#4a66e6" />
          <stop offset="1" stopColor="#2a46c8" />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop offset="0" stopColor="#7d9bff" stopOpacity={glow} />
          <stop offset="1" stopColor="#1335d8" stopOpacity="0" />
        </radialGradient>

        {/* The note, flat, 640 × 300. */}
        <g id={`${id}-note`}>
          <rect width={NW} height={ND} rx="10" fill={`url(#${id}-paper)`} stroke="#0a1f8f" strokeWidth="3" />
          <rect width={NW} height={ND} rx="10" fill={`url(#${id}-guilloche)`} />
          <rect x="14" y="14" width={NW - 28} height={ND - 28} rx="6" fill="none" stroke="#ffffff" strokeOpacity="0.75" strokeWidth="5" />
          <rect x="26" y="26" width={NW - 52} height={ND - 52} rx="4" fill="none" stroke="#ffffff" strokeOpacity="0.3" strokeWidth="2" />
          {/* Side rosettes, echoing the roundel. */}
          <circle cx="110" cy={ND / 2} r="56" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3" />
          <circle cx="110" cy={ND / 2} r="40" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
          <circle cx={NW - 110} cy={ND / 2} r="56" fill="none" stroke="#ffffff" strokeOpacity="0.28" strokeWidth="3" />
          <circle cx={NW - 110} cy={ND / 2} r="40" fill="none" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="2" />
          {/* Centre roundel with the snowcastle. */}
          <circle cx={NW / 2} cy={ND / 2} r="118" fill={`url(#${id}-sheen)`} />
          <circle cx={NW / 2} cy={ND / 2} r="104" fill="#0e28a6" stroke="#ffffff" strokeWidth="6" />
          <circle cx={NW / 2} cy={ND / 2} r="92" fill="none" stroke="#ffffff" strokeOpacity="0.4" strokeWidth="2" />
          <g transform={`translate(${NW / 2 - logoW / 2} ${ND / 2 - logoH / 2}) scale(${logoW / SNOWCASTLE_W})`}>
            <path d={SNOWCASTLE_PATH} fill="#ffffff" />
          </g>
        </g>
      </defs>

      <ellipse cx={VB.w / 2} cy={groundY + drop * 0.35} rx={glowR} ry={glowR * 0.36} fill={`url(#${id}-glow)`} />
      <g className="money__stack">{shapes}</g>
      {level === 3 && (
        <g className="money__glints" fill="#ffffff">
          <path d="M26 34 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" />
          <path d="M156 44 l1.5 4.5 4.5 1.5 -4.5 1.5 -1.5 4.5 -1.5 -4.5 -4.5 -1.5 4.5 -1.5z" />
          <path d="M112 12 l1.2 3.6 3.6 1.2 -3.6 1.2 -1.2 3.6 -1.2 -3.6 -3.6 -1.2 3.6 -1.2z" />
        </g>
      )}
    </svg>
  )
}
