import { mod12, noteToPc, pcToName, preferredAccidental, type Accidental } from './notes'

/** Chord qualities keyed by canonical suffix. Intervals are semitones above the root. */
export const QUALITIES: Record<string, { intervals: number[]; label: string; family: ChordFamily }> = {
  '': { intervals: [0, 4, 7], label: 'major', family: 'Major' },
  m: { intervals: [0, 3, 7], label: 'minor', family: 'Minor' },
  dim: { intervals: [0, 3, 6], label: 'diminished', family: 'Diminished & augmented' },
  aug: { intervals: [0, 4, 8], label: 'augmented', family: 'Diminished & augmented' },
  sus2: { intervals: [0, 2, 7], label: 'suspended 2nd', family: 'Suspended' },
  sus4: { intervals: [0, 5, 7], label: 'suspended 4th', family: 'Suspended' },
  '5': { intervals: [0, 7], label: 'power chord', family: 'Major' },
  '6': { intervals: [0, 4, 7, 9], label: 'major 6th', family: 'Sixths & added' },
  m6: { intervals: [0, 3, 7, 9], label: 'minor 6th', family: 'Sixths & added' },
  '69': { intervals: [0, 4, 7, 9, 14], label: '6/9', family: 'Sixths & added' },
  add9: { intervals: [0, 4, 7, 14], label: 'add 9', family: 'Sixths & added' },
  madd9: { intervals: [0, 3, 7, 14], label: 'minor add 9', family: 'Sixths & added' },
  '7': { intervals: [0, 4, 7, 10], label: 'dominant 7th', family: 'Sevenths' },
  maj7: { intervals: [0, 4, 7, 11], label: 'major 7th', family: 'Sevenths' },
  m7: { intervals: [0, 3, 7, 10], label: 'minor 7th', family: 'Sevenths' },
  mMaj7: { intervals: [0, 3, 7, 11], label: 'minor-major 7th', family: 'Sevenths' },
  dim7: { intervals: [0, 3, 6, 9], label: 'diminished 7th', family: 'Diminished & augmented' },
  m7b5: { intervals: [0, 3, 6, 10], label: 'half-diminished', family: 'Diminished & augmented' },
  aug7: { intervals: [0, 4, 8, 10], label: 'augmented 7th', family: 'Diminished & augmented' },
  '7sus4': { intervals: [0, 5, 7, 10], label: '7 suspended 4th', family: 'Suspended' },
  '7sus2': { intervals: [0, 2, 7, 10], label: '7 suspended 2nd', family: 'Suspended' },
  '9': { intervals: [0, 4, 7, 10, 14], label: 'dominant 9th', family: 'Extended' },
  maj9: { intervals: [0, 4, 7, 11, 14], label: 'major 9th', family: 'Extended' },
  m9: { intervals: [0, 3, 7, 10, 14], label: 'minor 9th', family: 'Extended' },
  '11': { intervals: [0, 7, 10, 14, 17], label: 'dominant 11th', family: 'Extended' },
  m11: { intervals: [0, 3, 7, 10, 14, 17], label: 'minor 11th', family: 'Extended' },
  '13': { intervals: [0, 4, 7, 10, 14, 21], label: 'dominant 13th', family: 'Extended' },
  '7b9': { intervals: [0, 4, 7, 10, 13], label: '7 flat 9', family: 'Extended' },
  '7#9': { intervals: [0, 4, 7, 10, 15], label: '7 sharp 9', family: 'Extended' },
  '7b5': { intervals: [0, 4, 6, 10], label: '7 flat 5', family: 'Extended' },
}

export type ChordFamily =
  | 'Major'
  | 'Minor'
  | 'Sevenths'
  | 'Suspended'
  | 'Diminished & augmented'
  | 'Sixths & added'
  | 'Extended'

export const CHORD_FAMILIES: ChordFamily[] = [
  'Major',
  'Minor',
  'Sevenths',
  'Suspended',
  'Diminished & augmented',
  'Sixths & added',
  'Extended',
]

/** Alias -> canonical suffix. Matching is case-sensitive because "M7" ≠ "m7". */
const ALIASES: Record<string, string> = {
  '': '', M: '', maj: '', major: '',
  m: 'm', min: 'm', '-': 'm', minor: 'm',
  dim: 'dim', '°': 'dim', o: 'dim',
  aug: 'aug', '+': 'aug', '#5': 'aug',
  sus2: 'sus2', '2': 'sus2',
  sus4: 'sus4', sus: 'sus4', '4': 'sus4',
  '5': '5',
  '6': '6', maj6: '6', M6: '6',
  m6: 'm6', min6: 'm6', '-6': 'm6',
  '69': '69', '6/9': '69', '6add9': '69',
  add9: 'add9', add2: 'add9', 'maj(add9)': 'add9',
  madd9: 'madd9', 'm(add9)': 'madd9', madd2: 'madd9',
  '7': '7', dom7: '7',
  maj7: 'maj7', M7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7', ma7: 'maj7', j7: 'maj7',
  m7: 'm7', min7: 'm7', '-7': 'm7', mi7: 'm7',
  mMaj7: 'mMaj7', mM7: 'mMaj7', 'm(maj7)': 'mMaj7', mmaj7: 'mMaj7', '-Δ7': 'mMaj7',
  dim7: 'dim7', '°7': 'dim7', o7: 'dim7',
  m7b5: 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5', 'm7(b5)': 'm7b5', '-7b5': 'm7b5',
  aug7: 'aug7', '+7': 'aug7', '7#5': 'aug7', '7+': 'aug7',
  '7sus4': '7sus4', '7sus': '7sus4', sus7: '7sus4',
  '7sus2': '7sus2',
  '9': '9', dom9: '9',
  maj9: 'maj9', M9: 'maj9', 'Δ9': 'maj9',
  m9: 'm9', min9: 'm9', '-9': 'm9',
  '11': '11',
  m11: 'm11', min11: 'm11',
  '13': '13',
  '7b9': '7b9', '7(b9)': '7b9',
  '7#9': '7#9', '7(#9)': '7#9',
  '7b5': '7b5', '7(b5)': '7b5',
}

export interface ParsedChord {
  root: number
  rootName: string
  /** Suffix exactly as written, preserved through transposition. */
  suffix: string
  quality: string
  bass: number | null
  bassName: string | null
}

const CHORD_RE = /^([A-G](?:#|b|♯|♭)?)([^/\s]*)(?:\/([A-G](?:#|b|♯|♭)?))?$/

export function parseChord(symbol: string): ParsedChord | null {
  const s = symbol.trim()
  const m = CHORD_RE.exec(s)
  if (!m) return null
  const root = noteToPc(m[1])
  if (root === null) return null
  const quality = ALIASES[m[2]]
  if (quality === undefined) return null
  const bass = m[3] ? noteToPc(m[3]) : null
  return { root, rootName: m[1], suffix: m[2], quality, bass, bassName: m[3] ?? null }
}

export function isChord(token: string): boolean {
  return parseChord(token) !== null
}

export function chordIntervals(chord: ParsedChord): number[] {
  return QUALITIES[chord.quality].intervals
}

/** Pitch classes of a chord, root first; slash bass appended if it isn't already a chord tone. */
export function chordPitchClasses(chord: ParsedChord): number[] {
  const pcs = chordIntervals(chord).map((i) => mod12(chord.root + i))
  const unique = [...new Set(pcs)]
  if (chord.bass !== null && !unique.includes(chord.bass)) unique.push(chord.bass)
  return unique
}

export function formatChord(chord: ParsedChord, accidental: Accidental): string {
  const root = pcToName(chord.root, accidental)
  const bass = chord.bass !== null ? `/${pcToName(chord.bass, accidental)}` : ''
  return `${root}${chord.suffix}${bass}`
}

/** Spelling used when the caller doesn't force sharps or flats. */
export type SpellingPref = Accidental | 'auto'

/**
 * Transpose a chord symbol by `semitones`. Unknown tokens are returned unchanged
 * so that sheet text like "N.C." or "x2" survives transposition.
 */
export function transposeChord(symbol: string, semitones: number, pref: SpellingPref = 'auto', keyPc?: number): string {
  const chord = parseChord(symbol)
  if (!chord) return symbol
  if (semitones === 0 && pref === 'auto') return symbol
  const shifted: ParsedChord = {
    ...chord,
    root: mod12(chord.root + semitones),
    bass: chord.bass === null ? null : mod12(chord.bass + semitones),
  }
  let accidental: Accidental
  if (pref !== 'auto') accidental = pref
  else if (keyPc !== undefined) accidental = preferredAccidental(keyPc + semitones, false)
  else accidental = /b|♭/.test(chord.rootName.slice(1)) ? 'flat' : preferredAccidental(shifted.root, chord.quality.startsWith('m') && !chord.quality.startsWith('maj'))
  return formatChord(shifted, accidental)
}

export interface ParsedKey {
  tonic: number
  minor: boolean
}

export function parseKey(key: string | null | undefined): ParsedKey | null {
  if (!key) return null
  const m = /^([A-G](?:#|b)?)\s*(m|min|minor|maj|major)?$/i.exec(key.trim())
  if (!m) return null
  const tonic = noteToPc(m[1][0].toUpperCase() + m[1].slice(1))
  if (tonic === null) return null
  return { tonic, minor: !!m[2] && /^m(in(or)?)?$/i.test(m[2]) }
}

export function formatKey(key: ParsedKey, pref: SpellingPref = 'auto'): string {
  const acc = pref === 'auto' ? preferredAccidental(key.tonic, key.minor) : pref
  return `${pcToName(key.tonic, acc)}${key.minor ? 'm' : ''}`
}

export function transposeKey(key: string, semitones: number, pref: SpellingPref = 'auto'): string {
  const k = parseKey(key)
  if (!k) return key
  return formatKey({ tonic: mod12(k.tonic + semitones), minor: k.minor }, pref)
}

/** Chord shapes beginners can play in open position; used for capo suggestions. */
const OPEN_FRIENDLY = new Set(['C', 'A', 'G', 'E', 'D', 'Am', 'Em', 'Dm', 'A7', 'E7', 'D7', 'G7', 'C7', 'B7', 'Am7', 'Em7', 'Dm7', 'Cmaj7', 'Fmaj7', 'Asus2', 'Asus4', 'Dsus2', 'Dsus4', 'Esus4', 'Cadd9', 'Gsus4'])

function shapeDifficulty(symbol: string): number {
  const c = parseChord(symbol)
  if (!c) return 0
  const plain = formatChord({ ...c, bass: null }, 'sharp')
  if (OPEN_FRIENDLY.has(plain)) return 0
  if (plain === 'F' || plain === 'Bm') return 2
  return 3
}

export interface CapoSuggestion {
  capo: number
  shapes: string[]
  difficulty: number
}

/** For chords sounding as written, find capo positions that give the easiest open shapes. */
export function suggestCapo(chords: string[], maxCapo = 7): CapoSuggestion[] {
  const unique = [...new Set(chords.filter(isChord))]
  const out: CapoSuggestion[] = []
  for (let capo = 0; capo <= maxCapo; capo++) {
    const shapes = unique.map((c) => transposeChord(c, -capo, 'sharp'))
    out.push({ capo, shapes, difficulty: shapes.reduce((s, c) => s + shapeDifficulty(c), 0) })
  }
  return out.sort((a, b) => a.difficulty - b.difficulty || a.capo - b.capo)
}

/** Diatonic chords of a key, for progression builders. */
export function diatonicChords(key: ParsedKey, sevenths = false): { roman: string; symbol: string }[] {
  const acc = preferredAccidental(key.tonic, key.minor)
  const steps = key.minor ? [0, 2, 3, 5, 7, 8, 10] : [0, 2, 4, 5, 7, 9, 11]
  const triads = key.minor ? ['m', 'dim', '', 'm', 'm', '', ''] : ['', 'm', 'm', '', '', 'm', 'dim']
  const sev = key.minor ? ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'] : ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5']
  const romans = key.minor ? ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'] : ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°']
  return steps.map((s, i) => ({
    roman: romans[i],
    symbol: `${pcToName(key.tonic + s, acc)}${(sevenths ? sev : triads)[i]}`,
  }))
}

export const ROOT_CHOICES = ['C', 'C#', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']
export const QUALITY_CHOICES = Object.keys(QUALITIES)
