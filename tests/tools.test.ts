import { detectPitch, nearestNote, centsBetween, median, PitchSmoother } from '@/lib/audio/pitch'
import { tapsToBpm, TapTempo, clampBpm, defaultAccents, cycleAccent } from '@/lib/audio/metronome'
import { transposeText, extractChords, isChordLine, keyFromChord, intervalName, semitoneDelta, formatClock } from '@/features/musician-tools/lib'

const SR = 44100

function sine(freq: number, n = 4096, amp = 0.5, harmonics: number[] = []) {
  const buf = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let v = amp * Math.sin((2 * Math.PI * freq * i) / SR)
    harmonics.forEach((h, k) => (v += h * amp * Math.sin((2 * Math.PI * freq * (k + 2) * i) / SR)))
    buf[i] = v
  }
  return buf
}

describe('detectPitch', () => {
  it.each([82.41, 110, 146.83, 196, 246.94, 329.63, 440, 659.25])('finds %s Hz within 1%%', (f) => {
    const got = detectPitch(sine(f), SR)
    expect(got).not.toBeNull()
    expect(Math.abs(got! - f) / f).toBeLessThan(0.01)
  })

  it('is accurate to a few cents on A4', () => {
    expect(Math.abs(centsBetween(detectPitch(sine(440), SR)!, 440))).toBeLessThan(3)
  })

  it('locks to the fundamental with strong harmonics (no octave error)', () => {
    const got = detectPitch(sine(110, 4096, 0.4, [0.8, 0.5, 0.3]), SR)!
    expect(Math.abs(got - 110) / 110).toBeLessThan(0.01)
  })

  it('handles 48 kHz-style rates and a smaller buffer', () => {
    const n = 2048
    const buf = new Float32Array(n)
    for (let i = 0; i < n; i++) buf[i] = 0.3 * Math.sin((2 * Math.PI * 196 * i) / 48000)
    expect(Math.abs(detectPitch(buf, 48000)! - 196) / 196).toBeLessThan(0.01)
  })

  it('returns null for silence and near-silence', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull()
    expect(detectPitch(sine(440, 4096, 0.001), SR)).toBeNull()
  })

  it('returns null for white noise', () => {
    let seed = 1
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1
    const buf = new Float32Array(4096).map(() => rand() * 0.5)
    expect(detectPitch(buf, SR)).toBeNull()
  })
})

describe('note helpers', () => {
  it('computes cents', () => {
    expect(centsBetween(880, 440)).toBeCloseTo(1200)
    expect(centsBetween(440 * Math.pow(2, 10 / 1200), 440)).toBeCloseTo(10)
  })
  it('finds the nearest note and octave', () => {
    const r = nearestNote(82.41)
    expect(r.name).toBe('E')
    expect(r.octave).toBe(2)
    expect(Math.abs(r.cents)).toBeLessThan(1)
    expect(nearestNote(445).cents).toBeGreaterThan(15)
    expect(nearestNote(432, 432).name).toBe('A')
    expect(nearestNote(277.18, 440, 'flat').name).toBe('Db')
  })
  it('median', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 2, 3])).toBe(2.5)
  })
  it('smoother rejects one-frame octave blips and holds the note through the boundary', () => {
    const s = new PitchSmoother(5, 18)
    for (let i = 0; i < 4; i++) s.push(110)
    expect(s.push(220)!.midi).toBe(45) // a single octave blip is ignored
    s.push(220)
    expect(s.push(220)!.midi).toBe(57) // ...but a sustained new note takes over
    const sm = new PitchSmoother(5, 18)
    sm.push(440)
    // 60 cents sharp of A4 is nearer to A#4 but inside the hysteresis band: stays A4.
    expect(sm.push(440 * Math.pow(2, 60 / 1200))!.midi).toBe(69)
    sm.push(440 * Math.pow(2, 90 / 1200))
    sm.push(440 * Math.pow(2, 90 / 1200))
    // Once the median is clearly past the band, the note switches.
    expect(sm.push(440 * Math.pow(2, 90 / 1200))!.midi).toBe(70)
  })
})

describe('metronome helpers', () => {
  it('averages taps into BPM', () => {
    expect(tapsToBpm([0, 500, 1000, 1500])).toBe(120)
    expect(tapsToBpm([0, 1000])).toBe(60)
    expect(tapsToBpm([0])).toBeNull()
  })
  it('tap tempo resets after a 2 s gap', () => {
    const t = new TapTempo(2000)
    t.tap(0)
    t.tap(500)
    expect(t.tap(1000)).toBe(120)
    expect(t.tap(5000)).toBeNull()
    expect(t.tap(5250)).toBe(240)
  })
  it('clamps and patterns', () => {
    expect(clampBpm(10)).toBe(30)
    expect(clampBpm(999)).toBe(300)
    expect(defaultAccents('6/8')).toEqual(['accent', 'normal', 'normal', 'accent', 'normal', 'normal'])
    expect(defaultAccents('3/4')).toHaveLength(3)
    expect(cycleAccent('accent')).toBe('normal')
    expect(cycleAccent('normal')).toBe('mute')
    expect(cycleAccent('mute')).toBe('accent')
  })
})

describe('transposer helpers', () => {
  it('detects chord lines vs lyric lines', () => {
    expect(isChordLine('Am   F   C   G')).toBe(true)
    expect(isChordLine('| C | G/B | Am7 | x2')).toBe(true)
    expect(isChordLine('A man walks into the bar')).toBe(false)
  })
  it('transposes chord lines but leaves lyrics', () => {
    const src = 'C        G\nA man walks in\n[Am]words [F]here'
    expect(transposeText(src, 2)).toBe('D        A\nA man walks in\n[Bm]words [G]here')
  })
  it('keeps column alignment when chord names grow', () => {
    const out = transposeText('C    G    C', 1, 'sharp')
    expect(out).toBe('C#   G#   C#')
  })
  it('extracts chords and guesses the key', () => {
    expect(extractChords('Am F\nla la [C] la')).toEqual(['Am', 'F', 'C'])
    expect(keyFromChord('F#m7')).toEqual({ tonic: 6, minor: true })
    expect(keyFromChord('Cmaj7')).toEqual({ tonic: 0, minor: false })
  })
  it('semitone deltas take the short way round', () => {
    expect(semitoneDelta(0, 7)).toBe(-5)
    expect(semitoneDelta(0, 2)).toBe(2)
    expect(semitoneDelta(11, 0)).toBe(1)
  })
  it('names intervals by quality', () => {
    expect(intervalName(3)).toBe('b3')
    expect(intervalName(8, 'aug')).toBe('#5')
    expect(intervalName(6, 'dim')).toBe('b5')
    expect(intervalName(9, 'dim7')).toBe('bb7')
    expect(intervalName(5, 'sus4')).toBe('4')
    expect(intervalName(14)).toBe('9')
  })
  it('formats clocks', () => {
    expect(formatClock(65)).toBe('1:05')
    expect(formatClock(3725)).toBe('1:02:05')
  })
})

describe('tool components render', () => {
  it.each(['Tuner', 'MetronomeTool', 'ChordExplorer', 'Transposer', 'PitchPipe', 'ProgressionBuilder', 'PracticeTimer'])('%s mounts and unmounts cleanly', async (name) => {
    const { createElement } = await import('react')
    const { render, cleanup } = await import('@testing-library/react')
    const mod = (await import(`@/features/musician-tools/tools/${name}.tsx`)) as { default: () => null }
    const { container } = render(createElement(mod.default))
    expect(container.textContent?.length).toBeGreaterThan(20)
    cleanup()
  })
})
