import { AnimatePresence, motion } from 'motion/react'
import { Bell, BookOpen, Cloud, CloudOff, House, ListMusic, LoaderCircle, Map as MapIcon, Search, TriangleAlert, Wrench } from 'lucide-react'
import { cloneElement, useEffect, useRef, useState, type ReactElement } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router'
import { Cosmos, type Scene } from '@/components/art/Cosmos'
import { CatAvatar, Logo, SpotifyMark } from '@/components/art/Art'
import { useApp, useSettings } from '@/stores/app'
import { useSpotify } from '@/integrations/spotify'
import { useToasts } from '@/stores/toasts'
import { Player } from '@/features/player/Player'
import { CommandPalette } from './CommandPalette'
import { cx, relativeTime } from '@/lib/util'
import { spring } from '@/components/ui'

const NAV = [
  { to: '/', label: 'Home', icon: House, hint: 'g h' },
  { to: '/chordbook', label: 'Chordbook', icon: BookOpen, hint: 'g c' },
  { to: '/playlists', label: 'Playlists', icon: ListMusic, hint: 'g p' },
  { to: '/roadmap', label: 'Roadmap', icon: MapIcon, hint: 'g r' },
  { to: '/tools', label: 'Tools', icon: Wrench, hint: 'g t' },
]

function sceneFor(path: string): Scene {
  if (path.startsWith('/chordbook')) return 'chordbook'
  if (path.startsWith('/song')) return 'song'
  if (path.startsWith('/playlists')) return 'playlists'
  if (path.startsWith('/roadmap')) return 'roadmap'
  if (path.startsWith('/tools')) return 'tools'
  if (path.startsWith('/profile')) return 'profile'
  return 'home'
}

export function Shell() {
  const location = useLocation()
  const outlet = useOutlet()
  const navigate = useNavigate()
  const settings = useSettings()
  const [paletteOpen, setPaletteOpen] = useState(false)
  const pendingG = useRef(false)

  // Global shortcuts: ⌘K / Ctrl+K / "/" → search; "g" then h/c/p/r/t → navigate.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      const typing = !!t.closest('input, textarea, select, [contenteditable="true"]')
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((v) => !v)
        return
      }
      if (typing) return
      if (e.key === '/') {
        e.preventDefault()
        setPaletteOpen(true)
        return
      }
      if (pendingG.current) {
        pendingG.current = false
        const dest = { h: '/', c: '/chordbook', p: '/playlists', r: '/roadmap', t: '/tools', s: '/profile' }[e.key]
        if (dest) navigate(dest)
        return
      }
      if (e.key === 'g') {
        pendingG.current = true
        setTimeout(() => (pendingG.current = false), 900)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  const isSong = location.pathname.startsWith('/song')
  // Key transitions on the top-level section so in-page param changes (song → song) don't remount.
  const sectionKey = location.pathname.split('/')[1] || 'home'

  return (
    <div className="relative min-h-dvh">
      <Cosmos scene={sceneFor(location.pathname)} theme={settings.theme} />
      <Dock />
      <div className="relative z-10 md:pl-[88px]">
        <TopBar onSearch={() => setPaletteOpen(true)} compact={isSong} />
        <AnimatePresence mode="wait" initial={false}>
          {outlet && cloneElement(outlet as ReactElement, { key: sectionKey })}
        </AnimatePresence>
      </div>
      <MobileNav />
      <Player />
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  )
}

function Dock() {
  const me = useApp((s) => s.me)
  return (
    <nav className="no-print fixed inset-y-3 left-3 z-40 hidden w-[68px] flex-col items-center gap-2 rounded-[26px] py-4 md:flex glass" aria-label="Main">
      <NavLink to="/" aria-label="Alimonus home" className="mb-3">
        <Logo compact />
      </NavLink>
      {NAV.map((n) => (
        <DockLink key={n.to} {...n} />
      ))}
      <div className="flex-1" />
      <NavLink to="/profile" className={({ isActive }) => cx('relative rounded-2xl p-1 transition-transform hover:scale-105', isActive && 'ring-2 ring-a1/70')} aria-label="Profile & settings" title="Profile & settings (g s)">
        {me && <CatAvatar who={me.username} size={46} animated={false} />}
      </NavLink>
    </nav>
  )
}

function DockLink({ to, label, icon: Icon, hint: shortcut }: (typeof NAV)[number]) {
  return (
    <NavLink to={to} end={to === '/'} className="group relative flex h-12 w-12 items-center justify-center rounded-2xl" aria-label={label} title={`${label} (${shortcut})`}>
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span layoutId="dock-active" className="absolute inset-0 rounded-2xl bg-a1/15 ring-1 ring-a1/50" transition={spring}>
              <span className="absolute -left-[13px] top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-a1 shadow-[0_0_12px_var(--a1)]" />
            </motion.span>
          )}
          <motion.span whileHover={{ scale: 1.15, rotate: -4 }} whileTap={{ scale: 0.9 }} className={cx('relative z-10', isActive ? 'text-a1' : 'text-mute group-hover:text-white')}>
            <Icon size={21} />
          </motion.span>
          <span className="pointer-events-none absolute left-[60px] z-50 whitespace-nowrap rounded-lg bg-raised px-2 py-1 text-xs font-semibold opacity-0 shadow-lg transition-opacity group-hover:opacity-100">{label}</span>
        </>
      )}
    </NavLink>
  )
}

function MobileNav() {
  return (
    <nav className="no-print glass fixed inset-x-2 bottom-2 z-50 flex justify-around rounded-[22px] px-1 py-1.5 md:hidden" aria-label="Main">
      {[...NAV, { to: '/profile', label: 'Me', icon: null, hint: '' }].map((n) => (
        <NavLink key={n.to} to={n.to} end={n.to === '/'} className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[0.62rem] font-semibold">
          {({ isActive }) => (
            <>
              {isActive && <motion.span layoutId="mnav-active" className="absolute inset-0 rounded-2xl bg-a1/15" transition={spring} />}
              <span className={cx('relative', isActive ? 'text-a1' : 'text-mute')}>{n.icon ? <n.icon size={19} /> : <MeIcon />}</span>
              <span className={cx('relative', isActive ? 'text-a1' : 'text-mute')}>{n.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}

function MeIcon() {
  const me = useApp((s) => s.me)
  return me ? <CatAvatar who={me.username} size={20} animated={false} /> : null
}

function TopBar({ onSearch, compact }: { onSearch: () => void; compact?: boolean }) {
  const me = useApp((s) => s.me)
  const mode = useApp((s) => s.backend?.mode)
  const navigate = useNavigate()
  return (
    <div className={cx('no-print sticky top-0 z-30 flex items-center gap-3 px-4 py-3 sm:px-6 lg:px-8', compact ? 'bg-ink/70 backdrop-blur-md' : '')}>
      <div className="md:hidden">
        <Logo compact />
      </div>
      <button onClick={onSearch} className="glass flex h-11 min-w-0 flex-1 items-center gap-3 rounded-2xl px-4 text-left text-sm text-mute transition-colors hover:text-white sm:max-w-xl" aria-label="Search songs, tools and pages">
        <Search size={17} className="shrink-0" />
        <span className="truncate">Search songs, artists, chords, tools…</span>
        <span className="ml-auto hidden gap-1 sm:flex">
          <kbd className="kbd">Ctrl</kbd>
          <kbd className="kbd">K</kbd>
        </span>
      </button>
      <div className="ml-auto flex items-center gap-1.5">
        {mode === 'demo' && (
          <span className="hidden rounded-full border border-ember/40 bg-ember/10 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-ember lg:inline" title="Data is stored only in this browser. Configure Supabase to sync between devices.">
            Local demo mode
          </span>
        )}
        <SaveIndicator />
        <SpotifyIndicator />
        <Notifications />
        <button onClick={() => navigate('/profile')} className="hidden items-center gap-2 rounded-full py-1 pl-1 pr-3 transition-colors hover:bg-white/5 sm:flex" aria-label="Profile">
          {me && <CatAvatar who={me.username} size={32} animated={false} />}
          <span className="text-sm font-semibold">{me?.displayName.split(' ')[0]}</span>
        </button>
      </div>
    </div>
  )
}

function SaveIndicator() {
  const status = useApp((s) => s.saveStatus)
  const error = useApp((s) => s.lastError)
  const mode = useApp((s) => s.backend?.mode)
  const [visibleSaved, setVisibleSaved] = useState(false)
  useEffect(() => {
    if (status !== 'saved') return
    setVisibleSaved(true)
    const t = setTimeout(() => setVisibleSaved(false), 1800)
    return () => clearTimeout(t)
  }, [status])
  const where = mode === 'cloud' ? 'Supabase' : 'this browser'
  let content: ReactElement | null = null
  if (status === 'saving') content = <LoaderCircle size={16} className="animate-spin text-mute" />
  else if (status === 'error') content = <TriangleAlert size={16} className="text-rec" />
  else if (visibleSaved) content = <Cloud size={16} className="text-a1" />
  else if (mode === 'demo') content = <CloudOff size={16} className="text-mute" />
  if (!content) return null
  const label = status === 'saving' ? 'Saving…' : status === 'error' ? `Last save failed: ${error}` : visibleSaved ? `Saved to ${where}` : 'Saved locally (demo mode)'
  return (
    <span className="flex h-9 w-9 items-center justify-center rounded-full" title={label} aria-label={label} role="status">
      {content}
    </span>
  )
}

function SpotifyIndicator() {
  const status = useSpotify((s) => s.status)
  const name = useSpotify((s) => s.displayName)
  const navigate = useNavigate()
  const label =
    status === 'connected' ? `Spotify connected${name ? ` as ${name}` : ''}` : status === 'unconfigured' ? 'Spotify not configured' : status === 'expired' ? 'Spotify needs reconnecting' : status === 'loading' ? 'Checking Spotify…' : 'Spotify not connected'
  return (
    <button onClick={() => navigate(status === 'connected' ? '/playlists?tab=spotify' : '/profile#services')} className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/5" title={label} aria-label={label}>
      <SpotifyMark className={cx('h-[18px] w-[18px] transition', status !== 'connected' && 'opacity-35 grayscale')} />
      {status === 'expired' && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-ember" />}
    </button>
  )
}

function Notifications() {
  const [open, setOpen] = useState(false)
  const activity = useApp((s) => s.data.activity)
  const profiles = useApp((s) => s.data.profiles)
  const me = useApp((s) => s.me)
  const history = useToasts((s) => s.history)
  const [seenAt, setSeenAt] = useState(() => Number(localStorage.getItem('alimonus:seen') ?? 0))
  const partnerEvents = activity.filter((a) => a.userId !== me?.id)
  const unread = partnerEvents.filter((a) => new Date(a.createdAt).getTime() > seenAt).length
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const now = Date.now()
    localStorage.setItem('alimonus:seen', String(now))
    setSeenAt(now)
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="relative flex h-9 w-9 items-center justify-center rounded-full text-mute hover:bg-white/5 hover:text-white" aria-label={`Notifications${unread ? ` (${unread} new)` : ''}`} aria-expanded={open}>
        <Bell size={18} />
        {unread > 0 && (
          <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-a3 px-1 text-[0.6rem] font-bold text-white">
            {unread}
          </motion.span>
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -8, scale: 0.97 }} transition={spring} className="panel absolute right-0 top-11 z-50 w-[min(340px,calc(100vw-24px))] p-3">
            <div className="label mb-2 px-1">Activity</div>
            <ul className="max-h-80 overflow-auto">
              {activity.slice(0, 20).map((a) => {
                const who = profiles.find((p) => p.id === a.userId)
                return (
                  <li key={a.id} className="flex items-start gap-2.5 rounded-xl px-1 py-2 text-sm">
                    {who && <CatAvatar who={who.username} size={26} animated={false} />}
                    <div className="min-w-0">
                      <span className="font-semibold">{who?.id === me?.id ? 'You' : who?.displayName.split(' ')[0]}</span> <span className="text-soft">{a.text}</span>
                      <div className="text-xs text-mute">{relativeTime(a.createdAt)}</div>
                    </div>
                  </li>
                )
              })}
              {!activity.length && <li className="px-1 py-3 text-sm text-mute">Nothing yet — cover a song or tick off a roadmap item.</li>}
            </ul>
            {history.length > 0 && (
              <>
                <div className="label mb-1 mt-3 px-1">This session</div>
                <ul className="max-h-40 overflow-auto text-xs text-soft">
                  {history.slice(0, 8).map((h) => (
                    <li key={h.id} className="px-1 py-1">
                      {h.title}
                      {h.body ? <span className="text-mute"> — {h.body}</span> : null}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
