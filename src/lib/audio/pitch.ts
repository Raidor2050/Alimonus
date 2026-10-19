import { pcToName, type Accidental } from '@/lib/theory/notes'

export interface DetectOptions {
  /** Below this RMS the buffer counts as silence. */
  rmsGate?: number
  minFreq?: number
  maxFreq?: number
  /** Minimum normalised correlation at the chosen lag (0..1); rejects noise. */
  clarity?: number
}

/**
 * Autocorrelation pitch detector (ACF2+ family).
 * 1. RMS gate rejects silence.
 * 2. Unbiased autocorrelation over the useful lag range, normalised by r(0).
 * 3. Skip the initial lobe (until the correlation first dips), then take the first peak that is
 *    close to the global maximum: this avoids the classic "octave too low" error.
 * 4. Parabolic interpolation around the peak for sub-sample precision.
 * Returns the fundamental in Hz or null.
 */
export function detectPitch(buf: Float32Array, sampleRate: number, opts: DetectOptions = {}): number | null {
  const { rmsGate = 0.01, minFreq = 50, maxFreq = 1600, clarity = 0.5 } = opts
  const n = buf.length
  if (n < 64) return null

  let mean = 0
  for (let i = 0; i < n; i++) mean += buf[i]
  mean /= n
  let energy = 0
  for (let i = 0; i < n; i++) {
    const v = buf[i] - mean
    energy += v * v
  }
  const rms = Math.sqrt(energy / n)
  if (!isFinite(rms) || rms < rmsGate) return null

  const minLag = Math.max(2, Math.floor(sampleRate / maxFreq))
  const maxLag = Math.min(Math.ceil(sampleRate / minFreq), Math.floor(n / 2))
  if (maxLag <= minLag + 2) return null

  // r[lag] / (n - lag): unbiased, so later periods aren't penalised for having fewer samples.
  const r = new Float32Array(maxLag + 2)
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let sum = 0
    const lim = n - lag
    for (let i = 0; i < lim; i++) sum += (buf[i] - mean) * (buf[i + lag] - mean)
    r[lag] = sum / lim
  }
  const r0 = r[0]
  if (r0 <= 0) return null
  for (let lag = 0; lag < r.length; lag++) r[lag] /= r0

  // Walk past the zero-lag lobe.
  let start = 1
  while (start < maxLag && r[start] > 0) start++
  start = Math.max(start, minLag)
  if (start >= maxLag) return null

  let best = -Infinity
  for (let lag = start; lag <= maxLag; lag++) if (r[lag] > best) best = r[lag]
  if (best < clarity) return null

  // First local maximum that reaches ~90% of the best peak.
  let peak = -1
  for (let lag = start; lag <= maxLag; lag++) {
    if (r[lag] >= best * 0.9 && r[lag] >= r[lag - 1] && r[lag] >= r[lag + 1]) {
      peak = lag
      break
    }
  }
  if (peak < 0) return null

  const a = r[peak - 1]
  const b = r[peak]
  const c = r[peak + 1]
  const denom = a - 2 * b + c
  const shift = denom !== 0 ? (0.5 * (a - c)) / denom : 0
  const period = peak + (Math.abs(shift) < 1 ? shift : 0)
  const freq = sampleRate / period
  if (!isFinite(freq) || freq < minFreq * 0.9 || freq > maxFreq * 1.1) return null
  return freq
}

/** Cents between two frequencies (positive = f is sharp of ref). */
export function centsBetween(f: number, ref: number): number {
  return 1200 * Math.log2(f / ref)
}

export interface NoteReading {
  midi: number
  name: string
  octave: number
  /** -50..+50 offset from the nearest equal-tempered note. */
  cents: number
  /** Frequency of the nearest note at the given reference. */
  target: number
}

export function nearestNote(freq: number, a4 = 440, accidental: Accidental = 'sharp'): NoteReading {
  const exact = 69 + 12 * Math.log2(freq / a4)
  const midi = Math.round(exact)
  const target = a4 * Math.pow(2, (midi - 69) / 12)
  return { midi, name: pcToName(midi, accidental), octave: Math.floor(midi / 12) - 1, cents: centsBetween(freq, target), target }
}

export function median(values: number[]): number {
  if (!values.length) return NaN
  const s = [...values].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/**
 * Stabilises raw detector output: median of recent readings (kills octave blips), plus note
 * hysteresis so the displayed note only changes once the pitch is clearly past the boundary.
 */
export class PitchSmoother {
  private history: number[] = []
  private jump: number[] = []
  private note: number | null = null
  private misses = 0

  constructor(
    private size = 7,
    /** Extra cents beyond ±50 required before switching note. */
    private hysteresis = 18,
    /** Consecutive null frames before the reading is dropped. */
    private holdFrames = 12,
  ) {}

  reset() {
    this.history = []
    this.jump = []
    this.note = null
    this.misses = 0
  }

  /** Feed a raw frequency (or null); returns smoothed frequency + stable midi note, or null. */
  push(freq: number | null, a4 = 440): { freq: number; midi: number } | null {
    if (freq === null) {
      this.misses++
      if (this.misses > this.holdFrames) this.reset()
      if (!this.history.length || this.note === null) return null
      return { freq: median(this.history), midi: this.note }
    }
    this.misses = 0
    // A large jump is either a one-frame blip (octave error, pick noise) or a new note. Ignore it
    // until a second consecutive reading agrees, then flush history so we respond quickly.
    const current = this.history.length ? median(this.history) : null
    if (current !== null && Math.abs(centsBetween(freq, current)) > 150) {
      const agree = this.jump.length && Math.abs(centsBetween(freq, this.jump[this.jump.length - 1])) < 60
      this.jump = agree ? [...this.jump, freq] : [freq]
      if (this.jump.length < 2) return this.note === null ? null : { freq: current, midi: this.note }
      this.history = this.jump
      this.jump = []
      this.note = null
    } else {
      this.jump = []
      this.history.push(freq)
    }
    if (this.history.length > this.size) this.history.shift()
    const f = median(this.history)
    const exact = 69 + 12 * Math.log2(f / a4)
    const nearest = Math.round(exact)
    if (this.note === null) this.note = nearest
    else if (nearest !== this.note && Math.abs(exact - this.note) * 100 > 50 + this.hysteresis) this.note = nearest
    return { freq: f, midi: this.note }
  }
}
