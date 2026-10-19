import { parseChord, transposeChord, transposeKey, suggestCapo, chordPitchClasses, diatonicChords, parseKey } from '@/lib/theory/chords'
import { guitarVoicings, getTuning } from '@/lib/theory/guitar'
import { pianoVoicings, midiNames } from '@/lib/theory/piano'
import { parseChordPro, uniqueChords, transposeSheet, chordsOverLyricsToChordPro, parseLyricLine } from '@/lib/theory/chordpro'
import { nameToMidi, noteToPc } from '@/lib/theory/notes'

describe('chord parsing', () => {
  it.each([
    ['C', 0, ''], ['Am', 9, 'm'], ['F#m7', 6, 'm7'], ['Bbmaj7', 10, 'maj7'], ['Ebdim7', 3, 'dim7'],
    ['Gsus4', 7, 'sus4'], ['Caug', 0, 'aug'], ['Bm7b5', 11, 'm7b5'], ['Dadd9', 2, 'add9'], ['A5', 9, '5'],
  ])('%s', (sym, root, quality) => {
    const c = parseChord(sym)!
    expect(c.root).toBe(root)
    expect(c.quality).toBe(quality)
  })
  it('parses slash chords', () => {
    const c = parseChord('D/F#')!
    expect(c.bass).toBe(6)
    expect(chordPitchClasses(parseChord('C/B')!)).toEqual([0, 4, 7, 11])
  })
  it('rejects non-chords', () => {
    expect(parseChord('Chorus')).toBeNull()
    expect(parseChord('x2')).toBeNull()
    expect(parseChord('H')).toBeNull()
  })
})

describe('transposition', () => {
  it('moves roots and slash basses', () => {
    expect(transposeChord('C', 2)).toBe('D')
    expect(transposeChord('Am7', 3)).toBe('Cm7')
    expect(transposeChord('D/F#', -2)).toBe('C/E')
    expect(transposeChord('G', 3, 'flat')).toBe('Bb')
    expect(transposeChord('G', 3, 'sharp')).toBe('A#')
    expect(transposeChord('Bb', 2)).toBe('C')
    expect(transposeChord('N.C.', 4)).toBe('N.C.')
  })
  it('round-trips', () => {
    for (const c of ['C', 'F#m', 'Bbmaj7', 'E7/G#', 'Csus4']) {
      expect(parseChord(transposeChord(transposeChord(c, 5), -5))!.root).toBe(parseChord(c)!.root)
    }
  })
  it('transposes keys', () => {
    expect(transposeKey('Am', 3)).toBe('Cm')
    expect(transposeKey('C', 5)).toBe('F')
    expect(transposeKey('E', 1)).toBe('F')
  })
  it('suggests capo positions with easy shapes', () => {
    const best = suggestCapo(['Bb', 'Eb', 'F', 'Gm'])[0]
    expect(best.capo).toBe(3)
    expect(best.shapes).toEqual(['G', 'C', 'D', 'Em'])
  })
  it('builds diatonic chords', () => {
    expect(diatonicChords(parseKey('G')!).map((c) => c.symbol)).toEqual(['G', 'Am', 'Bm', 'C', 'D', 'Em', 'F#dim'])
    expect(diatonicChords(parseKey('Dm')!).map((c) => c.symbol)[2]).toBe('F')
  })
})

describe('notes', () => {
  it('parses scientific pitch', () => {
    expect(nameToMidi('A4')).toBe(69)
    expect(nameToMidi('E2')).toBe(40)
    expect(nameToMidi('B#3')).toBe(60)
    expect(noteToPc('Db')).toBe(1)
  })
})

describe('guitar voicings', () => {
  const first = (c: string, t = 'standard') => guitarVoicings(c, getTuning(t))[0].frets.map((f) => (f === null ? 'x' : f)).join('')
  it.each([
    ['C', 'x32010'], ['G', '320003'], ['D', 'xx0232'], ['A', 'x02220'], ['E', '022100'],
    ['Am', 'x02210'], ['Em', '022000'], ['Dm', 'xx0231'], ['F', '133211'], ['Bb', 'x13331'], ['F#m', '244222'],
  ])('finds the familiar open shape for %s', (chord, shape) => {
    expect(first(chord)).toBe(shape)
  })
  it('keeps the slash bass lowest', () => {
    const v = guitarVoicings('D/F#')[0]
    expect(v.frets[0]).toBe(2)
  })
  it('finds a barre with finger numbers for Bm', () => {
    const v = guitarVoicings('Bm')[0]
    expect(v.barre).not.toBeNull()
    expect(v.fingers.filter((f) => f !== null).every((f) => f! >= 1 && f! <= 4)).toBe(true)
  })
  it('works in alternate tunings', () => {
    const v = guitarVoicings('G', getTuning('open-g'))
    expect(v.length).toBeGreaterThan(0)
    expect(v[0].frets.every((f) => f === null || f === 0)).toBe(true)
  })
  it('handles sevenths and extensions', () => {
    for (const c of ['G7', 'Cmaj7', 'Am7', 'Bdim7', 'E9', 'Fm7b5', 'Csus2', 'Gaug']) expect(guitarVoicings(c).length).toBeGreaterThan(0)
  })
})

describe('piano voicings', () => {
  it('gives root position and inversions', () => {
    const v = pianoVoicings('C')
    expect(midiNames(v[0].right)).toEqual(['C4', 'E4', 'G4'])
    expect(midiNames(v[1].right)).toEqual(['E4', 'G4', 'C5'])
    expect(v.find((x) => x.id === 'inv3')).toBeUndefined()
    expect(pianoVoicings('G7').some((x) => x.id === 'inv3')).toBe(true)
  })
})

describe('ChordPro', () => {
  const src = `{title: Test}
{key: G}
{c: Verse 1}
[G]Hello [D]there
{start_of_chorus}
[C]Sing [G/B]it
{end_of_chorus}`
  it('parses meta, sections and segments', () => {
    const s = parseChordPro(src)
    expect(s.meta.title).toBe('Test')
    expect(s.sections.map((x) => x.type)).toEqual(['verse', 'chorus'])
    expect(uniqueChords(s)).toEqual(['G', 'D', 'C', 'G/B'])
  })
  it('splits lyric lines at chords', () => {
    expect(parseLyricLine('[Am]Hel[G]lo')).toEqual([{ chord: 'Am', text: 'Hel' }, { chord: 'G', text: 'lo' }])
    expect(parseLyricLine('so [C]far')).toEqual([{ chord: null, text: 'so ' }, { chord: 'C', text: 'far' }])
  })
  it('transposes a sheet without mutating it', () => {
    const s = parseChordPro(src)
    const t = transposeSheet(s, 2)
    expect(uniqueChords(t)).toEqual(['A', 'E', 'D', 'A/C#'])
    expect(uniqueChords(s)[0]).toBe('G')
  })
  it('converts chords-over-lyrics text', () => {
    const out = chordsOverLyricsToChordPro('Verse 1\nAm      G\nWalking home\n')
    expect(out).toContain('{c: Verse 1}')
    expect(out).toContain('[Am]Walking [G]home')
  })
})
