import { AnimatePresence, motion } from 'motion/react'
import { ArrowDownAZ, ExternalLink, Globe, LoaderCircle, Plus, Search, SlidersHorizontal, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { Page, PageHeader, EmptyState, Badge } from '@/components/ui'
import { SpotifyMark, YouTubeMark, Penrose } from '@/components/art/Art'
import { useApp, useSettings } from '@/stores/app'
import { useSpotify } from '@/integrations/spotify'
import { YouTubeNotConfigured, youtubeSearchUrl } from '@/integrations/youtube'
import { usePlayer } from '@/stores/player'
import { cx, formatDuration } from '@/lib/util'
import { SongCard } from './SongCard'
import { AddSongModal } from './AddSongModal'
import { matchExisting, searchSongs, spotifyProvider, youtubeProvider, type ExternalHit } from './search'
import { importHit } from './importHit'
import type { Song } from '@/types'

type Filter = 'all' | 'recent' | 'added' | 'wishlist' | 'covered' | 'uncovered' | 'sheets'
type Sort = 'relevance' | 'title' | 'artist' | 'added' | 'opened'

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All songs' },
  { id: 'recent', label: 'Recently opened' },
  { id: 'added', label: 'Recently added' },
  { id: 'wishlist', label: '★ Wishlist' },
  { id: 'covered', label: 'Covered' },
  { id: 'uncovered', label: 'Not yet covered' },
  { id: 'sheets', label: 'Has chords' },
]

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms)
    return () => clearTimeout(t)
  }, [value, ms])
  return v
}

export default function ChordbookPage() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const songs = useApp((s) => s.data.songs)
  const states = useApp((s) => s.data.states)
  const playlists = useApp((s) => s.data.playlists)
  const items = useApp((s) => s.data.items)
  const me = useApp((s) => s.me)
  const [q, setQ] = useState(params.get('q') ?? '')
  const dq = useDebounced(q, 160)
  const filter = (params.get('filter') as Filter) || 'all'
  const [sort, setSort] = useState<Sort>('relevance')
  const [artist, setArtist] = useState('')
  const [genre, setGenre] = useState('')
  const [keyF, setKeyF] = useState('')
  const [playlistF, setPlaylistF] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [adding, setAdding] = useState(false)
  const [active, setActive] = useState(-1)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const next = new URLSearchParams(params)
    if (dq) next.set('q', dq)
    else next.delete('q')
    if (next.toString() !== params.toString()) setParams(next, { replace: true })
  }, [dq]) // eslint-disable-line react-hooks/exhaustive-deps

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params)
    if (f === 'all') next.delete('filter')
    else next.set('filter', f)
    setParams(next, { replace: true })
  }

  const myStates = useMemo(() => new Map(states.filter((s) => s.userId === me?.id).map((s) => [s.songId, s])), [states, me?.id])
  const artists = useMemo(() => [...new Set(songs.map((s) => s.artist))].sort(), [songs])
  const genres = useMemo(() => [...new Set(songs.map((s) => s.genre).filter((g): g is string => !!g))].sort(), [songs])
  const keys = useMemo(() => [...new Set(songs.map((s) => s.key).filter((k): k is string => !!k))].sort(), [songs])
  const visiblePlaylists = playlists.filter((p) => p.ownerId === me?.id || p.shared)

  const results = useMemo(() => {
    let list = searchSongs(songs, dq)
    const st = (s: Song) => myStates.get(s.id)
    if (filter === 'recent') list = list.filter((s) => st(s)?.lastOpenedAt).sort((a, b) => (st(b)!.lastOpenedAt! > st(a)!.lastOpenedAt! ? 1 : -1))
    if (filter === 'added') list = [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)).slice(0, 30)
    if (filter === 'wishlist') list = list.filter((s) => st(s)?.wishlist)
    if (filter === 'covered') list = list.filter((s) => st(s)?.covered)
    if (filter === 'uncovered') list = list.filter((s) => !st(s)?.covered)
    if (filter === 'sheets') list = list.filter((s) => s.chordSheet || s.progression)
    if (artist) list = list.filter((s) => s.artist === artist)
    if (genre) list = list.filter((s) => s.genre === genre)
    if (keyF) list = list.filter((s) => s.key === keyF)
    if (playlistF) {
      const ids = new Set(items.filter((i) => i.playlistId === playlistF).map((i) => i.songId))
      list = list.filter((s) => ids.has(s.id))
    }
    if (sort === 'title') list = [...list].sort((a, b) => a.title.localeCompare(b.title))
    if (sort === 'artist') list = [...list].sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title))
    if (sort === 'added') list = [...list].sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1))
    if (sort === 'opened') list = [...list].sort((a, b) => ((st(b)?.lastOpenedAt ?? '') > (st(a)?.lastOpenedAt ?? '') ? 1 : -1))
    return list
  }, [songs, dq, filter, myStates, artist, genre, keyF, playlistF, items, sort])

  useEffect(() => setActive(-1), [dq, filter])

  // Keyboard navigation across the grid: arrows move, Enter opens.
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!results.length) return
      const cols = window.innerWidth >= 1280 ? 4 : window.innerWidth >= 1024 ? 3 : window.innerWidth >= 640 ? 2 : 1
      const move = { ArrowDown: cols, ArrowUp: -cols, ArrowRight: 1, ArrowLeft: -1 }[e.key]
      if (move !== undefined && (e.key.startsWith('ArrowD') || e.key.startsWith('ArrowU') || active >= 0)) {
        e.preventDefault()
        setActive((a) => Math.max(0, Math.min(results.length - 1, a < 0 ? 0 : a + move)))
      } else if (e.key === 'Enter' && results[Math.max(0, active)]) {
        e.preventDefault()
        navigate(`/song/${results[Math.max(0, active)].id}`)
      } else if (e.key === 'Escape') {
        setQ('')
      }
    },
    [results, active, navigate],
  )

  useEffect(() => {
    if (active >= 0) document.querySelectorAll('[data-song-card]')[active]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active])

  const activeFilters = [artist, genre, keyF, playlistF].filter(Boolean).length

  return (
    <Page>
      <PageHeader eyebrow="The heart of Alimonus" title={<span>Chordbook</span>} art={<Penrose size={46} className="anim-float hidden sm:block" />}>
        <span className="text-sm text-mute">{songs.length} songs</span>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>
          <Plus size={16} /> Add song
        </button>
      </PageHeader>

      <div className="sticky top-[68px] z-20 -mx-1 mb-5 rounded-[24px] px-1 py-1">
        <div className="glass flex flex-col gap-3 rounded-[22px] p-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-a1" />
              <input
                ref={inputRef}
                className="input h-12 rounded-2xl pl-11 pr-10 text-base"
                placeholder="Search title, artist, album, alt titles, key…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                aria-label="Search the Chordbook"
                autoFocus={!!params.get('q')}
              />
              {q && (
                <button className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-white" onClick={() => setQ('')} aria-label="Clear search">
                  <X size={16} />
                </button>
              )}
            </div>
            <button className={cx('btn h-12 rounded-2xl', (showFilters || activeFilters > 0) && 'border-a1/50 text-a1')} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              <SlidersHorizontal size={16} /> <span className="hidden sm:inline">Filters</span>
              {activeFilters > 0 && <span className="rounded-full bg-a1 px-1.5 text-[0.65rem] text-ink">{activeFilters}</span>}
            </button>
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
            {FILTERS.map((f) => (
              <button key={f.id} className="chip" data-active={filter === f.id} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
          <AnimatePresence initial={false}>
            {showFilters && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <div className="grid grid-cols-2 gap-2 pt-1 sm:grid-cols-5">
                  <select className="input py-2 text-sm" value={playlistF} onChange={(e) => setPlaylistF(e.target.value)} aria-label="Playlist">
                    <option value="">Any playlist</option>
                    <optgroup label="Personal">
                      {visiblePlaylists.filter((p) => !p.shared).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Shared">
                      {visiblePlaylists.filter((p) => p.shared).map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <select className="input py-2 text-sm" value={artist} onChange={(e) => setArtist(e.target.value)} aria-label="Artist">
                    <option value="">Any artist</option>
                    {artists.map((a) => (
                      <option key={a}>{a}</option>
                    ))}
                  </select>
                  <select className="input py-2 text-sm" value={genre} onChange={(e) => setGenre(e.target.value)} aria-label="Genre">
                    <option value="">Any genre</option>
                    {genres.map((g) => (
                      <option key={g}>{g}</option>
                    ))}
                  </select>
                  <select className="input py-2 font-mono text-sm" value={keyF} onChange={(e) => setKeyF(e.target.value)} aria-label="Key">
                    <option value="">Any key</option>
                    {keys.map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                  <div className="relative">
                    <ArrowDownAZ size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute" />
                    <select className="input py-2 pl-8 text-sm" value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort">
                      <option value="relevance">Best match</option>
                      <option value="title">Title A–Z</option>
                      <option value="artist">Artist A–Z</option>
                      <option value="added">Newest first</option>
                      <option value="opened">Last opened</option>
                    </select>
                  </div>
                </div>
                {activeFilters > 0 && (
                  <button
                    className="mt-2 text-xs text-mute underline-offset-2 hover:text-white hover:underline"
                    onClick={() => {
                      setArtist('')
                      setGenre('')
                      setKeyF('')
                      setPlaylistF('')
                    }}
                  >
                    Clear filters
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {results.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {results.map((s, i) => (
            <SongCard key={s.id} song={s} queue={results} index={i} active={i === active} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Search size={34} />}
          title={dq ? `Nothing in the Chordbook for “${dq}”` : 'No songs match these filters'}
          body={dq ? 'Search Spotify and YouTube below, or add it yourself.' : 'Try a different filter.'}
          action={
            <button className="btn btn-primary" onClick={() => setAdding(true)}>
              <Plus size={15} /> Add “{dq || 'a song'}”
            </button>
          }
        />
      )}

      {dq.trim().length > 1 && <OnlineResults query={dq} autoYouTube={params.get('online') === '1'} />}

      <AddSongModal key={String(adding)} open={adding} onClose={() => setAdding(false)} initialTitle={dq} />
    </Page>
  )
}

/** Spotify (automatic) and YouTube (on demand, to protect the ~100/day quota) results. */
function OnlineResults({ query, autoYouTube }: { query: string; autoYouTube: boolean }) {
  const spotifyStatus = useSpotify((s) => s.status)
  const [sp, setSp] = useState<{ loading: boolean; hits: ExternalHit[]; error: string | null }>({ loading: false, hits: [], error: null })
  const [yt, setYt] = useState<{ loading: boolean; hits: ExternalHit[]; error: string | null; notConfigured: boolean; ran: string | null }>({ loading: false, hits: [], error: null, notConfigured: false, ran: null })

  useEffect(() => {
    const ctrl = new AbortController()
    setSp({ loading: true, hits: [], error: null })
    spotifyProvider
      .search(query, ctrl.signal)
      .then((hits) => setSp({ loading: false, hits, error: null }))
      .catch((e: Error) => e.name !== 'AbortError' && setSp({ loading: false, hits: [], error: e.message }))
    return () => ctrl.abort()
  }, [query, spotifyStatus])

  const runYouTube = useCallback(() => {
    setYt((s) => ({ ...s, loading: true, error: null }))
    youtubeProvider
      .search(query)
      .then((hits) => setYt({ loading: false, hits, error: null, notConfigured: false, ran: query }))
      .catch((e: Error) => setYt({ loading: false, hits: [], error: e instanceof YouTubeNotConfigured ? null : e.message, notConfigured: e instanceof YouTubeNotConfigured, ran: query }))
  }, [query])

  useEffect(() => {
    if (autoYouTube) runYouTube()
  }, [autoYouTube, runYouTube])

  return (
    <section className="mt-10">
      <h2 className="display mb-4 flex items-center gap-2 text-xl font-bold">
        <Globe size={20} className="text-a2" /> Beyond the Chordbook
      </h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="panel p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <SpotifyMark className="h-5 w-5" /> Spotify
            {sp.loading && <LoaderCircle size={15} className="animate-spin text-mute" />}
          </div>
          {sp.hits.length ? (
            <HitList hits={sp.hits} />
          ) : !sp.loading ? (
            <p className="text-sm text-mute">
              {sp.error ??
                (spotifyStatus === 'unconfigured'
                  ? 'Spotify isn’t configured. Add VITE_SPOTIFY_CLIENT_ID (and SPOTIFY_CLIENT_SECRET for search without connecting) — see README.'
                  : spotifyStatus !== 'connected'
                    ? 'Connect Spotify in Settings to search its catalog (or configure the server-side search function).'
                    : 'No Spotify matches.')}
            </p>
          ) : (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-12 rounded-xl" />
              ))}
            </div>
          )}
        </div>
        <div className="panel p-4">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <YouTubeMark className="h-5 w-5" /> YouTube
            {yt.loading && <LoaderCircle size={15} className="animate-spin text-mute" />}
          </div>
          {yt.ran !== query && !yt.loading ? (
            <button className="btn" onClick={runYouTube}>
              <Search size={15} /> Search YouTube for “{query}”
            </button>
          ) : yt.hits.length ? (
            <HitList hits={yt.hits} />
          ) : yt.notConfigured ? (
            <div className="text-sm text-mute">
              <p>YouTube search needs an API key (see README). Meanwhile you can search on YouTube and paste the link into a song’s Sources panel.</p>
              <a className="btn mt-3" href={youtubeSearchUrl(query)} target="_blank" rel="noreferrer">
                <ExternalLink size={15} /> Open YouTube search
              </a>
            </div>
          ) : yt.error ? (
            <p className="text-sm text-rec">{yt.error}</p>
          ) : !yt.loading ? (
            <p className="text-sm text-mute">No YouTube matches.</p>
          ) : null}
        </div>
      </div>
    </section>
  )
}

function HitList({ hits }: { hits: ExternalHit[] }) {
  const songs = useApp((s) => s.data.songs)
  const navigate = useNavigate()
  const playTrack = usePlayer((s) => s.playTrack)
  const settings = useSettings()
  void settings
  return (
    <ul className="flex flex-col gap-1">
      {hits.map((h) => {
        const existing = matchExisting(songs, h)
        return (
          <li key={h.provider + h.externalId} className="group flex items-center gap-3 rounded-xl p-1.5 hover:bg-white/[0.04]">
            <button
              className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg bg-white/5"
              onClick={() =>
                playTrack({
                  key: `${h.provider}:${h.externalId}`,
                  songId: existing?.id ?? null,
                  title: h.title,
                  artist: h.artist,
                  artworkUrl: h.artworkUrl,
                  source: h.provider,
                  ...(h.provider === 'youtube' ? { youtubeId: h.externalId } : { spotifyUri: `spotify:track:${h.externalId}` }),
                })
              }
              aria-label={`Preview ${h.title}`}
            >
              {h.artworkUrl && <img src={h.artworkUrl} alt="" className="h-full w-full object-cover" loading="lazy" />}
              <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100">▶</span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{h.title}</div>
              <div className="truncate text-xs text-mute">
                {h.artist}
                {h.album ? ` · ${h.album}` : ''} · {formatDuration(h.durationMs)}
              </div>
            </div>
            {existing && <Badge tone="a1">In Chordbook</Badge>}
            <button className="btn shrink-0 py-1.5 text-xs" onClick={() => navigate(`/song/${importHit(h).id}`)}>
              {existing ? 'Open' : 'Add & open'}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
