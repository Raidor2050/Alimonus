import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronLeft, ChevronRight, Guitar, Piano, Volume2 } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { GuitarDiagram } from '@/components/diagrams/GuitarDiagram'
import { PianoKeyboard } from '@/components/diagrams/PianoKeyboard'
import { getTuning, guitarVoicings, TUNINGS, voicingMidi } from '@/lib/theory/guitar'
import { pianoVoicings } from '@/lib/theory/piano'
import { chordPitchClasses, parseChord, QUALITIES } from '@/lib/theory/chords'
import { pcToName, type Accidental } from '@/lib/theory/notes'
import { playNotes } from '@/lib/audio/synth'
import { cx } from '@/lib/util'
import { spring } from '@/components/ui'

function Collapsible({ title, icon, children, defaultOpen = true, extra }: { title: string; icon: ReactNode; children: ReactNode; defaultOpen?: boolean; extra?: ReactNode }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="panel overflow-hidden p-0">
      <div className="flex items-center gap-2 px-4 py-3">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2 text-left font-bold" aria-expanded={open}>
          <span className="text-a1">{icon}</span>
          <span className="display">{title}</span>
          <motion.span animate={{ rotate: open ? 0 : -90 }} transition={spring} className="ml-1 text-mute">
            <ChevronDown size={16} />
          </motion.span>
        </button>
        {extra}
      </div>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 32 }} className="overflow-hidden">
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const INTERVAL_NAMES: Record<number, string> = { 0: 'R', 1: 'b9', 2: '9', 3: 'b3', 4: '3', 5: '4', 6: 'b5', 7: '5', 8: '#5', 9: '6', 10: 'b7', 11: '7', 13: 'b9', 14: '9', 15: '#9', 17: '11', 21: '13' }

/** Guitar (shape relative to capo) and piano (sounding chord) panels for the selected chord. */
export function ChordPanels({
  shapeChord,
  soundingChord,
  capo,
  tuningId,
  onTuning,
  accidental,
  palette,
  onPick,
}: {
  shapeChord: string | null
  soundingChord: string | null
  capo: number
  tuningId: string
  onTuning: (id: string) => void
  accidental: Accidental
  palette: { shape: string; key: string }[]
  onPick: (key: string) => void
}) {
  const tuning = getTuning(tuningId)
  const voicings = useMemo(() => (shapeChord ? guitarVoicings(shapeChord, tuning) : []), [shapeChord, tuning])
  const piano = useMemo(() => (soundingChord ? pianoVoicings(soundingChord) : []), [soundingChord])
  const [vi, setVi] = useState(0)
  const [pi, setPi] = useState(0)
  useEffect(() => {
    setVi(0)
    setPi(0)
  }, [shapeChord])
  const v = voicings[Math.min(vi, voicings.length - 1)]
  const pv = piano[Math.min(pi, piano.length - 1)]
  const parsed = soundingChord ? parseChord(soundingChord) : null

  const notes = parsed ? chordPitchClasses(parsed).map((pc) => pcToName(pc, accidental)) : []
  const intervals = parsed ? QUALITIES[parsed.quality].intervals.map((i) => INTERVAL_NAMES[i] ?? String(i)) : []

  return (
    <div className="flex flex-col gap-4">
      {palette.length > 0 && (
        <div className="panel p-3">
          <div className="label mb-2 px-1">Chords in this song</div>
          <div className="flex flex-wrap gap-1.5">
            {palette.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => onPick(c.key)}
                className={cx(
                  'rounded-lg border px-2.5 py-1 font-mono text-sm font-bold transition-all',
                  c.shape === shapeChord ? 'border-transparent bg-a1 text-ink shadow-[0_0_16px_-2px_var(--a1)]' : 'border-white/10 text-a1 hover:border-a1/50',
                )}
              >
                {c.shape}
              </button>
            ))}
          </div>
        </div>
      )}

      <Collapsible
        title="Guitar"
        icon={<Guitar size={17} />}
        extra={
          v && (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Play guitar chord" onClick={() => playNotes(voicingMidi(v, tuning).map((m) => m + capo), { instrument: 'guitar' })}>
              <Volume2 size={16} />
            </button>
          )
        }
      >
        {shapeChord && v ? (
          <div className="flex flex-col items-center gap-2">
            <AnimatePresence mode="wait">
              <motion.div key={shapeChord + vi + tuningId} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.18 }}>
                <GuitarDiagram voicing={v} tuning={tuning} name={shapeChord} size={1.25} accidental={accidental} />
              </motion.div>
            </AnimatePresence>
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost btn-icon" disabled={vi === 0} onClick={() => setVi((i) => i - 1)} aria-label="Previous voicing">
                <ChevronLeft size={16} />
              </button>
              <span className="text-xs text-mute">
                Voicing {vi + 1} / {voicings.length}
                {v.barre ? ' · barre' : ''}
              </span>
              <button type="button" className="btn btn-ghost btn-icon" disabled={vi >= voicings.length - 1} onClick={() => setVi((i) => i + 1)} aria-label="Next voicing">
                <ChevronRight size={16} />
              </button>
            </div>
            {capo > 0 && soundingChord !== shapeChord && (
              <div className="text-center text-xs text-mute">
                Capo {capo}: play the <b className="text-a1">{shapeChord}</b> shape, sounds as <b className="text-a2">{soundingChord}</b>
              </div>
            )}
            <select className="input mt-1 py-1.5 text-xs" value={tuningId} onChange={(e) => onTuning(e.target.value)} aria-label="Guitar tuning">
              {TUNINGS.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <p className="text-sm text-mute">{shapeChord ? `No playable voicing found for ${shapeChord} in this tuning.` : 'Tap a chord in the sheet to see how to play it.'}</p>
        )}
      </Collapsible>

      <Collapsible
        title="Piano"
        icon={<Piano size={17} />}
        extra={
          pv && (
            <button type="button" className="btn btn-ghost btn-icon" aria-label="Play piano chord" onClick={() => playNotes([...pv.left, ...pv.right], { instrument: 'piano' })}>
              <Volume2 size={16} />
            </button>
          )
        }
      >
        {soundingChord && pv ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono text-lg font-bold text-a1">{soundingChord}</span>
              <span className="text-xs text-mute">{parsed ? QUALITIES[parsed.quality].label : ''}</span>
            </div>
            <PianoKeyboard right={pv.right} left={pv.left} rootPc={parsed?.root} accidental={accidental} height={110} />
            <div className="flex flex-wrap gap-1">
              {piano.map((p, i) => (
                <button key={p.id} type="button" className="chip" data-active={i === pi} onClick={() => setPi(i)}>
                  {p.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <div className="label mb-1">Notes</div>
                <div className="font-mono text-soft">{notes.join(' · ')}</div>
              </div>
              <div>
                <div className="label mb-1">Formula</div>
                <div className="font-mono text-soft">{intervals.join(' · ')}</div>
              </div>
            </div>
            <div className="flex gap-3 text-[0.68rem] text-mute">
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-sm bg-a1" /> right hand
              </span>
              {pv.left.length > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2.5 w-2.5 rounded-sm bg-a2" /> left hand
                </span>
              )}
              <span className="flex items-center gap-1">
                <span className="h-2.5 w-2.5 rounded-full border-2 border-white/60" /> root
              </span>
            </div>
          </div>
        ) : (
          <p className="text-sm text-mute">Tap a chord in the sheet to see its piano voicing.</p>
        )}
      </Collapsible>
    </div>
  )
}
