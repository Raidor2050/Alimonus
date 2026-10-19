import { useMemo, useState } from 'react'
import { WandSparkles } from 'lucide-react'
import { Modal } from '@/components/ui'
import { chordsOverLyricsToChordPro, parseChordPro, uniqueChords } from '@/lib/theory/chordpro'
import { isChord } from '@/lib/theory/chords'
import { SheetView } from './SheetView'
import type { ChordSource, Song } from '@/types'

const TEMPLATE = `{c: Intro}
[C] [G] [Am] [F]

{start_of_verse: Verse 1}
[C]Your own words [G]go here
{end_of_verse}

{start_of_chorus}
[F]Sing the [C]chorus
{end_of_chorus}`

/** Split editor: ChordPro source on the left, live preview on the right. */
export function SheetEditor({ open, onClose, song, onSave }: { open: boolean; onClose: () => void; song: Song; onSave: (sheet: string | null, progression: string | null, source: ChordSource | null) => void }) {
  const [text, setText] = useState(song.chordSheet ?? '')
  const [progression, setProgression] = useState(song.progression ?? '')
  const [source, setSource] = useState<ChordSource>(song.chordSource && song.chordSource !== 'sample' ? song.chordSource : 'user')
  const sheet = useMemo(() => parseChordPro(text), [text])
  const unknown = useMemo(() => uniqueChords({ ...sheet, sections: sheet.sections }).length, [sheet])
  const badTokens = useMemo(() => {
    const out = new Set<string>()
    for (const s of sheet.sections) for (const l of s.lines) if (l.kind === 'lyric') for (const seg of l.segments) if (seg.chord && !isChord(seg.chord) && !/^(N\.?C\.?|x\d+|\||%|-)$/i.test(seg.chord)) out.add(seg.chord)
    return [...out]
  }, [sheet])

  return (
    <Modal open={open} onClose={onClose} title={`Edit arrangement — ${song.title}`} wide>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-mute">
        <span>
          ChordPro: put chords in brackets before the syllable — <code className="text-a1">[Am]Hello</code>. Sections: <code className="text-soft">{'{start_of_chorus}'}</code> … <code className="text-soft">{'{end_of_chorus}'}</code> or <code className="text-soft">{'{c: Verse 2}'}</code>.
        </span>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <textarea className="input min-h-[46vh] font-mono text-[0.82rem] leading-relaxed" value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} placeholder={TEMPLATE} aria-label="ChordPro source" />
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn text-xs" onClick={() => setText(chordsOverLyricsToChordPro(text))} title="Turn chords-on-their-own-line text into ChordPro">
              <WandSparkles size={14} /> Convert chords-over-lyrics
            </button>
            {!text && (
              <button type="button" className="btn text-xs" onClick={() => setText(TEMPLATE)}>
                Start from template
              </button>
            )}
          </div>
          {badTokens.length > 0 && <p className="text-xs text-ember">Not recognised as chords (shown as-is, won’t transpose): {badTokens.join(', ')}</p>}
        </div>
        <div className="max-h-[52vh] overflow-auto rounded-2xl border border-line bg-black/30 p-4">
          {text.trim() ? <SheetView sheet={sheet} selected={null} onSelect={() => {}} mode="above" mono={false} scale={0.92} /> : <p className="text-sm text-mute">Live preview appears here.</p>}
        </div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_200px]">
        <label className="flex flex-col gap-1.5">
          <span className="label">Progression (optional, for songs without a full sheet)</span>
          <input className="input font-mono" value={progression} onChange={(e) => setProgression(e.target.value)} placeholder="Am F C G" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="label">Source</span>
          <select className="input" value={source} onChange={(e) => setSource(e.target.value as ChordSource)}>
            <option value="user">User-entered</option>
            <option value="verified">Verified (checked by ear)</option>
            <option value="suggested">Suggested / unverified</option>
            <option value="imported">Imported</option>
          </select>
        </label>
      </div>
      <p className="mt-3 text-xs text-mute">Only add lyrics you wrote or have the right to use. Chord progressions on their own are always fine.</p>
      <div className="mt-4 flex items-center justify-between gap-2">
        <span className="text-xs text-mute">{unknown} unique chords</span>
        <div className="flex gap-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onSave(text.trim() || null, progression.trim() || null, text.trim() || progression.trim() ? source : null)
              onClose()
            }}
          >
            Save arrangement
          </button>
        </div>
      </div>
    </Modal>
  )
}
