import { motion, useReducedMotion } from 'motion/react'
import { CalendarOff, Flag, Lock, Trophy } from 'lucide-react'
import type { Profile, RoadmapItem } from '@/types'
import { softSpring } from '@/components/ui'
import { cx } from '@/lib/util'
import { CatAvatar } from '@/components/art/Art'
import { accentFor, canEdit, dueState, parseDay, shortDay, startOfToday } from './logic'

const DAY = 86_400_000
const WEEK_PX = 96

function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function mondayOf(d: Date): Date {
  return addDays(d, -((d.getDay() + 6) % 7))
}

export function TimelineView({ items, profiles, meId, onEdit }: { items: RoadmapItem[]; profiles: Profile[]; meId: string | null; onEdit: (id: string) => void }) {
  const reduce = useReducedMotion()
  const today = startOfToday()
  const dated = items
    .filter((i) => i.startDate || i.dueDate)
    .sort((a, b) => (a.startDate ?? a.dueDate ?? '').localeCompare(b.startDate ?? b.dueDate ?? '') || a.position - b.position)
  const undated = items.filter((i) => !i.startDate && !i.dueDate)

  const days = dated.flatMap((i) => [parseDay(i.startDate), parseDay(i.dueDate)]).filter((d): d is Date => !!d)
  const min = new Date(Math.min(today.getTime(), ...days.map((d) => d.getTime())))
  const max = new Date(Math.max(today.getTime(), ...days.map((d) => d.getTime())))
  const start = mondayOf(addDays(min, -3))
  let end = addDays(mondayOf(addDays(max, 7)), 7) // exclusive, next Monday
  if ((end.getTime() - start.getTime()) / DAY < 35) end = addDays(start, 35)
  const span = end.getTime() - start.getTime()
  const pct = (d: Date) => ((d.getTime() - start.getTime()) / span) * 100
  const weeks: Date[] = []
  for (let w = start; w < end; w = addDays(w, 7)) weeks.push(w)
  const todayPct = pct(today) + (100 * DAY) / span / 2

  return (
    <div className="flex flex-col gap-4">
      <section className="panel overflow-hidden p-0" aria-label="Timeline">
        {dated.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <CalendarOff size={28} className="anim-float text-cyanx" />
            <div className="display text-lg font-bold">No dates on the map yet</div>
            <p className="max-w-sm text-sm text-mute">Give an item a start or due date and it’ll appear here. No pressure — undated dreams are listed below.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="relative" style={{ minWidth: Math.max(weeks.length * WEEK_PX, 560) }}>
              {/* week grid header */}
              <div className="sticky top-0 z-10 flex border-b border-white/[0.07] bg-[#0b0911]/90 backdrop-blur">
                {weeks.map((w, i) => {
                  const newMonth = i === 0 || w.getMonth() !== weeks[i - 1].getMonth()
                  return (
                    <div key={w.toISOString()} className="flex-1 border-l border-white/[0.05] px-2 py-2 first:border-l-0">
                      <div className={cx('text-[0.62rem] font-bold uppercase tracking-widest', newMonth ? 'text-soft' : 'text-transparent')}>
                        {w.toLocaleDateString(undefined, { month: 'short', year: w.getMonth() === 0 || i === 0 ? 'numeric' : undefined })}
                      </div>
                      <div className="text-[0.68rem] text-mute">{w.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</div>
                    </div>
                  )
                })}
              </div>

              <div className="relative py-3">
                {/* vertical week lines */}
                <div className="pointer-events-none absolute inset-0 flex" aria-hidden>
                  {weeks.map((w) => (
                    <div key={w.toISOString()} className="flex-1 border-l border-white/[0.035] first:border-l-0" />
                  ))}
                </div>
                {/* today marker */}
                <div className="pointer-events-none absolute inset-y-0 z-[5] w-px" style={{ left: `${todayPct}%`, background: 'linear-gradient(#ff3dbb, #2ef2ff)' }} aria-hidden>
                  <span className="absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-magenta px-1.5 py-0.5 text-[0.58rem] font-bold uppercase tracking-wider text-ink">Today</span>
                </div>

                <ol className="relative flex flex-col gap-1.5 pt-4">
                  {dated.map((item, idx) => {
                    const s = parseDay(item.startDate)
                    const d = parseDay(item.dueDate)
                    const accent = accentFor(item, profiles)
                    const from = s ?? d!
                    const to = d ? addDays(d, 1) : addDays(s!, 4)
                    const left = pct(from)
                    const width = Math.max(pct(to) - left, 1.2)
                    const overdue = dueState(item) === 'overdue'
                    const done = item.status === 'done'
                    const milestone = item.category === 'milestone'
                    const owner = profiles.find((p) => p.id === item.ownerId)
                    const alignRight = left > 62
                    const openEnded = !d
                    const bg = overdue ? '#ff2b3b' : openEnded ? `linear-gradient(90deg, ${accent.c1}, transparent)` : `linear-gradient(90deg, ${accent.c1}, ${accent.c2})`
                    return (
                      <li key={item.id} className="relative h-12">
                        <button
                          type="button"
                          onClick={() => onEdit(item.id)}
                          className="group absolute inset-y-0 flex flex-col justify-center text-left"
                          style={alignRight ? { right: `${100 - left - width}%`, alignItems: 'flex-end' } : { left: `${left}%` }}
                          aria-label={`${item.title}${s ? `, starts ${shortDay(item.startDate)}` : ''}${d ? `, due ${shortDay(item.dueDate)}` : ''}`}
                        >
                          <span className={cx('mb-1 flex max-w-[260px] items-center gap-1.5 truncate whitespace-nowrap px-1 text-xs font-semibold', done ? 'text-mute line-through' : 'text-soft group-hover:text-white')}>
                            {owner && !item.shared && <CatAvatar who={owner.username} size={14} animated={false} />}
                            {milestone && (done ? <Trophy size={12} className="text-[#ffb347]" /> : <Flag size={12} className="text-[#ffb347]" />)}
                            <span className="truncate">{item.title}</span>
                            {!canEdit(item, meId) && <Lock size={10} className="shrink-0 text-mute/60" aria-label="read-only" />}
                            {overdue && <span className="text-[0.6rem] font-bold uppercase text-rec">overdue</span>}
                          </span>
                        </button>
                        <motion.div
                          aria-hidden
                          className="pointer-events-none absolute bottom-1.5 h-2 rounded-full"
                          style={{
                            left: `${left}%`,
                            width: `${width}%`,
                            background: bg,
                            opacity: done ? 0.35 : 1,
                            boxShadow: done || openEnded ? undefined : `0 0 14px -2px rgb(${overdue ? '255 43 59' : accent.glow} / 0.7)`,
                            transformOrigin: 'left center',
                          }}
                          initial={reduce ? false : { scaleX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ ...softSpring, delay: reduce ? 0 : Math.min(idx, 10) * 0.03 }}
                        />
                        {milestone && d && (
                          <span
                            aria-hidden
                            className="pointer-events-none absolute bottom-[3px] h-3.5 w-3.5 -translate-x-1/2 rotate-45 rounded-[3px] border-2 border-[#ffb347] bg-ink"
                            style={{ left: `${pct(addDays(d, 1))}%` }}
                          />
                        )}
                      </li>
                    )
                  })}
                </ol>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="panel p-4" aria-label="Undated items">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="display font-bold">Floating in the void</h3>
          <span className="text-xs text-mute">{undated.length} undated</span>
        </div>
        {undated.length === 0 ? (
          <p className="text-sm text-mute">Every item has a date. Very organised. Suspiciously so.</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {undated.map((item) => {
              const accent = accentFor(item, profiles)
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => onEdit(item.id)}
                    className={cx('chip max-w-[280px] hover:text-white', item.status === 'done' && 'line-through opacity-60')}
                    style={{ borderColor: `rgb(${accent.glow} / 0.35)` }}
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: accent.c1 }} aria-hidden />
                    <span className="truncate">{item.title}</span>
                    {!canEdit(item, meId) && <Lock size={10} className="shrink-0 text-mute/60" aria-label="read-only" />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
