import { motion } from 'motion/react'
import type { GuitarVoicing, Tuning } from '@/lib/theory/guitar'
import { voicingNoteNames } from '@/lib/theory/guitar'
import type { Accidental } from '@/lib/theory/notes'

/**
 * SVG chord box. Strings run vertically (low E on the left), frets horizontally.
 * Shows open (○) and muted (×) strings, barres, finger numbers and note names.
 */
export function GuitarDiagram({
  voicing,
  tuning,
  name,
  size = 1,
  showNotes = true,
  accidental = 'sharp',
}: {
  voicing: GuitarVoicing
  tuning: Tuning
  name?: string
  size?: number
  showNotes?: boolean
  accidental?: Accidental
}) {
  const strings = voicing.frets.length
  const frets = 5
  const W = 150
  const left = 22
  const right = 14
  const top = name ? 46 : 28
  const sx = (W - left - right) / (strings - 1)
  const fy = 26
  const H = top + fy * frets + (showNotes ? 34 : 14)
  const base = voicing.baseFret
  const x = (s: number) => left + s * sx
  const y = (f: number) => top + (f - base + 0.5) * fy
  const notes = voicingNoteNames(voicing, tuning, accidental)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W * size} height={H * size} role="img" aria-label={`${name ?? 'Chord'} guitar diagram: ${voicing.frets.map((f) => (f === null ? 'x' : f)).join(' ')}`}>
      {name && (
        <text x={W / 2} y={18} textAnchor="middle" className="fill-white" fontFamily="var(--font-mono)" fontWeight="700" fontSize="15">
          {name}
        </text>
      )}
      {/* nut or position marker */}
      {base === 1 ? (
        <rect x={left - 1} y={top - 4} width={W - left - right + 2} height={4} rx={1.5} fill="#ece9f7" />
      ) : (
        <text x={left - 8} y={top + fy * 0.5 + 4} textAnchor="end" fontSize="10" fontFamily="var(--font-mono)" fill="var(--color-mute)">
          {base}fr
        </text>
      )}
      {Array.from({ length: frets + 1 }, (_, i) => (
        <line key={`f${i}`} x1={left} x2={W - right} y1={top + i * fy} y2={top + i * fy} stroke="rgb(255 255 255 / 0.18)" strokeWidth={1} />
      ))}
      {Array.from({ length: strings }, (_, s) => (
        <line key={`s${s}`} x1={x(s)} x2={x(s)} y1={top} y2={top + frets * fy} stroke="rgb(255 255 255 / 0.32)" strokeWidth={1 + (strings - 1 - s) * 0.18} />
      ))}
      {/* open / muted markers */}
      {voicing.frets.map((f, s) =>
        f === null ? (
          <text key={`m${s}`} x={x(s)} y={top - 9} textAnchor="middle" fontSize="11" fill="var(--color-mute)" fontFamily="var(--font-mono)">
            ×
          </text>
        ) : f === 0 ? (
          <circle key={`o${s}`} cx={x(s)} cy={top - 12} r={4} fill="none" stroke="var(--a2)" strokeWidth={1.5} />
        ) : null,
      )}
      {/* barre */}
      {voicing.barre && (
        <motion.rect
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          style={{ transformOrigin: `${x(voicing.barre.from)}px ${y(voicing.barre.fret)}px` }}
          x={x(voicing.barre.from) - 8}
          y={y(voicing.barre.fret) - 8}
          width={x(voicing.barre.to) - x(voicing.barre.from) + 16}
          height={16}
          rx={8}
          fill="var(--a1)"
          opacity={0.9}
        />
      )}
      {/* fretted notes */}
      {voicing.frets.map((f, s) => {
        if (f === null || f === 0) return null
        if (voicing.barre && f === voicing.barre.fret && voicing.fingers[s] === 1 && s !== voicing.barre.from) return null
        const finger = voicing.fingers[s]
        return (
          <motion.g key={`n${s}`} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 22, delay: s * 0.03 }} style={{ transformOrigin: `${x(s)}px ${y(f)}px` }}>
            <circle cx={x(s)} cy={y(f)} r={8.5} fill="var(--a1)" style={{ filter: 'drop-shadow(0 0 5px rgb(var(--glow) / 0.7))' }} />
            {finger && (
              <text x={x(s)} y={y(f) + 3.5} textAnchor="middle" fontSize="10" fontWeight="700" fill="#07060b" fontFamily="var(--font-mono)">
                {finger}
              </text>
            )}
          </motion.g>
        )
      })}
      {showNotes &&
        notes.map((n, s) => (
          <text key={`t${s}`} x={x(s)} y={top + frets * fy + 16} textAnchor="middle" fontSize="9" fill={n ? 'var(--color-soft)' : 'transparent'} fontFamily="var(--font-mono)">
            {n ?? ''}
          </text>
        ))}
      {showNotes &&
        tuning.notes.map((n, s) => (
          <text key={`tu${s}`} x={x(s)} y={top + frets * fy + 29} textAnchor="middle" fontSize="7.5" fill="var(--color-mute)" fontFamily="var(--font-mono)" opacity={0.7}>
            {n.replace(/\d/, '')}
          </text>
        ))}
    </svg>
  )
}
