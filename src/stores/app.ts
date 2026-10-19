import { create } from 'zustand'
import { getBackend, type Backend } from '@/lib/backend'
import { uid } from '@/lib/util'
import { toast } from './toasts'
import {
  DEFAULT_SETTINGS,
  type ActivityEvent,
  type Playlist,
  type PlaylistItem,
  type Profile,
  type RoadmapItem,
  type Settings,
  type Snapshot,
  type Song,
  type UserSongState,
  type Username,
} from '@/types'

const EMPTY: Snapshot = { profiles: [], songs: [], states: [], playlists: [], items: [], roadmap: [], activity: [] }

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface AppState {
  backend: Backend | null
  booting: boolean
  me: Profile | null
  data: Snapshot
  pending: number
  saveStatus: SaveStatus
  lastError: string | null

  init(): Promise<void>
  signIn(username: Username, password: string): Promise<void>
  signOut(): Promise<void>
  refresh(): Promise<void>

  toggleWishlist(songId: string): void
  toggleCovered(songId: string): void
  touchSong(songId: string): void
  setSongPrefs(songId: string, patch: Partial<Pick<UserSongState, 'transpose' | 'capo' | 'notes'>>): void

  saveSong(song: Song): Promise<void>
  createSong(p: Partial<Song> & Pick<Song, 'title' | 'artist'>): Song
  deleteSong(id: string): void

  createPlaylist(p: Partial<Playlist> & Pick<Playlist, 'name'>): Playlist
  updatePlaylist(id: string, patch: Partial<Playlist>): void
  deletePlaylist(id: string): void
  addToPlaylist(playlistId: string, songId: string): void
  removeFromPlaylist(itemId: string): void
  reorderPlaylist(playlistId: string, orderedItemIds: string[]): void

  saveRoadmap(item: RoadmapItem): void
  createRoadmap(p: Partial<RoadmapItem> & Pick<RoadmapItem, 'title'>): RoadmapItem
  deleteRoadmap(id: string): void

  updateProfile(patch: Partial<Pick<Profile, 'displayName' | 'tagline' | 'bio'>>): void
  updateSettings(patch: Partial<Settings>): void
}

const nowIso = () => new Date().toISOString()

export function emptyState(userId: string, songId: string): UserSongState {
  return { userId, songId, wishlist: false, covered: false, coveredAt: null, notes: '', lastOpenedAt: null, transpose: 0, capo: 0 }
}

export const useApp = create<AppState>((set, get) => {
  /** Run a write against the backend, tracking status; on failure, tell the user and resync. */
  const persist = (label: string, fn: (b: Backend) => Promise<void>) => {
    const b = get().backend
    if (!b) return Promise.resolve()
    set((s) => ({ pending: s.pending + 1, saveStatus: 'saving' }))
    return fn(b)
      .then(() => {
        set((s) => ({ pending: s.pending - 1, saveStatus: s.pending - 1 > 0 ? 'saving' : 'saved' }))
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err)
        set((s) => ({ pending: s.pending - 1, saveStatus: 'error', lastError: message }))
        toast({ tone: 'error', title: `Couldn’t save ${label}`, body: `${message} — your screen was resynced with what's actually stored.` }, 7000)
        void get().refresh()
      })
  }

  const patchData = (fn: (d: Snapshot) => Partial<Snapshot>) => set((s) => ({ data: { ...s.data, ...fn(s.data) } }))

  const log = (kind: ActivityEvent['kind'], text: string, songId: string | null = null) => {
    const me = get().me
    if (!me) return
    const e: ActivityEvent = { id: uid(), userId: me.id, kind, text, songId, createdAt: nowIso() }
    patchData((d) => ({ activity: [e, ...d.activity].slice(0, 60) }))
    void persist('activity', (b) => b.logActivity(e))
  }

  const updateState = (songId: string, fn: (s: UserSongState) => UserSongState) => {
    const me = get().me
    if (!me) return null
    const current = get().data.states.find((s) => s.userId === me.id && s.songId === songId) ?? emptyState(me.id, songId)
    const next = fn(current)
    patchData((d) => ({ states: [...d.states.filter((s) => !(s.userId === me.id && s.songId === songId)), next] }))
    void persist('song status', (b) => b.upsertState(next))
    return next
  }

  return {
    backend: null,
    booting: true,
    me: null,
    data: EMPTY,
    pending: 0,
    saveStatus: 'idle',
    lastError: null,

    async init() {
      const backend = await getBackend()
      set({ backend })
      try {
        const me = await backend.restore()
        if (me) {
          const data = await backend.load()
          set({ me: data.profiles.find((p) => p.id === me.id) ?? me, data })
        }
      } catch (err) {
        toast({ tone: 'error', title: 'Couldn’t restore your session', body: err instanceof Error ? err.message : String(err) })
      }
      set({ booting: false })
      backend.subscribe(() => void get().refresh())
    },

    async signIn(username, password) {
      const backend = get().backend ?? (await getBackend())
      const me = await backend.signIn(username, password)
      const data = await backend.load()
      set({ backend, me: data.profiles.find((p) => p.id === me.id) ?? me, data })
    },

    async signOut() {
      await get().backend?.signOut()
      set({ me: null, data: EMPTY })
    },

    async refresh() {
      const { backend, me } = get()
      if (!backend || !me) return
      try {
        const data = await backend.load()
        set({ data, me: data.profiles.find((p) => p.id === me.id) ?? me })
      } catch (err) {
        set({ saveStatus: 'error', lastError: err instanceof Error ? err.message : String(err) })
      }
    },

    toggleWishlist(songId) {
      const next = updateState(songId, (s) => ({ ...s, wishlist: !s.wishlist }))
      const song = get().data.songs.find((s) => s.id === songId)
      if (next?.wishlist && song) log('wishlist', `wishlisted “${song.title}”`, songId)
    },

    toggleCovered(songId) {
      const next = updateState(songId, (s) => ({ ...s, covered: !s.covered, coveredAt: s.covered ? null : nowIso() }))
      const { me, data } = get()
      const song = data.songs.find((s) => s.id === songId)
      if (!next?.covered || !song || !me) return
      log('covered', `covered “${song.title}”`, songId)
      const partnerCovered = data.states.some((s) => s.songId === songId && s.userId !== me.id && s.covered)
      if (partnerCovered) toast({ tone: 'celebrate', title: 'Duet unlocked ✦', body: `You’ve both covered “${song.title}”.` }, 5000)
    },

    touchSong(songId) {
      updateState(songId, (s) => ({ ...s, lastOpenedAt: nowIso() }))
    },

    setSongPrefs(songId, patch) {
      updateState(songId, (s) => ({ ...s, ...patch }))
    },

    async saveSong(song) {
      const next = { ...song, updatedAt: nowIso() }
      patchData((d) => ({ songs: d.songs.some((s) => s.id === song.id) ? d.songs.map((s) => (s.id === song.id ? next : s)) : [...d.songs, next] }))
      await persist('song', (b) => b.upsertSong(next))
    },

    createSong(p) {
      const me = get().me
      const song: Song = {
        id: uid(),
        album: null,
        altTitles: [],
        artworkUrl: null,
        durationMs: null,
        releaseYear: null,
        genre: null,
        key: null,
        bpm: null,
        description: null,
        credits: null,
        spotifyId: null,
        youtubeId: null,
        chordSheet: null,
        progression: null,
        chordSource: null,
        provenance: null,
        createdBy: me?.id ?? null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...p,
      }
      patchData((d) => ({ songs: [...d.songs, song] }))
      void persist('song', (b) => b.upsertSong(song))
      log('song', `added “${song.title}” to the Chordbook`, song.id)
      return song
    },

    deleteSong(id) {
      patchData((d) => ({ songs: d.songs.filter((s) => s.id !== id), items: d.items.filter((i) => i.songId !== id) }))
      void persist('song', (b) => b.deleteSong(id))
    },

    createPlaylist(p) {
      const me = get().me!
      const pl: Playlist = { id: uid(), ownerId: me.id, description: '', shared: false, kind: 'playlist', color: '#a3e635', createdAt: nowIso(), updatedAt: nowIso(), ...p }
      patchData((d) => ({ playlists: [...d.playlists, pl] }))
      void persist('playlist', (b) => b.upsertPlaylist(pl))
      log('playlist', `created ${pl.shared ? 'shared ' : ''}${pl.kind} “${pl.name}”`)
      return pl
    },

    updatePlaylist(id, patch) {
      const pl = get().data.playlists.find((p) => p.id === id)
      if (!pl) return
      const next = { ...pl, ...patch, updatedAt: nowIso() }
      patchData((d) => ({ playlists: d.playlists.map((p) => (p.id === id ? next : p)) }))
      void persist('playlist', (b) => b.upsertPlaylist(next))
    },

    deletePlaylist(id) {
      patchData((d) => ({ playlists: d.playlists.filter((p) => p.id !== id), items: d.items.filter((i) => i.playlistId !== id) }))
      void persist('playlist', (b) => b.deletePlaylist(id))
    },

    addToPlaylist(playlistId, songId) {
      const { data, me } = get()
      if (!me) return
      if (data.items.some((i) => i.playlistId === playlistId && i.songId === songId)) {
        toast({ tone: 'info', title: 'Already in that playlist' })
        return
      }
      const position = Math.max(-1, ...data.items.filter((i) => i.playlistId === playlistId).map((i) => i.position)) + 1
      const item: PlaylistItem = { id: uid(), playlistId, songId, position, addedBy: me.id }
      patchData((d) => ({ items: [...d.items, item] }))
      void persist('playlist', (b) => b.upsertItems([item]))
      const pl = data.playlists.find((p) => p.id === playlistId)
      const song = data.songs.find((s) => s.id === songId)
      toast({ tone: 'success', title: `Added to ${pl?.name ?? 'playlist'}`, body: song?.title })
    },

    removeFromPlaylist(itemId) {
      patchData((d) => ({ items: d.items.filter((i) => i.id !== itemId) }))
      void persist('playlist', (b) => b.deleteItems([itemId]))
    },

    reorderPlaylist(playlistId, orderedItemIds) {
      const items = get().data.items
      const changed: PlaylistItem[] = []
      const next = items.map((i) => {
        if (i.playlistId !== playlistId) return i
        const position = orderedItemIds.indexOf(i.id)
        if (position === -1 || position === i.position) return i
        const updated = { ...i, position }
        changed.push(updated)
        return updated
      })
      patchData(() => ({ items: next }))
      if (changed.length) void persist('playlist order', (b) => b.upsertItems(changed))
    },

    saveRoadmap(item) {
      const prev = get().data.roadmap.find((r) => r.id === item.id)
      const next = {
        ...item,
        completedAt: item.status === 'done' ? (item.completedAt ?? nowIso()) : null,
        updatedAt: nowIso(),
      }
      patchData((d) => ({ roadmap: d.roadmap.some((r) => r.id === item.id) ? d.roadmap.map((r) => (r.id === item.id ? next : r)) : [...d.roadmap, next] }))
      void persist('roadmap', (b) => b.upsertRoadmap(next))
      if (prev && prev.status !== 'done' && next.status === 'done') {
        log('roadmap', `completed “${next.title}”`)
        if (next.category === 'milestone') toast({ tone: 'celebrate', title: 'Milestone reached ✦', body: next.title }, 5000)
      }
    },

    createRoadmap(p) {
      const me = get().me!
      const position = Math.max(-1, ...get().data.roadmap.map((r) => r.position)) + 1
      const item: RoadmapItem = {
        id: uid(),
        ownerId: me.id,
        shared: false,
        description: '',
        status: 'todo',
        priority: 'medium',
        category: 'task',
        startDate: null,
        dueDate: null,
        position,
        completedAt: null,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        ...p,
      }
      patchData((d) => ({ roadmap: [...d.roadmap, item] }))
      void persist('roadmap', (b) => b.upsertRoadmap(item))
      return item
    },

    deleteRoadmap(id) {
      patchData((d) => ({ roadmap: d.roadmap.filter((r) => r.id !== id) }))
      void persist('roadmap', (b) => b.deleteRoadmap(id))
    },

    updateProfile(patch) {
      const me = get().me
      if (!me) return
      const next = { ...me, ...patch }
      set({ me: next })
      patchData((d) => ({ profiles: d.profiles.map((p) => (p.id === me.id ? next : p)) }))
      void persist('profile', (b) => b.saveProfile(next))
    },

    updateSettings(patch) {
      const me = get().me
      if (!me) return
      const next = { ...me, settings: { ...DEFAULT_SETTINGS, ...me.settings, ...patch } }
      set({ me: next })
      patchData((d) => ({ profiles: d.profiles.map((p) => (p.id === me.id ? next : p)) }))
      void persist('settings', (b) => b.saveProfile(next))
    },
  }
})

/** Convenience hooks */
export const useMe = () => useApp((s) => s.me)
export const useSettings = () => useApp((s) => s.me?.settings ?? DEFAULT_SETTINGS)

export function useSongState(songId: string | undefined, userId?: string) {
  return useApp((s) => {
    const uidToUse = userId ?? s.me?.id
    return s.data.states.find((x) => x.songId === songId && x.userId === uidToUse) ?? null
  })
}

export function partnerOf(me: Profile | null, profiles: Profile[]): Profile | null {
  return profiles.find((p) => p.id !== me?.id) ?? null
}
