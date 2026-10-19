import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, BookOpen, CornerDownLeft, House, ListMusic, Map as MapIcon, Search, Settings, Wrench } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { useApp } from '@/stores/app'
import { Artwork } from '@/components/SongControls'
import { searchSongs } from '@/features/chordbook/search'
import { cx } from '@/lib/util'
import { spring } from '@/components/ui'

interface Item {
  id: string
  group: string
  label: string
  sub?: string
  icon: ReactNode
  run: () => void
}

const PAGES = [
  { label: 'Home', to: '/', icon: <House size={16} /> },
  { label: 'Chordbook', to: '/chordbook', icon: <BookOpen size={16} /> },
  { label: 'Playlists', to: '/playlists', icon: <ListMusic size={16} /> },
  { label: 'Spotify playlists', to: '/playlists?tab=spotify', icon: <ListMusic size={16} /> },
  { label: 'Roadmap', to: '/roadmap', icon: <MapIcon size={16} /> },
  { label: 'Tuner', to: '/tools/tuner', icon: <Wrench size={16} /> },
  { label: 'Metronome', to: '/tools/metronome', icon: <Wrench size={16} /> },
  { label: 'Chord explorer', to: '/tools/chords', icon: <Wrench size={16} /> },
  { label: 'Transposer', to: '/tools/transposer', icon: <Wrench size={16} /> },
  { label: 'Progression builder', to: '/tools/progression', icon: <Wrench size={16} /> },
  { label: 'Practice timer', to: '/tools/practice', icon: <Wrench size={16} /> },
  { label: 'Profile & settings', to: '/profile', icon: <Settings size={16} /> },
]

/** ⌘K palette: songs from the Chordbook, pages and tools, plus "search everywhere" hand-off. */
export function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const songs = useApp((s) => s.data.songs)
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 30)
    }
  }, [open])

  const items = useMemo<Item[]>(() => {
    const go = (to: string) => () => {
      navigate(to)
      onClose()
    }
    const songItems = searchSongs(songs, q)
      .slice(0, q ? 8 : 5)
      .map<Item>((s) => ({ id: s.id, group: 'Songs', label: s.title, sub: s.artist, icon: <Artwork song={s} className="h-8 w-8" rounded="rounded-lg" />, run: go(`/song/${s.id}`) }))
    const ql = q.toLowerCase()
    const pageItems = PAGES.filter((p) => !q || p.label.toLowerCase().includes(ql)).map<Item>((p) => ({ id: p.to, group: 'Go to', label: p.label, icon: p.icon, run: go(p.to) }))
    const out = [...songItems, ...pageItems]
    if (q.trim())
      out.push({
        id: 'everywhere',
        group: 'Search',
        label: `Search Chordbook, Spotify & YouTube for “${q.trim()}”`,
        icon: <Search size={16} />,
        run: go(`/chordbook?q=${encodeURIComponent(q.trim())}&online=1`),
      })
    return out
  }, [q, songs, navigate, onClose])

  useEffect(() => setActive(0), [q])
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((a) => Math.min(items.length - 1, a + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((a) => Math.max(0, a - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      items[active]?.run()
    } else if (e.key === 'Escape') onClose()
  }

  let lastGroup = ''
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[90] flex items-start justify-center p-3 pt-[10vh]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-label="Search"
            className="panel relative w-full max-w-xl overflow-hidden p-0"
            initial={{ y: -20, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: -10, scale: 0.98, opacity: 0 }}
            transition={spring}
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search size={18} className="text-a1" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKey}
                placeholder="Song, artist, album, page or tool…"
                className="h-14 flex-1 bg-transparent text-base outline-none placeholder:text-mute"
                aria-label="Search"
                role="combobox"
                aria-expanded="true"
                aria-controls="palette-list"
                aria-activedescendant={`pal-${active}`}
              />
              <kbd className="kbd">Esc</kbd>
            </div>
            <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[55vh] overflow-auto p-2">
              {items.map((it, i) => {
                const header = it.group !== lastGroup ? it.group : null
                lastGroup = it.group
                return (
                  <li key={it.group + it.id} role="presentation">
                    {header && <div className="label px-3 pb-1 pt-3">{header}</div>}
                    <button
                      id={`pal-${i}`}
                      role="option"
                      aria-selected={i === active}
                      data-index={i}
                      onMouseMove={() => setActive(i)}
                      onClick={it.run}
                      className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm', i === active ? 'bg-a1/12 text-white' : 'text-soft')}
                    >
                      <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center', i === active ? 'text-a1' : 'text-mute')}>{it.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{it.label}</span>
                        {it.sub && <span className="block truncate text-xs text-mute">{it.sub}</span>}
                      </span>
                      {i === active ? <CornerDownLeft size={14} className="text-a1" /> : <ArrowRight size={14} className="opacity-0" />}
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="flex gap-4 border-t border-line px-4 py-2 text-[0.7rem] text-mute">
              <span>
                <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> move
              </span>
              <span>
                <kbd className="kbd">Enter</kbd> open
              </span>
              <span className="hidden sm:inline">
                <kbd className="kbd">g</kbd> then <kbd className="kbd">c</kbd> Chordbook
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
