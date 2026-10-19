import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { Hand, Minus, Pause, Play, Plus, Volume2 } from 'lucide-react'
import { audioContext } from '@/lib/audio/synth'
import { Metronome, TapTempo, TIME_SIGNATURES, clampBpm, cycleAccent, defaultAccents, MAX_BPM, MIN_BPM, type BeatAccent, type Subdivision, type TimeSignature } from '@/lib/audio/metronome'
import { useApp, useSettings } from '@/stores/app'
import { Segmented, spring } from '@/components/ui'
import { cx } from '@/lib/util'
import { TransportButton, useDebouncedEffect, useSpacebar } from '../shared'

const SUBDIVISIONS: { value: string; label: string; n: Subdivision }[] = [
  { value: '1', label: '♩', n: 1 },
  { value: '2', label: '♫ 8ths', n: 2 },
  { value: '3', label: '3 trip', n: 3 },
  { value: '4', label: '16ths', n: 4 },
]

function tempoName(bpm: number): string {
  if (bpm < 60) return 'Largo'
  if (bpm < 76) return 'Adagio'
  if (bpm < 108) return 'Andante'
  if (bpm < 120) return 'Moderato'
  if (bpm < 168) return 'Allegro'
  if (bpm < 200) return 'Presto'
  return 'Prestissimo'
}

export default function MetronomeTool() {
  const settings = useSettings()
  const updateSettings = useApp((s) => s.updateSettings)
  const reduce = useReducedMotion()
  const [bpm, setBpmRaw] = useState(() => clampBpm(settings.metronomeBpm))
  const [volume, setVolume] = useState(() => Math.min(1, Math.max(0, settings.metronomeVolume)))
  const [sig, setSig] = useState<TimeSignature>('4/4')
  const [accents, setAccents] = useState<BeatAccent[]>(() => defaultAccents('4/4'))
  const [subdivision, setSubdivision] = useState<Subdivision>(1)
  const [running, setRunning] = useState(false)
  const [pos, setPos] = useState<{ beat: number; sub: number; n: number } | null>(null)
  const [tapCount, setTapCount] = useState(0)
  const setBpm = useCallback((v: number) => setBpmRaw(clampBpm(v)), [])

  const persisted = `${bpm}|${volume}`
  useDebouncedEffect(persisted, 900, () => updateSettings({ metronomeBpm: bpm, metronomeVolume: volume }), bpm === settings.metronomeBpm && volume === settings.metronomeVolume)

  const engine = useRef<Metronome | null>(null)
  if (!engine.current) engine.current = new Metronome({ bpm, accents, subdivision, volume })

  useEffect(() => {
    engine.current!.update({ bpm, accents, subdivision, volume })
  }, [bpm, accents, subdivision, volume])

  // Visuals follow the audio clock: drain ticks whose scheduled time has passed.
  useEffect(() => {
    if (!running) return
    let raf = 0
    let n = 0
    const loop = () => {
      const tick = engine.current!.takeDue(audioContext().currentTime)
      if (tick) setPos({ beat: tick.beat, sub: tick.sub, n: ++n })
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [running])

  useEffect(() => () => engine.current?.stop(), [])

  const toggle = useCallback(() => {
    const m = engine.current!
    if (m.running) {
      m.stop()
      setRunning(false)
      setPos(null)
    } else {
      m.start()
      setRunning(true)
    }
  }, [])
  useSpacebar(toggle)

  const tapper = useMemo(() => new TapTempo(2000), [])
  const tap = () => {
    const v = tapper.tap(performance.now())
    setTapCount(tapper.count)
    if (v) setBpm(v)
  }
  useEffect(() => {
    if (!tapCount) return
    const t = setTimeout(() => setTapCount(0), 2000)
    return () => clearTimeout(t)
  }, [tapCount])

  const changeSig = (s: TimeSignature) => {
    setSig(s)
    setAccents(defaultAccents(s))
  }

  const beatOn = pos && pos.sub === 0 ? pos.beat : null
  const downbeat = beatOn === 0 && accents[0] === 'accent'

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="panel relative overflow-hidden p-5 sm:p-7">
        {/* audio-synced flash */}
        <motion.div
          aria-hidden
          key={pos?.n ?? 'idle'}
          className="pointer-events-none absolute inset-0"
          style={{ background: `radial-gradient(70% 60% at 50% 35%, rgb(var(${downbeat ? '--glow' : '--glow2'}) / ${pos && pos.sub === 0 ? (downbeat ? 0.22 : 0.12) : 0.05}), transparent 70%)` }}
          initial={{ opacity: pos ? 1 : 0 }}
          animate={{ opacity: 0 }}
          transition={{ duration: reduce ? 0.05 : Math.min(0.5, 60 / bpm) }}
        />

        <div className="relative flex flex-col items-center">
          <div className="label">{tempoName(bpm)}</div>
          <div className="flex items-center gap-3 sm:gap-6">
            <motion.button whileTap={{ scale: 0.85 }} className="btn btn-icon h-12 w-12" aria-label="Slower" onClick={() => setBpm(bpm - 1)}>
              <Minus size={18} />
            </motion.button>
            <motion.div
              key={reduce ? 'static' : `b${pos?.n ?? 0}`}
              initial={{ scale: pos && pos.sub === 0 && !reduce ? 1.06 : 1 }}
              animate={{ scale: 1 }}
              transition={spring}
              className="display w-[4.2ch] text-center text-7xl font-extrabold tabular-nums sm:text-8xl"
            >
              {bpm}
            </motion.div>
            <motion.button whileTap={{ scale: 0.85 }} className="btn btn-icon h-12 w-12" aria-label="Faster" onClick={() => setBpm(bpm + 1)}>
              <Plus size={18} />
            </motion.button>
          </div>
          <div className="label -mt-1">BPM{sig.endsWith('/8') ? ' · eighth-note pulse' : ''}</div>

          <input type="range" min={MIN_BPM} max={MAX_BPM} value={bpm} onChange={(e) => setBpm(Number(e.target.value))} className="mt-5 w-full max-w-md accent-[var(--a1)]" aria-label="Tempo in beats per minute" />

          <div className="mt-6 flex flex-wrap justify-center gap-2 sm:gap-3" role="group" aria-label="Beats — click to cycle accent, normal, mute">
            {accents.map((a, i) => {
              const lit = beatOn === i
              return (
                <motion.button
                  key={i}
                  onClick={() => setAccents((arr) => arr.map((x, j) => (j === i ? cycleAccent(x) : x)))}
                  whileTap={{ scale: 0.85 }}
                  animate={{ scale: lit && !reduce ? 1.18 : 1 }}
                  transition={{ type: 'spring', stiffness: 700, damping: 18 }}
                  aria-label={`Beat ${i + 1}: ${a}`}
                  className={cx(
                    'relative grid h-11 w-11 place-items-center rounded-full border font-mono text-sm font-bold transition-colors duration-75 sm:h-14 sm:w-14',
                    a === 'mute' && 'border-dashed border-white/15 text-white/25',
                    a === 'accent' && (lit ? 'border-transparent bg-a1 text-ink shadow-[0_0_30px_-2px_rgb(var(--glow)/0.9)]' : 'border-a1/60 text-a1'),
                    a === 'normal' && (lit ? 'border-transparent bg-a2 text-ink shadow-[0_0_26px_-4px_rgb(var(--glow2)/0.9)]' : 'border-white/15 text-soft'),
                    a === 'mute' && lit && 'bg-white/10',
                  )}
                >
                  {i + 1}
                  {a === 'accent' && <span className="absolute -top-1 right-0 text-[0.6rem] text-a1">›</span>}
                </motion.button>
              )
            })}
          </div>
          {subdivision > 1 && (
            <div className="mt-3 flex gap-1.5" aria-hidden>
              {Array.from({ length: subdivision }, (_, i) => (
                <span key={i} className={cx('h-1.5 w-6 rounded-full transition-colors duration-75', pos && pos.sub === i ? 'bg-a1' : 'bg-white/10')} />
              ))}
            </div>
          )}

          <div className="mt-7 flex items-center gap-4">
            <TransportButton active={running} onClick={toggle} label={running ? 'Stop metronome' : 'Start metronome'}>
              {running ? <Pause size={28} /> : <Play size={28} className="translate-x-0.5" />}
            </TransportButton>
            <motion.button whileTap={{ scale: 0.9 }} onClick={tap} className={cx('btn h-14 px-5', tapCount > 0 && 'border-a1/50 text-a1')} aria-label="Tap tempo">
              <Hand size={16} /> Tap{tapCount > 1 ? ` ×${tapCount}` : ''}
            </motion.button>
          </div>
          <p className="mt-3 text-xs text-mute">
            <span className="kbd">Space</span> start / stop · click a beat to cycle accent → normal → mute
          </p>
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <section className="panel p-4 sm:p-5">
          <div className="label mb-2">Time signature</div>
          <div className="flex flex-wrap gap-1.5">
            {TIME_SIGNATURES.map((s) => (
              <button key={s} className="chip font-mono" data-active={sig === s} onClick={() => changeSig(s)}>
                {s}
              </button>
            ))}
          </div>
          <div className="label mb-2 mt-5">Subdivision</div>
          <Segmented layoutId="metro-sub" size="sm" value={String(subdivision)} options={SUBDIVISIONS.map((s) => ({ value: s.value, label: s.label }))} onChange={(v) => setSubdivision(Number(v) as Subdivision)} />
          <div className="label mb-2 mt-5">Quick tempos</div>
          <div className="flex flex-wrap gap-1.5">
            {[60, 72, 80, 90, 100, 120, 140, 160].map((v) => (
              <button key={v} className="chip font-mono" data-active={bpm === v} onClick={() => setBpm(v)}>
                {v}
              </button>
            ))}
          </div>
        </section>
        <section className="panel p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="label flex items-center gap-1.5">
              <Volume2 size={13} /> Volume
            </span>
            <span className="font-mono text-sm text-soft">{Math.round(volume * 100)}%</span>
          </div>
          <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-[var(--a1)]" aria-label="Metronome volume" />
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs text-mute">
            <div className="rounded-xl border border-white/[0.07] p-2">
              <div className="mx-auto mb-1 h-2.5 w-2.5 rounded-full bg-a1" />
              Downbeat / accent
            </div>
            <div className="rounded-xl border border-white/[0.07] p-2">
              <div className="mx-auto mb-1 h-2.5 w-2.5 rounded-full bg-a2" />
              Beat
            </div>
            <div className="rounded-xl border border-white/[0.07] p-2">
              <div className="mx-auto mb-1 h-2.5 w-2.5 rounded-full border border-dashed border-white/30" />
              Muted
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
