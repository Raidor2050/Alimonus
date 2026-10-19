import { chordIntervals, chordPitchClasses, parseChord, type ParsedChord } from './chords'
import { mod12, nameToMidi, pcToName, type Accidental } from './notes'

export interface Tuning {
  id: string
  name: string
  /** Scientific pitch names, lowest string first. */
  notes: string[]
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: 'Standard (EADGBE)', notes: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'half-down', name: 'Half step down (E♭)', notes: ['Eb2', 'Ab2', 'Db3', 'Gb3', 'Bb3', 'Eb4'] },
  { id: 'full-down', name: 'Whole step down (D)', notes: ['D2', 'G2', 'C3', 'F3', 'A3', 'D4'] },
  { id: 'drop-d', name: 'Drop D (DADGBE)', notes: ['D2', 'A2', 'D3', 'G3', 'B3', 'E4'] },
  { id: 'dadgad', name: 'DADGAD', notes: ['D2', 'A2', 'D3', 'G3', 'A3', 'D4'] },
  { id: 'open-g', name: 'Open G (DGDGBD)', notes: ['D2', 'G2', 'D3', 'G3', 'B3', 'D4'] },
  { id: 'open-d', name: 'Open D (DADF#AD)', notes: ['D2', 'A2', 'D3', 'F#3', 'A3', 'D4'] },
  { id: 'open-e', name: 'Open E (EBEG#BE)', notes: ['E2', 'B2', 'E3', 'G#3', 'B3', 'E4'] },
]

export function getTuning(id: string | undefined): Tuning {
  return TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]
}

export function tuningMidi(t: Tuning): number[] {
  return t.notes.map((n) => nameToMidi(n) ?? 40)
}

export interface GuitarVoicing {
  /** Fret per string, lowest string first. null = muted, 0 = open. */
  frets: (number | null)[]
  fingers: (number | null)[]
  barre: { fret: number; from: number; to: number } | null
  /** First fret shown in the diagram (1 for open position). */
  baseFret: number
  score: number
}

/** Remove the fifth (and for 11ths, the third) from the "must sound" set, like a guitarist would. */
function requiredPcs(chord: ParsedChord): number[] {
  const ivs = chordIntervals(chord)
  let req = ivs
  if (ivs.length > 3) req = req.filter((i) => i !== 7)
  if (chord.quality === '11' || chord.quality === 'm11') req = req.filter((i) => i !== 3 && i !== 4 && i !== 14)
  if (chord.quality === '13') req = req.filter((i) => i !== 14)
  const pcs = req.map((i) => mod12(chord.root + i))
  if (chord.bass !== null) pcs.push(chord.bass)
  return [...new Set(pcs)]
}

export function assignFingers(frets: (number | null)[]): Pick<GuitarVoicing, 'fingers' | 'barre'> | null {
  const fretted = frets.map((f, s) => ({ f, s })).filter((x): x is { f: number; s: number } => x.f !== null && x.f > 0)
  const fingers: (number | null)[] = frets.map(() => null)
  if (fretted.length === 0) return { fingers, barre: null }
  const minFret = Math.min(...fretted.map((x) => x.f))
  const atMin = fretted.filter((x) => x.f === minFret)

  let barre: GuitarVoicing['barre'] = null
  let rest = fretted
  if (atMin.length >= 2 && (fretted.length > 4 || atMin.length >= 3)) {
    const from = atMin[0].s
    const to = atMin[atMin.length - 1].s
    // A barre can't sit over open strings, so everything it crosses must be fretted at or above it.
    const ok = frets.slice(from, to + 1).every((f) => f !== null && f >= minFret)
    if (ok) {
      barre = { fret: minFret, from, to }
      atMin.forEach((x) => (fingers[x.s] = 1))
      rest = fretted.filter((x) => x.f !== minFret)
    }
  }
  const sorted = [...rest].sort((a, b) => a.f - b.f || a.s - b.s)
  let next = barre ? 2 : 1
  for (const x of sorted) {
    if (next > 4) return null
    fingers[x.s] = next++
  }
  return { fingers, barre }
}

const cache = new Map<string, GuitarVoicing[]>()

/**
 * Generate playable voicings for any chord symbol in any tuning by searching four-fret windows.
 * Lower scores are friendlier: low positions, more strings, open strings, few interior mutes.
 */
export function guitarVoicings(symbol: string, tuning: Tuning = TUNINGS[0], limit = 6): GuitarVoicing[] {
  const key = `${symbol}|${tuning.id}|${limit}`
  const hit = cache.get(key)
  if (hit) return hit
  const chord = parseChord(symbol)
  if (!chord) return []
  const open = tuningMidi(tuning)
  const allowed = new Set(chordPitchClasses(chord))
  const required = requiredPcs(chord)
  const bassPc = chord.bass ?? chord.root
  const isPower = chord.quality === '5'
  const minStrings = isPower ? 2 : Math.min(4, open.length)

  const found = new Map<string, GuitarVoicing>()

  for (let w = 1; w <= 12; w++) {
    const options = open.map((o) => {
      const opts: (number | null)[] = [null]
      if (allowed.has(mod12(o))) opts.push(0)
      for (let f = w; f <= w + 3; f++) if (allowed.has(mod12(o + f))) opts.push(f)
      return opts
    })
    const current: (number | null)[] = []
    const walk = (s: number) => {
      if (s === open.length) {
        evaluate(current.slice())
        return
      }
      for (const f of options[s]) {
        current[s] = f
        walk(s + 1)
      }
    }
    walk(0)
  }

  function evaluate(frets: (number | null)[]) {
    const played = frets.map((f, s) => (f === null ? null : open[s] + f))
    const idx = played.map((p, i) => (p === null ? -1 : i)).filter((i) => i >= 0)
    if (idx.length < minStrings) return
    const lowest = idx.reduce((lo, i) => (played[i]! < played[lo]! ? i : lo), idx[0])
    if (mod12(played[lowest]!) !== bassPc) return
    // The bass note must be on the lowest played string, otherwise it isn't really the bass.
    if (lowest !== idx[0]) return
    const pcs = new Set(played.filter((p): p is number => p !== null).map(mod12))
    if (!required.every((pc) => pcs.has(pc))) return
    const first = idx[0]
    const last = idx[idx.length - 1]
    const interiorMutes = last - first + 1 - idx.length
    if (interiorMutes > 1) return
    if (last !== open.length - 1 && !isPower) return // keep the top string ringing for full chords
    const frettedVals = frets.filter((f): f is number => f !== null && f > 0)
    if (frettedVals.length && Math.max(...frettedVals) - Math.min(...frettedVals) > 3) return
    const fingering = assignFingers(frets)
    if (!fingering) return
    const id = frets.join(',')
    if (found.has(id)) return
    const opens = frets.filter((f) => f === 0).length
    const minFret = frettedVals.length ? Math.min(...frettedVals) : 0
    const maxFret = frettedVals.length ? Math.max(...frettedVals) : 0
    const score =
      minFret * 1.1 +
      interiorMutes * 4 +
      first * 0.9 -
      idx.length * 1.5 -
      (maxFret <= 4 ? opens * 0.6 : 0) +
      (maxFret - minFret) * 0.6 +
      (maxFret - minFret >= 3 ? 2 : 0) +
      (opens && minFret > 1 ? 1.5 : 0) +
      (fingering.barre ? 1.2 : 0) +
      frettedVals.length * 0.2
    found.set(id, {
      frets,
      ...fingering,
      baseFret: maxFret <= 4 ? 1 : minFret,
      score,
    })
  }

  const result = [...found.values()].sort((a, b) => a.score - b.score)
  // In standard tuning, lead with the shapes guitarists actually learn.
  if (tuning.id === 'standard' && chord.bass === null) {
    const known = standardShapes(chord)
    for (let i = known.length - 1; i >= 0; i--) {
      const id = known[i].join(',')
      const fingering = assignFingers(known[i])
      if (!fingering) continue
      const existing = result.findIndex((r) => r.frets.join(',') === id)
      if (existing >= 0) result.splice(existing, 1)
      const fretted = known[i].filter((f): f is number => f !== null && f > 0)
      const maxF = fretted.length ? Math.max(...fretted) : 0
      result.unshift({ frets: known[i], ...fingering, baseFret: maxF <= 4 ? 1 : Math.min(...fretted), score: -100 + i })
    }
  }
  // Prefer diversity: avoid listing near-identical shapes at the same position.
  const picked: GuitarVoicing[] = []
  for (const v of result) {
    if (picked.length >= limit) break
    const similar = picked.some((p) => p.baseFret === v.baseFret && p.frets.filter((f, i) => f === v.frets[i]).length >= open.length - 1)
    if (!similar) picked.push(v)
  }
  cache.set(key, picked)
  return picked
}

/** Note names sounded by a voicing, lowest string first (null for muted strings). */
export function voicingNoteNames(v: GuitarVoicing, tuning: Tuning, accidental: Accidental = 'sharp'): (string | null)[] {
  const open = tuningMidi(tuning)
  return v.frets.map((f, s) => (f === null ? null : pcToName(open[s] + f, accidental)))
}

export function voicingMidi(v: GuitarVoicing, tuning: Tuning): number[] {
  const open = tuningMidi(tuning)
  return v.frets.flatMap((f, s) => (f === null ? [] : [open[s] + f]))
}

type Shape = (number | null)[]
const x = null

/** Open-position shapes in standard tuning, keyed by chord name (sharps). */
const OPEN_SHAPES: Record<string, Shape> = {
  C: [x, 3, 2, 0, 1, 0], A: [x, 0, 2, 2, 2, 0], G: [3, 2, 0, 0, 0, 3], E: [0, 2, 2, 1, 0, 0], D: [x, x, 0, 2, 3, 2],
  Am: [x, 0, 2, 2, 1, 0], Em: [0, 2, 2, 0, 0, 0], Dm: [x, x, 0, 2, 3, 1],
  C7: [x, 3, 2, 3, 1, 0], A7: [x, 0, 2, 0, 2, 0], G7: [3, 2, 0, 0, 0, 1], E7: [0, 2, 0, 1, 0, 0], D7: [x, x, 0, 2, 1, 2], B7: [x, 2, 1, 2, 0, 2],
  Am7: [x, 0, 2, 0, 1, 0], Em7: [0, 2, 0, 0, 0, 0], Dm7: [x, x, 0, 2, 1, 1],
  Cmaj7: [x, 3, 2, 0, 0, 0], Amaj7: [x, 0, 2, 1, 2, 0], Dmaj7: [x, x, 0, 2, 2, 2], Emaj7: [0, 2, 1, 1, 0, 0], Fmaj7: [x, x, 3, 2, 1, 0], Gmaj7: [3, 2, 0, 0, 0, 2],
  Asus2: [x, 0, 2, 2, 0, 0], Asus4: [x, 0, 2, 2, 3, 0], Dsus2: [x, x, 0, 2, 3, 0], Dsus4: [x, x, 0, 2, 3, 3], Esus4: [0, 2, 2, 2, 0, 0], Gsus4: [3, 3, 0, 0, 1, 3],
  Cadd9: [x, 3, 2, 0, 3, 0], Gadd9: [3, 0, 0, 2, 0, 3], A7sus4: [x, 0, 2, 0, 3, 0], E7sus4: [0, 2, 0, 2, 0, 0],
  Am6: [x, 0, 2, 2, 1, 2], Em6: [0, 2, 2, 0, 2, 0], A6: [x, 0, 2, 2, 2, 2], E5: [0, 2, 2, x, x, x], A5: [x, 0, 2, 2, x, x], D5: [x, x, 0, 2, 3, x],
  Bdim: [x, 2, 3, 4, 3, x], E9: [0, 2, 0, 1, 0, 2], C9: [x, 3, 2, 3, 3, 3],
}

/** Movable barre templates relative to the root fret: [string-6 rooted (E shape), string-5 rooted (A shape)]. */
const BARRE_SHAPES: Record<string, [Shape | null, Shape | null]> = {
  '': [[0, 2, 2, 1, 0, 0], [x, 0, 2, 2, 2, 0]],
  m: [[0, 2, 2, 0, 0, 0], [x, 0, 2, 2, 1, 0]],
  '7': [[0, 2, 0, 1, 0, 0], [x, 0, 2, 0, 2, 0]],
  m7: [[0, 2, 0, 0, 0, 0], [x, 0, 2, 0, 1, 0]],
  maj7: [[0, x, 1, 1, 0, x], [x, 0, 2, 1, 2, 0]],
  sus4: [[0, 2, 2, 2, 0, 0], [x, 0, 2, 2, 3, 0]],
  sus2: [null, [x, 0, 2, 2, 0, 0]],
  '7sus4': [[0, 2, 0, 2, 0, 0], [x, 0, 2, 0, 3, 0]],
  '5': [[0, 2, 2, x, x, x], [x, 0, 2, 2, x, x]],
  m7b5: [[0, x, 0, 0, -1, x], [x, 0, 1, 0, 1, x]],
  dim: [null, [x, 0, 1, 2, 1, x]],
  '6': [null, [x, 0, 2, 2, 2, 2]],
  m6: [[0, x, -1, 0, 0, x], [x, 0, 2, -1, 1, 0]],
  '9': [null, [x, 0, -1, 0, 0, 0]],
}

function standardShapes(chord: ParsedChord): Shape[] {
  const out: Shape[] = []
  const name = `${pcToName(chord.root, 'sharp')}${chord.quality}`
  if (OPEN_SHAPES[name]) out.push(OPEN_SHAPES[name])
  const tpl = BARRE_SHAPES[chord.quality]
  if (tpl) {
    const roots = [mod12(chord.root - 4), mod12(chord.root - 9)] // fret of root on low E and A strings
    const shapes = tpl
      .map((shape, i) => {
        if (!shape) return null
        let fret = roots[i]
        if (fret === 0) fret = 12
        if (shape.some((f) => f !== null && f + fret < 1)) fret += 12
        if (fret > 12) return null
        return shape.map((f) => (f === null ? null : f + fret))
      })
      .filter((s): s is Shape => s !== null)
      .sort((a, b) => Math.min(...a.filter((f): f is number => f !== null)) - Math.min(...b.filter((f): f is number => f !== null)))
    for (const s of shapes) if (!out.some((o) => o.join() === s.join())) out.push(s)
  }
  return out
}
