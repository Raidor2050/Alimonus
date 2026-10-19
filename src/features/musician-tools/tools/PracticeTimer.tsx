import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Clock, Flag, Pause, Play, RotateCcw, Trash } from 'lucide-react'
import { useApp } from '@/stores/app'
import { playNotes } from '@/lib/audio/synth'
import { Field, Section, Segmented, spring } from '@/components/ui'
import { cx, relativeTime, uid } from '@/lib/util'
import { formatClock, readLocal, writeLocal } from '../lib'
import { TransportButton } from '../shared'

const CHECKS = [
  { id: 'chords', label: 'Chords learned' },
  { id: 'rhythm', label: 'Rhythm / strumming' },
  { id: 'lyrics', label: 'Lyrics memorised' },
  { id: 'runthrough', label: 'Full run-through' },
  { id: 'recorded', label: 'Recorded a take' },
] as const

interface LogEntry {
  id: string
  songId: string | null
  songTitle: string
  seconds: number
  at: string
}

const PRESETS = [5, 10, 15, 25]

export default function PracticeTimer() {
  const userId = useApp((s) => s.me?.id) ?? 'guest'
  const songs = useApp((s) => s.data.songs)
  const sorted = useMemo(() => [...songs].sort((a, b) => a.title.localeCompare(b.title)), [songs])
  const [songId, setSongId] = useState<string>('')
  const song = sorted.find((s) => s.id === songId) ?? null

  const [mode, setMode] = useState<'countdown' | 'stopwatch'>('countdown')
  const [target, setTarget] = useState(15 * 60)
  const [accum, setAccum] = useState(0)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [, force] = useState(0)
  const running = startedAt !== null
  const elapsed = accum + (running ? (Date.now() - startedAt) / 1000 : 0)
  const remaining = Math.max(0, target - elapsed)
  const progress = mode === 'countdown' ? Math.min(1, elapsed / target) : (elapsed % 60) / 60

  // Re-render while running; time comes from timestamps, so throttled tabs stay accurate.
  useEffect(() => {
    if (!running) return
    const t = setInterval(() => force((n) => n + 1), 250)
    return () => clearInterval(t)
  }, [running])

  const logKey = `alimonus:practice-log:${userId}`
  const [log, setLog] = useState<LogEntry[]>(() => readLocal<LogEntry[]>(logKey, []))
  useEffect(() => setLog(readLocal<LogEntry[]>(logKey, [])), [logKey])

  const checkKey = `alimonus:practice:${userId}:${songId || 'general'}`
  const [checks, setChecks] = useState<Record<string, boolean>>(() => readLocal(checkKey, {}))
  useEffect(() => setChecks(readLocal(checkKey, {})), [checkKey])
  const toggleCheck = (id: string) => {
    const next = { ...checks, [id]: !checks[id] }
    setChecks(next)
    writeLocal(checkKey, next)
  }
  const doneCount = CHECKS.filter((c) => checks[c.id]).length

  const finish = useCallback(
    (seconds: number) => {
      if (seconds >= 10) {
        const entry: LogEntry = { id: uid(), songId: song?.id ?? null, songTitle: song ? `${song.title} — ${song.artist}` : 'General practice', seconds: Math.round(seconds), at: new Date().toISOString() }
        const next = [entry, ...readLocal<LogEntry[]>(logKey, [])].slice(0, 50)
        writeLocal(logKey, next)
        setLog(next)
      }
      setStartedAt(null)
      setAccum(0)
    },
    [song, logKey],
  )

  // Countdown complete: chime and log.
  const doneRef = useRef(false)
  useEffect(() => {
    if (mode === 'countdown' && running && remaining <= 0 && !doneRef.current) {
      doneRef.current = true
      playNotes([72, 76, 79, 84], { instrument: 'piano', strum: 0.14, duration: 2.4 })
      finish(target)
    }
    if (!running) doneRef.current = false
  })

  const toggle = () => {
    if (running) {
      setAccum(elapsed)
      setStartedAt(null)
    } else {
      if (mode === 'countdown' && remaining <= 0) setAccum(0)
      setStartedAt(Date.now())
    }
  }
  const reset = () => {
    setStartedAt(null)
    setAccum(0)
  }

  const now = Date.now()
  const todaySecs = log.filter((e) => new Date(e.at).toDateString() === new Date().toDateString()).reduce((s, e) => s + e.seconds, 0)
  const weekSecs = log.filter((e) => now - new Date(e.at).getTime() < 7 * 864e5).reduce((s, e) => s + e.seconds, 0)

  const R = 92
  const C = 2 * Math.PI * R

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <section className="panel flex flex-col items-center p-5 sm:p-7">
        <div className="grid w-full gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Field label="Song">
            <select className="input" value={songId} onChange={(e) => setSongId(e.target.value)}>
              <option value="">General practice (no song)</option>
              {sorted.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} — {s.artist}
                </option>
              ))}
            </select>
          </Field>
          <Segmented layoutId="practice-mode" size="sm" value={mode} onChange={(m) => { reset(); setMode(m) }} options={[{ value: 'countdown', label: 'Countdown' }, { value: 'stopwatch', label: 'Stopwatch' }]} />
        </div>

        <div className="relative my-6 grid place-items-center">
          <svg viewBox="0 0 220 220" className="h-56 w-56 -rotate-90 sm:h-64 sm:w-64" aria-hidden>
            <defs>
              <linearGradient id="practice-ring" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="var(--a1)" />
                <stop offset="0.6" stopColor="var(--a2)" />
                <stop offset="1" stopColor="var(--a3)" />
              </linearGradient>
            </defs>
            <circle cx="110" cy="110" r={R} stroke="rgb(255 255 255 / 0.07)" strokeWidth="10" fill="none" />
            <motion.circle cx="110" cy="110" r={R} stroke="url(#practice-ring)" strokeWidth="10" fill="none" strokeLinecap="round" strokeDasharray={C} animate={{ strokeDashoffset: C * (1 - progress) }} transition={{ duration: 0.3, ease: 'linear' }} style={{ filter: running ? 'drop-shadow(0 0 8px rgb(var(--glow) / 0.6))' : undefined }} />
          </svg>
          <div className="absolute flex flex-col items-center">
            <span className="display text-5xl font-extrabold tabular-nums sm:text-6xl" role="timer" aria-live="off">
              {formatClock(mode === 'countdown' ? Math.ceil(remaining) : elapsed)}
            </span>
            <span className="label mt-1">{mode === 'countdown' ? `of ${target / 60} min` : running ? 'practising' : 'stopwatch'}</span>
          </div>
        </div>

        {mode === 'countdown' && (
          <div className="mb-5 flex flex-wrap justify-center gap-1.5">
            {PRESETS.map((m) => (
              <button key={m} className="chip font-mono" data-active={target === m * 60} disabled={running} onClick={() => { setTarget(m * 60); setAccum(0) }}>
                {m} min
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button className="btn btn-icon h-12 w-12" onClick={reset} aria-label="Reset timer" disabled={!running && accum === 0}>
            <RotateCcw size={16} />
          </button>
          <TransportButton active={running} onClick={toggle} label={running ? 'Pause' : 'Start practising'}>
            {running ? <Pause size={28} /> : <Play size={28} className="translate-x-0.5" />}
          </TransportButton>
          <button className="btn h-12" onClick={() => finish(elapsed)} disabled={elapsed < 1}>
            <Flag size={14} /> Finish
          </button>
        </div>
        <p className="mt-3 text-center text-xs text-mute">Sessions over 10 seconds are logged on this device when you finish or the countdown ends.</p>
      </section>

      <div className="flex flex-col gap-4">
        <Section title={song ? <span className="line-clamp-1">{song.title}</span> : 'Checklist'} action={<span className="font-mono text-xs text-a1">{doneCount}/{CHECKS.length}</span>}>
          <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
            <motion.div className="h-full rounded-full bg-gradient-to-r from-a1 to-a2" animate={{ width: `${(doneCount / CHECKS.length) * 100}%` }} transition={spring} />
          </div>
          <ul className="flex flex-col gap-1.5">
            {CHECKS.map((c) => {
              const on = !!checks[c.id]
              return (
                <li key={c.id}>
                  <button role="checkbox" aria-checked={on} onClick={() => toggleCheck(c.id)} className={cx('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition-colors', on ? 'border-a1/30 bg-a1/[0.07]' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15')}>
                    <motion.span animate={{ scale: on ? [1, 1.25, 1] : 1 }} transition={{ duration: 0.25 }} className={cx('grid h-5 w-5 shrink-0 place-items-center rounded-md border', on ? 'border-transparent bg-a1 text-ink' : 'border-white/25')}>
                      {on && <Check size={13} strokeWidth={3} />}
                    </motion.span>
                    <span className={cx(on && 'text-soft line-through decoration-a1/50')}>{c.label}</span>
                  </button>
                </li>
              )
            })}
          </ul>
          {!song && <p className="mt-2 text-xs text-mute">Pick a song to keep a checklist for it.{!sorted.length && ' Your Chordbook is empty for now.'}</p>}
        </Section>

        <Section
          title={
            <span className="flex items-center gap-2">
              <Clock size={15} className="text-a2" /> Session log
            </span>
          }
          action={
            log.length > 0 && (
              <button className="btn btn-ghost py-1 text-xs" onClick={() => { writeLocal(logKey, []); setLog([]) }}>
                <Trash size={12} /> Clear
              </button>
            )
          }
        >
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-white/[0.07] px-3 py-2">
              <div className="label">Today</div>
              <div className="font-mono text-lg text-a1">{formatClock(todaySecs)}</div>
            </div>
            <div className="rounded-xl border border-white/[0.07] px-3 py-2">
              <div className="label">Last 7 days</div>
              <div className="font-mono text-lg text-a2">{formatClock(weekSecs)}</div>
            </div>
          </div>
          {log.length ? (
            <ul className="flex max-h-64 flex-col gap-1 overflow-auto pr-1">
              <AnimatePresence initial={false}>
                {log.slice(0, 12).map((e) => (
                  <motion.li key={e.id} layout initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-sm hover:bg-white/[0.03]">
                    <span className="min-w-0 truncate">{e.songTitle}</span>
                    <span className="shrink-0 font-mono text-xs text-mute">
                      {formatClock(e.seconds)} · {relativeTime(e.at)}
                    </span>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          ) : (
            <p className="text-sm text-mute">No sessions yet. Start the timer and hit Finish when you’re done.</p>
          )}
        </Section>
      </div>
    </div>
  )
}
