import { isChord, transposeChord, type SpellingPref } from './chords'

export type SectionType = 'intro' | 'verse' | 'pre-chorus' | 'chorus' | 'bridge' | 'solo' | 'outro' | 'other'

export interface Segment {
  chord: string | null
  text: string
}

export type SheetLine =
  | { kind: 'lyric'; segments: Segment[] }
  | { kind: 'comment'; text: string }
  | { kind: 'blank' }

export interface Section {
  type: SectionType
  label: string
  lines: SheetLine[]
}

export interface Sheet {
  meta: Record<string, string>
  sections: Section[]
}

const SECTION_WORDS: [RegExp, SectionType][] = [
  [/^pre[- ]?chorus/i, 'pre-chorus'],
  [/^intro/i, 'intro'],
  [/^verse/i, 'verse'],
  [/^(chorus|refrain|hook)/i, 'chorus'],
  [/^bridge/i, 'bridge'],
  [/^(solo|instrumental|interlude|break)/i, 'solo'],
  [/^(outro|ending|coda)/i, 'outro'],
]

export function sectionTypeFor(label: string): SectionType {
  for (const [re, t] of SECTION_WORDS) if (re.test(label.trim())) return t
  return 'other'
}

const DIRECTIVE_RE = /^\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}$/i
const BARE_SECTION_RE = /^\s*\[?((?:pre[- ]?chorus|intro|verse|chorus|refrain|bridge|solo|instrumental|interlude|outro|coda|hook)(?:\s*\d+)?(?:\s*\(.*\))?)\]?:?\s*$/i

/** Parse a single ChordPro lyric line like "[Am]Hello [G]world" into segments. */
export function parseLyricLine(line: string): Segment[] {
  const segments: Segment[] = []
  const re = /\[([^\]]*)\]/g
  let last = 0
  let pending: string | null = null
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    const text = line.slice(last, m.index)
    if (text || pending !== null) segments.push({ chord: pending, text })
    pending = m[1].trim()
    last = m.index + m[0].length
  }
  const tail = line.slice(last)
  if (tail || pending !== null) segments.push({ chord: pending, text: tail })
  return segments
}

export function parseChordPro(src: string): Sheet {
  const meta: Record<string, string> = {}
  const sections: Section[] = []
  let current: Section | null = null
  let openEnv: SectionType | null = null

  const start = (type: SectionType, label: string) => {
    current = { type, label, lines: [] }
    sections.push(current)
  }
  const ensure = () => {
    if (!current) start('other', '')
    return current!
  }

  for (const raw of src.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const d = DIRECTIVE_RE.exec(line.trim())
    if (d) {
      const name = d[1].toLowerCase()
      const value = d[2] ?? ''
      const envStart = /^(start_of_|so)(chorus|verse|bridge|tab|grid|c|v|b)$/.exec(name)
      const envEnd = /^(end_of_|eo)(chorus|verse|bridge|tab|grid|c|v|b)$/.exec(name)
      if (envStart) {
        const kind = { c: 'chorus', v: 'verse', b: 'bridge' }[envStart[2]] ?? envStart[2]
        const type = sectionTypeFor(kind)
        openEnv = type
        start(type, value || kind[0].toUpperCase() + kind.slice(1))
      } else if (envEnd) {
        openEnv = null
        current = null
      } else if (name === 'comment' || name === 'c' || name === 'comment_italic' || name === 'ci' || name === 'section') {
        const t = sectionTypeFor(value)
        if (!openEnv && (t !== 'other' || name === 'section')) start(t, value)
        else ensure().lines.push({ kind: 'comment', text: value })
      } else {
        const alias: Record<string, string> = { t: 'title', st: 'subtitle', a: 'artist' }
        meta[alias[name] ?? name] = value
      }
      continue
    }
    if (!openEnv && BARE_SECTION_RE.test(line)) {
      const label = BARE_SECTION_RE.exec(line)![1]
      start(sectionTypeFor(label), label)
      continue
    }
    if (line.trim() === '') {
      // A blank line ends an implicit (non-environment) section's current stanza but keeps spacing.
      if (current && (current as Section).lines.length) (current as Section).lines.push({ kind: 'blank' })
      continue
    }
    if (line.trim().startsWith('#')) continue
    ensure().lines.push({ kind: 'lyric', segments: parseLyricLine(line) })
  }
  for (const s of sections) while (s.lines.length && s.lines[s.lines.length - 1].kind === 'blank') s.lines.pop()
  return { meta, sections: sections.filter((s) => s.lines.length || s.label) }
}

/** All chord symbols in order of appearance (with repeats). */
export function sheetChords(sheet: Sheet): string[] {
  const out: string[] = []
  for (const s of sheet.sections)
    for (const l of s.lines) if (l.kind === 'lyric') for (const seg of l.segments) if (seg.chord && isChord(seg.chord)) out.push(seg.chord)
  return out
}

export function uniqueChords(sheet: Sheet): string[] {
  return [...new Set(sheetChords(sheet))]
}

export function transposeSheet(sheet: Sheet, semitones: number, pref: SpellingPref = 'auto', keyPc?: number): Sheet {
  if (semitones === 0 && pref === 'auto') return sheet
  return {
    meta: sheet.meta,
    sections: sheet.sections.map((s) => ({
      ...s,
      lines: s.lines.map((l) =>
        l.kind === 'lyric'
          ? { kind: 'lyric', segments: l.segments.map((seg) => ({ ...seg, chord: seg.chord ? transposeChord(seg.chord, semitones, pref, keyPc) : null })) }
          : l,
      ),
    })),
  }
}

function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean)
  if (!tokens.length) return false
  const chordish = tokens.filter((t) => isChord(t.replace(/[()|]/g, '')) || /^(\||x\d|N\.?C\.?|-+|\/)$/i.test(t))
  return chordish.length === tokens.length && tokens.some((t) => isChord(t.replace(/[()|]/g, '')))
}

/**
 * Convert the common "chords above lyrics" plain-text layout into ChordPro,
 * so people can paste arrangements they've written themselves.
 */
export function chordsOverLyricsToChordPro(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n')
  const out: string[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (BARE_SECTION_RE.test(line)) {
      out.push(`{c: ${BARE_SECTION_RE.exec(line)![1]}}`)
      continue
    }
    if (isChordLine(line)) {
      const next = lines[i + 1]
      const positions: { col: number; chord: string }[] = []
      const re = /\S+/g
      let m: RegExpExecArray | null
      while ((m = re.exec(line))) positions.push({ col: m.index, chord: m[0] })
      if (next !== undefined && next.trim() !== '' && !isChordLine(next) && !BARE_SECTION_RE.test(next)) {
        let lyric = next.padEnd(Math.max(next.length, ...positions.map((p) => p.col)), ' ')
        for (const p of [...positions].reverse()) lyric = `${lyric.slice(0, p.col)}[${p.chord}]${lyric.slice(p.col)}`
        out.push(lyric.replace(/\s+$/, ''))
        i++
      } else {
        out.push(positions.map((p) => `[${p.chord}]`).join(' '))
      }
      continue
    }
    out.push(line)
  }
  return out.join('\n')
}

/** Serialise a sheet back to plain chords-over-lyrics text (used for printing/export). */
export function sheetToPlainText(sheet: Sheet): string {
  const out: string[] = []
  for (const s of sheet.sections) {
    if (s.label) out.push(`[${s.label}]`)
    for (const l of s.lines) {
      if (l.kind === 'blank') out.push('')
      else if (l.kind === 'comment') out.push(`(${l.text})`)
      else {
        let chords = ''
        let words = ''
        for (const seg of l.segments) {
          if (seg.chord) {
            if (chords.length > words.length) words = words.padEnd(chords.length, ' ')
            chords = chords.padEnd(words.length, ' ') + seg.chord + ' '
          }
          words += seg.text
        }
        if (chords.trim()) out.push(chords.replace(/\s+$/, ''))
        if (words.trim()) out.push(words)
      }
    }
    out.push('')
  }
  return out.join('\n')
}
