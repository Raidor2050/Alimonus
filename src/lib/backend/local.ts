import { SEED_SONGS, seedPlaylists, seedRoadmap, seedStates } from '@/data/seed'
import { DEFAULT_SETTINGS, type Profile, type Snapshot, type SpotifyTokens, type Username } from '@/types'
import { AuthError, type Backend } from './types'

/**
 * Demo mode: everything lives in this browser's localStorage. Two tabs stay in sync
 * through the `storage` event, but nothing reaches other devices.
 */

const DATA_KEY = 'alimonus:demo:data:v1'
const SESSION_KEY = 'alimonus:demo:session'
const PASSWORD_KEY = 'alimonus:demo:passwords'
const SPOTIFY_KEY = 'alimonus:demo:spotify:'

export const DEMO_IDS: Record<Username, string> = { raiyan: 'demo-raiyan', afra: 'demo-afra' }
export const DEFAULT_PASSWORD = 'Alimonus'

export function demoProfiles(): Profile[] {
  return [
    {
      id: DEMO_IDS.raiyan,
      username: 'raiyan',
      displayName: 'Raiyan Kabir',
      tagline: 'Interdimensional sound engineer',
      bio: 'Codes by day, bends strings through portals by night. Collects odd chords and stranger tunings.',
      settings: { ...DEFAULT_SETTINGS, theme: 'portal' },
    },
    {
      id: DEMO_IDS.afra,
      username: 'afra',
      displayName: 'Afra Anani',
      tagline: 'Midnight headliner & cat whisperer',
      bio: 'Stage lights, moonwalks and a cat on the keyboard. Learns grooves by ear and never misses the downbeat.',
      settings: { ...DEFAULT_SETTINGS, theme: 'stage' },
    },
  ]
}

export function freshDemoSnapshot(): Snapshot {
  const { playlists, items } = seedPlaylists(DEMO_IDS.raiyan, DEMO_IDS.afra)
  return {
    profiles: demoProfiles(),
    songs: SEED_SONGS,
    states: seedStates(DEMO_IDS.raiyan, DEMO_IDS.afra),
    playlists,
    items,
    roadmap: seedRoadmap(DEMO_IDS.raiyan, DEMO_IDS.afra),
    activity: [],
  }
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}

function write(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    throw new Error('Could not save to this browser’s storage (private mode or storage full?).')
  }
}

function upsertBy<T>(list: T[], item: T, same: (a: T) => boolean): T[] {
  const i = list.findIndex(same)
  if (i === -1) return [...list, item]
  const next = list.slice()
  next[i] = item
  return next
}

export class LocalBackend implements Backend {
  mode = 'demo' as const

  private data(): Snapshot {
    const d = read<Snapshot | null>(DATA_KEY, null)
    if (d) return d
    const fresh = freshDemoSnapshot()
    write(DATA_KEY, fresh)
    return fresh
  }

  private mutate(fn: (d: Snapshot) => Snapshot) {
    write(DATA_KEY, fn(this.data()))
  }

  async restore() {
    const id = read<string | null>(SESSION_KEY, null)
    return this.data().profiles.find((p) => p.id === id) ?? null
  }

  async signIn(username: Username, password: string) {
    const passwords = read<Record<string, string>>(PASSWORD_KEY, {})
    if (password !== (passwords[username] ?? DEFAULT_PASSWORD)) throw new AuthError('That password doesn’t open this portal.')
    const profile = this.data().profiles.find((p) => p.username === username)
    if (!profile) throw new AuthError('Unknown profile.')
    write(SESSION_KEY, profile.id)
    return profile
  }

  async signOut() {
    write(SESSION_KEY, null)
  }

  async changePassword(newPassword: string) {
    const id = read<string | null>(SESSION_KEY, null)
    const p = this.data().profiles.find((x) => x.id === id)
    if (!p) throw new AuthError('Not signed in.')
    write(PASSWORD_KEY, { ...read<Record<string, string>>(PASSWORD_KEY, {}), [p.username]: newPassword })
  }

  async load() {
    return this.data()
  }

  async saveProfile(p: Profile) {
    this.mutate((d) => ({ ...d, profiles: upsertBy(d.profiles, p, (x) => x.id === p.id) }))
  }
  async upsertSong(s: Snapshot['songs'][number]) {
    this.mutate((d) => ({ ...d, songs: upsertBy(d.songs, s, (x) => x.id === s.id) }))
  }
  async deleteSong(id: string) {
    this.mutate((d) => ({ ...d, songs: d.songs.filter((x) => x.id !== id), items: d.items.filter((i) => i.songId !== id) }))
  }
  async upsertState(s: Snapshot['states'][number]) {
    this.mutate((d) => ({ ...d, states: upsertBy(d.states, s, (x) => x.userId === s.userId && x.songId === s.songId) }))
  }
  async upsertPlaylist(p: Snapshot['playlists'][number]) {
    this.mutate((d) => ({ ...d, playlists: upsertBy(d.playlists, p, (x) => x.id === p.id) }))
  }
  async deletePlaylist(id: string) {
    this.mutate((d) => ({ ...d, playlists: d.playlists.filter((x) => x.id !== id), items: d.items.filter((i) => i.playlistId !== id) }))
  }
  async upsertItems(items: Snapshot['items']) {
    this.mutate((d) => ({ ...d, items: items.reduce((acc, it) => upsertBy(acc, it, (x) => x.id === it.id), d.items) }))
  }
  async deleteItems(ids: string[]) {
    this.mutate((d) => ({ ...d, items: d.items.filter((i) => !ids.includes(i.id)) }))
  }
  async upsertRoadmap(item: Snapshot['roadmap'][number]) {
    this.mutate((d) => ({ ...d, roadmap: upsertBy(d.roadmap, item, (x) => x.id === item.id) }))
  }
  async deleteRoadmap(id: string) {
    this.mutate((d) => ({ ...d, roadmap: d.roadmap.filter((x) => x.id !== id) }))
  }
  async logActivity(e: Snapshot['activity'][number]) {
    this.mutate((d) => ({ ...d, activity: [e, ...d.activity].slice(0, 60) }))
  }
  async loadSpotifyTokens(userId: string) {
    return read<SpotifyTokens | null>(SPOTIFY_KEY + userId, null)
  }
  async saveSpotifyTokens(userId: string, tokens: SpotifyTokens | null) {
    write(SPOTIFY_KEY + userId, tokens)
  }

  subscribe(onChange: () => void) {
    const handler = (e: StorageEvent) => {
      if (e.key === DATA_KEY) onChange()
    }
    window.addEventListener('storage', handler)
    return () => window.removeEventListener('storage', handler)
  }

  /** Wipe demo data back to the seed (Settings → reset demo). */
  reset() {
    write(DATA_KEY, freshDemoSnapshot())
  }
}
