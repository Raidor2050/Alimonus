import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, Copy, Minus, Plus, RotateCcw } from 'lucide-react'
import { formatKey, parseKey, suggestCapo, type ParsedKey, type SpellingPref } from '@/lib/theory/chords'
import { mod12, pcToName, preferredAccidental } from '@/lib/theory/notes'
import { useSettings } from '@/stores/app'
import { Field, Segmented, spring } from '@/components/ui'
import { cx } from '@/lib/util'
import { extractChords, isChordLine, keyFromChord, semitoneDelta, transposeText } from '../lib'

const SAMPLE = `[Intro]
Am   F   C   G

[Verse]
Am                F
  Neon rivers in the static
C                    G
  Every portal hums in key
Am         F       C/E    G
  Cats on the stage lights, dancing`

const KEYS: { value: string; label: string }[] = [
  ...Array.from({ length: 12 }, (_, pc) => ({ value: formatKey({ tonic: pc, minor: false }), label: `${formatKey({ tonic: pc, minor: false })} major` })),
  ...Array.from({ length: 12 }, (_, pc) => ({ value: formatKey({ tonic: pc, minor: true }), label: `${formatKey({ tonic: pc, minor: true }).slice(0, -1)} minor` })),
]

/** Major-key tonic that shares a key signature with this key (minor → relative major). */
const majorTonic = (k: ParsedKey) => (k.minor ? mod12(k.tonic + 3) : k.tonic)

export default function Transposer() {
  const settings = useSettings()
  const [text, setText] = useState(SAMPLE)
  const [semis, setSemis] = useState(0)
  const [pref, setPref] = useState<SpellingPref>(settings.accidental)
  const [keyChoice, setKeyChoice] = useState('auto')
  const [copied, setCopied] = useState(false)

  const chords = useMemo(() => extractChords(text), [text])
  const detected = keyFromChord(chords[0])
  const source: ParsedKey | null = keyChoice === 'auto' ? detected : parseKey(keyChoice)
  const shift = mod12(semis) > 6 ? mod12(semis) - 12 : mod12(semis)
  const target: ParsedKey | null = source ? { tonic: mod12(source.tonic + shift), minor: source.minor } : null

  const spellPc = source ? majorTonic(source) : undefined
  const result = useMemo(() => transposeText(text, shift, pref, spellPc), [text, shift, pref, spellPc])
  const resultChords = useMemo(() => extractChords(result), [result])
  const capos = useMemo(() => (resultChords.length ? suggestCapo(resultChords).slice(0, 3) : []), [resultChords])

  const setTargetKey = (value: string) => {
    const t = parseKey(value)
    if (!t || !source) return
    // Switching mode: aim for the key that shares the signature (C → Am is 0 semitones).
    setSemis(semitoneDelta(majorTonic(source), majorTonic(t)))
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(result)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = result
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      ta.remove()
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  const fmtKey = (k: ParsedKey | null) => (k ? `${pcToName(k.tonic, pref === 'auto' ? preferredAccidental(k.tonic, k.minor) : pref)}${k.minor ? 'm' : ''}` : '—')

  return (
    <div className="flex flex-col gap-4">
      <section className="panel flex flex-wrap items-end gap-4 p-4 sm:p-5">
        <Field label="Original key">
          <select className="input min-w-36" value={keyChoice} onChange={(e) => setKeyChoice(e.target.value)}>
            <option value="auto">Auto · {detected ? fmtKey(detected) : 'no chords yet'}</option>
            {KEYS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Target key">
          <select className="input min-w-36" value={target ? formatKey(target) : ''} onChange={(e) => setTargetKey(e.target.value)} disabled={!source}>
            {!target && <option value="">—</option>}
            {KEYS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <span className="label">Semitones</span>
          <div className="flex items-center gap-1.5">
            <motion.button whileTap={{ scale: 0.88 }} className="btn btn-icon" aria-label="Down a semitone" onClick={() => setSemis((s) => s - 1)}>
              <Minus size={14} />
            </motion.button>
            <motion.span key={shift} initial={{ scale: 1.25, opacity: 0.4 }} animate={{ scale: 1, opacity: 1 }} transition={spring} className={cx('w-12 text-center font-mono text-lg font-bold', shift ? 'text-a1' : 'text-soft')}>
              {shift > 0 ? `+${shift}` : shift}
            </motion.span>
            <motion.button whileTap={{ scale: 0.88 }} className="btn btn-icon" aria-label="Up a semitone" onClick={() => setSemis((s) => s + 1)}>
              <Plus size={14} />
            </motion.button>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="label">Spelling</span>
          <Segmented layoutId="transposer-spell" size="sm" value={pref} onChange={setPref} options={[{ value: 'auto', label: 'Auto' }, { value: 'sharp', label: '♯' }, { value: 'flat', label: '♭' }]} />
        </div>
        <button className="btn ml-auto" onClick={() => setSemis(0)} disabled={shift === 0}>
          <RotateCcw size={14} /> Reset
        </button>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="panel flex flex-col p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">Original {source && `· ${fmtKey(source)}`}</span>
            <button className="btn btn-ghost py-1 text-xs" onClick={() => setText('')}>
              Clear
            </button>
          </div>
          <textarea
            className="input min-h-[300px] flex-1 resize-y font-mono text-sm leading-relaxed"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
            placeholder={'Paste chords or chords-over-lyrics.\nC  G  Am  F'}
            aria-label="Original chords"
          />
          <p className="mt-2 text-xs text-mute">Chord lines and [ChordPro] brackets are transposed. Lyric lines stay untouched.</p>
        </section>

        <section className="panel flex flex-col p-4 sm:p-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="label">
              Result {target && <span className="text-a1">· {fmtKey(target)}</span>}
            </span>
            <motion.button whileTap={{ scale: 0.92 }} className={cx('btn py-1.5 text-xs', copied && 'border-a1/50 text-a1')} onClick={() => void copy()} disabled={!result}>
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied' : 'Copy'}
            </motion.button>
          </div>
          <pre className="min-h-[300px] flex-1 overflow-auto whitespace-pre rounded-[14px] border border-white/[0.07] bg-black/30 p-3 font-mono text-sm leading-relaxed text-soft" aria-live="polite">
            {result.split('\n').map((line, i) => (
              <div key={i} className={cx(line.trim() && isChordLine(line) && 'font-bold text-a1')}>
                {line || ' '}
              </div>
            ))}
          </pre>
        </section>
      </div>

      <section className="panel p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="display text-base font-bold">Capo suggestions</h2>
          <span className="text-xs text-mute">Easiest open shapes that sound in {target ? fmtKey(target) : 'the result key'}</span>
        </div>
        {capos.length ? (
          <div className="grid gap-3 sm:grid-cols-3">
            <AnimatePresence initial={false}>
              {capos.map((c, i) => (
                <motion.div key={`${c.capo}-${shift}`} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring, delay: i * 0.05 }} className={cx('rounded-2xl border p-3', i === 0 ? 'border-a1/40 bg-a1/[0.06]' : 'border-white/[0.07] bg-white/[0.02]')}>
                  <div className="flex items-center justify-between">
                    <span className="display text-lg font-bold">{c.capo === 0 ? 'No capo' : `Capo ${c.capo}`}</span>
                    {i === 0 && <span className="chip" data-active="true">Easiest</span>}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {c.shapes.map((s) => (
                      <span key={s} className="rounded-md bg-white/[0.05] px-1.5 py-0.5 font-mono text-xs text-soft">
                        {s}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <p className="text-sm text-mute">Add some chords to see capo options.</p>
        )}
      </section>
    </div>
  )
}
