import { env } from '@/lib/env'
import { isoDurationToMs } from '@/lib/util'

export interface YouTubeResult {
  videoId: string
  title: string
  channel: string
  thumbnail: string
  durationMs: number | null
  url: string
}

export class YouTubeNotConfigured extends Error {
  constructor() {
    super('YouTube search isn’t configured yet. Add a YouTube Data API key (see README) — or paste a video link below.')
  }
}

const CACHE_KEY = 'alimonus:yt-cache:v1'

// search.list is limited to roughly 100 calls/day per project, so cache aggressively.
function cacheGet(q: string): YouTubeResult[] | null {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { at: number; r: YouTubeResult[] }>
    const hit = all[q.toLowerCase()]
    if (hit && Date.now() - hit.at < 1000 * 60 * 60 * 24 * 7) return hit.r
  } catch {
    /* ignore */
  }
  return null
}
function cacheSet(q: string, r: YouTubeResult[]) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, { at: number; r: YouTubeResult[] }>
    all[q.toLowerCase()] = { at: Date.now(), r }
    const entries = Object.entries(all).sort((a, b) => b[1].at - a[1].at).slice(0, 80)
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)))
  } catch {
    /* ignore */
  }
}

const decode = (s: string) => {
  const t = document.createElement('textarea')
  t.innerHTML = s
  return t.value
}

/**
 * Search YouTube. Uses VITE_YOUTUBE_API_KEY directly when present (restrict it by HTTP
 * referrer in Google Cloud), otherwise the /api/youtube-search Netlify Function which
 * keeps YOUTUBE_API_KEY server-side.
 */
export async function searchYouTube(q: string, signal?: AbortSignal): Promise<YouTubeResult[]> {
  const query = q.trim()
  if (!query) return []
  const cached = cacheGet(query)
  if (cached) return cached

  let results: YouTubeResult[]
  if (env.youtubeApiKey) {
    const p = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '8', q: query, key: env.youtubeApiKey })
    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${p}`, { signal })
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error?.message ?? `YouTube search failed (${res.status})`)
    const items = (json.items ?? []) as { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> } }[]
    const ids = items.map((i) => i.id.videoId).join(',')
    const durations: Record<string, number | null> = {}
    if (ids) {
      const vp = new URLSearchParams({ part: 'contentDetails', id: ids, key: env.youtubeApiKey })
      const vres = await fetch(`https://www.googleapis.com/youtube/v3/videos?${vp}`, { signal })
      if (vres.ok) for (const v of (await vres.json()).items ?? []) durations[v.id] = isoDurationToMs(v.contentDetails?.duration ?? '')
    }
    results = items.map((i) => ({
      videoId: i.id.videoId,
      title: decode(i.snippet.title),
      channel: decode(i.snippet.channelTitle),
      thumbnail: i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? '',
      durationMs: durations[i.id.videoId] ?? null,
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
    }))
  } else {
    let res: Response
    try {
      res = await fetch(`/api/youtube-search?q=${encodeURIComponent(query)}`, { signal })
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      throw new YouTubeNotConfigured()
    }
    const type = res.headers.get('content-type') ?? ''
    if (res.status === 404 || res.status === 501 || !type.includes('json')) throw new YouTubeNotConfigured()
    const json = await res.json()
    if (!res.ok) throw new Error(json?.error ?? `YouTube search failed (${res.status})`)
    results = json.results as YouTubeResult[]
  }
  cacheSet(query, results)
  return results
}

export function youtubeSearchUrl(q: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`
}

/** Accepts a bare 11-char id or any youtube.com / youtu.be / music.youtube.com link. */
export function parseYouTubeId(input: string): string | null {
  const s = input.trim()
  if (/^[\w-]{11}$/.test(s)) return s
  try {
    const u = new URL(s)
    if (u.hostname.endsWith('youtu.be')) return u.pathname.slice(1, 12) || null
    if (u.hostname.includes('youtube.com')) {
      const v = u.searchParams.get('v')
      if (v && /^[\w-]{11}$/.test(v)) return v
      const m = /\/(embed|shorts|live)\/([\w-]{11})/.exec(u.pathname)
      if (m) return m[2]
    }
  } catch {
    /* not a URL */
  }
  return null
}

/* ---------- IFrame Player API loader ---------- */

declare global {
  interface Window {
    YT?: typeof YT
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<typeof YT> | null = null

export function loadYouTubeApi(): Promise<typeof YT> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (apiPromise) return apiPromise
  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      prev?.()
      resolve(window.YT!)
    }
    const s = document.createElement('script')
    s.src = 'https://www.youtube.com/iframe_api'
    s.async = true
    s.onerror = () => {
      apiPromise = null
      reject(new Error('Couldn’t load the YouTube player (offline or blocked by an extension?).'))
    }
    document.head.appendChild(s)
  })
  return apiPromise
}

export const YT_ERRORS: Record<number, string> = {
  2: 'That video ID looks invalid.',
  5: 'The YouTube player hit an HTML5 playback error.',
  100: 'This video was removed or is private.',
  101: 'The owner doesn’t allow this video to be embedded. Open it on YouTube or pick another video.',
  150: 'The owner doesn’t allow this video to be embedded. Open it on YouTube or pick another video.',
  153: 'YouTube rejected the embed request (missing referrer). Check your site’s Referrer-Policy.',
}

/* Minimal ambient types for the parts of the IFrame API we use. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace YT {
    interface PlayerOptions {
      height?: string | number
      width?: string | number
      videoId?: string
      playerVars?: Record<string, string | number>
      events?: {
        onReady?: (e: { target: Player }) => void
        onStateChange?: (e: { data: number; target: Player }) => void
        onError?: (e: { data: number }) => void
        onAutoplayBlocked?: () => void
      }
    }
    class Player {
      constructor(el: HTMLElement | string, opts: PlayerOptions)
      loadVideoById(id: string, start?: number): void
      cueVideoById(id: string): void
      playVideo(): void
      pauseVideo(): void
      seekTo(s: number, allowSeekAhead: boolean): void
      getCurrentTime(): number
      getDuration(): number
      getPlayerState(): number
      destroy(): void
    }
  }
}
