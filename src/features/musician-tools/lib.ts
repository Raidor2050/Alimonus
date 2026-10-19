import { parseChord, transposeChord, type ParsedKey, type SpellingPref } from '@/lib/theory/chords'
import { mod12 } from '@/lib/theory/notes'

/** Interval label relative to the root, aware of the chord quality (aug → #5, dim7 → bb7). */
export function intervalName(semitones: number, quality = ''): string {
  if (semitones === 8 && quality.includes('aug')) return '#5'
  if (semitones === 9 && quality === 'dim7') return 'bb7'
  if (semitones === 6 && (quality.startsWith('dim') || quality.includes('b5'))) return 'b5'
  if (semitones === 2 && quality.includes('sus2')) return '2'
  if (semitones === 5 && quality.includes('sus')) return '4'
  const names: Record<number, string> = {
    0: 'R', 1: 'b2', 2: '9', 3: 'b3', 4: '3', 5: '11', 6: '#11', 7: '5', 8: 'b6', 9: '6', 10: 'b7', 11: '7',
    12: 'R', 13: 'b9', 14: '9', 15: '#9', 16: '3', 17: '11', 18: '#11', 19: '5', 20: 'b13', 21: '13',
  }
  return names[semitones] ?? String(semitones)
}

const WRAP_RE = /^([([{|]*)(.*?)([)\]}|,.:;]*)$/

/** Split a token into leading punctuation, a chord symbol and trailing punctuation (if it is one). */
function chordToken(tok: string): { pre: string; chord: string; post: string } | null {
  const m = WRAP_RE.exec(tok)
  if (!m || !m[2]) return null
  return parseChord(m[2]) ? { pre: m[1], chord: m[2], post: m[3] } : null
}

const NEUTRAL = /^[|/\-–x\d.:%()[\]]+$|^(N\.?C\.?|x\d+|\d+x)$/i

/** A line counts as a chord line when most of its non-neutral tokens are chords. */
export function isChordLine(line: string): boolean {
  const toks = line.trim().split(/\s+/).filter(Boolean)
  if (!toks.length) return false
  const meaningful = toks.filter((t) => !NEUTRAL.test(t))
  if (!meaningful.length) return false
  const chords = meaningful.filter((t) => chordToken(t)).length
  return chords / meaningful.length >= 0.6
}

/**
 * Transpose chords inside free text. Chord lines (chords-over-lyrics) and inline [ChordPro]
 * brackets are transposed; lyric lines are left alone so words like "A" stay intact.
 * Column alignment of chord lines is preserved where whitespace allows.
 */
export function transposeText(text: string, semitones: number, pref: SpellingPref = 'auto', keyPc?: number): string {
  if (semitones === 0 && pref === 'auto') return text
  const tc = (c: string) => transposeChord(c, semitones, pref, keyPc)
  return text
    .split('\n')
    .map((line) => {
      if (isChordLine(line)) {
        // Rebuild with alignment: track how much we over/under-shot and absorb it in the next gap.
        let debt = 0
        return line.replace(/(\S+)(\s*)/g, (_m, tok: string, gap: string) => {
          const ct = chordToken(tok)
          const next = ct ? ct.pre + tc(ct.chord) + ct.post : tok
          debt += next.length - tok.length
          let g = gap
          if (debt > 0 && gap.length) {
            const take = Math.min(debt, gap.length - 1)
            g = gap.slice(take)
            debt -= take
          } else if (debt < 0 && gap.length) {
            g = gap + ' '.repeat(-debt)
            debt = 0
          }
          return next + g
        })
      }
      return line.replace(/\[([^\]\s]+)\]/g, (m, inner: string) => (parseChord(inner) ? `[${tc(inner)}]` : m))
    })
    .join('\n')
}

/** All chord symbols in text, in order of appearance (chord lines and [brackets]). */
export function extractChords(text: string): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    if (isChordLine(line)) {
      for (const tok of line.trim().split(/\s+/)) {
        const ct = chordToken(tok)
        if (ct) out.push(ct.chord)
      }
    } else {
      for (const m of line.matchAll(/\[([^\]\s]+)\]/g)) if (parseChord(m[1])) out.push(m[1])
    }
  }
  return out
}

/** Guess the key from the first chord: its root, minor if the chord is minor. */
export function keyFromChord(symbol: string | undefined): ParsedKey | null {
  if (!symbol) return null
  const c = parseChord(symbol)
  if (!c) return null
  return { tonic: c.root, minor: c.quality.startsWith('m') && !c.quality.startsWith('maj') }
}

/** Smallest signed semitone distance from one pitch class to another (-5..+6). */
export function semitoneDelta(from: number, to: number): number {
  const d = mod12(to - from)
  return d > 6 ? d - 12 : d
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = h ? String(m).padStart(2, '0') : String(m)
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`
}

/** Read/write JSON in localStorage without ever throwing (private mode, quota, bad data). */
export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

export function writeLocal(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* storage unavailable */
  }
}
