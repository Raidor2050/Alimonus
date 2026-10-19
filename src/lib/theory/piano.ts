import { chordIntervals, parseChord } from './chords'
import { midiToName, type Accidental } from './notes'

export interface PianoVoicing {
  id: string
  label: string
  /** Right-hand MIDI notes. */
  right: number[]
  /** Left-hand MIDI notes (empty for right-hand-only shapes). */
  left: number[]
}

const INVERSION_NAMES = ['Root position', '1st inversion', '2nd inversion', '3rd inversion']

/** Root-position and inversion voicings, plus a two-hand voicing with the bass in the left hand. */
export function pianoVoicings(symbol: string): PianoVoicing[] {
  const chord = parseChord(symbol)
  if (!chord) return []
  // Keep compound intervals (9ths, 11ths) above the octave in root position.
  const ivs = chordIntervals(chord)
  const rootMidi = 60 + chord.root // C4..B4
  const base = ivs.map((i) => rootMidi + i)
  const bassMidi = 48 + (chord.bass ?? chord.root)

  const out: PianoVoicing[] = []
  const simple = [...new Set(ivs.map((i) => i % 12))].sort((a, b) => a - b).map((i) => rootMidi + i)
  const inversions = Math.min(simple.length, 4)
  for (let inv = 0; inv < inversions; inv++) {
    const notes = [...simple.slice(inv), ...simple.slice(0, inv).map((n) => n + 12)]
    // Keep the shape near middle C.
    const shift = notes[0] >= 67 ? -12 : 0
    out.push({
      id: `inv${inv}`,
      label: INVERSION_NAMES[inv],
      right: notes.map((n) => n + shift),
      left: chord.bass !== null ? [bassMidi] : [],
    })
  }
  out.push({
    id: 'two-hand',
    label: 'Two hands (bass + full chord)',
    left: chord.bass !== null ? [bassMidi - 12, bassMidi] : [rootMidi - 24, rootMidi - 24 + 7],
    right: base.length > 4 ? base.filter((n) => n - rootMidi !== 7) : base,
  })
  return out
}

export function midiNames(midi: number[], accidental: Accidental = 'sharp'): string[] {
  return midi.map((m) => midiToName(m, accidental))
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}
