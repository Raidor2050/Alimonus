import { audioContext } from './synth'

export type BeatAccent = 'accent' | 'normal' | 'mute'
/** Clicks per beat: 1 = none, 2 = eighths, 3 = triplets, 4 = sixteenths. */
export type Subdivision = 1 | 2 | 3 | 4

export interface MetronomeConfig {
  bpm: number
  accents: BeatAccent[]
  subdivision: Subdivision
  volume: number
}

export interface Tick {
  time: number
  beat: number
  sub: number
  accent: BeatAccent
}

export const MIN_BPM = 30
export const MAX_BPM = 300

export function clampBpm(bpm: number): number {
  if (!isFinite(bpm)) return 120
  return Math.min(MAX_BPM, Math.max(MIN_BPM, Math.round(bpm)))
}

export const TIME_SIGNATURES = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '12/8'] as const
export type TimeSignature = (typeof TIME_SIGNATURES)[number]

/** Default accent pattern: downbeat accented, plus the natural group starts in compound/odd meters. */
export function defaultAccents(sig: TimeSignature): BeatAccent[] {
  const beats = Number(sig.split('/')[0])
  const strong = new Set<number>([0])
  if (sig === '6/8') strong.add(3)
  if (sig === '12/8') [3, 6, 9].forEach((b) => strong.add(b))
  if (sig === '7/8') [2, 4].forEach((b) => strong.add(b)) // 2+2+3
  return Array.from({ length: beats }, (_, i) => (strong.has(i) ? 'accent' : 'normal'))
}

export function cycleAccent(a: BeatAccent): BeatAccent {
  return a === 'accent' ? 'normal' : a === 'normal' ? 'mute' : 'accent'
}

/** Average BPM from tap timestamps (ms). Uses up to the last `window` intervals. */
export function tapsToBpm(times: number[], window = 6): number | null {
  if (times.length < 2) return null
  const recent = times.slice(-(window + 1))
  const intervals: number[] = []
  for (let i = 1; i < recent.length; i++) intervals.push(recent[i] - recent[i - 1])
  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length
  if (avg <= 0) return null
  return clampBpm(60000 / avg)
}

/** Tap tempo tracker; forgets old taps after a pause of `resetMs`. */
export class TapTempo {
  private taps: number[] = []
  constructor(private resetMs = 2000) {}
  tap(now: number): number | null {
    const last = this.taps[this.taps.length - 1]
    if (last !== undefined && now - last > this.resetMs) this.taps = []
    this.taps.push(now)
    if (this.taps.length > 8) this.taps.shift()
    return tapsToBpm(this.taps)
  }
  get count() {
    return this.taps.length
  }
}

/**
 * Lookahead metronome ("A Tale of Two Clocks"): a coarse JS timer wakes every 25 ms and schedules
 * every click that falls within the next 100 ms on the sample-accurate AudioContext clock.
 */
export class Metronome {
  private timer: ReturnType<typeof setInterval> | null = null
  private nextTime = 0
  private beat = 0
  private sub = 0
  private master: GainNode | null = null
  private queue: Tick[] = []
  readonly lookahead = 0.1
  readonly interval = 25

  constructor(public config: MetronomeConfig) {}

  get running() {
    return this.timer !== null
  }

  update(patch: Partial<MetronomeConfig>) {
    this.config = { ...this.config, ...patch }
    if (patch.volume !== undefined && this.master) this.master.gain.setTargetAtTime(patch.volume, audioContext().currentTime, 0.02)
    if (patch.accents && this.beat >= patch.accents.length) this.beat = 0
  }

  start() {
    if (this.timer) return
    const ctx = audioContext()
    this.master = ctx.createGain()
    this.master.gain.value = this.config.volume
    this.master.connect(ctx.destination)
    this.beat = 0
    this.sub = 0
    this.queue = []
    this.nextTime = ctx.currentTime + 0.06
    this.schedule()
    this.timer = setInterval(() => this.schedule(), this.interval)
  }

  stop() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.queue = []
    const m = this.master
    this.master = null
    if (m) {
      const ctx = audioContext()
      m.gain.setTargetAtTime(0, ctx.currentTime, 0.01)
      setTimeout(() => m.disconnect(), 200)
    }
  }

  /** Remove and return the latest tick whose time has passed (for visuals, read in rAF). */
  takeDue(now: number): Tick | null {
    let due: Tick | null = null
    while (this.queue.length && this.queue[0].time <= now) due = this.queue.shift()!
    return due
  }

  private schedule() {
    const ctx = audioContext()
    // If the tab was throttled, don't burst-play missed clicks: jump ahead.
    if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.05
    while (this.nextTime < ctx.currentTime + this.lookahead) {
      const { bpm, accents, subdivision } = this.config
      const accent = accents[this.beat] ?? 'normal'
      this.queue.push({ time: this.nextTime, beat: this.beat, sub: this.sub, accent })
      this.click(this.nextTime, this.beat, this.sub, accent)
      const step = 60 / clampBpm(bpm) / subdivision
      this.nextTime += step
      this.sub++
      if (this.sub >= subdivision) {
        this.sub = 0
        this.beat = (this.beat + 1) % Math.max(1, accents.length)
      }
    }
  }

  private click(t: number, beat: number, sub: number, accent: BeatAccent) {
    if (!this.master || accent === 'mute') return
    const ctx = audioContext()
    let freq = 880
    let vol = 0.55
    let len = 0.045
    if (sub > 0) {
      freq = 620
      vol = 0.22
      len = 0.03
    } else if (accent === 'accent' && beat === 0) {
      freq = 1760
      vol = 1
      len = 0.06
    } else if (accent === 'accent') {
      freq = 1320
      vol = 0.8
    }
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = sub > 0 ? 'triangle' : 'square'
    osc.frequency.setValueAtTime(freq, t)
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = freq
    bp.Q.value = 2
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    osc.connect(bp).connect(g).connect(this.master)
    osc.start(t)
    osc.stop(t + len + 0.02)
    osc.onended = () => {
      osc.disconnect()
      bp.disconnect()
      g.disconnect()
    }
  }
}
