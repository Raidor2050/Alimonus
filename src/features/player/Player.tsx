import { AnimatePresence, motion } from 'motion/react'
import { ChevronDown, ChevronUp, ExternalLink, ListMusic, LoaderCircle, Music, Pause, Play, SkipBack, SkipForward, X, Minimize2 } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { currentTrack, usePlayer } from '@/stores/player'
import { cx, formatSeconds } from '@/lib/util'
import { SpotifyEngine, YouTubeEngine } from './engines'
import { SpotifyMark, YouTubeMark, GeneratedArt } from '@/components/art/Art'
import { spring } from '@/components/ui'

type Rect = { left: number; top: number; width: number; height: number }

const PIP_W = 288
const PIP_H = 162
const SPOTIFY_COMPACT = 80
const SPOTIFY_TALL = 352

/**
 * Persistent bottom player. The provider iframes live in fixed "stages" that glide between
 * a picture-in-picture spot and the expanded panel — the iframe is never re-parented,
 * so playback continues smoothly while the layout animates.
 */
export function Player() {
  const track = usePlayer(currentTrack)
  const { status, position, duration, error, expanded, pipHidden, queue, index } = usePlayer()
  const { toggle, next, prev, seek, setExpanded, setPipHidden, close, playTrack } = usePlayer.getState()
  const ytMount = useRef<HTMLDivElement>(null)
  const spMount = useRef<HTMLDivElement>(null)
  const slotRef = useRef<HTMLDivElement>(null)
  const [slot, setSlot] = useState<Rect | null>(null)
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [seeking, setSeeking] = useState<number | null>(null)

  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useLayoutEffect(() => {
    if (!expanded || !slotRef.current) return
    const el = slotRef.current
    const measure = () => {
      const r = el.getBoundingClientRect()
      setSlot({ left: r.left, top: r.top, width: r.width, height: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    const t = setTimeout(measure, 450) // after the panel's spring settles
    return () => {
      ro.disconnect()
      clearTimeout(t)
    }
  }, [expanded, viewport])

  // Keyboard: "M" toggles the expanded player, media keys work through the engines.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (t.closest('input, textarea, select, [contenteditable="true"]')) return
      if (e.key === 'm' && !e.metaKey && !e.ctrlKey && usePlayer.getState().queue.length) setExpanded(!usePlayer.getState().expanded)
      if (e.key === 'Escape' && usePlayer.getState().expanded) setExpanded(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setExpanded])

  const isMobile = viewport.w < 768
  const barBottom = isMobile ? 72 : 16
  const pip: Rect = isMobile
    ? { left: viewport.w - 176 - 12, top: viewport.h - barBottom - 72 - 99 - 10, width: 176, height: 99 }
    : { left: viewport.w - PIP_W - 24, top: viewport.h - barBottom - 76 - PIP_H - 12, width: PIP_W, height: PIP_H }
  const spPip: Rect = isMobile
    ? { left: 12, top: viewport.h - barBottom - 72 - SPOTIFY_COMPACT - 10, width: viewport.w - 24, height: SPOTIFY_COMPACT }
    : { left: viewport.w - 340 - 24, top: viewport.h - barBottom - 76 - SPOTIFY_COMPACT - 12, width: 340, height: SPOTIFY_COMPACT }

  const source = track?.source
  const ytRect = expanded && slot ? slot : pip
  const spRect = expanded && slot ? { ...slot, height: Math.min(slot.height, SPOTIFY_TALL), top: slot.top + Math.max(0, (slot.height - SPOTIFY_TALL) / 2) } : spPip
  const ytVisible = source === 'youtube' && (expanded || !pipHidden)
  const spVisible = source === 'spotify' && (expanded || !pipHidden)
  const shownPos = seeking ?? position
  const busy = status === 'loading' || status === 'buffering'

  return (
    <>
      {/* Provider stages (always mounted once used) */}
      <motion.div
        className="fixed z-[61] overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-white/10"
        initial={false}
        animate={{ ...ytRect, opacity: ytVisible ? 1 : 0, scale: ytVisible ? 1 : 0.9 }}
        transition={spring}
        style={{ pointerEvents: ytVisible ? 'auto' : 'none' }}
        aria-hidden={!ytVisible}
      >
        <div ref={ytMount} className="h-full w-full [&>div]:h-full [&_iframe]:h-full [&_iframe]:w-full" />
        {!expanded && ytVisible && (
          <button className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1 text-white/80 hover:text-white" onClick={() => setPipHidden(true)} aria-label="Hide video (pauses YouTube)" title="Hide video (pauses)">
            <Minimize2 size={13} />
          </button>
        )}
      </motion.div>
      <motion.div
        className="fixed z-[61] overflow-hidden rounded-2xl"
        initial={false}
        animate={{ ...spRect, opacity: spVisible ? 1 : 0 }}
        transition={spring}
        style={{ pointerEvents: spVisible ? 'auto' : 'none' }}
        aria-hidden={!spVisible}
      >
        <div ref={spMount} className="h-full w-full [&_iframe]:h-full [&_iframe]:w-full" />
      </motion.div>
      <YouTubeEngine mountRef={ytMount} />
      <SpotifyEngine mountRef={spMount} height={SPOTIFY_TALL} />

      {/* Expanded panel */}
      <AnimatePresence>
        {expanded && track && (
          <motion.div className="fixed inset-0 z-[58]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setExpanded(false)} />
            <motion.div
              className="panel absolute inset-x-3 top-3 flex flex-col gap-4 overflow-hidden p-4 md:inset-x-8 md:top-8 md:flex-row md:p-6"
              style={{ bottom: barBottom + 84 }}
              initial={{ y: 80, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 60, opacity: 0, scale: 0.97 }}
              transition={spring}
            >
              <div className="relative min-h-[200px] flex-1 overflow-hidden rounded-2xl bg-black/60">
                <div ref={slotRef} className="absolute inset-0" />
                {source === 'spotify' && !track.spotifyUri && <div className="absolute inset-0 flex items-center justify-center text-mute">No Spotify track</div>}
              </div>
              <div className="flex w-full flex-col gap-4 overflow-hidden md:w-80">
                <div className="flex items-start gap-3">
                  <TrackArt track={track} className="h-16 w-16 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="display truncate text-lg font-bold">{track.title}</div>
                    <div className="truncate text-sm text-mute">{track.artist}</div>
                    <SourceBadge source={track.source} />
                  </div>
                  <button className="btn btn-ghost btn-icon" onClick={() => setExpanded(false)} aria-label="Collapse player">
                    <ChevronDown size={18} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {track.songId && (
                    <Link to={`/song/${track.songId}`} className="btn" onClick={() => setExpanded(false)}>
                      <Music size={15} /> Open chord sheet
                    </Link>
                  )}
                  <a className="btn" href={sourceUrl(track)} target="_blank" rel="noreferrer">
                    <ExternalLink size={15} /> Open in {track.source === 'youtube' ? 'YouTube' : 'Spotify'}
                  </a>
                </div>
                {track.source === 'spotify' && (
                  <p className="text-xs text-mute">Spotify plays 30-second previews unless you’re signed in to Spotify in this browser. Controls use Spotify’s official embed.</p>
                )}
                <div className="min-h-0 flex-1 overflow-auto">
                  <div className="label mb-2 flex items-center gap-2">
                    <ListMusic size={13} /> Up next
                  </div>
                  <ol className="flex flex-col gap-1">
                    {queue.map((t, i) => (
                      <li key={t.key}>
                        <button
                          onClick={() => playTrack(t, queue)}
                          className={cx('flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left text-sm transition-colors', i === index ? 'bg-a1/10 text-a1' : 'hover:bg-white/5')}
                        >
                          <span className="w-5 text-right font-mono text-xs text-mute">{i + 1}</span>
                          <span className="min-w-0 flex-1 truncate">{t.title}</span>
                          {t.source === 'youtube' ? <YouTubeMark className="h-3.5 w-3.5" /> : <SpotifyMark className="h-3.5 w-3.5" />}
                        </button>
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini bar */}
      <AnimatePresence>
        {track && (
          <motion.div
            className="no-print fixed inset-x-2 z-[60] md:inset-x-auto md:left-1/2 md:w-[min(920px,calc(100vw-7rem))] md:-translate-x-1/2"
            style={{ bottom: barBottom }}
            initial={{ y: 120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 120, opacity: 0 }}
            transition={spring}
          >
            <div className="glass relative overflow-hidden rounded-[22px] px-3 py-2.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.9)]">
              {/* progress line */}
              <div className="absolute inset-x-0 top-0 h-[2px] bg-white/5">
                <motion.div className="h-full bg-gradient-to-r from-a1 to-a2" animate={{ width: duration ? `${(shownPos / duration) * 100}%` : '0%' }} transition={{ type: 'tween', duration: 0.4 }} />
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setExpanded(!expanded)} className="group relative shrink-0" aria-label={expanded ? 'Collapse player' : 'Expand player'}>
                  <TrackArt track={track} className={cx('h-11 w-11', status === 'playing' && 'ring-2 ring-a1/60')} />
                  {status === 'playing' && <Equalizer />}
                </button>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-semibold">{track.title}</span>
                    {track.source === 'youtube' ? <YouTubeMark className="h-3.5 w-3.5 shrink-0" /> : <SpotifyMark className="h-3.5 w-3.5 shrink-0" />}
                  </div>
                  <div className="truncate text-xs text-mute">{error ? <span className="text-ember">{error}</span> : track.artist}</div>
                  <div className="mt-1 hidden items-center gap-2 sm:flex">
                    <span className="w-9 text-right font-mono text-[0.65rem] text-mute">{formatSeconds(shownPos)}</span>
                    <input
                      type="range"
                      min={0}
                      max={duration || 0}
                      step={0.5}
                      value={Math.min(shownPos, duration || 0)}
                      disabled={!duration}
                      onChange={(e) => setSeeking(Number(e.target.value))}
                      onPointerUp={() => {
                        if (seeking !== null) seek(seeking)
                        setSeeking(null)
                      }}
                      onKeyUp={() => {
                        if (seeking !== null) seek(seeking)
                        setSeeking(null)
                      }}
                      className="h-1 flex-1 cursor-pointer accent-[var(--a1)]"
                      aria-label="Seek"
                    />
                    <span className="w-9 font-mono text-[0.65rem] text-mute">{formatSeconds(duration)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  <button className="btn btn-ghost btn-icon hidden sm:inline-flex" onClick={prev} aria-label="Previous / restart">
                    <SkipBack size={17} />
                  </button>
                  <motion.button whileTap={{ scale: 0.88 }} className="btn btn-primary btn-icon h-10 w-10" onClick={toggle} aria-label={status === 'playing' ? 'Pause' : 'Play'} disabled={status === 'error' && !duration}>
                    {busy ? <LoaderCircle size={18} className="animate-spin" /> : status === 'playing' ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" className="ml-0.5" />}
                  </motion.button>
                  <button className="btn btn-ghost btn-icon" onClick={next} disabled={index >= queue.length - 1} aria-label="Next">
                    <SkipForward size={17} />
                  </button>
                  {pipHidden && !expanded && (
                    <button className="btn btn-ghost btn-icon hidden sm:inline-flex" onClick={() => setPipHidden(false)} aria-label="Show video">
                      {track.source === 'youtube' ? <YouTubeMark className="h-4 w-4" /> : <SpotifyMark className="h-4 w-4" />}
                    </button>
                  )}
                  <button className="btn btn-ghost btn-icon" onClick={() => setExpanded(!expanded)} aria-label={expanded ? 'Collapse player' : 'Expand player'}>
                    <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={spring} className="flex">
                      <ChevronUp size={18} />
                    </motion.span>
                  </button>
                  <button className="btn btn-ghost btn-icon hidden sm:inline-flex" onClick={close} aria-label="Close player">
                    <X size={16} />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function TrackArt({ track, className }: { track: { key: string; title: string; artworkUrl: string | null }; className?: string }) {
  return track.artworkUrl ? (
    <img src={track.artworkUrl} alt="" className={cx('rounded-xl object-cover', className)} />
  ) : (
    <GeneratedArt seed={track.key} title={track.title} className={cx('rounded-xl text-[0.5rem]', className)} />
  )
}

function Equalizer() {
  return (
    <span className="pointer-events-none absolute inset-0 flex items-end justify-center gap-[2px] rounded-xl bg-black/40 pb-2">
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="w-[3px] rounded-full bg-a1" style={{ height: 14, animation: `eqbar 0.8s ${i * 0.15}s ease-in-out infinite alternate`, transformOrigin: 'bottom' }} />
      ))}
      <style>{`@keyframes eqbar { from { transform: scaleY(0.25) } to { transform: scaleY(1) } }`}</style>
    </span>
  )
}

function SourceBadge({ source }: { source: 'youtube' | 'spotify' }) {
  return (
    <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-mute">
      {source === 'youtube' ? <YouTubeMark className="h-3.5 w-3.5" /> : <SpotifyMark className="h-3.5 w-3.5" />}
      {source === 'youtube' ? 'YouTube' : 'Spotify'}
    </span>
  )
}

function sourceUrl(t: { source: string; youtubeId?: string; spotifyUri?: string }) {
  if (t.source === 'youtube') return `https://www.youtube.com/watch?v=${t.youtubeId}`
  const id = t.spotifyUri?.split(':').pop()
  return `https://open.spotify.com/track/${id}`
}
