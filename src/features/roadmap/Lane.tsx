import { AnimatePresence, Reorder, motion, useDragControls, useReducedMotion } from 'motion/react'
import { ChevronDown, GripVertical, Plus, Sparkles, Trophy } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Profile, RoadmapCategory, RoadmapItem, RoadmapStatus } from '@/types'
import { CatAvatar } from '@/components/art/Art'
import { softSpring } from '@/components/ui'
import { CATEGORIES, CATEGORY_LABEL, firstName, type Accent } from './logic'
import { CategoryIcon, ItemCard, MoveButtons, ProgressRing } from './pieces'

export type GroupBy = 'status' | 'category' | 'none'

export interface LaneProps {
  kind: 'person' | 'shared'
  profile: Profile | null
  profiles: Profile[]
  accent: Accent
  isMe: boolean
  /** Can the signed-in user add / edit / reorder in this lane? */
  editable: boolean
  meId: string | null
  /** Every item in the lane (drives progress) */
  all: RoadmapItem[]
  /** Filtered + sorted items to show */
  visible: RoadmapItem[]
  /** Item ids that were just ticked and should linger a moment for the celebration */
  lingering: Set<string>
  groupBy: GroupBy
  reorderable: boolean
  filtersActive: boolean
  onEdit: (id: string) => void
  onToggle: (item: RoadmapItem) => void
  onQuickAdd: (title: string) => void
  onReorder: (ordered: RoadmapItem[]) => void
}

const ACTIVE_STATUS_ORDER: RoadmapStatus[] = ['doing', 'todo', 'idea']

function groupItems(items: RoadmapItem[], groupBy: GroupBy): { key: string; label: ReactNode; items: RoadmapItem[] }[] {
  if (groupBy === 'none') return [{ key: 'all', label: null, items }]
  if (groupBy === 'status') {
    return ACTIVE_STATUS_ORDER.map((s) => ({
      key: s,
      label: s === 'doing' ? 'In motion' : s === 'todo' ? 'Up next' : 'Idea pile',
      // lingering just-completed items stay where they were (as "doing"-ish) for a beat
      items: items.filter((i) => (i.status === 'done' ? s === 'doing' : i.status === s)),
    })).filter((g) => g.items.length)
  }
  return CATEGORIES.map((c: RoadmapCategory) => ({
    key: c,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <CategoryIcon category={c} size={12} /> {CATEGORY_LABEL[c]}
      </span>
    ),
    items: items.filter((i) => i.category === c),
  })).filter((g) => g.items.length)
}

export function Lane(props: LaneProps) {
  const { kind, profile, profiles, accent, isMe, editable, all, visible, lingering, groupBy, reorderable, filtersActive, meId } = props
  const reduce = useReducedMotion()
  const [showDone, setShowDone] = useState(false)
  const done = all.filter((i) => i.status === 'done').length
  const active = visible.filter((i) => i.status !== 'done' || lingering.has(i.id))
  const completed = visible
    .filter((i) => i.status === 'done' && !lingering.has(i.id))
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const groups = groupItems(active, groupBy)
  const name = kind === 'shared' ? 'Shared goals' : (profile?.displayName ?? 'Unknown')
  const laneLabel = kind === 'shared' ? 'Shared goals lane' : `${firstName(profile)}’s lane`

  const renderCard = (item: RoadmapItem, extra?: { handle?: ReactNode; controls?: ReactNode }) => (
    <ItemCard
      item={item}
      accent={accent}
      editable={editable && (kind === 'shared' || item.ownerId === meId)}
      owner={profiles.find((p) => p.id === item.ownerId)}
      showOwner={kind === 'shared'}
      onEdit={() => props.onEdit(item.id)}
      onToggle={() => props.onToggle(item)}
      handle={extra?.handle}
      controls={extra?.controls}
    />
  )

  return (
    <section
      aria-label={laneLabel}
      className="panel relative flex min-w-0 flex-col overflow-hidden p-4 sm:p-5"
      style={{ boxShadow: `0 0 0 1px rgb(${accent.glow} / ${isMe ? 0.22 : 0.08}) inset, 0 30px 60px -40px rgb(${accent.glow} / 0.5)` }}
    >
      {/* soft lane glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 right-[-20%] h-56 w-[70%] rounded-full blur-3xl"
        style={{ background: `radial-gradient(closest-side, rgb(${accent.glow} / 0.16), transparent)` }}
      />

      <header className="relative mb-4 flex items-center gap-3">
        {kind === 'person' && profile ? (
          <CatAvatar who={profile.username} size={56} />
        ) : (
          <div className="relative h-14 w-[76px] shrink-0">
            {profiles.map((p, i) => (
              <span key={p.id} className="absolute top-0" style={{ left: i * 22 }}>
                <CatAvatar who={p.username} size={52} animated={false} />
              </span>
            ))}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2
              className="display truncate text-lg font-bold sm:text-xl"
              style={{ backgroundImage: `linear-gradient(100deg, ${accent.c1}, ${accent.c2})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}
            >
              {name}
            </h2>
            {isMe && (
              <span className="rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-ink" style={{ background: accent.c1 }}>
                You
              </span>
            )}
          </div>
          <div className="truncate text-xs text-mute">
            {kind === 'shared' ? 'Dreamed up together · both of you can edit' : profile?.tagline || (isMe ? 'Your corner of the multiverse' : 'View only')}
          </div>
        </div>
        <ProgressRing done={done} total={all.length} accent={accent} size={60} />
      </header>

      {editable && <QuickAdd accent={accent} shared={kind === 'shared'} onAdd={props.onQuickAdd} />}

      <div className="relative flex flex-col gap-4">
        {active.length === 0 && (
          <LaneEmpty kind={kind} isMe={isMe} profile={profile} accent={accent} filtered={filtersActive && all.length > 0} allDone={all.length > 0 && done === all.length} />
        )}
        {groups.map((g) => (
          <div key={g.key}>
            {g.label && (
              <div className="label mb-2 flex items-center gap-2">
                {g.label}
                <span className="text-mute/70">· {g.items.length}</span>
              </div>
            )}
            {reorderable ? (
              <ReorderList items={g.items} onCommit={props.onReorder} render={renderCard} />
            ) : (
              <ul className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {g.items.map((item) => (
                    <motion.li key={item.id} layout={!reduce} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.97 }} transition={softSpring}>
                      {renderCard(item)}
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            )}
          </div>
        ))}
      </div>

      {completed.length > 0 && (
        <div className="relative mt-4 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-xl px-1 py-1 text-left text-sm font-semibold text-soft hover:text-white"
            aria-expanded={showDone}
            onClick={() => setShowDone((v) => !v)}
          >
            <Trophy size={14} style={{ color: accent.c1 }} />
            Done &amp; dusted
            <span className="text-mute">({completed.length})</span>
            <motion.span className="ml-auto text-mute" animate={{ rotate: showDone ? 180 : 0 }} transition={softSpring}>
              <ChevronDown size={16} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {showDone && (
              <motion.ul
                className="flex flex-col gap-2 overflow-hidden"
                initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                transition={softSpring}
              >
                <li className="h-1" aria-hidden />
                {completed.map((item) => (
                  <li key={item.id}>{renderCard(item)}</li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>
      )}
    </section>
  )
}

/* ---------- Quick add ---------- */

function QuickAdd({ accent, shared, onAdd }: { accent: Accent; shared: boolean; onAdd: (title: string) => void }) {
  const [value, setValue] = useState('')
  const submit = () => {
    const t = value.trim()
    if (!t) return
    onAdd(t)
    setValue('')
  }
  return (
    <div className="relative mb-4 flex items-center gap-2">
      <Plus size={16} className="pointer-events-none absolute left-3" style={{ color: accent.c1 }} aria-hidden />
      <input
        className="input pl-9"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            submit()
          }
        }}
        placeholder={shared ? 'Add a shared goal… (Enter)' : 'Quick add to your lane… (Enter)'}
        aria-label={shared ? 'Quick add a shared goal' : 'Quick add to your lane'}
        maxLength={160}
      />
    </div>
  )
}

/* ---------- Empty states ---------- */

function LaneEmpty({ kind, isMe, profile, accent, filtered, allDone }: { kind: 'person' | 'shared'; isMe: boolean; profile: Profile | null; accent: Accent; filtered: boolean; allDone: boolean }) {
  let title: string
  let body: string
  if (filtered) {
    title = 'Nothing matches'
    body = 'The filters are hiding everything here. Loosen them up a little.'
  } else if (allDone) {
    title = 'Clean slate ✦'
    body = isMe || kind === 'shared' ? 'Everything’s done. Take a bow — then dream up the next thing.' : `${firstName(profile)} cleared the whole lane. Show-off.`
  } else if (kind === 'shared') {
    title = 'No shared goals yet'
    body = 'A duet, a gig, a release date — plant something you’ll both water.'
  } else if (isMe) {
    title = 'Blank canvas'
    body = 'Type a first spark above and hit Enter. Small is fine.'
  } else {
    title = `${firstName(profile)}’s lane is quiet`
    body = 'Nothing plotted yet. A gentle meow might help.'
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center">
      <motion.span className="anim-float" style={{ color: accent.c1 }}>
        <Sparkles size={26} />
      </motion.span>
      <div className="display font-bold">{title}</div>
      <p className="max-w-xs text-xs text-mute">{body}</p>
    </div>
  )
}

/* ---------- Drag-to-reorder list (motion Reorder) with keyboard up/down ---------- */

function ReorderList({
  items,
  onCommit,
  render,
}: {
  items: RoadmapItem[]
  onCommit: (ordered: RoadmapItem[]) => void
  render: (item: RoadmapItem, extra: { handle?: ReactNode; controls?: ReactNode }) => ReactNode
}) {
  const idsKey = items.map((i) => i.id).join('|')
  const [order, setOrder] = useState<string[]>(() => items.map((i) => i.id))
  const orderRef = useRef(order)
  const dragging = useRef(false)
  orderRef.current = order

  useEffect(() => {
    if (!dragging.current) setOrder(idsKey ? idsKey.split('|') : [])
  }, [idsKey])

  const byId = new Map(items.map((i) => [i.id, i]))
  // Fall back to the incoming order if local order is stale (an item was added/removed mid-render).
  const ids = order.length === items.length && order.every((id) => byId.has(id)) ? order : items.map((i) => i.id)
  const commit = (next: string[]) => onCommit(next.map((id) => byId.get(id)!).filter(Boolean))
  const move = (idx: number, delta: number) => {
    const next = [...ids]
    const [x] = next.splice(idx, 1)
    next.splice(idx + delta, 0, x)
    setOrder(next)
    commit(next)
  }

  return (
    <Reorder.Group as="ul" axis="y" values={ids} onReorder={setOrder} className="flex flex-col gap-2">
      {ids.map((id, idx) => {
        const item = byId.get(id)!
        return (
          <ReorderRow
            key={id}
            id={id}
            onDragStart={() => (dragging.current = true)}
            onDragEnd={() => {
              dragging.current = false
              commit(orderRef.current)
            }}
            render={(handle) =>
              render(item, {
                handle,
                controls: <MoveButtons title={item.title} onUp={idx > 0 ? () => move(idx, -1) : undefined} onDown={idx < ids.length - 1 ? () => move(idx, 1) : undefined} />,
              })
            }
          />
        )
      })}
    </Reorder.Group>
  )
}

function ReorderRow({ id, render, onDragStart, onDragEnd }: { id: string; render: (handle: ReactNode) => ReactNode; onDragStart: () => void; onDragEnd: () => void }) {
  const controls = useDragControls()
  const reduce = useReducedMotion()
  return (
    <Reorder.Item
      value={id}
      dragListener={false}
      dragControls={controls}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      layout={reduce ? undefined : 'position'}
      whileDrag={{ scale: 1.02, zIndex: 5, boxShadow: '0 18px 40px -16px rgb(0 0 0 / 0.9)' }}
      className="relative list-none rounded-2xl"
    >
      {render(
        <span
          role="presentation"
          className="-ml-1 mt-0.5 block cursor-grab touch-none text-mute/50 hover:text-soft active:cursor-grabbing"
          onPointerDown={(e) => controls.start(e)}
          title="Drag to reorder"
        >
          <GripVertical size={16} />
        </span>,
      )}
    </Reorder.Item>
  )
}
