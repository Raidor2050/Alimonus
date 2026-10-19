import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ExternalLink, ListMusic, LoaderCircle, Play, Plus, Star, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Page, PageHeader, Segmented, EmptyState, Modal, Field, Toggle, Rise } from '@/components/ui'
import { SpotifyMark, GeneratedArt } from '@/components/art/Art'
import { useApp } from '@/stores/app'
import { usePlayer } from '@/stores/player'
import { connectSpotify, getMyPlaylists, getPlaylistTracks, bestImage, playlistTotal, useSpotify, type Paged, type SpotifyPlaylist, type SpotifyTrack } from '@/integrations/spotify'
import { spotifyTrackToHit, matchExisting } from '@/features/chordbook/search'
import { importHit } from '@/features/chordbook/importHit'
import { cx, formatDuration } from '@/lib/util'
import type { Playlist } from '@/types'

export const PLAYLIST_COLORS = ['#b6ff3b', '#2ef2ff', '#c084fc', '#f472b6', '#ff8a3d', '#ffd84a', '#ff2b3b', '#8b5cf6']

export default function PlaylistsPage() {
  const [params, setParams] = useSearchParams()
  const tab = params.get('tab') === 'spotify' ? 'spotify' : 'alimonus'
  const [creating, setCreating] = useState(false)
  return (
    <Page>
      <PageHeader eyebrow="Your sets, your mixes" title="Playlists">
        <Segmented
          layoutId="pl-tab"
          value={tab}
          onChange={(v) => setParams(v === 'spotify' ? { tab: 'spotify' } : {})}
          options={[
            { value: 'alimonus', label: <><ListMusic size={15} /> Alimonus</> },
            { value: 'spotify', label: <><SpotifyMark className="h-4 w-4" /> Spotify</> },
          ]}
        />
        {tab === 'alimonus' && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            <Plus size={16} /> New
          </button>
        )}
      </PageHeader>
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, x: tab === 'spotify' ? 20 : -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
          {tab === 'alimonus' ? <AlimonusPlaylists onCreate={() => setCreating(true)} /> : <SpotifyBrowser />}
        </motion.div>
      </AnimatePresence>
      <PlaylistModal key={String(creating)} open={creating} onClose={() => setCreating(false)} />
    </Page>
  )
}

export function PlaylistModal({ open, onClose, playlist }: { open: boolean; onClose: () => void; playlist?: Playlist }) {
  const createPlaylist = useApp((s) => s.createPlaylist)
  const updatePlaylist = useApp((s) => s.updatePlaylist)
  const navigate = useNavigate()
  const [name, setName] = useState(playlist?.name ?? '')
  const [description, setDescription] = useState(playlist?.description ?? '')
  const [shared, setShared] = useState(playlist?.shared ?? false)
  const [kind, setKind] = useState<Playlist['kind']>(playlist?.kind ?? 'playlist')
  const [color, setColor] = useState(playlist?.color ?? PLAYLIST_COLORS[0])
  return (
    <Modal open={open} onClose={onClose} title={playlist ? 'Edit playlist' : 'New playlist'}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          if (playlist) updatePlaylist(playlist.id, { name: name.trim(), description, shared, kind, color })
          else navigate(`/playlists/${createPlaylist({ name: name.trim(), description, shared, kind, color }).id}`)
          onClose()
        }}
      >
        <Field label="Name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
        </Field>
        <Field label="Description">
          <textarea className="input min-h-16" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-center gap-4">
          <Segmented layoutId="pl-kind" size="sm" value={kind} onChange={setKind} options={[{ value: 'playlist', label: 'Playlist' }, { value: 'setlist', label: 'Practice setlist' }]} />
          <Toggle checked={shared} onChange={setShared} label="Shared with each other" />
        </div>
        <div className="flex gap-2">
          {PLAYLIST_COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={cx('h-7 w-7 rounded-full transition-transform', color === c && 'scale-125 ring-2 ring-white')} style={{ background: c }} aria-label={`Colour ${c}`} />
          ))}
        </div>
        <p className="text-xs text-mute">Alimonus playlists are separate from Spotify — nothing here changes your Spotify library.</p>
        <div className="flex justify-end gap-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!name.trim()}>{playlist ? 'Save' : 'Create'}</button>
        </div>
      </form>
    </Modal>
  )
}

function AlimonusPlaylists({ onCreate }: { onCreate: () => void }) {
  const me = useApp((s) => s.me)!
  const playlists = useApp((s) => s.data.playlists)
  const mine = playlists.filter((p) => p.ownerId === me.id && !p.shared)
  const shared = playlists.filter((p) => p.shared)
  return (
    <div className="flex flex-col gap-8">
      <section>
        <h2 className="display mb-3 flex items-center gap-2 text-lg font-bold">
          <ListMusic size={18} className="text-a1" /> Personal
        </h2>
        {mine.length ? <Grid lists={mine} /> : <EmptyState title="No personal playlists yet" body="Make one for your own practice queue." action={<button className="btn btn-primary" onClick={onCreate}><Plus size={15} /> New playlist</button>} />}
      </section>
      <section>
        <h2 className="display mb-3 flex items-center gap-2 text-lg font-bold">
          <Users size={18} className="text-a2" /> Shared
        </h2>
        {shared.length ? <Grid lists={shared} /> : <EmptyState title="Nothing shared yet" body="Shared playlists are editable by both of you." />}
      </section>
    </div>
  )
}

function Grid({ lists }: { lists: Playlist[] }) {
  const items = useApp((s) => s.data.items)
  const states = useApp((s) => s.data.states)
  const songs = useApp((s) => s.data.songs)
  const me = useApp((s) => s.me)!
  const profiles = useApp((s) => s.data.profiles)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {lists.map((p, i) => {
        const its = items.filter((x) => x.playlistId === p.id).sort((a, b) => a.position - b.position)
        const covered = its.filter((x) => states.some((s) => s.userId === me.id && s.songId === x.songId && s.covered)).length
        const pct = its.length ? covered / its.length : 0
        const covers = its.slice(0, 4).map((x) => songs.find((s) => s.id === x.songId)).filter(Boolean)
        const owner = profiles.find((pr) => pr.id === p.ownerId)
        return (
          <Rise key={p.id} i={i}>
            <Link to={`/playlists/${p.id}`} className="panel group block overflow-hidden p-0 transition-all hover:-translate-y-1 hover:border-white/20">
              <div className="relative grid aspect-[2/1] grid-cols-4 overflow-hidden">
                {covers.length ? covers.map((s) => <GeneratedArt key={s!.id} seed={s!.id + s!.title} title={s!.title} className="h-full text-[0.8rem]" />) : <div className="col-span-4" style={{ background: `linear-gradient(135deg, ${p.color}55, transparent)` }} />}
                <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, transparent, rgb(13 11 20) 95%), linear-gradient(90deg, ${p.color}33, transparent)` }} />
                <span className="absolute bottom-2 left-3 rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider text-ink" style={{ background: p.color }}>
                  {p.kind === 'setlist' ? 'Setlist' : 'Playlist'}
                </span>
              </div>
              <div className="p-4">
                <div className="display truncate text-lg font-bold">{p.name}</div>
                <div className="truncate text-xs text-mute">
                  {its.length} songs{p.shared && owner ? ` · started by ${owner.displayName.split(' ')[0]}` : ''}
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                    <motion.div className="h-full rounded-full" style={{ background: p.color }} initial={{ width: 0 }} animate={{ width: `${pct * 100}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.2 + i * 0.05 }} />
                  </div>
                  <span className="text-[0.68rem] text-mute">
                    {covered}/{its.length} covered
                  </span>
                </div>
              </div>
            </Link>
          </Rise>
        )
      })}
    </div>
  )
}

/* ---------------------------------- Spotify ---------------------------------- */

function SpotifyBrowser() {
  const status = useSpotify((s) => s.status)
  const name = useSpotify((s) => s.displayName)
  const error = useSpotify((s) => s.error)
  const [params, setParams] = useSearchParams()
  const selected = params.get('sp')
  const [page, setPage] = useState<Paged<SpotifyPlaylist> | null>(null)
  const [lists, setLists] = useState<SpotifyPlaylist[]>([])
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = (offset: number) => {
    setLoading(true)
    getMyPlaylists(offset)
      .then((p) => {
        setPage(p)
        setLists((l) => (offset ? [...l, ...p.items] : p.items))
        setErr(null)
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => {
    if (status === 'connected') load(0)
  }, [status]) // eslint-disable-line react-hooks/exhaustive-deps

  if (status === 'unconfigured')
    return (
      <EmptyState
        icon={<SpotifyMark className="h-10 w-10" />}
        title="Spotify isn’t configured yet"
        body={<>Create a Spotify developer app and set <code>VITE_SPOTIFY_CLIENT_ID</code> in Netlify (see README → Spotify). Everything else in Alimonus works without it.</>}
      />
    )
  if (status === 'loading') return <div className="flex justify-center py-12"><LoaderCircle className="animate-spin text-a1" /></div>
  if (status !== 'connected')
    return (
      <EmptyState
        icon={<SpotifyMark className="h-10 w-10" />}
        title={status === 'expired' ? 'Your Spotify connection expired' : 'Connect your Spotify'}
        body={error ?? 'Browse your playlists and pull tracks into the Chordbook. Each Alimonus profile connects its own Spotify account.'}
        action={<button className="btn btn-primary" onClick={() => void connectSpotify('/playlists?tab=spotify')}><SpotifyMark className="h-4 w-4" /> {status === 'expired' ? 'Reconnect' : 'Connect Spotify'}</button>}
      />
    )

  if (selected) {
    const meta = lists.find((l) => l.id === selected)
    return <SpotifyPlaylistView id={selected} meta={meta} onBack={() => setParams({ tab: 'spotify' })} />
  }

  return (
    <div>
      <p className="mb-4 text-sm text-mute">
        Connected as <b className="text-white">{name}</b>. These are your Spotify playlists — Spotify only returns the tracks of playlists you own or collaborate on.
      </p>
      {err && <p className="mb-3 text-sm text-rec">{err}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {lists.map((p, i) => (
          <Rise key={p.id} i={i}>
            <button onClick={() => setParams({ tab: 'spotify', sp: p.id })} className="group block w-full text-left">
              <div className="relative overflow-hidden rounded-2xl">
                {bestImage(p.images) ? <img src={bestImage(p.images)!} alt="" className="aspect-square w-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" /> : <div className="aspect-square w-full bg-white/5" />}
              </div>
              <div className="mt-2 truncate text-sm font-semibold">{p.name}</div>
              <div className="truncate text-xs text-mute">
                {playlistTotal(p)} tracks · {p.owner.display_name}
              </div>
            </button>
          </Rise>
        ))}
        {loading && [0, 1, 2, 3, 4].map((i) => <div key={i} className="skeleton aspect-square rounded-2xl" />)}
      </div>
      {page?.next && !loading && (
        <div className="mt-6 flex justify-center">
          <button className="btn" onClick={() => load(page.offset + page.limit)}>Load more</button>
        </div>
      )}
      {!loading && !lists.length && !err && <EmptyState title="No playlists found" />}
    </div>
  )
}

function SpotifyPlaylistView({ id, meta, onBack }: { id: string; meta?: SpotifyPlaylist; onBack: () => void }) {
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [page, setPage] = useState<Paged<SpotifyTrack> | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const songs = useApp((s) => s.data.songs)
  const toggleWishlist = useApp((s) => s.toggleWishlist)
  const navigate = useNavigate()
  const playTrack = usePlayer((s) => s.playTrack)

  const load = (offset: number) => {
    setLoading(true)
    getPlaylistTracks(id, offset)
      .then((p) => {
        setPage(p)
        setTracks((t) => (offset ? [...t, ...p.items] : p.items))
        setErr(null)
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => load(0), [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const asTrack = (t: SpotifyTrack) => ({ key: `spotify:${t.id}`, songId: matchExisting(songs, spotifyTrackToHit(t))?.id ?? null, title: t.name, artist: t.artists.map((a) => a.name).join(', '), artworkUrl: bestImage(t.album.images, 64), source: 'spotify' as const, spotifyUri: t.uri })

  return (
    <div>
      <button className="btn btn-ghost mb-4" onClick={onBack}>
        <ArrowLeft size={16} /> All Spotify playlists
      </button>
      <div className="mb-5 flex items-end gap-4">
        {meta && bestImage(meta.images) && <img src={bestImage(meta.images)!} alt="" className="h-28 w-28 rounded-2xl object-cover shadow-xl" />}
        <div>
          <div className="label">Spotify playlist</div>
          <h2 className="display text-2xl font-extrabold">{meta?.name ?? 'Playlist'}</h2>
          {meta && (
            <a href={meta.external_urls.spotify} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-xs text-mute hover:text-white">
              Open in Spotify <ExternalLink size={11} />
            </a>
          )}
        </div>
      </div>
      {err && <p className="mb-3 text-sm text-rec">{err}</p>}
      <div className="panel p-2">
        {tracks.map((t, i) => {
          const hit = spotifyTrackToHit(t)
          const existing = matchExisting(songs, hit)
          return (
            <div key={t.id + i} className="group flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/[0.04]">
              <span className="w-6 text-right font-mono text-xs text-mute">{i + 1}</span>
              <button className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg" onClick={() => playTrack(asTrack(t), tracks.map(asTrack))} aria-label={`Play ${t.name}`}>
                {bestImage(t.album.images, 64) && <img src={bestImage(t.album.images, 64)!} alt="" className="h-full w-full object-cover" loading="lazy" />}
                <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100"><Play size={14} fill="white" /></span>
              </button>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{t.name}</div>
                <div className="truncate text-xs text-mute">
                  {hit.artist} · {t.album.name}
                </div>
              </div>
              <span className="hidden font-mono text-xs text-mute sm:inline">{formatDuration(t.duration_ms)}</span>
              <button
                className="btn btn-ghost btn-icon"
                title="Add to Chordbook & wishlist"
                aria-label="Add to wishlist"
                onClick={() => {
                  const s = importHit(hit)
                  const st = useApp.getState().data.states.find((x) => x.songId === s.id && x.userId === useApp.getState().me?.id)
                  if (!st?.wishlist) toggleWishlist(s.id)
                }}
              >
                <Star size={15} />
              </button>
              <button className={cx('btn py-1.5 text-xs', existing && 'border-a1/40 text-a1')} onClick={() => navigate(`/song/${importHit(hit).id}`)}>
                {existing ? 'Open song' : 'Open in Alimonus'}
              </button>
            </div>
          )
        })}
        {loading && <div className="flex justify-center py-6"><LoaderCircle className="animate-spin text-a1" /></div>}
        {!loading && !tracks.length && !err && <p className="p-4 text-sm text-mute">No tracks returned. Spotify only shares the contents of playlists you own or collaborate on.</p>}
      </div>
      {page?.next && !loading && (
        <div className="mt-4 flex justify-center">
          <button className="btn" onClick={() => load(page.offset + page.limit)}>Load more tracks</button>
        </div>
      )}
    </div>
  )
}
