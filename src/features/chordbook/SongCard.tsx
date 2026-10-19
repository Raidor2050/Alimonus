import { motion } from 'motion/react'
import { FileMusic, ListMusic, Play } from 'lucide-react'
import { memo } from 'react'
import { Link } from 'react-router'
import type { Song } from '@/types'
import { Artwork, CoverButton, DuetBadge, WishlistStar } from '@/components/SongControls'
import { useApp, useSettings } from '@/stores/app'
import { canPlay, playSong } from '@/features/player/tracks'
import { cx, formatDuration } from '@/lib/util'

export const SongCard = memo(function SongCard({ song, queue, active, index = 0 }: { song: Song; queue?: Song[]; active?: boolean; index?: number }) {
  const settings = useSettings()
  const playlistCount = useApp((s) => {
    const mine = new Set(s.data.playlists.filter((p) => p.ownerId === s.me?.id || p.shared).map((p) => p.id))
    return s.data.items.filter((i) => i.songId === song.id && mine.has(i.playlistId)).length
  })
  const hasSheet = !!song.chordSheet
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 260, damping: 26, delay: Math.min(index, 14) * 0.025 }}
      whileHover={{ y: -4 }}
      className={cx('group relative', active && 'z-10')}
    >
      <Link
        to={`/song/${song.id}`}
        data-song-card
        className={cx(
          'panel relative flex h-full flex-col overflow-hidden p-0 transition-[border-color,box-shadow] duration-300 hover:border-a1/40 hover:shadow-[0_20px_60px_-25px_var(--a1)]',
          active && 'border-a1/70 shadow-[0_0_0_2px_var(--a1)]',
        )}
      >
        <div className="relative aspect-[5/3] overflow-hidden">
          <Artwork song={song} className="h-full w-full text-[1.4rem] transition-transform duration-700 group-hover:scale-105" rounded="rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-panel/20 to-transparent" />
          <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
            {song.key && <span className="rounded-full bg-black/60 px-2 py-0.5 font-mono text-[0.7rem] font-bold text-a1 backdrop-blur">{song.key}</span>}
            {hasSheet ? (
              <span className="flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-semibold text-soft backdrop-blur" title="Chord sheet available">
                <FileMusic size={11} /> Chords
              </span>
            ) : song.progression ? (
              <span className="rounded-full bg-black/60 px-2 py-0.5 text-[0.65rem] font-semibold text-soft backdrop-blur">Progression</span>
            ) : null}
          </div>
          {canPlay(song) && (
            <button
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                playSong(song, queue ?? [song], settings.playerSource)
              }}
              className="absolute bottom-3 right-3 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-a1 text-ink opacity-0 shadow-[0_8px_24px_-6px_var(--a1)] transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100 focus-visible:translate-y-0 focus-visible:opacity-100"
              aria-label={`Play ${song.title}`}
            >
              <Play size={17} fill="currentColor" className="ml-0.5" />
            </button>
          )}
        </div>
        <div className="flex flex-1 flex-col gap-1 px-4 pb-3 pt-1">
          <div className="flex items-start gap-1">
            <div className="min-w-0 flex-1">
              <h3 className="truncate font-bold leading-tight">{song.title}</h3>
              <p className="truncate text-sm text-mute">{song.artist}</p>
            </div>
            <WishlistStar songId={song.id} />
          </div>
          <div className="truncate text-xs text-mute/80">
            {[song.album, song.releaseYear, formatDuration(song.durationMs) !== '—' ? formatDuration(song.durationMs) : null].filter(Boolean).join(' · ') || ' '}
          </div>
          <div className="mt-auto flex items-center gap-2 pt-2">
            <CoverButton songId={song.id} compact />
            <DuetBadge songId={song.id} />
            {playlistCount > 0 && (
              <span className="ml-auto flex items-center gap-1 text-xs text-mute" title={`In ${playlistCount} playlist${playlistCount > 1 ? 's' : ''}`}>
                <ListMusic size={13} /> {playlistCount}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  )
})

export function SongRow({ song, index, onPlay, trailing }: { song: Song; index?: number; onPlay?: () => void; trailing?: React.ReactNode }) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl px-2 py-2 transition-colors hover:bg-white/[0.04]">
      {index !== undefined && <span className="w-6 text-right font-mono text-xs text-mute">{index + 1}</span>}
      <Link to={`/song/${song.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Artwork song={song} className="h-11 w-11 shrink-0 text-[0.55rem]" rounded="rounded-xl" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{song.title}</div>
          <div className="truncate text-xs text-mute">
            {song.artist}
            {song.key ? ` · ${song.key}` : ''}
          </div>
        </div>
      </Link>
      {onPlay && canPlay(song) && (
        <button onClick={onPlay} className="btn btn-ghost btn-icon opacity-60 group-hover:opacity-100" aria-label={`Play ${song.title}`}>
          <Play size={15} />
        </button>
      )}
      <WishlistStar songId={song.id} size={16} />
      <CoverButton songId={song.id} compact />
      {trailing}
    </div>
  )
}
