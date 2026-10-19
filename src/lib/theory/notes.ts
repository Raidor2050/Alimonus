// Core pitch-class utilities. Pitch classes are 0..11 with C = 0.

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const

export type Accidental = 'sharp' | 'flat'

const LETTER_PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** Parse a note name like "C", "F#", "Bb", "E♭", "Cb", "B#" into a pitch class. */
export function noteToPc(name: string): number | null {
  const m = /^([A-Ga-g])([#b♯♭]{0,2})$/.exec(name.trim())
  if (!m) return null
  let pc = LETTER_PC[m[1].toUpperCase()]
  for (const ch of m[2]) pc += ch === '#' || ch === '♯' ? 1 : -1
  return mod12(pc)
}

export function mod12(n: number): number {
  return ((n % 12) + 12) % 12
}

export function pcToName(pc: number, accidental: Accidental = 'sharp'): string {
  return (accidental === 'flat' ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)]
}

/** Keys conventionally spelled with flats (major key tonic pitch classes). */
const FLAT_MAJOR_KEYS = new Set([5, 10, 3, 8, 1, 6]) // F Bb Eb Ab Db Gb
/** Minor tonics conventionally spelled with flats: D G C F Bb Eb minor */
const FLAT_MINOR_KEYS = new Set([2, 7, 0, 5, 10, 3])

export function preferredAccidental(keyPc: number, minor = false): Accidental {
  return (minor ? FLAT_MINOR_KEYS : FLAT_MAJOR_KEYS).has(mod12(keyPc)) ? 'flat' : 'sharp'
}

/** MIDI note number -> frequency (A4 = 69). */
export function midiToFreq(midi: number, a4 = 440): number {
  return a4 * Math.pow(2, (midi - 69) / 12)
}

export function freqToMidi(freq: number, a4 = 440): number {
  return 69 + 12 * Math.log2(freq / a4)
}

export function midiToName(midi: number, accidental: Accidental = 'sharp'): string {
  return `${pcToName(midi, accidental)}${Math.floor(midi / 12) - 1}`
}

/** Parse scientific pitch like "E2" or "Bb3" into MIDI. */
export function nameToMidi(name: string): number | null {
  const m = /^([A-Ga-g][#b]?)(-?\d)$/.exec(name.trim())
  if (!m) return null
  const pc = noteToPc(m[1])
  if (pc === null) return null
  // Compute from the letter so Cb4 / B#3 land in the right octave.
  const letterPc = LETTER_PC[m[1][0].toUpperCase()]
  const shift = pc - letterPc
  const wrap = shift > 6 ? -12 : shift < -6 ? 12 : 0
  return (Number(m[2]) + 1) * 12 + letterPc + shift + wrap
}
