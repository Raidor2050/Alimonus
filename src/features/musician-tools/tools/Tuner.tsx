import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Mic, MicOff, Minus, Plus, Square, TriangleAlert } from 'lucide-react'
import { audioContext } from '@/lib/audio/synth'
import { PitchSmoother, centsBetween, detectPitch } from '@/lib/audio/pitch'
import { getTuning, TUNINGS } from '@/lib/theory/guitar'
import { midiToFreq, nameToMidi, pcToName } from '@/lib/theory/notes'
import { useApp, useSettings } from '@/stores/app'
import { Field, spring } from '@/components/ui'
import { cx } from '@/lib/util'
import { Stat, useAccidental, useDebouncedEffect } from '../shared'

type Status = 'idle' | 'requesting' | 'active' | 'denied' | 'nomic' | 'insecure' | 'unsupported' | 'error'

interface Reading {
  freq: number
  midi: number
  cents: number
  level: number
}

const IN_TUNE = 5

export default function Tuner() {
  const settings = useSettings()
  const updateSettings = useApp((s) => s.updateSettings)
  const [a4, setA4] = useState(() => clampA4(settings.referencePitch))
  const [tuningId, setTuningId] = useState(settings.tuning)
  const [status, setStatus] = useState<Status>('idle')
  const [errorText, setErrorText] = useState('')
  const [reading, setReading] = useState<Reading | null>(null)
  const [level, setLevel] = useState(0)
  const accidental = useAccidental()
  const reduce = useReducedMotion()

  useDebouncedEffect(a4, 800, (v) => updateSettings({ referencePitch: v }), a4 === settings.referencePitch)

  const a4Ref = useRef(a4)
  a4Ref.current = a4
  const session = useRef<{ stream: MediaStream; source: MediaStreamAudioSourceNode; analyser: AnalyserNode; raf: number } | null>(null)

  const stop = useCallback(() => {
    const s = session.current
    session.current = null
    if (s) {
      cancelAnimationFrame(s.raf)
      s.source.disconnect()
      s.analyser.disconnect()
      s.stream.getTracks().forEach((t) => t.stop())
    }
    setReading(null)
    setLevel(0)
    setStatus((st) => (st === 'active' || st === 'requesting' ? 'idle' : st))
  }, [])

  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      stop()
    }
  }, [stop])

  // Surface a previously-blocked permission before the user even clicks.
  useEffect(() => {
    let cancelled = false
    const perms = navigator.permissions
    if (!perms?.query) return
    perms
      .query({ name: 'microphone' as PermissionName })
      .then((p) => {
        if (!cancelled && p.state === 'denied') setStatus((s) => (s === 'idle' ? 'denied' : s))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const start = useCallback(async () => {
    if (session.current) return
    if (typeof window !== 'undefined' && window.isSecureContext === false) return setStatus('insecure')
    if (!navigator.mediaDevices?.getUserMedia) return setStatus('unsupported')
    setStatus('requesting')
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } })
    } catch (err) {
      const name = err instanceof DOMException ? err.name : ''
      if (name === 'NotAllowedError' || name === 'SecurityError') setStatus('denied')
      else if (name === 'NotFoundError' || name === 'OverconstrainedError' || name === 'DevicesNotFoundError') setStatus('nomic')
      else {
        setErrorText(err instanceof Error ? err.message : String(err))
        setStatus('error')
      }
      return
    }
    // Unmounted (or stopped) while the permission prompt was open: release the mic immediately.
    if (!mounted.current) {
      stream.getTracks().forEach((t) => t.stop())
      return
    }
    const ctx = audioContext()
    const source = ctx.createMediaStreamSource(stream)
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 4096
    source.connect(analyser)
    const buf = new Float32Array(analyser.fftSize)
    const smoother = new PitchSmoother()
    let frame = 0
    const loop = () => {
      const s = session.current
      if (!s) return
      s.raf = requestAnimationFrame(loop)
      // Detection is the expensive part; ~30 Hz is plenty for a tuner.
      if (frame++ % 2) return
      analyser.getFloatTimeDomainData(buf)
      let sum = 0
      for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i]
      const rms = Math.sqrt(sum / buf.length)
      setLevel(Math.min(1, rms * 6))
      const f = detectPitch(buf, ctx.sampleRate, { rmsGate: 0.008, minFreq: 55, maxFreq: 1400 })
      const sm = smoother.push(f, a4Ref.current)
      if (!sm) setReading(null)
      else setReading({ freq: sm.freq, midi: sm.midi, cents: centsBetween(sm.freq, midiToFreq(sm.midi, a4Ref.current)), level: rms })
    }
    session.current = { stream, source, analyser, raf: requestAnimationFrame(loop) }
    // The track can end on its own (device unplugged, permission revoked).
    stream.getAudioTracks().forEach((t) => (t.onended = () => stop()))
    setStatus('active')
  }, [stop])

  const tuning = getTuning(tuningId)
  const strings = useMemo(
    () =>
      tuning.notes.map((n) => {
        const midi = nameToMidi(n) ?? 40
        return { name: n, midi, freq: midiToFreq(midi, a4) }
      }),
    [tuning, a4],
  )
  const closest = useMemo(() => {
    if (!reading) return null
    let best = -1
    let bestCents = Infinity
    strings.forEach((s, i) => {
      const c = centsBetween(reading.freq, s.freq)
      if (Math.abs(c) < Math.abs(bestCents)) {
        best = i
        bestCents = c
      }
    })
    return Math.abs(bestCents) < 350 ? { index: best, cents: bestCents } : null
  }, [reading, strings])

  const active = status === 'active'
  const cents = reading ? Math.max(-50, Math.min(50, reading.cents)) : 0
  const inTune = !!reading && Math.abs(reading.cents) <= IN_TUNE

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className={cx('panel relative overflow-hidden p-5 sm:p-7 transition-shadow duration-500', inTune && 'shadow-[0_0_80px_-20px_rgb(var(--glow)/0.7)]')}>
        <div aria-hidden className={cx('pointer-events-none absolute inset-0 transition-opacity duration-500', inTune ? 'opacity-100' : 'opacity-0')} style={{ background: 'radial-gradient(60% 55% at 50% 60%, rgb(var(--glow) / 0.16), transparent 70%)' }} />

        <Gauge cents={cents} hasReading={!!reading} inTune={inTune} reduce={!!reduce} />

        <div className="relative -mt-6 flex flex-col items-center text-center sm:-mt-10">
          <div className="flex items-start gap-1" aria-live="polite" aria-atomic="true">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={reading ? reading.midi : 'none'}
                initial={{ opacity: 0, y: 12, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -12, scale: 0.9 }}
                transition={spring}
                className={cx('display text-7xl font-extrabold leading-none sm:text-8xl', inTune ? 'text-a1 [text-shadow:0_0_30px_rgb(var(--glow)/0.7)]' : reading ? 'text-white' : 'text-white/20')}
              >
                {reading ? pcToName(reading.midi, accidental) : '—'}
              </motion.span>
            </AnimatePresence>
            {reading && <span className="mt-2 font-mono text-xl text-mute">{Math.floor(reading.midi / 12) - 1}</span>}
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2 font-mono text-sm">
            <span className={cx('rounded-full px-3 py-1', inTune ? 'bg-a1 text-ink font-bold' : 'bg-white/[0.05] text-soft')}>
              {reading ? (inTune ? 'In tune' : `${reading.cents > 0 ? '+' : ''}${reading.cents.toFixed(0)}¢ ${reading.cents > 0 ? 'sharp' : 'flat'}`) : active ? 'Play a note…' : 'Mic off'}
            </span>
            <span className="text-mute">{reading ? `${reading.freq.toFixed(1)} Hz` : '— Hz'}</span>
          </div>

          <div className="mt-6 flex items-center gap-3">
            {active ? (
              <button className="btn" onClick={stop}>
                <Square size={14} /> Stop listening
              </button>
            ) : (
              <button className="btn btn-primary" onClick={() => void start()} disabled={status === 'requesting'}>
                <Mic size={16} /> {status === 'requesting' ? 'Waiting for permission…' : status === 'idle' ? 'Start tuner' : 'Try again'}
              </button>
            )}
            {active && (
              <div className="flex h-8 w-24 items-end gap-0.5" aria-label="Input level" role="meter" aria-valuenow={Math.round(level * 100)} aria-valuemin={0} aria-valuemax={100}>
                {Array.from({ length: 12 }, (_, i) => (
                  <span key={i} className={cx('flex-1 rounded-sm transition-colors duration-75', level * 12 > i ? (i > 9 ? 'bg-a3' : 'bg-a1') : 'bg-white/10')} style={{ height: `${30 + i * 6}%` }} />
                ))}
              </div>
            )}
          </div>
          <StatusNote status={status} errorText={errorText} />
        </div>
      </section>

      <div className="flex flex-col gap-4">
        <section className="panel p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="display text-base font-bold">Strings</h2>
            {closest && (
              <span className={cx('font-mono text-xs', Math.abs(closest.cents) <= IN_TUNE ? 'text-a1' : 'text-soft')}>
                {strings[closest.index].name}: {closest.cents > 0 ? '+' : ''}
                {closest.cents.toFixed(0)}¢
              </span>
            )}
          </div>
          <Field label="Tuning">
            <select className="input" value={tuning.id} onChange={(e) => setTuningId(e.target.value)}>
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <div className="mt-4 grid grid-cols-6 gap-1.5">
            {strings.map((s, i) => {
              const on = closest?.index === i
              const ok = on && Math.abs(closest!.cents) <= IN_TUNE
              return (
                <motion.div
                  key={i}
                  animate={{ y: on ? -4 : 0, scale: on ? 1.06 : 1 }}
                  transition={spring}
                  className={cx('flex flex-col items-center rounded-xl border px-1 py-2.5 transition-colors', ok ? 'border-a1 bg-a1/15 shadow-[0_0_20px_-6px_rgb(var(--glow)/0.9)]' : on ? 'border-a2/60 bg-a2/10' : 'border-white/[0.07] bg-white/[0.02]')}
                >
                  <span className="text-[0.6rem] text-mute">{6 - i}</span>
                  <span className={cx('font-mono text-sm font-bold', ok ? 'text-a1' : on ? 'text-white' : 'text-soft')}>{pcToName(s.midi, accidental)}</span>
                  <span className="font-mono text-[0.6rem] text-mute">{s.freq.toFixed(0)}</span>
                  {on && <span className={cx('mt-0.5 font-mono text-[0.6rem]', ok ? 'text-a1' : 'text-a2')}>{closest!.cents > 0 ? '+' : ''}{closest!.cents.toFixed(0)}</span>}
                </motion.div>
              )
            })}
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Reference A4</span>
            <span className="font-mono text-sm text-a1">{a4} Hz</span>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn btn-icon" aria-label="Lower reference pitch" onClick={() => setA4((v) => clampA4(v - 1))}>
              <Minus size={14} />
            </button>
            <input type="range" min={415} max={466} value={a4} onChange={(e) => setA4(clampA4(Number(e.target.value)))} className="w-full accent-[var(--a1)]" aria-label="Reference pitch A4 in hertz" />
            <button className="btn btn-icon" aria-label="Raise reference pitch" onClick={() => setA4((v) => clampA4(v + 1))}>
              <Plus size={14} />
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {[415, 432, 440, 442, 444].map((v) => (
              <button key={v} className="chip" data-active={a4 === v} onClick={() => setA4(v)}>
                {v}
              </button>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Stat label="Target" value={reading ? `${midiToFreq(reading.midi, a4).toFixed(2)} Hz` : '—'} />
            <Stat label="Window" value={`±${IN_TUNE}¢ = in tune`} />
          </div>
        </section>
      </div>
    </div>
  )
}

function clampA4(v: number) {
  return Math.min(466, Math.max(415, Math.round(v || 440)))
}

function Gauge({ cents, hasReading, inTune, reduce }: { cents: number; hasReading: boolean; inTune: boolean; reduce: boolean }) {
  const W = 320
  const cx0 = W / 2
  const cy0 = 170
  const R = 140
  const ang = (c: number) => (c / 50) * 70 // ±50¢ → ±70°
  const pt = (deg: number, r: number) => {
    const rad = ((deg - 90) * Math.PI) / 180
    return [cx0 + r * Math.cos(rad), cy0 + r * Math.sin(rad)] as const
  }
  const arc = (from: number, to: number, r: number) => {
    const [x1, y1] = pt(from, r)
    const [x2, y2] = pt(to, r)
    return `M ${x1} ${y1} A ${r} ${r} 0 ${Math.abs(to - from) > 180 ? 1 : 0} 1 ${x2} ${y2}`
  }
  return (
    <svg viewBox={`0 0 ${W} 190`} className="relative mx-auto block w-full max-w-[460px]" role="img" aria-label={hasReading ? `Tuning gauge, ${cents.toFixed(0)} cents` : 'Tuning gauge, no signal'}>
      <defs>
        <linearGradient id="tuner-arc" x1="0" x2="1">
          <stop offset="0" stopColor="var(--a4)" />
          <stop offset="0.5" stopColor="var(--a1)" />
          <stop offset="1" stopColor="var(--a3)" />
        </linearGradient>
      </defs>
      <path d={arc(-70, 70, R)} stroke="url(#tuner-arc)" strokeOpacity={0.35} strokeWidth={10} fill="none" strokeLinecap="round" />
      <path d={arc(ang(-IN_TUNE), ang(IN_TUNE), R)} stroke="var(--a1)" strokeWidth={inTune ? 14 : 10} fill="none" strokeLinecap="round" style={{ filter: inTune ? 'drop-shadow(0 0 8px rgb(var(--glow)))' : undefined, transition: 'stroke-width .3s' }} />
      {Array.from({ length: 21 }, (_, i) => {
        const c = -50 + i * 5
        const major = c % 25 === 0
        const [x1, y1] = pt(ang(c), R - 14)
        const [x2, y2] = pt(ang(c), R - (major ? 30 : 22))
        return <line key={c} x1={x1} y1={y1} x2={x2} y2={y2} stroke={c === 0 ? 'var(--a1)' : 'rgb(255 255 255 / 0.3)'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />
      })}
      {[-50, -25, 25, 50].map((c) => {
        const [x, y] = pt(ang(c), R - 44)
        return (
          <text key={c} x={x} y={y + 3} textAnchor="middle" fontSize="10" fill="var(--color-mute)" fontFamily="var(--font-mono)">
            {c > 0 ? `+${c}` : c}
          </text>
        )
      })}
      <text x={pt(-78, R)[0]} y={pt(-78, R)[1] + 18} fontSize="16" fill="var(--a4)" textAnchor="middle" fontWeight="700">
        ♭
      </text>
      <text x={pt(78, R)[0]} y={pt(78, R)[1] + 18} fontSize="16" fill="var(--a3)" textAnchor="middle" fontWeight="700">
        ♯
      </text>
      {inTune && !reduce && (
        <motion.circle cx={cx0} cy={cy0} r={18} fill="none" stroke="var(--a1)" strokeWidth={2} initial={{ scale: 0.6, opacity: 0.8 }} animate={{ scale: 3.2, opacity: 0 }} transition={{ duration: 1.2, repeat: Infinity, ease: 'easeOut' }} style={{ transformOrigin: `${cx0}px ${cy0}px` }} />
      )}
      <motion.g animate={{ rotate: hasReading ? ang(cents) : 0, opacity: hasReading ? 1 : 0.25 }} transition={{ type: 'spring', stiffness: 170, damping: 18, mass: 0.6 }} style={{ transformOrigin: `${cx0}px ${cy0}px` }}>
        <line x1={cx0} y1={cy0} x2={cx0} y2={cy0 - R + 6} stroke={inTune ? 'var(--a1)' : 'white'} strokeWidth={3} strokeLinecap="round" style={{ filter: inTune ? 'drop-shadow(0 0 6px rgb(var(--glow)))' : undefined }} />
      </motion.g>
      <circle cx={cx0} cy={cy0} r={9} fill={inTune ? 'var(--a1)' : '#ece9f7'} />
    </svg>
  )
}

function StatusNote({ status, errorText }: { status: Status; errorText: string }) {
  const notes: Partial<Record<Status, { title: string; body: string }>> = {
    idle: { title: 'Microphone needed', body: 'The tuner listens through your mic. Audio never leaves this device.' },
    requesting: { title: 'Asking for the mic…', body: 'Look for the permission prompt near the address bar and choose Allow.' },
    denied: {
      title: 'Microphone blocked',
      body: 'Click the lock / tune icon left of the address bar, set Microphone to Allow, then press Try again. On iPhone: Settings → Safari → Microphone → Allow. On Android Chrome: ⋮ → Settings → Site settings → Microphone.',
    },
    nomic: { title: 'No microphone found', body: 'Plug in or enable a microphone (or check it isn’t disabled in your system sound settings), then press Try again.' },
    insecure: { title: 'Needs a secure connection', body: 'Browsers only allow the mic on https:// or localhost. Open Alimonus over https and try again.' },
    unsupported: { title: 'Not supported here', body: 'This browser can’t share a microphone with web pages. Try a recent Chrome, Edge, Firefox or Safari.' },
    error: { title: 'Couldn’t start the mic', body: errorText || 'Something else is using it, or the device stopped responding.' },
  }
  const n = notes[status]
  if (!n) return null
  const bad = status !== 'idle' && status !== 'requesting'
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} key={status} className={cx('mt-5 flex max-w-md items-start gap-3 rounded-2xl border p-3 text-left text-sm', bad ? 'border-a3/40 bg-a3/[0.07]' : 'border-white/[0.07] bg-white/[0.02]')} role={bad ? 'alert' : 'status'}>
      {bad ? <TriangleAlert size={18} className="mt-0.5 shrink-0 text-a3" /> : status === 'requesting' ? <Mic size={18} className="mt-0.5 shrink-0 text-a1" /> : <MicOff size={18} className="mt-0.5 shrink-0 text-mute" />}
      <div>
        <div className="font-semibold">{n.title}</div>
        <div className="text-mute">{n.body}</div>
      </div>
    </motion.div>
  )
}
