import { useEffect, useState } from 'react'
import { Lock, Trash2 } from 'lucide-react'
import type { Profile, RoadmapCategory, RoadmapItem, RoadmapPriority, RoadmapStatus } from '@/types'
import { Field, Modal, Segmented, Toggle } from '@/components/ui'
import { useApp } from '@/stores/app'
import { relativeTime } from '@/lib/util'
import { CATEGORIES, CATEGORY_LABEL, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, canDelete, canEdit, firstName } from './logic'

export type ModalTarget = { mode: 'new'; shared: boolean } | { mode: 'edit'; id: string } | null

interface Draft {
  title: string
  description: string
  status: RoadmapStatus
  priority: RoadmapPriority
  category: RoadmapCategory
  startDate: string
  dueDate: string
  shared: boolean
}

const blank = (shared: boolean): Draft => ({
  title: '',
  description: '',
  status: 'todo',
  priority: 'medium',
  category: shared ? 'goal' : 'task',
  startDate: '',
  dueDate: '',
  shared,
})

const fromItem = (i: RoadmapItem): Draft => ({
  title: i.title,
  description: i.description,
  status: i.status,
  priority: i.priority,
  category: i.category,
  startDate: i.startDate?.slice(0, 10) ?? '',
  dueDate: i.dueDate?.slice(0, 10) ?? '',
  shared: i.shared,
})

export function ItemModal({ target, onClose, profiles }: { target: ModalTarget; onClose: () => void; profiles: Profile[] }) {
  const me = useApp((s) => s.me)
  const item = useApp((s) => (target?.mode === 'edit' ? (s.data.roadmap.find((r) => r.id === target.id) ?? null) : null))
  const saveRoadmap = useApp((s) => s.saveRoadmap)
  const createRoadmap = useApp((s) => s.createRoadmap)
  const deleteRoadmap = useApp((s) => s.deleteRoadmap)

  const [draft, setDraft] = useState<Draft>(blank(false))
  const [confirmDelete, setConfirmDelete] = useState(false)
  const targetKey = target ? (target.mode === 'edit' ? target.id : `new-${target.shared}`) : null

  useEffect(() => {
    if (!target) return
    setConfirmDelete(false)
    setDraft(target.mode === 'edit' ? (item ? fromItem(item) : blank(false)) : blank(target.shared))
    // Only reset when the modal target changes, not on every store update.
  }, [targetKey])

  const isNew = target?.mode === 'new'
  const editable = isNew || (item ? canEdit(item, me?.id) : false)
  const deletable = !!item && canDelete(item, me?.id)
  const isOwner = isNew || (!!item && item.ownerId === me?.id)
  const owner = item ? profiles.find((p) => p.id === item.ownerId) : me
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const datesBackwards = !!draft.startDate && !!draft.dueDate && draft.dueDate < draft.startDate
  const valid = draft.title.trim().length > 0 && !datesBackwards

  const submit = () => {
    if (!editable || !valid) return
    const patch = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      status: draft.status,
      priority: draft.priority,
      category: draft.category,
      startDate: draft.startDate || null,
      dueDate: draft.dueDate || null,
      // Only the owner decides whether a personal item becomes shared (or back).
      shared: isOwner ? draft.shared : (item?.shared ?? draft.shared),
    }
    if (isNew) createRoadmap(patch)
    else if (item) saveRoadmap({ ...item, ...patch })
    onClose()
  }

  const title = isNew ? (draft.shared ? 'New shared goal' : 'New roadmap item') : editable ? 'Edit item' : 'Item details'

  return (
    <Modal open={!!target && (isNew || !!item)} onClose={onClose} title={title}>
      {/* Not a <form>: the shared Segmented/Toggle buttons have no type and would submit it. */}
      <div className="flex flex-col gap-4">
        {!editable && (
          <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-mute">
            <Lock size={13} /> This lives in {firstName(owner)}’s lane — you can look, only they can touch.
          </div>
        )}
        <fieldset disabled={!editable} className="flex flex-col gap-4 disabled:opacity-80">
          <Field label="Title">
             <input
              className="input"
              value={draft.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="What are we chasing?"
              autoFocus={editable}
              maxLength={160}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  submit()
                }
              }}
            />
          </Field>
          <Field label="Notes">
            <textarea className="input min-h-[84px] resize-y" value={draft.description} onChange={(e) => set('description', e.target.value)} placeholder="Why it matters, links, the vibe…" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Status">
              <select className="input" value={draft.status} onChange={(e) => set('status', e.target.value as RoadmapStatus)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Category">
              <select className="input" value={draft.category} onChange={(e) => set('category', e.target.value as RoadmapCategory)}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="label">Priority</span>
            <div>
              <Segmented
                layoutId="roadmap-modal-priority"
                size="sm"
                value={draft.priority}
                onChange={(v) => editable && set('priority', v)}
                options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Start date" hint="Optional">
              <input type="date" className="input" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} />
            </Field>
            <Field label="Due date" hint={datesBackwards ? <span className="text-rec">Due date is before the start — time travel not supported (yet).</span> : 'Optional — leave blank if there’s no real deadline'}>
              <input type="date" className="input" value={draft.dueDate} onChange={(e) => set('dueDate', e.target.value)} />
            </Field>
          </div>
          {isOwner ? (
            <Toggle checked={draft.shared} onChange={(v) => set('shared', v)} label="Shared goal — both of us can edit" />
          ) : (
            item?.shared && <div className="text-xs text-mute">Shared goal · {firstName(owner)} started it, you can both edit it.</div>
          )}
        </fieldset>

        {item && (
          <div className="text-[0.7rem] text-mute">
            {firstName(owner)} added this {relativeTime(item.createdAt)}
            {item.completedAt && ` · done ${relativeTime(item.completedAt)}`}
          </div>
        )}

        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <div>
            {deletable && (
              <button
                type="button"
                className={confirmDelete ? 'btn border-rec/60 bg-rec/15 text-rec' : 'btn btn-ghost text-mute hover:text-rec'}
                onClick={() => {
                  if (!confirmDelete) return setConfirmDelete(true)
                  deleteRoadmap(item.id)
                  onClose()
                }}
              >
                <Trash2 size={15} /> {confirmDelete ? 'Tap again to delete' : 'Delete'}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              {editable ? 'Cancel' : 'Close'}
            </button>
            {editable && (
              <button type="button" className="btn btn-primary" disabled={!valid} onClick={submit}>
                {isNew ? 'Add to roadmap' : 'Save changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
