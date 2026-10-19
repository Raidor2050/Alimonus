import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Square, Volume2 } from 'lucide-react'
import { startTone } from '@/lib/audio/synth'
import { getTuning, TUNINGS } from '@/lib/theory/guitar'
import { midiToFreq, midiToName, nameToMidi, pcToName } from '@/lib/theory/notes'
import { useSettings } from '@/stores/app'
import { Field, Section, spring } from '@/components/ui'
import { cx } from '@/lib/util'
import { useAccidental } from '../shared'

export default function PitchPipe() {
  const settings = useSettings()
  const reduce = useReducedMotion()
  const accidental = useAccidental()
  const [tuningId, setTuningId] = useState(settings.tuning)
  const [octave, setOctave] = useState(4)
  const [volume, setVolume] = useState(0.25)
  const [playing, setPlaying] = useState<number | null>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const a4 = settings.referencePitch || 440
  const tuning = getTuning(tuningId)

  const stop = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setPlaying(null)
  }, [])

  useEffect(() => stop, [stop])

  const toggle = (midi: number) => {
    const same = playing === midi
    stopRef.current?.()
    stopRef.current = null
    if (same) return setPlaying(null)
    stopRef.current = startTone(midiToFreq(midi, a4), volume)
    setPlaying(midi)
  }

  // Volume changes restart the current tone at the new level (startTone has a fixed gain).
  const changeVolume = (v: number) => {
    setVolume(v)
    if (playing !== null) {
      stopRef.current?.()
      stopRef.current = startTone(midiToFreq(playing, a4), v)
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <Section title="Strings" action={<span className="font-mono text-xs text-mute">A4 = {a4} Hz</span>}>
        <Field label="Tuning">
          <select className="input" value={tuning.id} onChange={(e) => { stop(); setTuningId(e.target.value) }}>
            {TUNINGS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <div className="mt-5 flex flex-col gap-2">
          {[...tuning.notes].reverse().map((n, ri) => {
            const i = tuning.notes.length - 1 - ri
            const midi = nameToMidi(n) ?? 40
            const on = playing === midi
            return (
              <motion.button
                key={`${i}-${n}`}
                onClick={() => toggle(midi)}
                whileTap={{ scale: 0.97 }}
                transition={spring}
                aria-pressed={on}
                className={cx('group relative flex items-center gap-4 overflow-hidden rounded-2xl border px-4 py-3 text-left transition-colors', on ? 'border-a1/60 bg-a1/10' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15')}
              >
                <span className="w-5 font-mono text-xs text-mute">{tuning.notes.length - i}</span>
                <span className={cx('w-12 font-mono text-xl font-bold', on ? 'text-a1' : 'text-white')}>{pcToName(midi, accidental)}<span className="text-xs text-mute">{Math.floor(midi / 12) - 1}</span></span>
                {/* the string itself — vibrates while sounding */}
                <span className="relative h-6 flex-1">
                  <motion.span
                    className={cx('absolute left-0 right-0 top-1/2 rounded-full', on ? 'bg-a1 shadow-[0_0_12px_rgb(var(--glow)/0.8)]' : 'bg-white/25')}
                    style={{ height: 1 + (tuning.notes.length - ri) * 0.4 }}
                    animate={on && !reduce ? { scaleY: [1, 3, 1, 2.4, 1], y: [0, -1.5, 1.5, -1, 0] } : { scaleY: 1, y: 0 }}
                    transition={on && !reduce ? { duration: 0.18, repeat: Infinity } : { duration: 0.2 }}
                  />
                </span>
                <span className="font-mono text-xs text-mute">{midiToFreq(midi, a4).toFixed(1)} Hz</span>
              </motion.button>
            )
          })}
        </div>
      </Section>

      <div className="flex flex-col gap-4">
        <Section
          title="Chromatic"
          action={
            <div className="flex items-center gap-1">
              {[2, 3, 4, 5].map((o) => (
                <button key={o} className="chip font-mono" data-active={octave === o} onClick={() => setOctave(o)}>
                  {o}
                </button>
              ))}
            </div>
          }
        >
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {Array.from({ length: 12 }, (_, pc) => {
              const midi = (octave + 1) * 12 + pc
              const on = playing === midi
              const black = [1, 3, 6, 8, 10].includes(pc)
              return (
                <motion.button
                  key={pc}
                  onClick={() => toggle(midi)}
                  whileTap={{ scale: 0.92 }}
                  aria-pressed={on}
                  aria-label={`Play ${midiToName(midi, accidental)}`}
                  className={cx('relative flex aspect-square flex-col items-center justify-center rounded-2xl border font-mono transition-colors', on ? 'border-transparent bg-a1 text-ink shadow-[0_0_28px_-4px_rgb(var(--glow)/0.9)]' : black ? 'border-white/[0.07] bg-black/40 text-soft hover:border-white/20' : 'border-white/[0.09] bg-white/[0.05] text-white hover:border-white/20')}
                >
                  {on && !reduce && <motion.span className="absolute inset-0 rounded-2xl border-2 border-a1" initial={{ scale: 1, opacity: 0.8 }} animate={{ scale: 1.35, opacity: 0 }} transition={{ duration: 1.1, repeat: Infinity }} />}
                  <span className="text-base font-bold">{pcToName(pc, accidental)}</span>
                  <span className={cx('text-[0.6rem]', on ? 'text-ink/70' : 'text-mute')}>{midiToFreq(midi, a4).toFixed(0)}</span>
                </motion.button>
              )
            })}
          </div>
        </Section>
        <section className="panel flex flex-wrap items-center gap-4 p-4 sm:p-5">
          <span className="label flex items-center gap-1.5">
            <Volume2 size={13} /> Level
          </span>
          <input type="range" min={0.05} max={0.6} step={0.01} value={volume} onChange={(e) => changeVolume(Number(e.target.value))} className="min-w-32 flex-1 accent-[var(--a1)]" aria-label="Tone volume" />
          <button className="btn" onClick={stop} disabled={playing === null}>
            <Square size={13} /> Stop
          </button>
          <p className="w-full text-xs text-mute">{playing !== null ? `Sounding ${midiToName(playing, accidental)} · ${midiToFreq(playing, a4).toFixed(2)} Hz — tap again to stop.` : 'Tap a string or note for a sustained reference tone. One plays at a time.'}</p>
        </section>
      </div>
    </div>
  )
}
