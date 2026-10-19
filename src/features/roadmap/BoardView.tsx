import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useState } from 'react'
import type { Profile, RoadmapItem, RoadmapStatus } from '@/types'
import { softSpring } from '@/components/ui'
import { cx } from '@/lib/util'
import { STATUSES, STATUS_BLURB, STATUS_LABEL, accentFor, canEdit } from './logic'
import { ItemCard } from './pieces'

const COLUMN_TINT: Record<RoadmapStatus, string> = {
  idea: '#8b5cf6',
  todo: '#2ef2ff',
  doing: '#ffb347',
  done: '#b6ff3b',
}

export function BoardView({
  items,
  profiles,
  meId,
  onEdit,
  onToggle,
  onSetStatus,
}: {
  items: RoadmapItem[]
  profiles: Profile[]
  meId: string | null
  onEdit: (id: string) => void
  onToggle: (item: RoadmapItem) => void
  onSetStatus: (item: RoadmapItem, status: RoadmapStatus) => void
}) {
  const reduce = useReducedMotion()
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<RoadmapStatus | null>(null)
  const dragging = dragId ? items.find((i) => i.id === dragId) : undefined

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {STATUSES.map((status) => {
        const col = items.filter((i) => i.status === status)
        const isOver = over === status && !!dragging && dragging.status !== status
        return (
          <section
            key={status}
            aria-label={`${STATUS_LABEL[status]} column`}
            className={cx('panel flex min-h-[180px] flex-col p-3 transition-[box-shadow,background-color]', isOver && 'bg-white/[0.04]')}
            style={isOver ? { boxShadow: `0 0 0 2px ${COLUMN_TINT[status]}88 inset, 0 0 40px -14px ${COLUMN_TINT[status]}` } : undefined}
            onDragOver={(e) => {
              if (!dragging) return
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              if (over !== status) setOver(status)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === status ? null : o))
            }}
            onDrop={(e) => {
              e.preventDefault()
              const id = e.dataTransfer.getData('text/plain') || dragId
              const item = items.find((i) => i.id === id)
              if (item && item.status !== status && canEdit(item, meId)) onSetStatus(item, status)
              setDragId(null)
              setOver(null)
            }}
          >
            <header className="mb-3 flex items-center gap-2 px-1">
              <span className="h-2 w-2 rounded-full" style={{ background: COLUMN_TINT[status], boxShadow: `0 0 10px ${COLUMN_TINT[status]}` }} aria-hidden />
              <h3 className="display font-bold">{STATUS_LABEL[status]}</h3>
              <span className="text-xs text-mute">{col.length}</span>
              <span className="ml-auto hidden text-[0.68rem] text-mute sm:inline">{STATUS_BLURB[status]}</span>
            </header>
            <ul className="flex flex-1 flex-col gap-2">
              <AnimatePresence initial={false}>
                {col.map((item) => {
                  const editable = canEdit(item, meId)
                  const owner = profiles.find((p) => p.id === item.ownerId)
                  return (
                    <motion.li key={item.id} layout={!reduce} initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: dragId === item.id ? 0.45 : 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={softSpring}>
                      <div
                        draggable={editable}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/plain', item.id)
                          e.dataTransfer.effectAllowed = 'move'
                          setDragId(item.id)
                        }}
                        onDragEnd={() => {
                          setDragId(null)
                          setOver(null)
                        }}
                        className={editable ? 'cursor-grab active:cursor-grabbing' : undefined}
                      >
                        <ItemCard
                          item={item}
                          accent={accentFor(item, profiles)}
                          editable={editable}
                          owner={owner}
                          showOwner
                          onEdit={() => onEdit(item.id)}
                          onToggle={() => onToggle(item)}
                          controls={
                            editable ? (
                              <select
                                className="h-7 max-w-[5.5rem] rounded-lg border border-white/10 bg-white/[0.04] px-1.5 text-[0.68rem] text-soft focus:border-white/30 focus:outline-none"
                                value={item.status}
                                aria-label={`Move “${item.title}” to column`}
                                onChange={(e) => onSetStatus(item, e.target.value as RoadmapStatus)}
                              >
                                {STATUSES.map((s) => (
                                  <option key={s} value={s}>
                                    {STATUS_LABEL[s]}
                                  </option>
                                ))}
                              </select>
                            ) : undefined
                          }
                        />
                      </div>
                    </motion.li>
                  )
                })}
              </AnimatePresence>
              {col.length === 0 && (
                <li className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs text-mute">
                  {status === 'done' ? 'Drag something here to celebrate.' : status === 'doing' ? 'Nothing cooking. Pull a card in.' : 'Empty — drop cards here.'}
                </li>
              )}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
