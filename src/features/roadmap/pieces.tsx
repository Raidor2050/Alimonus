import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  CalendarClock,
  ChevronDown,
  ChevronUp,
  Code,
  Flag,
  GraduationCap,
  ListChecks,
  Lock,
  Music,
  Palette,
  Pencil,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { useId, useState, type CSSProperties, type ReactNode } from 'react'
import type { Profile, RoadmapCategory, RoadmapItem } from '@/types'
import { CatAvatar } from '@/components/art/Art'
import { spring } from '@/components/ui'
import { cx } from '@/lib/util'
import { CATEGORY_LABEL, PRIORITY_LABEL, dueLabel, dueState, shortDay, type Accent } from './logic'

/* ---------- Icons ---------- */

export function CategoryIcon({ category, size = 14 }: { category: RoadmapCategory; size?: number }) {
  const Icon = { goal: Target, task: ListChecks, learning: GraduationCap, music: Music, coding: Code, creative: Palette, milestone: Flag }[category]
  return <Icon size={size} aria-hidden />
}

/* ---------- Progress ring ---------- */

export function ProgressRing({ done, total, accent, size = 64 }: { done: number; total: number; accent: Accent; size?: number }) {
  const reduce = useReducedMotion()
  const id = useId()
  const stroke = 6
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total ? done / total : 0
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={`${done} of ${total} done`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={accent.c1} />
            <stop offset="1" stopColor={accent.c2} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${id}-g)`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - pct) }}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 90, damping: 18 }}
          style={{ filter: `drop-shadow(0 0 6px rgb(${accent.glow} / 0.55))` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="display text-sm font-bold">{Math.round(pct * 100)}%</span>
        <span className="mt-0.5 text-[0.6rem] text-mute">
          {done}/{total}
        </span>
      </div>
    </div>
  )
}

/* ---------- Tactile completion checkbox with check-draw + particle burst ---------- */

const PARTICLES = 10

export function CompleteCheck({
  item,
  accent,
  disabled,
  onToggle,
}: {
  item: RoadmapItem
  accent: Accent
  disabled?: boolean
  onToggle: () => void
}) {
  const reduce = useReducedMotion()
  const [burst, setBurst] = useState(0)
  const done = item.status === 'done'
  const milestone = item.category === 'milestone'
  return (
    <motion.button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Mark “${item.title}” not done` : `Mark “${item.title}” done`}
      disabled={disabled}
      onClick={() => {
        if (!done) setBurst((b) => b + 1)
        onToggle()
      }}
      whileTap={reduce || disabled ? undefined : { scale: 0.82 }}
      transition={spring}
      className={cx(
        'relative grid h-6 w-6 shrink-0 place-items-center border-2 transition-colors',
        milestone ? 'rounded-[8px] rotate-45' : 'rounded-full',
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
      )}
      style={{
        borderColor: done ? accent.c1 : 'rgb(255 255 255 / 0.22)',
        background: done ? accent.c1 : 'transparent',
        boxShadow: done ? `0 0 14px -2px rgb(${accent.glow} / 0.8)` : undefined,
      }}
    >
      <svg viewBox="0 0 24 24" className={cx('h-4 w-4', milestone && '-rotate-45')} aria-hidden>
        <motion.path
          d="M5 12.5l4.2 4.2L19 7"
          fill="none"
          stroke="#07060b"
          strokeWidth={3.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={false}
          animate={{ pathLength: done ? 1 : 0, opacity: done ? 1 : 0 }}
          transition={reduce ? { duration: 0 } : { duration: 0.32, ease: [0.65, 0, 0.35, 1] }}
        />
      </svg>
      <AnimatePresence>
        {!reduce && burst > 0 && (
          <span key={burst} className="pointer-events-none absolute inset-0" aria-hidden>
            {Array.from({ length: PARTICLES }, (_, i) => {
              const a = (i / PARTICLES) * Math.PI * 2 + burst
              const d = 18 + (i % 3) * 7
              return (
                <motion.span
                  key={i}
                  className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 rounded-full"
                  style={{ background: i % 2 ? accent.c1 : accent.c2, marginLeft: -3, marginTop: -3 }}
                  initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
                  animate={{ x: Math.cos(a) * d, y: Math.sin(a) * d, scale: 0, opacity: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  onAnimationComplete={i === 0 ? () => setBurst(0) : undefined}
                />
              )
            })}
          </span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/* ---------- Due badge ---------- */

export function DueBadge({ item }: { item: RoadmapItem }) {
  const st = dueState(item)
  const label = dueLabel(item)
  if (st === 'overdue' || st === 'today' || st === 'soon') {
    const overdue = st === 'overdue'
    return (
      <span
        className={cx(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.66rem] font-semibold',
          overdue ? 'border-rec/50 bg-rec/10 text-rec' : 'border-ember/40 bg-ember/10 text-ember',
        )}
      >
        <CalendarClock size={11} aria-hidden />
        {label}
      </span>
    )
  }
  if (item.dueDate)
    return (
      <span className="inline-flex items-center gap-1 text-[0.66rem] text-mute">
        <CalendarClock size={11} aria-hidden />
        {item.status === 'done' ? 'was due ' : 'due '}
        {shortDay(item.dueDate)}
      </span>
    )
  return null
}

const PRIORITY_DOT: Record<RoadmapItem['priority'], string> = { high: '#ff2b3b', medium: '#ffb347', low: '#6f6a85' }

/* ---------- Item card ---------- */

export interface CardProps {
  item: RoadmapItem
  accent: Accent
  editable: boolean
  owner?: Profile | null
  showOwner?: boolean
  onEdit: () => void
  onToggle: () => void
  /** Optional leading slot (drag handle) and trailing controls (reorder / status menu). */
  handle?: ReactNode
  controls?: ReactNode
  className?: string
  style?: CSSProperties
}

export function ItemCard({ item, accent, editable, owner, showOwner, onEdit, onToggle, handle, controls, className, style }: CardProps) {
  const done = item.status === 'done'
  const milestone = item.category === 'milestone'
  const overdue = dueState(item) === 'overdue'
  return (
    <div
      data-testid={`roadmap-card-${item.id}`}
      className={cx(
        'group relative flex items-start gap-3 overflow-hidden rounded-2xl border bg-white/[0.025] p-3 transition-colors',
        'hover:bg-white/[0.045]',
        overdue ? 'border-rec/40' : 'border-white/[0.07]',
        className,
      )}
      style={{
        ...(milestone
          ? {
              background: `linear-gradient(120deg, rgb(255 179 71 / 0.10), rgb(${accent.glow} / 0.06) 60%, transparent)`,
              borderColor: done ? 'rgb(255 179 71 / 0.6)' : 'rgb(255 179 71 / 0.32)',
              boxShadow: done ? '0 0 26px -10px rgb(255 179 71 / 0.9)' : undefined,
            }
          : null),
        ...style,
      }}
    >
      {/* accent rail */}
      <span
        aria-hidden
        className="absolute inset-y-2 left-0 w-[3px] rounded-r-full"
        style={{ background: overdue ? '#ff2b3b' : `linear-gradient(${accent.c1}, ${accent.c2})`, opacity: done ? 0.35 : 0.9 }}
      />
      {handle}
      <div className="pt-0.5">
        <CompleteCheck item={item} accent={accent} disabled={!editable} onToggle={onToggle} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          {milestone && (
            <span className="mt-0.5 shrink-0 text-[#ffb347]" title="Milestone">
              {done ? <Trophy size={15} aria-label="Milestone reached" /> : <Flag size={15} aria-label="Milestone" />}
            </span>
          )}
          <div className={cx('min-w-0 flex-1 break-words text-[0.92rem] font-semibold leading-snug', done && 'text-mute line-through decoration-white/25')}>
            {item.title}
          </div>
        </div>
        {item.description && <p className="mt-1 line-clamp-2 text-xs text-mute">{item.description}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 text-[0.68rem] text-soft">
          <span className="inline-flex items-center gap-1" style={{ color: milestone ? '#ffb347' : accent.c1 }}>
            <CategoryIcon category={item.category} size={12} />
            <span className="text-soft">{CATEGORY_LABEL[item.category]}</span>
          </span>
          <span className="inline-flex items-center gap-1" title={`${PRIORITY_LABEL[item.priority]} priority`}>
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: PRIORITY_DOT[item.priority] }} aria-hidden />
            {PRIORITY_LABEL[item.priority]}
          </span>
          {item.shared && (
            <span className="inline-flex items-center gap-1 text-mute">
              <Users size={11} aria-hidden /> shared
            </span>
          )}
          {showOwner && owner && (
            <span className="inline-flex items-center gap-1 text-mute">
              <CatAvatar who={owner.username} size={16} animated={false} />
              {owner.displayName.split(' ')[0]}
            </span>
          )}
          <DueBadge item={item} />
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        {controls}
        {editable ? (
          <button type="button" className="btn btn-ghost btn-icon h-8 w-8 text-mute hover:text-white" onClick={onEdit} aria-label={`Edit “${item.title}”`}>
            <Pencil size={14} />
          </button>
        ) : (
          <button
            type="button"
            className="grid h-8 w-8 place-items-center rounded-full text-mute/60 hover:text-soft"
            onClick={onEdit}
            aria-label={`View “${item.title}” (read-only)`}
            title={`Only ${owner?.displayName.split(' ')[0] ?? 'the owner'} can edit this`}
          >
            <Lock size={12} />
          </button>
        )}
      </div>
    </div>
  )
}

/* ---------- Move up / down (keyboard reorder alternative) ---------- */

export function MoveButtons({ title, onUp, onDown }: { title: string; onUp?: () => void; onDown?: () => void }) {
  return (
    <div className="flex flex-col opacity-60 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
      <button type="button" className="grid h-4 w-6 place-items-center rounded text-mute hover:text-white disabled:opacity-25" disabled={!onUp} onClick={onUp} aria-label={`Move “${title}” up`}>
        <ChevronUp size={14} />
      </button>
      <button type="button" className="grid h-4 w-6 place-items-center rounded text-mute hover:text-white disabled:opacity-25" disabled={!onDown} onClick={onDown} aria-label={`Move “${title}” down`}>
        <ChevronDown size={14} />
      </button>
    </div>
  )
}
