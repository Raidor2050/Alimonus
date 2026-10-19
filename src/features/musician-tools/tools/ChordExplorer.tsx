import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ChevronLeft, ChevronRight, Guitar, Minus, Piano, Play, Plus, Search } from 'lucide-react'
import { CHORD_FAMILIES, QUALITIES, ROOT_CHOICES, chordIntervals, parseChord, transposeChord } from '@/lib/theory/chords'
import { getTuning, guitarVoicings, TUNINGS, voicingMidi } from '@/lib/theory/guitar'
import { pianoVoicings } from '@/lib/theory/piano'
import { pcToName } from '@/lib/theory/notes'
import { playNotes } from '@/lib/audio/synth'
import { useSettings } from '@/stores/app'
import { GuitarDiagram } from '@/components/diagrams/GuitarDiagram'
import { PianoKeyboard } from '@/components/diagrams/PianoKeyboard'
import { Section, spring } from '@/components/ui'
import { cx } from '@/lib/util'
import { intervalName } from '../lib'
import { useAccidental } from '../shared'

export default function ChordExplorer() {
  const settings = useSettings()
  const [symbol, setSymbol] = useState('Am7')
  const [query, setQuery] = useState('')
  const [tuningId, setTuningId] = useState(settings.tuning)
  const [gIndex, setGIndex] = useState(0)
  const [pIndex, setPIndex] = useState(0)
  const tuning = getTuning(tuningId)

  const chord = parseChord(symbol)!
  const minor = chord.quality.startsWith('m') && !chord.quality.startsWith('maj')
  const accidental = useAccidental(chord.root, minor)
  const queryChord = query.trim() ? parseChord(query.trim().replace(/♯/g, '#').replace(/♭/g, 'b')) : null

  const select = (s: string) => {
    setSymbol(s)
    setGIndex(0)
    setPIndex((i) => Math.min(i, 3))
  }

  const guitar = useMemo(() => guitarVoicings(symbol, tuning, 8), [symbol, tuning])
  const piano = useMemo(() => pianoVoicings(symbol), [symbol])
  const gv = guitar[Math.min(gIndex, guitar.length - 1)]
  const pv = piano[Math.min(pIndex, piano.length - 1)]

  const tones = chordIntervals(chord).map((iv) => ({ iv, name: pcToName(chord.root + iv, accidental), label: intervalName(iv, chord.quality) }))
  const rootName = chord.rootName.replace('♯', '#').replace('♭', 'b')
  const pretty = (s: string) => {
    const c = parseChord(s)
    return c ? `${pcToName(c.root, accidental)}${c.suffix}${c.bass !== null ? `/${pcToName(c.bass, accidental)}` : ''}` : s
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* Browser */}
      <div className="flex min-w-0 flex-col gap-4">
        <section className="panel p-4 sm:p-5">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (queryChord) {
                select(query.trim().replace(/♯/g, '#').replace(/♭/g, 'b'))
                setQuery('')
              }
            }}
            className="relative"
          >
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
            <input className="input pl-9 font-mono" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Type a chord: F#m7b5, Cadd9, D/F#…" aria-label="Search chord by name" spellCheck={false} autoCapitalize="off" />
            {query.trim() && (
              <div className="mt-2 text-xs">
                {queryChord ? (
                  <button type="submit" className="chip" data-active="true">
                    Show {query.trim()} — {QUALITIES[queryChord.quality].label}
                  </button>
                ) : (
                  <span className="text-mute">Not a chord I recognise yet. Try a root (A–G, with # or b) plus a quality like m7, sus4, maj9.</span>
                )}
              </div>
            )}
          </form>

          <div className="label mb-2 mt-5">Root</div>
          <div className="grid grid-cols-7 gap-1.5">
            {ROOT_CHOICES.map((r) => (
              <button key={r} className="chip justify-center font-mono" data-active={parseChord(r)!.root === chord.root} onClick={() => select(`${r}${chord.suffix}${chord.bass !== null ? `/${chord.bassName}` : ''}`)}>
                {r}
              </button>
            ))}
          </div>
        </section>

        <section className="panel p-4 sm:p-5">
          <div className="flex flex-col gap-4">
            {CHORD_FAMILIES.map((fam) => (
              <div key={fam}>
                <div className="label mb-1.5">{fam}</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(QUALITIES)
                    .filter(([, q]) => q.family === fam)
                    .map(([suffix, q]) => (
                      <button key={suffix || 'maj'} className="chip font-mono" data-active={chord.quality === suffix && chord.bass === null} title={q.label} onClick={() => select(`${rootName}${suffix}`)}>
                        {pcToName(chord.root, accidental)}
                        {suffix}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Detail */}
      <div className="flex min-w-0 flex-col gap-4">
        <section className="panel relative overflow-hidden p-4 sm:p-6">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-a2/20 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="label">{QUALITIES[chord.quality].label}</div>
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.h2 key={symbol} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={spring} className="display text-gradient text-5xl font-extrabold sm:text-6xl">
                  {pretty(symbol)}
                </motion.h2>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="label mr-1">Transpose</span>
              <button className="btn btn-icon" aria-label="Transpose down a semitone" onClick={() => select(transposeChord(symbol, -1, settings.accidental === 'auto' ? 'auto' : settings.accidental))}>
                <Minus size={14} />
              </button>
              <button className="btn btn-icon" aria-label="Transpose up a semitone" onClick={() => select(transposeChord(symbol, 1, settings.accidental === 'auto' ? 'auto' : settings.accidental))}>
                <Plus size={14} />
              </button>
            </div>
          </div>
          <div className="relative mt-4 flex flex-wrap gap-2">
            {tones.map((t, i) => (
              <motion.div key={`${symbol}-${t.iv}`} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.04 }} className={cx('flex min-w-14 flex-col items-center rounded-2xl border px-3 py-2', t.iv === 0 ? 'border-a1/50 bg-a1/10' : 'border-white/[0.08] bg-white/[0.03]')}>
                <span className={cx('font-mono text-lg font-bold', t.iv === 0 ? 'text-a1' : 'text-white')}>{t.name}</span>
                <span className="font-mono text-[0.68rem] text-mute">{t.label}</span>
              </motion.div>
            ))}
            {chord.bass !== null && (
              <div className="flex min-w-14 flex-col items-center rounded-2xl border border-a2/40 bg-a2/10 px-3 py-2">
                <span className="font-mono text-lg font-bold text-a2">{pcToName(chord.bass, accidental)}</span>
                <span className="font-mono text-[0.68rem] text-mute">bass</span>
              </div>
            )}
          </div>
        </section>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Section
            title={
              <span className="flex items-center gap-2">
                <Guitar size={16} className="text-a1" /> Guitar
              </span>
            }
            action={
              <select className="input w-auto py-1.5 text-xs" value={tuning.id} onChange={(e) => { setTuningId(e.target.value); setGIndex(0) }} aria-label="Guitar tuning">
                {TUNINGS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            }
          >
            {gv ? (
              <div className="flex flex-col items-center">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={`${symbol}-${tuning.id}-${gIndex}`} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
                    <GuitarDiagram voicing={gv} tuning={tuning} name={pretty(symbol)} size={1.35} accidental={accidental} />
                  </motion.div>
                </AnimatePresence>
                <div className="mt-2 flex items-center gap-2">
                  <button className="btn btn-icon" aria-label="Previous voicing" onClick={() => setGIndex((i) => (i - 1 + guitar.length) % guitar.length)} disabled={guitar.length < 2}>
                    <ChevronLeft size={16} />
                  </button>
                  <span className="w-16 text-center font-mono text-xs text-mute">
                    {Math.min(gIndex, guitar.length - 1) + 1} / {guitar.length}
                  </span>
                  <button className="btn btn-icon" aria-label="Next voicing" onClick={() => setGIndex((i) => (i + 1) % guitar.length)} disabled={guitar.length < 2}>
                    <ChevronRight size={16} />
                  </button>
                  <button className="btn btn-primary" onClick={() => playNotes(voicingMidi(gv, tuning), { instrument: 'guitar' })}>
                    <Play size={14} /> Strum
                  </button>
                </div>
                <div className="mt-2 font-mono text-xs text-mute">{gv.frets.map((f) => (f === null ? 'x' : f)).join(' ')}</div>
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-mute">No playable shape found in this tuning — try another tuning or the piano view.</p>
            )}
          </Section>

          <Section
            title={
              <span className="flex items-center gap-2">
                <Piano size={16} className="text-a2" /> Piano
              </span>
            }
            action={
              pv && (
                <button className="btn btn-primary" onClick={() => playNotes([...pv.left, ...pv.right], { instrument: 'piano' })}>
                  <Play size={14} /> Play
                </button>
              )
            }
          >
            {pv && (
              <>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {piano.map((p, i) => (
                    <button key={p.id} className="chip" data-active={pv.id === p.id} onClick={() => { setPIndex(i); playNotes([...p.left, ...p.right], { instrument: 'piano' }) }}>
                      {p.label}
                    </button>
                  ))}
                </div>
                <PianoKeyboard right={pv.right} left={pv.left} rootPc={chord.root} accidental={accidental} height={130} onKey={(m) => playNotes([m], { instrument: 'piano', duration: 1.2 })} />
                <p className="mt-2 text-xs text-mute">
                  <span className="text-a1">●</span> right hand · <span className="text-a2">●</span> left hand · tap a key to hear it
                </p>
              </>
            )}
          </Section>
        </div>
      </div>
    </div>
  )
}
