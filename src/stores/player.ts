import { create } from 'zustand'

export type PlayerSource = 'youtube' | 'spotify'

export interface Track {
  /** Unique per source+id so the same song from two providers are different tracks. */
  key: string
  songId: string | null
  title: string
  artist: string
  artworkUrl: string | null
  source: PlayerSource
  youtubeId?: string
  spotifyUri?: string
}

export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'playing' | 'paused' | 'buffering' | 'ended' | 'error'

/** Engines (YouTube/Spotify) register their controls here so the UI stays provider-agnostic. */
export interface EngineControls {
  play(): void
  pause(): void
  seek(seconds: number): void
}

interface PlayerState {
  queue: Track[]
  index: number
  status: PlayerStatus
  position: number
  duration: number
  error: string | null
  expanded: boolean
  pipHidden: boolean
  /** Bumps on every explicit play request so engines reload even for the same track. */
  nonce: number
  engines: Partial<Record<PlayerSource, EngineControls>>

  playTrack(track: Track, queue?: Track[]): void
  next(): void
  prev(): void
  toggle(): void
  seek(seconds: number): void
  close(): void
  setExpanded(v: boolean): void
  setPipHidden(v: boolean): void
  report(p: Partial<Pick<PlayerState, 'status' | 'position' | 'duration' | 'error'>>): void
  registerEngine(source: PlayerSource, controls: EngineControls | null): void
}

export const usePlayer = create<PlayerState>((set, get) => ({
  queue: [],
  index: -1,
  status: 'idle',
  position: 0,
  duration: 0,
  error: null,
  expanded: false,
  pipHidden: false,
  nonce: 0,
  engines: {},

  playTrack(track, queue) {
    const q = queue && queue.some((t) => t.key === track.key) ? queue : [track]
    set((s) => ({ queue: q, index: q.findIndex((t) => t.key === track.key), status: 'loading', position: 0, duration: 0, error: null, nonce: s.nonce + 1, pipHidden: false }))
  },
  next() {
    const { queue, index } = get()
    if (index < queue.length - 1) set((s) => ({ index: index + 1, status: 'loading', position: 0, duration: 0, error: null, nonce: s.nonce + 1 }))
  },
  prev() {
    const { index, position, queue } = get()
    if (position > 4 || index <= 0) {
      get().seek(0)
      return
    }
    if (queue.length) set((s) => ({ index: index - 1, status: 'loading', position: 0, duration: 0, error: null, nonce: s.nonce + 1 }))
  },
  toggle() {
    const { status, engines, queue, index } = get()
    const track = queue[index]
    if (!track) return
    const engine = engines[track.source]
    if (!engine) return
    if (status === 'playing' || status === 'buffering') engine.pause()
    else engine.play()
  },
  seek(seconds) {
    const track = get().queue[get().index]
    if (!track) return
    get().engines[track.source]?.seek(seconds)
    set({ position: seconds })
  },
  close() {
    const { engines } = get()
    engines.youtube?.pause()
    engines.spotify?.pause()
    set({ queue: [], index: -1, status: 'idle', position: 0, duration: 0, error: null, expanded: false })
  },
  setExpanded(v) {
    set({ expanded: v })
  },
  setPipHidden(v) {
    set({ pipHidden: v })
    if (v) get().engines.youtube?.pause()
  },
  report(p) {
    set(p)
  },
  registerEngine(source, controls) {
    set((s) => {
      const engines = { ...s.engines }
      if (controls) engines[source] = controls
      else delete engines[source]
      return { engines }
    })
  },
}))

export const currentTrack = (s: PlayerState) => s.queue[s.index] ?? null
