import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { CalendarClock, ChartGantt, Flame, Kanban, LayoutList, Plus, Search, Trophy, X } from 'lucide-react'
import type { RoadmapItem, RoadmapStatus, Username } from '@/types'
import { Page, PageHeader, Rise, Segmented } from '@/components/ui'
import { useApp } from '@/stores/app'
import { cx } from '@/lib/util'
import {
  ACCENTS,
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  applyFilters,
  canEdit,
  dueState,
  sortItems,
  reposition,
  type Filters,
  type SortMode,
} from './logic'
import { CategoryIcon } from './pieces'
import { Lane, type GroupBy } from './Lane'
import { BoardView } from './BoardView'
import { TimelineView } from './TimelineView'
import { ItemModal, type ModalTarget } from './ItemModal'

type View = 'list' | 'board' | 'timeline'
type Who = 'all' | Username | 'shared'

const LINGER_MS = 900

export default function RoadmapPage() {
  const me = useApp((s) => s.me)
  const profiles = useApp((s) => s.data.profiles)
  const roadmap = useApp((s) => s.data.roadmap)
  const saveRoadmap = useApp((s) => s.saveRoadmap)
  const createRoadmap = useApp((s) => s.createRoadmap)
  const reduce = useReducedMotion()

  const [view, setView] = useState<View>('list')
  const [who, setWho] = useState<Who>('all')
  const [filters, setFilters] = useState<Filters>({ category: 'all', priority: 'all', query: '' })
  const [sort, setSort] = useState<SortMode>('position')
  const [groupBy, setGroupBy] = useState<GroupBy>('status')
  const [modal, setModal] = useState<ModalTarget>(null)
  const [lingering, setLingering] = useState<Set<string>>(() => new Set())
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  const meId = me?.id ?? null
  const raiyan = profiles.find((p) => p.username === 'raiyan') ?? null
  const afra = profiles.find((p) => p.username === 'afra') ?? null
  const people = [raiyan, afra].filter((p): p is NonNullable<typeof p> => !!p)

  const filtersActive = filters.category !== 'all' || filters.priority !== 'all' || filters.query.trim() !== ''
  const visible = useMemo(() => sortItems(applyFilters(roadmap, filters), sort), [roadmap, filters, sort])

  const byWho = (items: RoadmapItem[], w: Who) =>
    w === 'all' ? items : w === 'shared' ? items.filter((i) => i.shared) : items.filter((i) => !i.shared && i.ownerId === profiles.find((p) => p.username === w)?.id)

  /* ---------- actions ---------- */

  const toggle = useCallback(
    (item: RoadmapItem) => {
      if (!canEdit(item, meId)) return
      const completing = item.status !== 'done'
      if (completing && !reduce) {
        setLingering((s) => new Set(s).add(item.id))
        timers.current.push(
          window.setTimeout(() => {
            setLingering((s) => {
              const n = new Set(s)
              n.delete(item.id)
              return n
            })
          }, LINGER_MS),
        )
      }
      saveRoadmap({ ...item, status: completing ? 'done' : 'todo' })
    },
    [meId, reduce, saveRoadmap],
  )

  const setStatus = useCallback(
    (item: RoadmapItem, status: RoadmapStatus) => {
      if (canEdit(item, meId) && item.status !== status) saveRoadmap({ ...item, status })
    },
    [meId, saveRoadmap],
  )

  const quickAdd = (title: string, shared: boolean) => {
    if (!me) return
    createRoadmap({
      title,
      shared,
      // keep the new item visible under the current filters
      category: filters.category !== 'all' ? filters.category : shared ? 'goal' : 'task',
      priority: filters.priority !== 'all' ? filters.priority : 'medium',
    })
  }

  const reorder = (ordered: RoadmapItem[]) => {
    for (const item of reposition(ordered)) if (canEdit(item, meId)) saveRoadmap(item)
  }

  /* ---------- pulse stats ---------- */

  const mine = roadmap.filter((i) => i.shared || i.ownerId === meId)
  const overdue = mine.filter((i) => dueState(i) === 'overdue').length
  const dueSoon = mine.filter((i) => ['today', 'soon'].includes(dueState(i) ?? '')).length
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const shippedThisMonth = roadmap.filter((i) => i.status === 'done' && (i.completedAt ?? '') >= monthStart).length

  const laneFor = (kind: 'person' | 'shared', items: RoadmapItem[], profile: (typeof people)[number] | null) => {
    const isMe = kind === 'person' && !!profile && profile.id === meId
    const editable = kind === 'shared' ? !!me : isMe
    return (
      <Lane
        kind={kind}
        profile={profile}
        profiles={people}
        accent={kind === 'shared' ? ACCENTS.shared : ACCENTS[profile!.username]}
        isMe={isMe}
        editable={editable}
        meId={meId}
        all={items}
        visible={sortItems(applyFilters(items, filters), sort)}
        lingering={lingering}
        groupBy={groupBy}
        reorderable={editable && sort === 'position'}
        filtersActive={filtersActive}
        onEdit={(id) => setModal({ mode: 'edit', id })}
        onToggle={toggle}
        onQuickAdd={(t) => quickAdd(t, kind === 'shared')}
        onReorder={reorder}
      />
    )
  }

  return (
    <Page>
      <PageHeader
        eyebrow="Shared roadmap"
        title={
          <>
            Where we’re <span className="text-gradient">headed</span>
          </>
        }
      >
        <Segmented
          layoutId="roadmap-view"
          value={view}
          onChange={setView}
          options={[
            { value: 'list', label: <><LayoutList size={15} /> <span className="hidden sm:inline">List</span><span className="sr-only sm:hidden">List</span></> },
            { value: 'board', label: <><Kanban size={15} /> <span className="hidden sm:inline">Board</span><span className="sr-only sm:hidden">Board</span></> },
            { value: 'timeline', label: <><ChartGantt size={15} /> <span className="hidden sm:inline">Timeline</span><span className="sr-only sm:hidden">Timeline</span></> },
          ]}
        />
        {me && (
          <button type="button" className="btn btn-primary" onClick={() => setModal({ mode: 'new', shared: false })}>
            <Plus size={16} /> New item
          </button>
        )}
      </PageHeader>

      {/* pulse */}
      <Rise className="mb-4 flex flex-wrap gap-2 text-xs">
        <span className={cx('chip', overdue > 0 && 'border-rec/40 text-rec')}>
          <Flame size={12} /> {overdue > 0 ? `${overdue} overdue — no judgement` : 'Nothing overdue'}
        </span>
        <span className={cx('chip', dueSoon > 0 && 'border-ember/40 text-ember')}>
          <CalendarClock size={12} /> {dueSoon} due this week
        </span>
        <span className="chip">
          <Trophy size={12} /> {shippedThisMonth} shipped this month between you
        </span>
      </Rise>

      {/* filters */}
      <Rise i={1} className="panel mb-5 flex flex-col gap-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-56">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" aria-hidden />
            <input
              className="input pl-9"
              type="search"
              placeholder="Search titles & notes…"
              aria-label="Search roadmap"
              value={filters.query}
              onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
            />
          </div>
          <select
            className="input w-auto"
            aria-label="Filter by priority"
            value={filters.priority}
            onChange={(e) => setFilters((f) => ({ ...f, priority: e.target.value as Filters['priority'] }))}
          >
            <option value="all">Any priority</option>
            {PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABEL[p]} priority
              </option>
            ))}
          </select>
          <select className="input w-auto" aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortMode)}>
            <option value="position">Sort: my order</option>
            <option value="due">Sort: due date</option>
            <option value="priority">Sort: priority</option>
          </select>
          {filtersActive && (
            <button type="button" className="btn btn-ghost text-mute" onClick={() => setFilters({ category: 'all', priority: 'all', query: '' })}>
              <X size={14} /> Clear
            </button>
          )}
        </div>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="group" aria-label="Filter by category">
          <button type="button" className="chip" data-active={filters.category === 'all'} onClick={() => setFilters((f) => ({ ...f, category: 'all' }))}>
            Everything
          </button>
          {CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              className="chip"
              data-active={filters.category === c}
              aria-pressed={filters.category === c}
              onClick={() => setFilters((f) => ({ ...f, category: f.category === c ? 'all' : c }))}
            >
              <CategoryIcon category={c} size={12} /> {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {view === 'list' ? (
            <>
              <span className="label">Group by</span>
              <Segmented
                layoutId="roadmap-group"
                size="sm"
                value={groupBy}
                onChange={setGroupBy}
                options={[
                  { value: 'status', label: 'Status' },
                  { value: 'category', label: 'Category' },
                  { value: 'none', label: 'Nothing' },
                ]}
              />
              {sort !== 'position' && <span className="text-xs text-mute">Drag-reordering is on when sorting by “my order”.</span>}
            </>
          ) : (
            <>
              <span className="label">Showing</span>
              <Segmented
                layoutId="roadmap-who"
                size="sm"
                value={who}
                onChange={setWho}
                options={[
                  { value: 'all', label: 'Everyone' },
                  ...people.map((p) => ({ value: p.username as Who, label: p.id === meId ? `${p.displayName.split(' ')[0]} (you)` : p.displayName.split(' ')[0] })),
                  { value: 'shared', label: 'Shared' },
                ]}
              />
            </>
          )}
        </div>
      </Rise>

      {view === 'list' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {people.map((p, i) => (
              <Rise key={p.id} i={i + 2} className="min-w-0">
                {laneFor(
                  'person',
                  roadmap.filter((r) => !r.shared && r.ownerId === p.id),
                  p,
                )}
              </Rise>
            ))}
          </div>
          <Rise i={4}>{laneFor('shared', roadmap.filter((r) => r.shared), null)}</Rise>
        </div>
      )}

      {view === 'board' && <BoardView items={byWho(visible, who)} profiles={people} meId={meId} onEdit={(id) => setModal({ mode: 'edit', id })} onToggle={toggle} onSetStatus={setStatus} />}

      {view === 'timeline' && <TimelineView items={byWho(visible, who)} profiles={people} meId={meId} onEdit={(id) => setModal({ mode: 'edit', id })} />}

      <ItemModal target={modal} onClose={() => setModal(null)} profiles={people} />
    </Page>
  )
}
