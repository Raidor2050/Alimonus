import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, Pause, Play, Plus, Repeat, Trash, X } from 'lucide-react'
import { diatonicChords, transposeChord } from '@/lib/theory/chords'
import { getTuning, guitarVoicings, voicingMidi } from '@/lib/theory/guitar'
import { pianoVoicings } from '@/lib/theory/piano'
import { mod12, pcToName, preferredAccidental } from '@/lib/theory/notes'
import { audioContext, playNotes } from '@/lib/audio/synth'
import { clampBpm } from '@/lib/audio/metronome'
import { useSettings } from '@/stores/app'
import { GuitarDiagram } from '@/components/diagrams/GuitarDiagram'
import { Section, Segmented, Toggle, spring } from '@/components/ui'
import { cx, uid } from '@/lib/util'
import { TransportButton, useLatest } from '../shared'

interface Step {
  id: string
  symbol: string
  roman: string
}

type Preset = { name: string; minor: boolean; build: (tonic: number, minor: boolean) => Step[] }

const fromDegrees = (degrees: number[], sevenths: boolean) => (tonic: number, minor: boolean) => {
  const d = diatonicChords({ tonic, minor }, sevenths)
  return degrees.map((i) => ({ id: uid(), symbol: d[i].symbol, roman: d[i].roman }))
}

const PRESETS: Preset[] = [
  { name: 'I–V–vi–IV', minor: false, build: fromDegrees([0, 4, 5, 3], false) },
  { name: 'ii–V–I', minor: false, build: fromDegrees([1, 4, 0], true) },
  { name: 'i–VI–III–VII', minor: true, build: fromDegrees([0, 5, 2, 6], false) },
  {
    name: '12-bar blues',
    minor: false,
    build: (tonic) => {
      const acc = preferredAccidental(tonic)
      const n = (deg: number, roman: string) => ({ id: uid(), symbol: `${pcToName(tonic + deg, acc)}7`, roman })
      return [0, 0, 0, 0, 5, 5, 0, 0, 7, 5, 0, 7].map((deg) => n(deg, deg === 0 ? 'I7' : deg === 5 ? 'IV7' : 'V7'))
    },
  },
]

export default function ProgressionBuilder() {
  const settings = useSettings()
  const tuning = getTuning(settings.tuning)
  const [tonic, setTonic] = useState(0)
  const [minor, setMinor] = useState(false)
  const [sevenths, setSevenths] = useState(false)
  const [steps, setSteps] = useState<Step[]>(() => PRESETS[0].build(0, false))
  const [bpm, setBpm] = useState(96)
  const [beatsPer, setBeatsPer] = useState(4)
  const [loop, setLoop] = useState(true)
  const [instrument, setInstrument] = useState<'guitar' | 'piano'>('guitar')
  const [playing, setPlaying] = useState(false)
  const [current, setCurrent] = useState<number | null>(null)
  const [focus, setFocus] = useState(0)

  const acc = preferredAccidental(tonic, minor)
  const diatonic = useMemo(() => diatonicChords({ tonic, minor }, sevenths), [tonic, minor, sevenths])

  const sound = useCallback(
    (symbol: string, inst: 'guitar' | 'piano', dur?: number) => {
      if (inst === 'guitar') {
        const v = guitarVoicings(symbol, tuning, 1)[0]
        if (v) playNotes(voicingMidi(v, tuning), { instrument: 'guitar', duration: dur })
      } else {
        const p = pianoVoicings(symbol).find((x) => x.id === 'two-hand')
        if (p) playNotes([...p.left, ...p.right], { instrument: 'piano', duration: dur })
      }
    },
    [tuning],
  )

  // Playback: a short-interval checker against the audio clock, so chords land on time even if a frame is late.
  const live = useLatest({ steps, bpm, beatsPer, loop, instrument, sound })
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const stop = useCallback(() => {
    if (timer.current) clearInterval(timer.current)
    timer.current = null
    setPlaying(false)
    setCurrent(null)
  }, [])
  const play = useCallback(() => {
    if (!live.current.steps.length) return
    const ctx = audioContext()
    let index = 0
    let nextAt = ctx.currentTime + 0.05
    setPlaying(true)
    const tick = () => {
      const L = live.current
      if (ctx.currentTime + 0.03 < nextAt) return
      if (index >= L.steps.length) {
        if (!L.loop) return stop()
        index = 0
      }
      const s = L.steps[index]
      const dur = (60 / clampBpm(L.bpm)) * L.beatsPer
      L.sound(s.symbol, L.instrument, Math.min(dur + 0.3, 3.5))
      setCurrent(index)
      setFocus(index)
      index++
      nextAt += dur
      if (nextAt < ctx.currentTime) nextAt = ctx.currentTime + dur // recovered from a throttled tab
    }
    tick()
    timer.current = setInterval(tick, 20)
  }, [live, stop])
  useEffect(() => stop, [stop])

  const changeKey = (newTonic: number, newMinor: boolean) => {
    const newMajor = newMinor ? mod12(newTonic + 3) : newTonic
    const delta = mod12(newTonic - tonic)
    if (newMinor === minor && delta) setSteps((arr) => arr.map((s) => ({ ...s, symbol: transposeChord(s.symbol, delta, 'auto', mod12(newMajor - delta)) })))
    setTonic(newTonic)
    setMinor(newMinor)
  }

  const add = (symbol: string, roman: string) => {
    setSteps((arr) => [...arr, { id: uid(), symbol, roman }])
    setFocus(steps.length)
    sound(symbol, instrument)
  }
  const move = (i: number, d: number) =>
    setSteps((arr) => {
      const j = i + d
      if (j < 0 || j >= arr.length) return arr
      const next = [...arr]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  const remove = (i: number) => setSteps((arr) => arr.filter((_, k) => k !== i))

  const shown = steps[Math.min(current ?? focus, steps.length - 1)]
  const shownVoicing = shown ? guitarVoicings(shown.symbol, tuning, 1)[0] : undefined

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-4">
        <section className="panel p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <select className="input w-auto" value={tonic} onChange={(e) => changeKey(Number(e.target.value), minor)} aria-label="Key tonic">
              {Array.from({ length: 12 }, (_, pc) => (
                <option key={pc} value={pc}>
                  {pcToName(pc, preferredAccidental(pc, minor))}
                </option>
              ))}
            </select>
            <Segmented layoutId="prog-mode" size="sm" value={minor ? 'minor' : 'major'} onChange={(v) => changeKey(tonic, v === 'minor')} options={[{ value: 'major', label: 'Major' }, { value: 'minor', label: 'Minor' }]} />
            <Toggle checked={sevenths} onChange={setSevenths} label="Sevenths" />
          </div>
          <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">
            {diatonic.map((d, i) => (
              <motion.button key={d.roman} whileTap={{ scale: 0.9 }} whileHover={{ y: -2 }} transition={spring} onClick={() => add(d.symbol, d.roman)} className="group flex flex-col items-center gap-0.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-2 py-3 hover:border-a1/50" aria-label={`Add ${d.symbol} (${d.roman})`}>
                <span className={cx('font-mono text-[0.7rem]', i === 0 ? 'text-a1' : 'text-mute')}>{d.roman}</span>
                <span className="font-mono text-base font-bold">{d.symbol}</span>
                <Plus size={12} className="text-mute opacity-0 transition-opacity group-hover:opacity-100" />
              </motion.button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-1.5">
            <span className="label mr-1">Presets</span>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                className="chip"
                onClick={() => {
                  stop()
                  // Keep the tonic letter; switch mode if the preset needs it.
                  setMinor(p.minor)
                  setSteps(p.build(tonic, p.minor))
                  setFocus(0)
                }}
              >
                {p.name}
              </button>
            ))}
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="display text-base font-bold">
              Progression <span className="font-mono text-xs font-normal text-mute">in {pcToName(tonic, acc)}{minor ? ' minor' : ' major'} · {steps.length} chords</span>
            </h2>
            <button className="btn btn-ghost py-1 text-xs" onClick={() => { stop(); setSteps([]) }} disabled={!steps.length}>
              <Trash size={13} /> Clear
            </button>
          </div>
          {steps.length ? (
            <motion.ol layout className="flex flex-wrap gap-2">
              <AnimatePresence initial={false}>
                {steps.map((s, i) => {
                  const on = current === i
                  return (
                    <motion.li
                      key={s.id}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: on ? 1.06 : 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      transition={spring}
                      className={cx('group relative flex min-w-[88px] flex-col items-center rounded-2xl border px-2 pb-1.5 pt-2 transition-colors', on ? 'border-transparent bg-a1 text-ink shadow-[0_0_30px_-6px_rgb(var(--glow)/0.9)]' : focus === i ? 'border-a2/50 bg-a2/10' : 'border-white/[0.08] bg-white/[0.03]')}
                    >
                      <button className="flex flex-col items-center" onClick={() => { setFocus(i); sound(s.symbol, instrument) }} aria-label={`Play ${s.symbol}`}>
                        <span className={cx('font-mono text-[0.65rem]', on ? 'text-ink/70' : 'text-mute')}>{s.roman}</span>
                        <span className="font-mono text-lg font-bold">{s.symbol}</span>
                      </button>
                      <div className={cx('mt-1 flex gap-0.5', on ? 'text-ink/70' : 'text-mute')}>
                        <button className="rounded p-0.5 hover:text-white disabled:opacity-30" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Move ${s.symbol} earlier`}>
                          <ArrowLeft size={12} />
                        </button>
                        <button className="rounded p-0.5 hover:text-a3" onClick={() => remove(i)} aria-label={`Remove ${s.symbol}`}>
                          <X size={12} />
                        </button>
                        <button className="rounded p-0.5 hover:text-white disabled:opacity-30" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label={`Move ${s.symbol} later`}>
                          <ArrowRight size={12} />
                        </button>
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
            </motion.ol>
          ) : (
            <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-mute">Tap chords above (or a preset) to start building.</p>
          )}
        </section>
      </div>

      <div className="flex flex-col gap-4">
        <section className="panel flex flex-col items-center gap-4 p-4 sm:p-5">
          <div className="flex items-center gap-4">
            <TransportButton active={playing} onClick={() => (playing ? stop() : play())} label={playing ? 'Stop playback' : 'Play progression'}>
              {playing ? <Pause size={26} /> : <Play size={26} className="translate-x-0.5" />}
            </TransportButton>
            <div className="flex flex-col gap-2">
              <button className="chip" data-active={loop} onClick={() => setLoop(!loop)} aria-pressed={loop}>
                <Repeat size={12} /> Loop
              </button>
              <Segmented layoutId="prog-inst" size="sm" value={instrument} onChange={setInstrument} options={[{ value: 'guitar', label: 'Guitar' }, { value: 'piano', label: 'Piano' }]} />
            </div>
          </div>
          <div className="w-full">
            <div className="mb-1 flex justify-between">
              <span className="label">Tempo</span>
              <span className="font-mono text-sm text-a1">{bpm} BPM</span>
            </div>
            <input type="range" min={40} max={200} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="w-full accent-[var(--a1)]" aria-label="Playback tempo" />
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="label">Beats per chord</span>
              <div className="flex gap-1">
                {[1, 2, 4, 8].map((b) => (
                  <button key={b} className="chip font-mono" data-active={beatsPer === b} onClick={() => setBeatsPer(b)}>
                    {b}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
        <Section title={shown ? <span className="font-mono">{shown.symbol}</span> : 'Chord shape'} action={shown && <span className="font-mono text-xs text-mute">{shown.roman}</span>}>
          <div className="flex min-h-[230px] items-center justify-center">
            {shown && shownVoicing ? (
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={shown.id + shown.symbol} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.94 }} transition={{ duration: 0.15 }}>
                  <GuitarDiagram voicing={shownVoicing} tuning={tuning} size={1.3} accidental={acc} />
                </motion.div>
              </AnimatePresence>
            ) : (
              <span className="text-sm text-mute">{shown ? 'No shape in this tuning' : 'Nothing selected'}</span>
            )}
          </div>
        </Section>
      </div>
    </div>
  )
}
