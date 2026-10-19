import type { Profile, RoadmapCategory, RoadmapItem, RoadmapPriority, RoadmapStatus, Username } from '@/types'
import { normalize } from '@/lib/util'

/* ---------- Ownership ---------- */

/** Personal items: owner only. Shared items: either of us. */
export function canEdit(item: RoadmapItem, meId: string | null | undefined): boolean {
  if (!meId) return false
  return item.shared || item.ownerId === meId
}

/** Deleting is always the owner's call, shared or not. */
export function canDelete(item: RoadmapItem, meId: string | null | undefined): boolean {
  return !!meId && item.ownerId === meId
}

/* ---------- Dates (stored as YYYY-MM-DD, compared as local calendar days) ---------- */

const DAY = 86_400_000

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseDay(s: string | null | undefined): Date | null {
  if (!s) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return null
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

export function startOfToday(now = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

/** Whole calendar days from today to the given day (negative = in the past). */
export function daysUntil(s: string | null | undefined, now = new Date()): number | null {
  const d = parseDay(s)
  if (!d) return null
  return Math.round((d.getTime() - startOfToday(now).getTime()) / DAY)
}

export type DueState = 'overdue' | 'today' | 'soon' | 'later'
export const DUE_SOON_DAYS = 7

export function dueState(item: RoadmapItem, now = new Date()): DueState | null {
  if (item.status === 'done') return null
  const n = daysUntil(item.dueDate, now)
  if (n === null) return null
  if (n < 0) return 'overdue'
  if (n === 0) return 'today'
  if (n <= DUE_SOON_DAYS) return 'soon'
  return 'later'
}

export function dueLabel(item: RoadmapItem, now = new Date()): string | null {
  const n = daysUntil(item.dueDate, now)
  const st = dueState(item, now)
  if (n === null || !st) return null
  if (st === 'overdue') return n === -1 ? 'Overdue · 1 day' : `Overdue · ${-n} days`
  if (st === 'today') return 'Due today'
  if (n === 1) return 'Due tomorrow'
  if (st === 'soon') return `Due in ${n} days`
  return null
}

export function shortDay(s: string | null | undefined): string {
  const d = parseDay(s)
  return d ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : ''
}

/* ---------- Meta ---------- */

export const STATUSES: RoadmapStatus[] = ['idea', 'todo', 'doing', 'done']
export const STATUS_LABEL: Record<RoadmapStatus, string> = { idea: 'Idea', todo: 'To do', doing: 'Doing', done: 'Done' }
export const STATUS_BLURB: Record<RoadmapStatus, string> = {
  idea: 'Sparks & maybes',
  todo: 'Queued up',
  doing: 'In the oven',
  done: 'Shipped & sung',
}

export const PRIORITIES: RoadmapPriority[] = ['low', 'medium', 'high']
export const PRIORITY_RANK: Record<RoadmapPriority, number> = { high: 0, medium: 1, low: 2 }
export const PRIORITY_LABEL: Record<RoadmapPriority, string> = { low: 'Low', medium: 'Medium', high: 'High' }

export const CATEGORIES: RoadmapCategory[] = ['goal', 'task', 'learning', 'music', 'coding', 'creative', 'milestone']
export const CATEGORY_LABEL: Record<RoadmapCategory, string> = {
  goal: 'Goal',
  task: 'Task',
  learning: 'Learning',
  music: 'Music',
  coding: 'Coding',
  creative: 'Creative',
  milestone: 'Milestone',
}

/* ---------- People & palette (fixed, independent of the active theme) ---------- */

export interface Accent {
  c1: string
  c2: string
  glow: string
}

export const ACCENTS: Record<Username | 'shared', Accent> = {
  raiyan: { c1: '#b6ff3b', c2: '#2ef2ff', glow: '182 255 59' },
  afra: { c1: '#ff3dbb', c2: '#a855f7', glow: '255 61 187' },
  shared: { c1: '#c4a5ff', c2: '#ffb347', glow: '196 165 255' },
}

export function accentFor(item: RoadmapItem, profiles: Profile[]): Accent {
  if (item.shared) return ACCENTS.shared
  const owner = profiles.find((p) => p.id === item.ownerId)
  return owner ? ACCENTS[owner.username] : ACCENTS.shared
}

export function firstName(p: Profile | null | undefined): string {
  return p?.displayName.split(' ')[0] ?? 'Someone'
}

/* ---------- Filtering & sorting ---------- */

export type SortMode = 'position' | 'due' | 'priority'

export interface Filters {
  category: RoadmapCategory | 'all'
  priority: RoadmapPriority | 'all'
  query: string
}

export function applyFilters(items: RoadmapItem[], f: Filters): RoadmapItem[] {
  const q = normalize(f.query.trim())
  return items.filter(
    (i) =>
      (f.category === 'all' || i.category === f.category) &&
      (f.priority === 'all' || i.priority === f.priority) &&
      (!q || normalize(`${i.title} ${i.description}`).includes(q)),
  )
}

export function sortItems(items: RoadmapItem[], mode: SortMode): RoadmapItem[] {
  const byPos = (a: RoadmapItem, b: RoadmapItem) => a.position - b.position || a.createdAt.localeCompare(b.createdAt)
  const copy = [...items]
  if (mode === 'position') return copy.sort(byPos)
  if (mode === 'priority') return copy.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byPos(a, b))
  // due: dated first (soonest first), undated after in position order
  return copy.sort((a, b) => {
    if (a.dueDate && b.dueDate) return a.dueDate.localeCompare(b.dueDate) || byPos(a, b)
    if (a.dueDate) return -1
    if (b.dueDate) return 1
    return byPos(a, b)
  })
}

/**
 * Re-assign positions for a reordered subset, reusing the subset's existing position values
 * so items outside the subset keep their relative order. Returns only the items that changed.
 */
export function reposition(ordered: RoadmapItem[]): RoadmapItem[] {
  const slots = ordered.map((i) => i.position).sort((a, b) => a - b)
  // Guard against duplicate slots (legacy data): spread them out from the smallest.
  for (let k = 1; k < slots.length; k++) if (slots[k] <= slots[k - 1]) slots[k] = slots[k - 1] + 1
  const changed: RoadmapItem[] = []
  ordered.forEach((item, idx) => {
    if (item.position !== slots[idx]) changed.push({ ...item, position: slots[idx] })
  })
  return changed
}

export function progressOf(items: RoadmapItem[]): { done: number; total: number; pct: number } {
  const total = items.length
  const done = items.filter((i) => i.status === 'done').length
  return { done, total, pct: total ? done / total : 0 }
}
