import { AnimatePresence, motion } from 'motion/react'
import { Check, ListPlus, Plus, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useApp } from '@/stores/app'
import { spring } from '@/components/ui'
import { cx } from '@/lib/util'

/** Popover listing the playlists you can add to (yours + shared), with inline create. */
export function AddToPlaylist({ songId, label = 'Add to playlist', className }: { songId: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const me = useApp((s) => s.me)
  const playlists = useApp((s) => s.data.playlists)
  const items = useApp((s) => s.data.items)
  const addToPlaylist = useApp((s) => s.addToPlaylist)
  const removeFromPlaylist = useApp((s) => s.removeFromPlaylist)
  const createPlaylist = useApp((s) => s.createPlaylist)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const visible = playlists.filter((p) => p.ownerId === me?.id || p.shared).sort((a, b) => Number(a.shared) - Number(b.shared) || a.name.localeCompare(b.name))

  return (
    <div className={cx('relative', className)} ref={ref}>
      <button className="btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="menu">
        <ListPlus size={15} /> {label}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={spring}
            className="panel absolute left-0 top-12 z-50 w-72 p-2"
          >
            <ul className="max-h-64 overflow-auto">
              {visible.map((p) => {
                const item = items.find((i) => i.playlistId === p.id && i.songId === songId)
                return (
                  <li key={p.id}>
                    <button
                      role="menuitemcheckbox"
                      aria-checked={!!item}
                      onClick={() => (item ? removeFromPlaylist(item.id) : addToPlaylist(p.id, songId))}
                      className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-white/5"
                    >
                      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      {p.shared && <Users size={13} className="text-a2" aria-label="Shared" />}
                      {item && <Check size={15} className="text-a1" />}
                    </button>
                  </li>
                )
              })}
              {!visible.length && <li className="px-2.5 py-2 text-sm text-mute">No playlists yet.</li>}
            </ul>
            <form
              className="mt-1 flex gap-1.5 border-t border-line pt-2"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                const pl = createPlaylist({ name: name.trim() })
                addToPlaylist(pl.id, songId)
                setName('')
              }}
            >
              <input className="input py-1.5 text-sm" placeholder="New playlist…" value={name} onChange={(e) => setName(e.target.value)} aria-label="New playlist name" />
              <button className="btn btn-icon" aria-label="Create playlist and add">
                <Plus size={15} />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
