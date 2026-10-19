import { motion } from 'motion/react'
import { Check, Download, KeyRound, LogOut, RefreshCw, Server } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useSearchParams } from 'react-router'
import { Page, Section, Segmented, Toggle, Field, Badge } from '@/components/ui'
import { CatAvatar, Penrose, SpotifyMark, YouTubeMark } from '@/components/art/Art'
import { CelestialCorners } from '@/components/art/Sigil'
import { useApp, partnerOf } from '@/stores/app'
import { connectSpotify, disconnectSpotify, useSpotify } from '@/integrations/spotify'
import { env, isSupabaseConfigured, spotifyRedirectUri } from '@/lib/env'
import { TUNINGS } from '@/lib/theory/guitar'
import { LocalBackend } from '@/lib/backend/local'
import { toast } from '@/stores/toasts'
import { cx, formatDate } from '@/lib/util'
import type { Profile, Settings, ThemeId } from '@/types'

const THEMES: { id: ThemeId; name: string; blurb: string; colors: string[] }[] = [
  { id: 'portal', name: 'Portal Lab', blurb: 'Acid lime, cyan & ultraviolet', colors: ['#b6ff3b', '#2ef2ff', '#8b5cf6'] },
  { id: 'stage', name: 'Midnight Stage', blurb: 'Magenta spotlights & a red REC light', colors: ['#ff4fa3', '#a855f7', '#ff2b3b'] },
  { id: 'fusion', name: 'Fusion', blurb: 'Both worlds at once', colors: ['#b6ff3b', '#c25cff', '#ff3dbb'] },
]

export default function ProfilePage() {
  const me = useApp((s) => s.me)!
  const profiles = useApp((s) => s.data.profiles)
  const [params, setParams] = useSearchParams()
  const location = useLocation()
  const partner = partnerOf(me, profiles)
  const viewing = params.get('who') === partner?.username && partner ? partner : me

  useEffect(() => {
    if (location.hash) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }, [location.hash])

  return (
    <Page>
      <div className="mb-5 flex justify-end">
        {partner && (
          <Segmented
            layoutId="who"
            value={viewing.id === me.id ? 'me' : 'partner'}
            onChange={(v) => setParams(v === 'me' ? {} : { who: partner.username })}
            options={[
              { value: 'me', label: 'My corner' },
              { value: 'partner', label: `${partner.displayName.split(' ')[0]}’s corner` },
            ]}
          />
        )}
      </div>
      <ProfileHero profile={viewing} editable={viewing.id === me.id} />
      {viewing.id === me.id && <SettingsPanel />}
    </Page>
  )
}

function ProfileHero({ profile, editable }: { profile: Profile; editable: boolean }) {
  const updateProfile = useApp((s) => s.updateProfile)
  const states = useApp((s) => s.data.states.filter((x) => x.userId === profile.id))
  const roadmap = useApp((s) => s.data.roadmap.filter((r) => r.ownerId === profile.id))
  const songs = useApp((s) => s.data.songs)
  const [editing, setEditing] = useState(false)
  const [f, setF] = useState({ displayName: profile.displayName, tagline: profile.tagline, bio: profile.bio })
  useEffect(() => setF({ displayName: profile.displayName, tagline: profile.tagline, bio: profile.bio }), [profile.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const r = profile.username === 'raiyan'
  const accent = r ? '#b6ff3b' : '#ff4fa3'
  const accent2 = r ? '#2ef2ff' : '#a855f7'
  const lastCovered = states.filter((s) => s.covered).sort((a, b) => ((b.coveredAt ?? '') > (a.coveredAt ?? '') ? 1 : -1))[0]
  const lastSong = songs.find((s) => s.id === lastCovered?.songId)
  const interests = r ? ['Rick & Morty', 'Psychedelic art', 'Impossible geometry', 'Experimental electronic', 'Code'] : ['Michael Jackson', 'FNAF', 'Cats', 'Performance', 'Analog horror']

  return (
    <motion.section key={profile.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative mb-6 overflow-hidden rounded-[32px] border border-white/10 p-6 sm:p-10">
      <div className="absolute inset-0 -z-10" style={{ background: `radial-gradient(circle at 20% 10%, ${accent}33, transparent 50%), radial-gradient(circle at 90% 90%, ${accent2}33, transparent 55%), rgb(8 7 13 / 0.9)` }} />
      {r ? (
        <>
          <div className="absolute -right-16 -top-16 h-72 w-72 rounded-full opacity-40 anim-spin-slow" style={{ background: `conic-gradient(${accent}, transparent 30%, ${accent2} 60%, transparent 80%, ${accent})`, mask: 'radial-gradient(closest-side, transparent 60%, black 64%, black 70%, transparent 74%)', WebkitMask: 'radial-gradient(closest-side, transparent 60%, black 64%, black 70%, transparent 74%)' }} />
          <pre className="pointer-events-none absolute bottom-3 right-5 hidden font-mono text-[0.65rem] leading-tight text-lime/30 md:block">{`while (alive) {\n  practice(guitar);\n  open(portal);\n}`}</pre>
        </>
      ) : (
        <>
          <div className="anim-sweep absolute -top-10 right-[20%] h-[140%] w-56 origin-top opacity-40" style={{ background: `conic-gradient(from 168deg at 50% 0%, transparent, ${accent}55 12deg, transparent 24deg)` }} />
          <div className="absolute right-6 top-6 flex items-center gap-2 font-mono text-xs font-bold text-rec">
            <span className="anim-blink h-3 w-3 rounded-full bg-rec shadow-[0_0_12px_#ff2b3b]" /> REC
          </div>
          <div className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: 'repeating-linear-gradient(0deg, white 0 1px, transparent 1px 3px)' }} />
        </>
      )}
      <CelestialCorners className="opacity-70" />
      <div className="relative flex flex-col gap-6 md:flex-row md:items-center">
        <div className="anim-float">
          <CatAvatar who={profile.username} size={170} />
        </div>
        <div className="min-w-0 flex-1">
          {editing ? (
            <div className="flex max-w-xl flex-col gap-3">
              <input className="input display text-2xl font-bold" value={f.displayName} onChange={(e) => setF({ ...f, displayName: e.target.value })} aria-label="Display name" />
              <input className="input" value={f.tagline} onChange={(e) => setF({ ...f, tagline: e.target.value })} aria-label="Tagline" />
              <textarea className="input min-h-20" value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} aria-label="Bio" />
              <div className="flex gap-2">
                <button className="btn btn-primary" onClick={() => { updateProfile(f); setEditing(false) }}><Check size={15} /> Save</button>
                <button className="btn" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="label" style={{ color: accent }}>{r ? 'Portal Lab' : 'Midnight Stage'}</div>
              <h1 className={cx('display text-4xl font-extrabold sm:text-5xl', !r && 'anim-glitch')} style={{ color: accent }}>{profile.displayName}</h1>
              <p className="mt-1 text-lg text-soft">{profile.tagline}</p>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-mute">{profile.bio}</p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {interests.map((t) => (
                  <span key={t} className="rounded-full border px-2.5 py-1 text-xs" style={{ borderColor: `${accent}44`, color: accent }}>{t}</span>
                ))}
              </div>
              {editable && <button className="btn mt-4" onClick={() => setEditing(true)}>Edit profile</button>}
            </>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 md:w-64">
          {[
            ['Covered', states.filter((s) => s.covered).length],
            ['Wishlist', states.filter((s) => s.wishlist).length],
            ['Goals done', roadmap.filter((x) => x.status === 'done').length],
            ['In progress', roadmap.filter((x) => x.status === 'doing').length],
          ].map(([k, v]) => (
            <div key={k} className="glass rounded-2xl p-3 text-center">
              <div className="display text-2xl font-extrabold" style={{ color: accent }}>{v}</div>
              <div className="text-[0.65rem] uppercase tracking-wider text-mute">{k}</div>
            </div>
          ))}
          {lastSong && <div className="col-span-2 text-center text-xs text-mute">Latest cover: <span className="text-white">{lastSong.title}</span> · {formatDate(lastCovered!.coveredAt)}</div>}
        </div>
      </div>
    </motion.section>
  )
}

function SettingsPanel() {
  const me = useApp((s) => s.me)!
  const s = me.settings
  const update = useApp((st) => st.updateSettings)
  const set = <K extends keyof Settings>(k: K) => (v: Settings[K]) => update({ [k]: v } as Partial<Settings>)

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="Appearance">
        <div className="grid gap-3 sm:grid-cols-3">
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => update({ theme: t.id })} className={cx('relative overflow-hidden rounded-2xl border p-3 text-left transition-all', s.theme === t.id ? 'border-a1 shadow-[0_0_24px_-8px_var(--a1)]' : 'border-line hover:border-white/20')}>
              <div className="mb-2 flex gap-1">{t.colors.map((c) => <span key={c} className="h-5 flex-1 rounded-full" style={{ background: c }} />)}</div>
              <div className="text-sm font-bold">{t.name}</div>
              <div className="text-xs text-mute">{t.blurb}</div>
              {s.theme === t.id && <Check size={15} className="absolute right-2 top-2 text-a1" />}
            </button>
          ))}
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Row label="Ambient animation">
            <Segmented layoutId="amb" size="sm" value={s.ambient} onChange={set('ambient')} options={[{ value: 'full', label: 'Full' }, { value: 'calm', label: 'Still' }, { value: 'off', label: 'Off' }]} />
          </Row>
          <Toggle checked={s.reducedMotion} onChange={set('reducedMotion')} label="Reduce motion (keeps essential feedback)" />
        </div>
      </Section>

      <Section title="Chord sheets">
        <div className="flex flex-col gap-3">
          <Row label="Chord position"><Segmented layoutId="cs" size="sm" value={s.chordStyle} onChange={set('chordStyle')} options={[{ value: 'above', label: 'Above lyrics' }, { value: 'inline', label: 'Inline' }]} /></Row>
          <Row label="Spelling"><Segmented layoutId="acc" size="sm" value={s.accidental} onChange={set('accidental')} options={[{ value: 'auto', label: 'Auto' }, { value: 'sharp', label: '♯' }, { value: 'flat', label: '♭' }]} /></Row>
          <Toggle checked={s.monospace} onChange={set('monospace')} label="Monospace alignment" />
          <Row label={`Text size · ${Math.round(s.fontScale * 100)}%`}>
            <input type="range" min={0.75} max={1.8} step={0.05} value={s.fontScale} onChange={(e) => update({ fontScale: Number(e.target.value) })} className="w-40 accent-[var(--a1)]" aria-label="Text size" />
          </Row>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default tuning">
              <select className="input" value={s.tuning} onChange={(e) => update({ tuning: e.target.value })}>
                {TUNINGS.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </Field>
            <Field label="Default capo">
              <input className="input" type="number" min={0} max={11} value={s.defaultCapo} onChange={(e) => update({ defaultCapo: Math.max(0, Math.min(11, Number(e.target.value))) })} />
            </Field>
          </div>
        </div>
      </Section>

      <Section title="Practice & playback">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Metronome BPM"><input className="input" type="number" min={30} max={300} value={s.metronomeBpm} onChange={(e) => update({ metronomeBpm: Number(e.target.value) })} /></Field>
          <Field label="Metronome volume"><input type="range" min={0} max={1} step={0.05} value={s.metronomeVolume} onChange={(e) => update({ metronomeVolume: Number(e.target.value) })} className="mt-3 accent-[var(--a1)]" /></Field>
          <Field label="Tuner A4 (Hz)"><input className="input" type="number" min={415} max={466} value={s.referencePitch} onChange={(e) => update({ referencePitch: Number(e.target.value) })} /></Field>
          <Field label="Preferred player">
            <select className="input" value={s.playerSource} onChange={(e) => update({ playerSource: e.target.value as Settings['playerSource'] })}>
              <option value="youtube">YouTube first</option>
              <option value="spotify">Spotify first</option>
            </select>
          </Field>
        </div>
      </Section>

      <div id="services" className="scroll-mt-24">
        <ServicesSection />
      </div>

      <AccountSection />
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <span className="text-sm">{label}</span>
      {children}
    </div>
  )
}

function ServicesSection() {
  const spotify = useSpotify()
  const mode = useApp((s) => s.backend?.mode)
  const [health, setHealth] = useState<Record<string, boolean> | null | 'unavailable'>(null)
  useEffect(() => {
    fetch('/api/health')
      .then((r) => ((r.headers.get('content-type') ?? '').includes('json') ? r.json() : Promise.reject()))
      .then(setHealth)
      .catch(() => setHealth('unavailable'))
  }, [])
  const fnOk = (k: string) => (health && health !== 'unavailable' ? health[k] : undefined)
  return (
    <Section title={<span className="flex items-center gap-2"><Server size={16} className="text-a1" /> Services</span>}>
      <ul className="flex flex-col gap-4 text-sm">
        <li className="flex items-start gap-3">
          <Penrose size={22} />
          <div className="flex-1">
            <div className="font-semibold">Storage</div>
            <div className="text-xs text-mute">{mode === 'cloud' ? 'Supabase — synced across devices with realtime updates.' : 'Local demo mode — saved in this browser only. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to sync.'}</div>
          </div>
          <Badge tone={mode === 'cloud' ? 'a1' : 'warn'}>{mode === 'cloud' ? 'Synced' : 'Demo'}</Badge>
        </li>
        <li className="flex items-start gap-3">
          <SpotifyMark className="h-5 w-5" />
          <div className="flex-1">
            <div className="font-semibold">Spotify</div>
            <div className="text-xs text-mute">
              {spotify.status === 'unconfigured' && 'Not configured: set VITE_SPOTIFY_CLIENT_ID.'}
              {spotify.status === 'disconnected' && 'Not connected for your profile.'}
              {spotify.status === 'connected' && `Connected as ${spotify.displayName ?? 'you'}.`}
              {spotify.status === 'expired' && 'Authorization expired — reconnect.'}
              {spotify.status === 'error' && (spotify.error ?? 'Error')}
              {spotify.status === 'loading' && 'Checking…'}
            </div>
            {spotify.status !== 'unconfigured' && <div className="mt-1 font-mono text-[0.65rem] text-mute">Redirect URI: {spotifyRedirectUri()}</div>}
          </div>
          {spotify.status === 'connected' ? (
            <button className="btn py-1.5 text-xs" onClick={() => void disconnectSpotify()}>Disconnect</button>
          ) : spotify.status !== 'unconfigured' && spotify.status !== 'loading' ? (
            <button className="btn btn-primary py-1.5 text-xs" onClick={() => void connectSpotify('/profile#services')}>{spotify.status === 'expired' ? 'Reconnect' : 'Connect'}</button>
          ) : null}
        </li>
        <li className="flex items-start gap-3">
          <YouTubeMark className="h-5 w-5" />
          <div className="flex-1">
            <div className="font-semibold">YouTube</div>
            <div className="text-xs text-mute">
              Playback works without a key. Search: {env.youtubeApiKey ? 'browser key configured.' : fnOk('youtube') ? 'server key configured (Netlify Function).' : 'not configured — set YOUTUBE_API_KEY in Netlify (or VITE_YOUTUBE_API_KEY). You can still paste video links.'}
            </div>
          </div>
          <Badge tone={env.youtubeApiKey || fnOk('youtube') ? 'a1' : 'default'}>{env.youtubeApiKey || fnOk('youtube') ? 'Search on' : 'Links only'}</Badge>
        </li>
        <li className="flex items-start gap-3">
          <Server size={18} className="text-mute" />
          <div className="flex-1">
            <div className="font-semibold">Netlify Functions</div>
            <div className="text-xs text-mute">
              {health === null ? 'Checking…' : health === 'unavailable' ? 'Not reachable (normal under plain `npm run dev`; use `netlify dev` or the deployed site).' : `Online · Spotify catalog search ${fnOk('spotifySearch') ? 'on' : 'off'} · YouTube search ${fnOk('youtube') ? 'on' : 'off'}`}
            </div>
          </div>
        </li>
      </ul>
    </Section>
  )
}

function AccountSection() {
  const backend = useApp((s) => s.backend)
  const signOut = useApp((s) => s.signOut)
  const me = useApp((s) => s.me)!
  const data = useApp((s) => s.data)
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)

  const exportData = () => {
    const mine = {
      exportedAt: new Date().toISOString(),
      profile: me,
      songStates: data.states.filter((s) => s.userId === me.id),
      playlists: data.playlists.filter((p) => p.ownerId === me.id || p.shared),
      playlistItems: data.items.filter((i) => data.playlists.some((p) => p.id === i.playlistId && (p.ownerId === me.id || p.shared))),
      roadmap: data.roadmap.filter((r) => r.ownerId === me.id || r.shared),
      songs: data.songs,
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(mine, null, 2)], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `alimonus-${me.username}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Section title="Account">
      <form
        className="flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (pw.length < 6 || pw !== pw2) return
          setBusy(true)
          try {
            await backend!.changePassword(pw)
            toast({ tone: 'success', title: 'Password changed' })
            setPw('')
            setPw2('')
          } catch (err) {
            toast({ tone: 'error', title: 'Couldn’t change password', body: (err as Error).message })
          } finally {
            setBusy(false)
          }
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="New password"><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Repeat"><input className="input" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" /></Field>
        </div>
        {pw && pw.length < 6 && <span className="text-xs text-ember">At least 6 characters.</span>}
        {pw2 && pw !== pw2 && <span className="text-xs text-ember">Passwords don’t match.</span>}
        <button className="btn w-fit" disabled={busy || pw.length < 6 || pw !== pw2}><KeyRound size={15} /> Change password</button>
      </form>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        <button className="btn" onClick={exportData}><Download size={15} /> Export my data</button>
        {backend?.mode === 'demo' && (
          <button
            className="btn"
            onClick={() => {
              if (!confirm('Reset all demo data in this browser back to the sample content?')) return
              ;(backend as LocalBackend).reset()
              void useApp.getState().refresh()
              toast({ tone: 'info', title: 'Demo data reset' })
            }}
          >
            <RefreshCw size={15} /> Reset demo data
          </button>
        )}
        <button className="btn ml-auto border-rec/30 text-rec hover:bg-rec/10" onClick={() => void signOut()}><LogOut size={15} /> Log out</button>
      </div>
      {!isSupabaseConfigured && <p className="mt-3 text-xs text-mute">Demo passwords are stored only in this browser.</p>}
    </Section>
  )
}
