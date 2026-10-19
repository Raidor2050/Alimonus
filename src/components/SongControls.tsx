import { AnimatePresence, motion } from 'motion/react'
import { Check, Mic, Star } from 'lucide-react'
import { useApp, useSongState } from '@/stores/app'
import { cx, formatDate } from '@/lib/util'
import { GeneratedArt } from './art/Art'
import type { Song } from '@/types'
import { useState } from 'react'

const BURST = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2)

/** Wishlist star with an orbital particle burst when activated. */
export function WishlistStar({ songId, size = 18, className }: { songId: string; size?: number; className?: string }) {
  const state = useSongState(songId)
  const toggle = useApp((s) => s.toggleWishlist)
  const active = !!state?.wishlist
  const [burst, setBurst] = useState(0)
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        if (!active) setBurst((b) => b + 1)
        toggle(songId)
      }}
      className={cx('relative inline-flex items-center justify-center rounded-full p-1.5 transition-colors', active ? 'text-[#f0c75e]' : 'text-mute hover:text-white', className)}
      aria-pressed={active}
      aria-label={active ? 'Remove from wishlist' : 'Add to wishlist'}
      title={active ? 'On your wishlist' : 'Add to wishlist'}
    >
      <motion.span key={burst} initial={burst ? { scale: 0.4, rotate: -90 } : false} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 14 }} className="relative z-10 flex">
        <Star size={size} fill={active ? 'currentColor' : 'none'} strokeWidth={2} style={active ? { filter: 'drop-shadow(0 0 6px rgb(240 199 94 / 0.85))' } : undefined} />
      </motion.span>
      <AnimatePresence>
        {burst > 0 && active && (
          <motion.span key={burst} className="pointer-events-none absolute inset-0" initial={{ opacity: 1 }} animate={{ opacity: 0 }} transition={{ duration: 0.7, delay: 0.25 }}>
            {BURST.map((a, i) => (
              <motion.span
                key={i}
                className="absolute left-1/2 top-1/2 h-1.5 w-1.5 rounded-full"
                style={{ background: i % 2 ? '#f0c75e' : 'var(--a1)', marginLeft: -3, marginTop: -3 }}
                initial={{ x: 0, y: 0, scale: 1 }}
                animate={{ x: Math.cos(a) * 20, y: Math.sin(a) * 20, scale: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
              />
            ))}
            <motion.span className="absolute inset-0 rounded-full border-2 border-[#f0c75e]" initial={{ scale: 0.6, opacity: 0.9 }} animate={{ scale: 2, opacity: 0 }} transition={{ duration: 0.55 }} />
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

/** Cover / Covered toggle: the check draws itself and a note flourish floats up. */
export function CoverButton({ songId, compact }: { songId: string; compact?: boolean }) {
  const state = useSongState(songId)
  const toggle = useApp((s) => s.toggleCovered)
  const covered = !!state?.covered
  return (
    <motion.button
      type="button"
      layout
      onClick={(e) => {
        e.stopPropagation()
        e.preventDefault()
        toggle(songId)
      }}
      whileTap={{ scale: 0.92 }}
      className={cx(
        'relative inline-flex items-center gap-1.5 overflow-visible rounded-full border font-semibold transition-colors',
        compact ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm',
        covered ? 'border-transparent bg-a1 text-ink' : 'border-white/15 bg-white/[0.04] text-soft hover:border-a1/50 hover:text-white',
      )}
      aria-pressed={covered}
      title={covered && state?.coveredAt ? `Covered ${formatDate(state.coveredAt)} — click to undo` : 'Mark as covered'}
    >
      <span className="relative flex h-4 w-4 items-center justify-center">
        {covered ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <motion.path d="M5 12.5 L10 17.5 L19 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: 'easeOut' }} />
          </svg>
        ) : (
          <Mic size={compact ? 13 : 15} />
        )}
      </span>
      <span>{covered ? 'Covered' : 'Cover'}</span>
      <AnimatePresence>
        {covered && (
          <motion.span
            key="flourish"
            className="pointer-events-none absolute -top-1 right-2 text-a1"
            initial={{ y: 0, opacity: 0 }}
            animate={{ y: -22, opacity: [0, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
          >
            ♪
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  )
}

export function Artwork({ song, className, rounded = 'rounded-2xl' }: { song: Pick<Song, 'id' | 'title' | 'artworkUrl'>; className?: string; rounded?: string }) {
  const [failed, setFailed] = useState(false)
  if (song.artworkUrl && !failed)
    return <img src={song.artworkUrl} alt="" loading="lazy" onError={() => setFailed(true)} className={cx('object-cover', rounded, className)} />
  return <GeneratedArt seed={song.id + song.title} title={song.title} className={cx(rounded, className)} />
}

/** Small "both covered" marker for shared achievements. */
export function DuetBadge({ songId }: { songId: string }) {
  const both = useApp((s) => {
    const covered = s.data.states.filter((x) => x.songId === songId && x.covered).map((x) => x.userId)
    return new Set(covered).size >= 2
  })
  if (!both) return null
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-a2/40 bg-a2/10 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider text-a2" title="You’ve both covered this">
      <Check size={11} /> Duet
    </span>
  )
}
