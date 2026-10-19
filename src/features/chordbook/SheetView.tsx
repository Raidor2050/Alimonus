import { motion } from 'motion/react'
import { memo } from 'react'
import type { Sheet, SectionType } from '@/lib/theory/chordpro'
import { cx } from '@/lib/util'

const SECTION_STYLE: Record<SectionType, { color: string; label: string }> = {
  intro: { color: 'var(--a4)', label: 'Intro' },
  verse: { color: 'var(--a2)', label: 'Verse' },
  'pre-chorus': { color: 'var(--a4)', label: 'Pre-chorus' },
  chorus: { color: 'var(--a1)', label: 'Chorus' },
  bridge: { color: 'var(--a3)', label: 'Bridge' },
  solo: { color: 'var(--a4)', label: 'Solo' },
  outro: { color: 'var(--a2)', label: 'Outro' },
  other: { color: 'var(--color-mute)', label: '' },
}

/**
 * Renders a parsed (and already transposed) sheet. `mapChord` converts displayed chord text
 * back to its identity so selection survives transposition.
 */
export const SheetView = memo(function SheetView({
  sheet,
  selected,
  onSelect,
  mode,
  mono,
  scale,
}: {
  sheet: Sheet
  selected: string | null
  onSelect: (chord: string) => void
  mode: 'above' | 'inline'
  mono: boolean
  scale: number
}) {
  return (
    <div className={cx('print-sheet flex flex-col gap-6', mono && 'sheet-mono')} style={{ fontSize: `${scale}rem` }}>
      {sheet.sections.map((sec, si) => {
        const style = SECTION_STYLE[sec.type]
        const isChorus = sec.type === 'chorus'
        return (
          <motion.section
            key={si}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(si, 8) * 0.04, type: 'spring', stiffness: 260, damping: 28 }}
            className={cx('relative pl-4', isChorus && 'rounded-r-2xl bg-a1/[0.04] py-2')}
          >
            <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-full" style={{ background: style.color, opacity: isChorus ? 0.9 : 0.5 }} />
            {(sec.label || style.label) && (
              <div className="mb-2 text-[0.68em] font-bold uppercase tracking-[0.18em]" style={{ color: style.color }}>
                {sec.label || style.label}
              </div>
            )}
            <div className="flex flex-col gap-1">
              {sec.lines.map((line, li) => {
                if (line.kind === 'blank') return <div key={li} className="h-3" />
                if (line.kind === 'comment')
                  return (
                    <div key={li} className="text-[0.85em] italic text-mute">
                      {line.text}
                    </div>
                  )
                const chordOnly = line.segments.every((s) => !s.text.trim())
                if (mode === 'inline' || chordOnly)
                  return (
                    <div key={li} className={cx('leading-relaxed', chordOnly && 'flex flex-wrap gap-x-1')}>
                      {line.segments.map((seg, k) => (
                        <span key={k}>
                          {seg.chord && (
                            <button type="button" className="sheet-chord inline-block" data-active={selected === seg.chord} onClick={() => onSelect(seg.chord!)}>
                              {chordOnly ? seg.chord : `[${seg.chord}]`}
                            </button>
                          )}
                          {!chordOnly && seg.text}
                        </span>
                      ))}
                    </div>
                  )
                return (
                  <div key={li} className="sheet-line">
                    {line.segments.map((seg, k) => (
                      <span key={k} className="sheet-seg">
                        {seg.chord ? (
                          <button type="button" className="sheet-chord" data-active={selected === seg.chord} onClick={() => onSelect(seg.chord!)}>
                            {seg.chord}
                          </button>
                        ) : (
                          <span className="sheet-chord pointer-events-none" aria-hidden>
                            {' '}
                          </span>
                        )}
                        <span className="leading-snug text-[#ece9f7]">{seg.text || ' '}</span>
                      </span>
                    ))}
                  </div>
                )
              })}
            </div>
          </motion.section>
        )
      })}
    </div>
  )
})
