import { Reorder, useDragControls } from 'motion/react'
import { ArrowDown, ArrowLeft, ArrowUp, GripVertical, Pencil, Play, Plus, Search, Trash2, Users, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Page, EmptyState, Modal, Badge } from '@/components/ui'
import { CatAvatar } from '@/components/art/Art'
import { Artwork, CoverButton, WishlistStar } from '@/components/SongControls'
import { useApp, useSettings } from '@/stores/app'
import { playSong, canPlay } from '@/features/player/tracks'
import { searchSongs } from '@/features/chordbook/search'
import { formatDuration } from '@/lib/util'
import { PlaylistModal } from './PlaylistsPage'
import type { PlaylistItem, Song } from '@/types'

export default function PlaylistDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const me = useApp((s) => s.me)!
  const settings = useSettings()
  const playlist = useApp((s) => s.data.playlists.find((p) => p.id === id))
  const allItems = useApp((s) => s.data.items)
  const songs = useApp((s) => s.data.songs)
  const states = useApp((s) => s.data.states)
  const profiles = useApp((s) => s.data.profiles)
  const reorder = useApp((s) => s.reorderPlaylist)
  const removeFromPlaylist = useApp((s) => s.removeFromPlaylist)
  const deletePlaylist = useApp((s) => s.deletePlaylist)
  const [editing, setEditing] = useState(false)
  const [adding, setAdding] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const items = useMemo(() => allItems.filter((i) => i.playlistId === id).sort((a, b) => a.position - b.position), [allItems, id])
  const [order, setOrder] = useState<string[] | null>(null)
  const ordered = order ? (order.map((oid) => items.find((i) => i.id === oid)).filter(Boolean) as PlaylistItem[]) : items
  const rows = ordered.map((i) => ({ item: i, song: songs.find((s) => s.id === i.songId) })).filter((r): r is { item: PlaylistItem; song: Song } => !!r.song)

  if (!playlist || (!playlist.shared && playlist.ownerId !== me.id))
    return (
      <Page>
        <EmptyState title="Playlist not found" body="It may have been deleted or it’s private to its owner." action={<Link className="btn" to="/playlists">Back to playlists</Link>} />
      </Page>
    )

  const canEdit = playlist.ownerId === me.id || playlist.shared
  const isOwner = playlist.ownerId === me.id
  const owner = profiles.find((p) => p.id === playlist.ownerId)
  const coveredBy = (uid: string) => rows.filter((r) => states.some((s) => s.userId === uid && s.songId === r.song.id && s.covered)).length
  const totalMs = rows.reduce((t, r) => t + (r.song.durationMs ?? 0), 0)
  const commit = (ids: string[]) => {
    reorder(playlist.id, ids)
    setOrder(null)
  }
  const move = (idx: number, d: number) => {
    const ids = rows.map((r) => r.item.id)
    const j = idx + d
    if (j < 0 || j >= ids.length) return
    ;[ids[idx], ids[j]] = [ids[j], ids[idx]]
    commit(ids)
  }

  return (
    <Page>
      <button className="btn btn-ghost mb-3" onClick={() => navigate('/playlists')}>
        <ArrowLeft size={16} /> Playlists
      </button>
      <header className="relative mb-6 overflow-hidden rounded-[28px] border border-white/10 p-6">
        <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(circle at 10% 0%, ${playlist.color}44, transparent 60%), rgb(13 11 20 / 0.9)` }} />
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <Badge tone={playlist.shared ? 'a2' : 'a1'}>{playlist.shared ? <><Users size={11} /> Shared</> : 'Personal'}</Badge>
              <Badge>{playlist.kind === 'setlist' ? 'Practice setlist' : 'Playlist'}</Badge>
            </div>
            <h1 className="display mt-2 text-3xl font-extrabold sm:text-4xl">{playlist.name}</h1>
            {playlist.description && <p className="mt-1 max-w-2xl text-soft">{playlist.description}</p>}
            <p className="mt-2 text-xs text-mute">
              {rows.length} songs{totalMs ? ` · ${Math.round(totalMs / 60000)} min` : ''}
              {owner && ` · by ${owner.id === me.id ? 'you' : owner.displayName}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {rows.some((r) => canPlay(r.song)) && (
              <button className="btn btn-primary" onClick={() => { const first = rows.find((r) => canPlay(r.song)); if (first) playSong(first.song, rows.map((r) => r.song), settings.playerSource) }}>
                <Play size={15} fill="currentColor" /> Play all
              </button>
            )}
            {canEdit && (
              <button className="btn" onClick={() => setAdding(true)}>
                <Plus size={15} /> Add songs
              </button>
            )}
            {isOwner && (
              <>
                <button className="btn btn-icon" onClick={() => setEditing(true)} aria-label="Edit playlist"><Pencil size={15} /></button>
                <button className={confirmDelete ? 'btn border-rec/50 text-rec' : 'btn btn-icon'} onClick={() => (confirmDelete ? (deletePlaylist(playlist.id), navigate('/playlists')) : setConfirmDelete(true))} aria-label="Delete playlist">
                  <Trash2 size={15} /> {confirmDelete && 'Confirm delete'}
                </button>
              </>
            )}
          </div>
        </div>
        {/* cover progress for both people */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {profiles.map((p) => {
            const n = coveredBy(p.id)
            return (
              <div key={p.id} className="flex items-center gap-3">
                <CatAvatar who={p.username} size={30} animated={false} />
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/5">
                  <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${rows.length ? (n / rows.length) * 100 : 0}%`, background: p.username === 'raiyan' ? '#b6ff3b' : '#ff4fa3' }} />
                </div>
                <span className="text-xs text-mute">{n}/{rows.length}</span>
              </div>
            )
          })}
        </div>
      </header>

      {rows.length ? (
        <Reorder.Group axis="y" values={rows.map((r) => r.item.id)} onReorder={(ids) => setOrder(ids)} className="panel flex flex-col gap-0.5 p-2">
          {rows.map((r, i) => (
            <Row key={r.item.id} item={r.item} song={r.song} index={i} canEdit={canEdit} onDrop={() => order && commit(order)} onMove={(d) => move(i, d)} onRemove={() => removeFromPlaylist(r.item.id)} last={i === rows.length - 1} listId={playlist.id} />
          ))}
        </Reorder.Group>
      ) : (
        <EmptyState title="This playlist is empty" body="Add songs from the Chordbook." action={canEdit ? <button className="btn btn-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add songs</button> : undefined} />
      )}

      <PlaylistModal key={String(editing)} open={editing} onClose={() => setEditing(false)} playlist={playlist} />
      <AddSongs open={adding} onClose={() => setAdding(false)} playlistId={playlist.id} existing={new Set(rows.map((r) => r.song.id))} />
    </Page>
  )
}

function Row({ item, song, index, canEdit, onDrop, onMove, onRemove, last, listId }: { item: PlaylistItem; song: Song; index: number; canEdit: boolean; onDrop: () => void; onMove: (d: number) => void; onRemove: () => void; last: boolean; listId: string }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={item.id} dragListener={false} dragControls={controls} onDragEnd={onDrop} className="group flex items-center gap-2 rounded-xl bg-panel px-2 py-2" whileDrag={{ scale: 1.02, boxShadow: '0 20px 40px -20px var(--a1)', zIndex: 5 }}>
      {canEdit && (
        <button className="cursor-grab touch-none p-1 text-mute hover:text-white active:cursor-grabbing" onPointerDown={(e) => controls.start(e)} aria-label="Drag to reorder">
          <GripVertical size={16} />
        </button>
      )}
      <span className="w-6 text-right font-mono text-xs text-mute">{index + 1}</span>
      <Link to={`/song/${song.id}?list=${listId}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Artwork song={song} className="h-10 w-10 shrink-0 text-[0.5rem]" rounded="rounded-lg" />
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{song.title}</div>
          <div className="truncate text-xs text-mute">{song.artist}{song.key ? ` · ${song.key}` : ''}</div>
        </div>
      </Link>
      <span className="hidden font-mono text-xs text-mute sm:inline">{formatDuration(song.durationMs)}</span>
      <WishlistStar songId={song.id} size={16} />
      <CoverButton songId={song.id} compact />
      {canEdit && (
        <div className="flex items-center opacity-60 group-hover:opacity-100 group-focus-within:opacity-100">
          <button className="btn btn-ghost btn-icon" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move up"><ArrowUp size={14} /></button>
          <button className="btn btn-ghost btn-icon" onClick={() => onMove(1)} disabled={last} aria-label="Move down"><ArrowDown size={14} /></button>
          <button className="btn btn-ghost btn-icon hover:text-rec" onClick={onRemove} aria-label="Remove from playlist"><X size={14} /></button>
        </div>
      )}
    </Reorder.Item>
  )
}

function AddSongs({ open, onClose, playlistId, existing }: { open: boolean; onClose: () => void; playlistId: string; existing: Set<string> }) {
  const songs = useApp((s) => s.data.songs)
  const add = useApp((s) => s.addToPlaylist)
  const [q, setQ] = useState('')
  const results = searchSongs(songs, q).slice(0, 40)
  return (
    <Modal open={open} onClose={onClose} title="Add songs">
      <div className="relative mb-3">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
        <input className="input pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the Chordbook" autoFocus />
      </div>
      <ul className="max-h-[50vh] overflow-auto">
        {results.map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
            <Artwork song={s} className="h-9 w-9 text-[0.45rem]" rounded="rounded-lg" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{s.title}</div>
              <div className="truncate text-xs text-mute">{s.artist}</div>
            </div>
            <button className="btn py-1 text-xs" disabled={existing.has(s.id)} onClick={() => add(playlistId, s.id)}>
              {existing.has(s.id) ? 'Added' : <><Plus size={13} /> Add</>}
            </button>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
