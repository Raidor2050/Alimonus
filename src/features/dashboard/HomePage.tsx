import { motion } from 'motion/react'
import { ArrowRight, BookOpen, Flag, Gauge, Guitar, ListMusic, Mic, Music2, Sparkles, Star, Timer, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Page, Section, Rise, EmptyState } from '@/components/ui'
import { CatAvatar, Penrose, SpotifyMark } from '@/components/art/Art'
import { CelestialCorners } from '@/components/art/Sigil'
import { Artwork } from '@/components/SongControls'
import { useApp, partnerOf } from '@/stores/app'
import { useSpotify, getMyPlaylists, bestImage, playlistTotal, type SpotifyPlaylist } from '@/integrations/spotify'
import { SongRow } from '@/features/chordbook/SongCard'
import { playSong } from '@/features/player/tracks'
import { cx, formatDate, relativeTime } from '@/lib/util'
import type { Song } from '@/types'


function greeting() {
  const h = new Date().getHours()
  if (h < 5) return 'Up late'
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  if (h < 22) return 'Good evening'
  return 'Night shift'
}

export default function HomePage() {
  const me = useApp((s) => s.me)!
  const data = useApp((s) => s.data)
  const mode = useApp((s) => s.backend?.mode)
  const partner = partnerOf(me, data.profiles)
  const isRaiyan = me.username === 'raiyan'

  const byId = useMemo(() => new Map(data.songs.map((s) => [s.id, s])), [data.songs])
  const mine = data.states.filter((s) => s.userId === me.id)
  const theirs = data.states.filter((s) => s.userId === partner?.id)
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((s): s is Song => !!s)

  const recent = pick(mine.filter((s) => s.lastOpenedAt).sort((a, b) => (b.lastOpenedAt! > a.lastOpenedAt! ? 1 : -1)).map((s) => s.songId)).slice(0, 6)
  const covered = pick(mine.filter((s) => s.covered).sort((a, b) => ((b.coveredAt ?? '') > (a.coveredAt ?? '') ? 1 : -1)).map((s) => s.songId))
  const wishlist = pick(mine.filter((s) => s.wishlist).map((s) => s.songId))
  const theirCovered = new Set(theirs.filter((s) => s.covered).map((s) => s.songId))
  const theirWish = new Set(theirs.filter((s) => s.wishlist).map((s) => s.songId))
  const myCovered = new Set(covered.map((s) => s.id))
  const duets = data.songs.filter((s) => myCovered.has(s.id) && theirCovered.has(s.id))
  // Recommendations: songs your partner wants or has covered that you haven't, then ones with full sheets you haven't opened.
  const recommended = useMemo(() => {
    const seen = new Set(mine.filter((s) => s.lastOpenedAt || s.covered).map((s) => s.songId))
    const scored = data.songs
      .filter((s) => !myCovered.has(s.id))
      .map((s) => ({ s, score: (theirWish.has(s.id) ? 3 : 0) + (theirCovered.has(s.id) ? 2 : 0) + (s.chordSheet ? 1 : 0) + (seen.has(s.id) ? -2 : 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.slice(0, 5).map((x) => ({ song: x.s, why: theirWish.has(x.s.id) ? `On ${partner?.displayName.split(' ')[0]}’s wishlist` : theirCovered.has(x.s.id) ? `${partner?.displayName.split(' ')[0]} covered it — duet?` : 'Full chord sheet ready' }))
  }, [data.songs, mine, myCovered, theirWish, theirCovered, partner]) // eslint-disable-line react-hooks/exhaustive-deps

  const myPlaylists = data.playlists.filter((p) => p.ownerId === me.id && !p.shared)
  const sharedPlaylists = data.playlists.filter((p) => p.shared)
  const today = new Date().toISOString().slice(0, 10)
  const upcoming = data.roadmap
    .filter((r) => r.status !== 'done' && (r.ownerId === me.id || r.shared))
    .sort((a, b) => (a.dueDate ?? '9999') .localeCompare(b.dueDate ?? '9999') || (a.status === 'doing' ? -1 : 1))
    .slice(0, 5)
  const sharedGoals = data.roadmap.filter((r) => r.shared && (r.category === 'goal' || r.category === 'milestone'))
  const lastSong = recent[0]

  return (
    <Page>
      {/* Hero */}
      <section className="relative mb-6 overflow-hidden rounded-[30px] border border-white/10 p-6 sm:p-8">
        <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(circle at 15% 20%, color-mix(in oklab, var(--a1) 22%, transparent), transparent 50%), radial-gradient(circle at 85% 80%, color-mix(in oklab, var(--a2) 26%, transparent), transparent 55%), rgb(10 8 16 / 0.85)' }} />
        <CelestialCorners />
        <div className="absolute -right-6 -top-6 opacity-20 sm:opacity-40">
          <Penrose size={180} className="anim-spin-slow" />
        </div>
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
          <motion.div initial={{ scale: 0.6, rotate: -10, opacity: 0 }} animate={{ scale: 1, rotate: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 14 }} className="anim-float shrink-0">
            <CatAvatar who={me.username} size={132} />
          </motion.div>
          <div className="min-w-0 flex-1">
            <div className="label mb-1">{greeting()}, {isRaiyan ? 'dimension-hopper' : 'headliner'}</div>
            <h1 className="display text-4xl font-extrabold leading-none sm:text-5xl">
              <span className="text-gradient">{me.displayName.split(' ')[0]}</span>
            </h1>
            <p className="mt-2 max-w-xl text-soft">{me.tagline}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {lastSong ? (
                <Link to={`/song/${lastSong.id}`} className="btn btn-primary">
                  <Music2 size={16} /> Continue “{lastSong.title}”
                </Link>
              ) : (
                <Link to="/chordbook" className="btn btn-primary">
                  <BookOpen size={16} /> Open the Chordbook
                </Link>
              )}
              <Link to="/tools/tuner" className="btn">
                <Gauge size={16} /> Tune up
              </Link>
              <Link to="/roadmap" className="btn">
                <Flag size={16} /> Roadmap
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 md:w-80">
            <Stat value={covered.length} label="covered" icon={<Mic size={14} />} />
            <Stat value={wishlist.length} label="wishlist" icon={<Star size={14} />} />
            <Stat value={duets.length} label="duets" icon={<Users size={14} />} />
          </div>
        </div>
        {mode === 'demo' && <p className="relative mt-5 text-xs text-ember">Local demo mode: sample songs, playlists and roadmap items live only in this browser. They aren’t synced.</p>}
      </section>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-5 lg:col-span-2">
          <Section title="Recently opened" action={<SeeAll to="/chordbook?filter=recent" />}>
            {recent.length ? (
              <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
                {recent.map((s, i) => (
                  <Rise key={s.id} i={i}>
                    <MiniTile song={s} sub={relativeTime(mine.find((m) => m.songId === s.id)?.lastOpenedAt)} />
                  </Rise>
                ))}
              </div>
            ) : (
              <EmptyState title="Nothing opened yet" body="Songs you open show up here." />
            )}
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            <Section title={<span className="flex items-center gap-2"><Star size={16} className="text-gold" /> Your wishlist</span>} action={<SeeAll to="/chordbook?filter=wishlist" />}>
              {wishlist.length ? wishlist.slice(0, 5).map((s) => <SongRow key={s.id} song={s} onPlay={() => playSong(s, wishlist, me.settings.playerSource)} />) : <p className="text-sm text-mute">Star songs to learn next.</p>}
            </Section>
            <Section title={<span className="flex items-center gap-2"><Mic size={16} className="text-a1" /> Recently covered</span>} action={<SeeAll to="/chordbook?filter=covered" />}>
              {covered.length ? (
                <ul className="flex flex-col gap-1">
                  {covered.slice(0, 5).map((s) => (
                    <li key={s.id}>
                      <Link to={`/song/${s.id}`} className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/5">
                        <Artwork song={s} className="h-9 w-9 text-[0.45rem]" rounded="rounded-lg" />
                        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{s.title}</span>
                        <span className="text-xs text-mute">{formatDate(mine.find((m) => m.songId === s.id)?.coveredAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-mute">Hit “Cover” on a song once you can play it.</p>
              )}
            </Section>
          </div>

          <Section title={<span className="flex items-center gap-2"><Sparkles size={16} className="text-a2" /> Picked for you</span>}>
            {recommended.length ? (
              <ul className="grid gap-2 sm:grid-cols-2">
                {recommended.map(({ song, why }) => (
                  <li key={song.id}>
                    <Link to={`/song/${song.id}`} className="flex items-center gap-3 rounded-2xl border border-line p-2.5 transition-colors hover:border-a2/50 hover:bg-white/[0.03]">
                      <Artwork song={song} className="h-12 w-12 text-[0.5rem]" rounded="rounded-xl" />
                      <div className="min-w-0">
                        <div className="truncate font-semibold">{song.title}</div>
                        <div className="truncate text-xs text-a2">{why}</div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">You’ve covered everything in sight. Add more songs to the Chordbook!</p>
            )}
          </Section>

          <div className="grid gap-5 md:grid-cols-2">
            <PlaylistList title="Your playlists" lists={myPlaylists} />
            <PlaylistList title="Shared with each other" lists={sharedPlaylists} shared />
          </div>
          <SpotifyStrip />
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Coming up" action={<SeeAll to="/roadmap" />}>
            {upcoming.length ? (
              <ul className="flex flex-col gap-2">
                {upcoming.map((r) => (
                  <li key={r.id} className="flex items-start gap-3 rounded-xl px-1 py-1">
                    <span className={cx('mt-1.5 h-2 w-2 shrink-0 rounded-full', r.status === 'doing' ? 'bg-a1 shadow-[0_0_8px_var(--a1)]' : 'bg-white/25')} />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm">{r.title}</div>
                      <div className="text-xs text-mute">
                        {r.shared ? 'Shared · ' : ''}
                        {r.status === 'doing' ? 'In progress' : r.status === 'idea' ? 'Idea' : 'To do'}
                        {r.dueDate ? ` · due ${formatDate(r.dueDate)}` : ''}
                        {r.dueDate && r.dueDate < today ? <span className="text-rec"> · overdue</span> : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">Clear skies. Add something to the roadmap.</p>
            )}
          </Section>

          <Section title={<span className="flex items-center gap-2"><Users size={16} className="text-a2" /> Shared goals</span>}>
            {sharedGoals.length ? (
              <ul className="flex flex-col gap-2">
                {sharedGoals.map((g) => (
                  <li key={g.id} className="flex items-center gap-2 text-sm">
                    <span className={cx('flex h-5 w-5 items-center justify-center rounded-full text-[0.6rem]', g.status === 'done' ? 'bg-a1 text-ink' : 'border border-white/20')}>{g.status === 'done' ? '✓' : ''}</span>
                    <span className={cx(g.status === 'done' && 'text-mute line-through')}>{g.title}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-mute">No shared goals yet.</p>
            )}
            {partner && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-white/[0.03] p-3">
                <CatAvatar who={partner.username} size={40} animated={false} />
                <div className="text-xs text-soft">
                  {partner.displayName.split(' ')[0]} has covered <b className="text-white">{theirCovered.size}</b> songs and wishlisted <b className="text-white">{theirWish.size}</b>.
                </div>
              </div>
            )}
          </Section>

          <Section title="Quick tools">
            <div className="grid grid-cols-2 gap-2">
              {[
                { to: '/tools/tuner', label: 'Tuner', icon: <Gauge size={18} /> },
                { to: '/tools/metronome', label: 'Metronome', icon: <Timer size={18} /> },
                { to: '/tools/chords', label: 'Chords', icon: <Guitar size={18} /> },
                { to: '/tools/practice', label: 'Practice', icon: <Music2 size={18} /> },
              ].map((t) => (
                <Link key={t.to} to={t.to} className="group flex items-center gap-2 rounded-2xl border border-line p-3 text-sm font-semibold transition-all hover:-translate-y-0.5 hover:border-a1/50">
                  <span className="text-a1 transition-transform group-hover:rotate-12">{t.icon}</span> {t.label}
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Recent activity">
            <ul className="flex flex-col gap-2">
              {data.activity.slice(0, 7).map((a) => {
                const who = data.profiles.find((p) => p.id === a.userId)
                return (
                  <li key={a.id} className="flex items-start gap-2 text-sm">
                    {who && <CatAvatar who={who.username} size={22} animated={false} />}
                    <div className="min-w-0">
                      <span className="font-semibold">{who?.id === me.id ? 'You' : who?.displayName.split(' ')[0]}</span> <span className="text-soft">{a.text}</span>
                      <div className="text-[0.68rem] text-mute">{relativeTime(a.createdAt)}</div>
                    </div>
                  </li>
                )
              })}
              {!data.activity.length && <li className="text-sm text-mute">Activity from both of you appears here.</li>}
            </ul>
          </Section>
        </div>
      </div>
    </Page>
  )
}

function Stat({ value, label, icon }: { value: number; label: string; icon: React.ReactNode }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 700)
      setN(Math.round(value * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return (
    <div className="glass rounded-2xl p-3 text-center">
      <div className="display text-3xl font-extrabold text-a1">{n}</div>
      <div className="flex items-center justify-center gap-1 text-[0.65rem] uppercase tracking-wider text-mute">
        {icon} {label}
      </div>
    </div>
  )
}

function SeeAll({ to }: { to: string }) {
  return (
    <Link to={to} className="flex items-center gap-1 text-xs text-mute hover:text-a1">
      See all <ArrowRight size={12} />
    </Link>
  )
}

function MiniTile({ song, sub }: { song: Song; sub?: string }) {
  return (
    <Link to={`/song/${song.id}`} className="group block w-36 shrink-0">
      <div className="relative overflow-hidden rounded-2xl">
        <Artwork song={song} className="aspect-square w-full text-[1.4rem] transition-transform duration-500 group-hover:scale-110" rounded="rounded-2xl" />
        {song.key && <span className="absolute left-2 top-2 rounded-full bg-black/60 px-1.5 font-mono text-[0.65rem] font-bold text-a1">{song.key}</span>}
      </div>
      <div className="mt-2 truncate text-sm font-semibold">{song.title}</div>
      <div className="truncate text-xs text-mute">{sub || song.artist}</div>
    </Link>
  )
}

function PlaylistList({ title, lists, shared }: { title: string; lists: { id: string; name: string; color: string; kind: string }[]; shared?: boolean }) {
  const items = useApp((s) => s.data.items)
  return (
    <Section title={<span className="flex items-center gap-2">{shared ? <Users size={16} className="text-a2" /> : <ListMusic size={16} className="text-a1" />} {title}</span>} action={<SeeAll to="/playlists" />}>
      {lists.length ? (
        <ul className="flex flex-col gap-1">
          {lists.slice(0, 5).map((p) => (
            <li key={p.id}>
              <Link to={`/playlists/${p.id}`} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
                <span className="h-8 w-8 rounded-lg" style={{ background: `linear-gradient(135deg, ${p.color}, transparent)` }} />
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-mute">{items.filter((i) => i.playlistId === p.id).length} songs</span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-mute">None yet.</p>
      )}
    </Section>
  )
}

function SpotifyStrip() {
  const status = useSpotify((s) => s.status)
  const [lists, setLists] = useState<SpotifyPlaylist[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    if (status !== 'connected') return
    getMyPlaylists(0, 8)
      .then((p) => setLists(p.items))
      .catch((e: Error) => setError(e.message))
  }, [status])
  return (
    <Section title={<span className="flex items-center gap-2"><SpotifyMark className="h-4 w-4" /> Spotify playlists</span>} action={status === 'connected' ? <SeeAll to="/playlists?tab=spotify" /> : undefined}>
      {status !== 'connected' ? (
        <p className="text-sm text-mute">
          {status === 'unconfigured' ? 'Spotify isn’t configured for this deployment yet (see README).' : status === 'expired' ? 'Your Spotify connection expired.' : 'Connect your Spotify account to browse your playlists here.'}{' '}
          {status !== 'unconfigured' && (
            <Link to="/profile#services" className="text-a1 hover:underline">
              {status === 'expired' ? 'Reconnect' : 'Connect'}
            </Link>
          )}
        </p>
      ) : error ? (
        <p className="text-sm text-rec">{error}</p>
      ) : !lists ? (
        <div className="flex gap-3">{[0, 1, 2, 3].map((i) => <div key={i} className="skeleton h-28 w-28 shrink-0 rounded-2xl" />)}</div>
      ) : (
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {lists.map((p) => (
            <Link key={p.id} to={`/playlists?tab=spotify&sp=${p.id}`} className="group w-28 shrink-0">
              {bestImage(p.images) ? <img src={bestImage(p.images)!} alt="" className="aspect-square w-full rounded-2xl object-cover transition-transform group-hover:scale-105" /> : <div className="aspect-square w-full rounded-2xl bg-white/5" />}
              <div className="mt-1.5 truncate text-xs font-semibold">{p.name}</div>
              <div className="text-[0.65rem] text-mute">{playlistTotal(p)} tracks</div>
            </Link>
          ))}
        </div>
      )}
    </Section>
  )
}
