import { useEffect, useRef } from 'react'
import { loadYouTubeApi, YT_ERRORS } from '@/integrations/youtube'
import { usePlayer, currentTrack } from '@/stores/player'

/**
 * YouTube IFrame Player engine. Creates one player for the app's lifetime and swaps
 * videos with loadVideoById, so changing tracks never reloads the page.
 */
export function YouTubeEngine({ mountRef }: { mountRef: React.RefObject<HTMLDivElement | null> }) {
  const playerRef = useRef<YT.Player | null>(null)
  const readyRef = useRef(false)
  const track = usePlayer(currentTrack)
  const nonce = usePlayer((s) => s.nonce)
  const report = usePlayer((s) => s.report)
  const registerEngine = usePlayer((s) => s.registerEngine)
  const active = track?.source === 'youtube'
  const videoId = active ? track?.youtubeId : undefined

  // Create the player lazily the first time a YouTube track is requested.
  useEffect(() => {
    if (!videoId || playerRef.current || !mountRef.current) return
    let cancelled = false
    const host = document.createElement('div')
    mountRef.current.appendChild(host)
    loadYouTubeApi()
      .then((YTns) => {
        if (cancelled) return
        playerRef.current = new YTns.Player(host, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1, origin: window.location.origin },
          events: {
            onReady: (e) => {
              readyRef.current = true
              report({ status: 'ready', duration: e.target.getDuration() || 0 })
              const latest = currentTrack(usePlayer.getState())
              if (latest?.source === 'youtube' && latest.youtubeId && latest.youtubeId !== videoId) e.target.loadVideoById(latest.youtubeId)
              else e.target.playVideo()
            },
            onStateChange: (e) => {
              // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
              const map: Record<number, Parameters<typeof report>[0]['status']> = { 0: 'ended', 1: 'playing', 2: 'paused', 3: 'buffering', 5: 'ready' }
              const status = map[e.data]
              if (status) report({ status, duration: e.target.getDuration() || usePlayer.getState().duration, error: null })
              if (e.data === 0) usePlayer.getState().next()
            },
            onError: (e) => report({ status: 'error', error: `${YT_ERRORS[e.data] ?? 'YouTube playback error.'} (code ${e.data})` }),
            onAutoplayBlocked: () => report({ status: 'paused', error: 'Your browser blocked autoplay — press play.' }),
          },
        })
      })
      .catch((err: Error) => report({ status: 'error', error: err.message }))
    return () => {
      cancelled = true
    }
  }, [videoId, mountRef, report])

  // Swap videos on new play requests.
  useEffect(() => {
    if (!videoId || !playerRef.current || !readyRef.current) return
    playerRef.current.loadVideoById(videoId)
  }, [videoId, nonce])

  // Pause YouTube when switching to another source.
  useEffect(() => {
    if (!active && readyRef.current) playerRef.current?.pauseVideo()
  }, [active])

  useEffect(() => {
    registerEngine('youtube', {
      play: () => playerRef.current?.playVideo(),
      pause: () => playerRef.current?.pauseVideo(),
      seek: (s) => playerRef.current?.seekTo(s, true),
    })
    return () => registerEngine('youtube', null)
  }, [registerEngine])

  // Progress polling while playing.
  useEffect(() => {
    const id = setInterval(() => {
      const p = playerRef.current
      const s = usePlayer.getState()
      if (!p || !readyRef.current || currentTrack(s)?.source !== 'youtube') return
      if (s.status === 'playing' || s.status === 'buffering') report({ position: p.getCurrentTime(), duration: p.getDuration() || s.duration })
    }, 500)
    return () => clearInterval(id)
  }, [report])

  useEffect(
    () => () => {
      playerRef.current?.destroy()
      playerRef.current = null
      readyRef.current = false
    },
    [],
  )

  return null
}

/* ---------- Spotify Embed iFrame API ---------- */

interface SpotifyController {
  loadUri(uri: string, preferVideo?: boolean, startAt?: number): void
  play(): void
  pause(): void
  resume(): void
  togglePlay(): void
  seek(seconds: number): void
  destroy(): void
  addListener(event: string, cb: (e: { data: { isPaused: boolean; isBuffering: boolean; duration: number; position: number } }) => void): void
}
interface SpotifyIFrameAPI {
  createController(el: HTMLElement, opts: { uri: string; width?: string | number; height?: string | number }, cb: (c: SpotifyController) => void): void
}
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void
  }
}

let spotifyApi: Promise<SpotifyIFrameAPI> | null = null
function loadSpotifyEmbedApi(): Promise<SpotifyIFrameAPI> {
  if (spotifyApi) return spotifyApi
  spotifyApi = new Promise((resolve, reject) => {
    window.onSpotifyIframeApiReady = (api) => resolve(api)
    const s = document.createElement('script')
    s.src = 'https://open.spotify.com/embed/iframe-api/v1'
    s.async = true
    s.onerror = () => {
      spotifyApi = null
      reject(new Error('Couldn’t load the Spotify player (offline or blocked?).'))
    }
    document.head.appendChild(s)
  })
  return spotifyApi
}

/**
 * Spotify's embed: controls via the official iFrame API. Logged-out listeners get
 * 30-second previews; signing into Spotify in the same browser plays full tracks
 * (Spotify's behaviour, not something this app controls).
 */
export function SpotifyEngine({ mountRef, height }: { mountRef: React.RefObject<HTMLDivElement | null>; height: number }) {
  const ctrlRef = useRef<SpotifyController | null>(null)
  const track = usePlayer(currentTrack)
  const nonce = usePlayer((s) => s.nonce)
  const report = usePlayer((s) => s.report)
  const registerEngine = usePlayer((s) => s.registerEngine)
  const uri = track?.source === 'spotify' ? track.spotifyUri : undefined
  const creating = useRef(false)

  useEffect(() => {
    if (!uri || !mountRef.current) return
    if (ctrlRef.current) {
      ctrlRef.current.loadUri(uri)
      ctrlRef.current.play()
      return
    }
    if (creating.current) return
    creating.current = true
    const host = document.createElement('div')
    mountRef.current.appendChild(host)
    loadSpotifyEmbedApi()
      .then((api) =>
        api.createController(host, { uri, width: '100%', height }, (c) => {
          ctrlRef.current = c
          c.addListener('ready', () => {
            report({ status: 'ready' })
            c.play()
          })
          c.addListener('playback_update', (e) => {
            const d = e.data
            report({ status: d.isBuffering ? 'buffering' : d.isPaused ? 'paused' : 'playing', position: d.position / 1000, duration: d.duration / 1000, error: null })
          })
        }),
      )
      .catch((err: Error) => report({ status: 'error', error: err.message }))
      .finally(() => {
        creating.current = false
      })
  }, [uri, nonce, mountRef, height, report])

  useEffect(() => {
    if (!uri) ctrlRef.current?.pause()
  }, [uri])

  useEffect(() => {
    registerEngine('spotify', {
      play: () => ctrlRef.current?.resume(),
      pause: () => ctrlRef.current?.pause(),
      seek: (s) => ctrlRef.current?.seek(s),
    })
    return () => registerEngine('spotify', null)
  }, [registerEngine])

  useEffect(
    () => () => {
      ctrlRef.current?.destroy()
      ctrlRef.current = null
    },
    [],
  )
  return null
}
