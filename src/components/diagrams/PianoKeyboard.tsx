import { motion } from 'motion/react'
import { isBlackKey } from '@/lib/theory/piano'
import { midiToName, pcToName, type Accidental } from '@/lib/theory/notes'

/**
 * Responsive SVG keyboard. Highlights right-hand notes in accent 1, left-hand notes in
 * accent 2 and marks the root with a ring. Range auto-fits the notes (min two octaves).
 */
export function PianoKeyboard({
  right = [],
  left = [],
  rootPc,
  accidental = 'sharp',
  from,
  to,
  showLabels = true,
  onKey,
  height = 120,
}: {
  right?: number[]
  left?: number[]
  rootPc?: number
  accidental?: Accidental
  from?: number
  to?: number
  showLabels?: boolean
  onKey?: (midi: number) => void
  height?: number
}) {
  const all = [...right, ...left]
  let lo = from ?? (all.length ? Math.min(...all) : 48)
  let hi = to ?? (all.length ? Math.max(...all) : 72)
  // start on a C / end on a B for a tidy keyboard
  lo = lo - (((lo % 12) + 12) % 12)
  hi = hi + (11 - (((hi % 12) + 12) % 12))
  if (hi - lo < 23) hi = lo + 23
  const whites: number[] = []
  for (let m = lo; m <= hi; m++) if (!isBlackKey(m)) whites.push(m)
  const ww = 22
  const W = whites.length * ww
  const H = 100
  const bw = 14
  const bh = 62
  const whiteIndex = new Map(whites.map((m, i) => [m, i]))
  const rset = new Set(right)
  const lset = new Set(left)

  const fillFor = (m: number, black: boolean) => (rset.has(m) ? 'var(--a1)' : lset.has(m) ? 'var(--a2)' : black ? '#16131f' : '#ece9f7')

  return (
    <svg viewBox={`0 0 ${W} ${H + (showLabels ? 16 : 0)}`} style={{ width: '100%', height }} preserveAspectRatio="xMidYMin meet" role="img" aria-label={`Piano: ${[...left, ...right].map((m) => midiToName(m, accidental)).join(', ') || 'no notes'}`}>
      {whites.map((m, i) => {
        const on = rset.has(m) || lset.has(m)
        return (
          <g key={m} onClick={onKey ? () => onKey(m) : undefined} style={{ cursor: onKey ? 'pointer' : undefined }}>
            <rect x={i * ww + 0.5} y={0.5} width={ww - 1} height={H - 1} rx={3} fill={fillFor(m, false)} stroke="#07060b" />
            {on && (
              <motion.circle
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                style={{ transformOrigin: `${i * ww + ww / 2}px ${H - 14}px` }}
                cx={i * ww + ww / 2}
                cy={H - 14}
                r={rootPc !== undefined && ((m % 12) + 12) % 12 === rootPc ? 5 : 3.5}
                fill="#07060b"
                stroke={rootPc !== undefined && ((m % 12) + 12) % 12 === rootPc ? '#07060b' : 'none'}
              />
            )}
            {m % 12 === 0 && !on && (
              <text x={i * ww + ww / 2} y={H - 8} textAnchor="middle" fontSize="8" fill="#8d88a3" fontFamily="var(--font-mono)">
                C{Math.floor(m / 12) - 1}
              </text>
            )}
          </g>
        )
      })}
      {Array.from({ length: hi - lo + 1 }, (_, k) => lo + k)
        .filter(isBlackKey)
        .map((m) => {
          const wi = whiteIndex.get(m - 1)!
          const xpos = (wi + 1) * ww - bw / 2
          const on = rset.has(m) || lset.has(m)
          return (
            <g key={m} onClick={onKey ? () => onKey(m) : undefined} style={{ cursor: onKey ? 'pointer' : undefined }}>
              <rect x={xpos} y={0} width={bw} height={bh} rx={2.5} fill={fillFor(m, true)} stroke="#07060b" />
              {on && <circle cx={xpos + bw / 2} cy={bh - 10} r={rootPc !== undefined && ((m % 12) + 12) % 12 === rootPc ? 4.5 : 3} fill="#07060b" />}
            </g>
          )
        })}
      {showLabels &&
        [...new Set(all)]
          .sort((a, b) => a - b)
          .map((m) => {
            const black = isBlackKey(m)
            const wi = black ? whiteIndex.get(m - 1)! + 1 : whiteIndex.get(m)! + 0.5
            return (
              <text key={`l${m}`} x={wi * ww} y={H + 12} textAnchor="middle" fontSize="8.5" fontWeight="700" fill={rset.has(m) ? 'var(--a1)' : 'var(--a2)'} fontFamily="var(--font-mono)">
                {pcToName(m, accidental)}
                <tspan fontSize="6.5" fill="var(--color-mute)">{Math.floor(m / 12) - 1}</tspan>
              </text>
            )
          })}
    </svg>
  )
}
