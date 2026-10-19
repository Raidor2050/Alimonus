import { midiToFreq } from '@/lib/theory/notes'

let ctx: AudioContext | null = null

/** Shared AudioContext, created lazily on first user gesture (autoplay rules). */
export function audioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

export interface PlayOptions {
  instrument?: 'guitar' | 'piano'
  /** Seconds between notes; 0 = block chord. Guitar defaults to a downstroke strum. */
  strum?: number
  duration?: number
  volume?: number
}

/** Plucked-string voice: bright attack, filtered decay. */
function guitarVoice(c: AudioContext, out: AudioNode, freq: number, t: number, dur: number, vol: number) {
  const osc = c.createOscillator()
  const osc2 = c.createOscillator()
  const filter = c.createBiquadFilter()
  const gain = c.createGain()
  osc.type = 'sawtooth'
  osc2.type = 'triangle'
  osc.frequency.value = freq
  osc2.frequency.value = freq * 2.003
  filter.type = 'lowpass'
  filter.frequency.setValueAtTime(Math.min(8000, freq * 9), t)
  filter.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 1.5), t + dur * 0.6)
  filter.Q.value = 1.2
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.006)
  gain.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.25)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  const g2 = c.createGain()
  g2.gain.value = 0.25
  osc.connect(filter)
  osc2.connect(g2).connect(filter)
  filter.connect(gain).connect(out)
  osc.start(t)
  osc2.start(t)
  osc.stop(t + dur + 0.05)
  osc2.stop(t + dur + 0.05)
}

/** Soft electric-piano voice: sine + bell partial. */
function pianoVoice(c: AudioContext, out: AudioNode, freq: number, t: number, dur: number, vol: number) {
  const partials: [number, number, OscillatorType][] = [
    [1, 1, 'sine'],
    [2, 0.35, 'sine'],
    [3.01, 0.12, 'triangle'],
  ]
  for (const [mul, amp, type] of partials) {
    const osc = c.createOscillator()
    const gain = c.createGain()
    osc.type = type
    osc.frequency.value = freq * mul
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(vol * amp, t + 0.01)
    gain.gain.exponentialRampToValueAtTime(vol * amp * 0.4, t + 0.4)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur * (1 / mul + 0.3))
    osc.connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + dur + 0.05)
  }
}

/** Play MIDI notes as a strummed guitar or piano chord. Returns when scheduled. */
export function playNotes(midi: number[], opts: PlayOptions = {}) {
  if (!midi.length) return
  const c = audioContext()
  const instrument = opts.instrument ?? 'guitar'
  const strum = opts.strum ?? (instrument === 'guitar' ? 0.035 : 0)
  const dur = opts.duration ?? (instrument === 'guitar' ? 2.2 : 1.8)
  const vol = (opts.volume ?? 0.7) * (0.32 / Math.sqrt(midi.length))
  const master = c.createGain()
  master.gain.value = 1
  const comp = c.createDynamicsCompressor()
  master.connect(comp).connect(c.destination)
  const t0 = c.currentTime + 0.02
  const sorted = [...midi].sort((a, b) => a - b)
  sorted.forEach((m, i) => {
    const t = t0 + i * strum
    if (instrument === 'guitar') guitarVoice(c, master, midiToFreq(m), t, dur, vol)
    else pianoVoice(c, master, midiToFreq(m), t, dur, vol)
  })
}

/** Sustained reference tone for the pitch pipe. Returns a stop function. */
export function startTone(freq: number, volume = 0.25): () => void {
  const c = audioContext()
  const osc = c.createOscillator()
  const gain = c.createGain()
  osc.type = 'triangle'
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0.0001, c.currentTime)
  gain.gain.exponentialRampToValueAtTime(volume, c.currentTime + 0.05)
  osc.connect(gain).connect(c.destination)
  osc.start()
  return () => {
    gain.gain.cancelScheduledValues(c.currentTime)
    gain.gain.setValueAtTime(gain.gain.value, c.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.08)
    osc.stop(c.currentTime + 0.1)
  }
}
