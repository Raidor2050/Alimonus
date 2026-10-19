import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import {
  DEFAULT_SETTINGS,
  type ActivityEvent,
  type Playlist,
  type PlaylistItem,
  type Profile,
  type RoadmapItem,
  type Snapshot,
  type Song,
  type SpotifyTokens,
  type UserSongState,
  type Username,
} from '@/types'
import { AuthError, type Backend } from './types'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const toProfile = (r: Row): Profile => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  tagline: r.tagline ?? '',
  bio: r.bio ?? '',
  settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
})

const toSong = (r: Row): Song => ({
  id: r.id,
  title: r.title,
  artist: r.artist,
  album: r.album,
  altTitles: r.alt_titles ?? [],
  artworkUrl: r.artwork_url,
  durationMs: r.duration_ms,
  releaseYear: r.release_year,
  genre: r.genre,
  key: r.key,
  bpm: r.bpm,
  description: r.description,
  credits: r.credits,
  spotifyId: r.spotify_id,
  youtubeId: r.youtube_id,
  chordSheet: r.chord_sheet,
  progression: r.progression,
  chordSource: r.chord_source,
  provenance: r.provenance,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
const fromSong = (s: Song): Row => ({
  id: s.id,
  title: s.title,
  artist: s.artist,
  album: s.album,
  alt_titles: s.altTitles,
  artwork_url: s.artworkUrl,
  duration_ms: s.durationMs,
  release_year: s.releaseYear,
  genre: s.genre,
  key: s.key,
  bpm: s.bpm,
  description: s.description,
  credits: s.credits,
  spotify_id: s.spotifyId,
  youtube_id: s.youtubeId,
  chord_sheet: s.chordSheet,
  progression: s.progression,
  chord_source: s.chordSource,
  provenance: s.provenance,
  updated_at: s.updatedAt,
})

const toState = (r: Row): UserSongState => ({
  userId: r.user_id,
  songId: r.song_id,
  wishlist: r.wishlist,
  covered: r.covered,
  coveredAt: r.covered_at,
  notes: r.notes ?? '',
  lastOpenedAt: r.last_opened_at,
  transpose: r.transpose ?? 0,
  capo: r.capo ?? 0,
})
const fromState = (s: UserSongState): Row => ({
  user_id: s.userId,
  song_id: s.songId,
  wishlist: s.wishlist,
  covered: s.covered,
  covered_at: s.coveredAt,
  notes: s.notes,
  last_opened_at: s.lastOpenedAt,
  transpose: s.transpose,
  capo: s.capo,
})

const toPlaylist = (r: Row): Playlist => ({
  id: r.id,
  ownerId: r.owner_id,
  name: r.name,
  description: r.description ?? '',
  shared: r.shared,
  kind: r.kind,
  color: r.color,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
const fromPlaylist = (p: Playlist): Row => ({
  id: p.id,
  owner_id: p.ownerId,
  name: p.name,
  description: p.description,
  shared: p.shared,
  kind: p.kind,
  color: p.color,
  updated_at: p.updatedAt,
})

const toItem = (r: Row): PlaylistItem => ({ id: r.id, playlistId: r.playlist_id, songId: r.song_id, position: r.position, addedBy: r.added_by })
const fromItem = (i: PlaylistItem): Row => ({ id: i.id, playlist_id: i.playlistId, song_id: i.songId, position: i.position, added_by: i.addedBy })

const toRoadmap = (r: Row): RoadmapItem => ({
  id: r.id,
  ownerId: r.owner_id,
  shared: r.shared,
  title: r.title,
  description: r.description ?? '',
  status: r.status,
  priority: r.priority,
  category: r.category,
  startDate: r.start_date,
  dueDate: r.due_date,
  position: r.position,
  completedAt: r.completed_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
})
const fromRoadmap = (i: RoadmapItem): Row => ({
  id: i.id,
  owner_id: i.ownerId,
  shared: i.shared,
  title: i.title,
  description: i.description,
  status: i.status,
  priority: i.priority,
  category: i.category,
  start_date: i.startDate,
  due_date: i.dueDate,
  position: i.position,
  completed_at: i.completedAt,
  updated_at: i.updatedAt,
})

const toActivity = (r: Row): ActivityEvent => ({ id: r.id, userId: r.user_id, kind: r.kind, text: r.text, songId: r.song_id, createdAt: r.created_at })

function check<T extends { error: { message: string } | null }>(res: T): T {
  if (res.error) throw new Error(res.error.message)
  return res
}

export class SupabaseBackend implements Backend {
  mode = 'cloud' as const
  client: SupabaseClient

  constructor() {
    this.client = createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, storageKey: 'alimonus-auth' },
    })
  }

  private async profileFor(userId: string): Promise<Profile> {
    const { data, error } = await this.client.from('profiles').select('*').eq('id', userId).maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new AuthError('This account has no Alimonus profile yet. Run `npm run provision` (see README).')
    return toProfile(data)
  }

  async restore() {
    const { data } = await this.client.auth.getSession()
    if (!data.session) return null
    return this.profileFor(data.session.user.id)
  }

  async signIn(username: Username, password: string) {
    const email = username === 'raiyan' ? env.raiyanEmail : env.afraEmail
    const { data, error } = await this.client.auth.signInWithPassword({ email, password })
    if (error || !data.user) throw new AuthError(error?.message === 'Invalid login credentials' ? 'That password doesn’t open this portal.' : (error?.message ?? 'Sign-in failed.'))
    return this.profileFor(data.user.id)
  }

  async signOut() {
    await this.client.auth.signOut()
  }

  async changePassword(newPassword: string) {
    const { error } = await this.client.auth.updateUser({ password: newPassword })
    if (error) throw new Error(error.message)
  }

  async load(): Promise<Snapshot> {
    const [profiles, songs, states, playlists, items, roadmap, activity] = await Promise.all([
      this.client.from('profiles').select('*'),
      this.client.from('songs').select('*').order('title'),
      this.client.from('user_song_states').select('*'),
      this.client.from('playlists').select('*'),
      this.client.from('playlist_items').select('*').order('position'),
      this.client.from('roadmap_items').select('*').order('position'),
      this.client.from('activity').select('*').order('created_at', { ascending: false }).limit(60),
    ]).then((rs) => rs.map(check))
    return {
      profiles: (profiles.data ?? []).map(toProfile),
      songs: (songs.data ?? []).map(toSong),
      states: (states.data ?? []).map(toState),
      playlists: (playlists.data ?? []).map(toPlaylist),
      items: (items.data ?? []).map(toItem),
      roadmap: (roadmap.data ?? []).map(toRoadmap),
      activity: (activity.data ?? []).map(toActivity),
    }
  }

  async saveProfile(p: Profile) {
    check(await this.client.from('profiles').update({ display_name: p.displayName, tagline: p.tagline, bio: p.bio, settings: p.settings }).eq('id', p.id))
  }
  async upsertSong(s: Song) {
    // created_by defaults to auth.uid() in the database on insert and is left untouched on update.
    check(await this.client.from('songs').upsert(fromSong(s)))
  }
  async deleteSong(id: string) {
    check(await this.client.from('songs').delete().eq('id', id))
  }
  async upsertState(s: UserSongState) {
    check(await this.client.from('user_song_states').upsert(fromState(s)))
  }
  async upsertPlaylist(p: Playlist) {
    check(await this.client.from('playlists').upsert(fromPlaylist(p)))
  }
  async deletePlaylist(id: string) {
    check(await this.client.from('playlists').delete().eq('id', id))
  }
  async upsertItems(items: PlaylistItem[]) {
    if (items.length) check(await this.client.from('playlist_items').upsert(items.map(fromItem)))
  }
  async deleteItems(ids: string[]) {
    if (ids.length) check(await this.client.from('playlist_items').delete().in('id', ids))
  }
  async upsertRoadmap(item: RoadmapItem) {
    check(await this.client.from('roadmap_items').upsert(fromRoadmap(item)))
  }
  async deleteRoadmap(id: string) {
    check(await this.client.from('roadmap_items').delete().eq('id', id))
  }
  async logActivity(e: ActivityEvent) {
    check(await this.client.from('activity').insert({ id: e.id, user_id: e.userId, kind: e.kind, text: e.text, song_id: e.songId }))
  }

  async loadSpotifyTokens(userId: string) {
    const { data } = await this.client.from('spotify_connections').select('*').eq('user_id', userId).maybeSingle()
    if (!data) return null
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Number(data.expires_at),
      scope: data.scope ?? '',
      displayName: data.display_name ?? undefined,
      spotifyUserId: data.spotify_user_id ?? undefined,
    } satisfies SpotifyTokens
  }
  async saveSpotifyTokens(userId: string, t: SpotifyTokens | null) {
    if (!t) {
      check(await this.client.from('spotify_connections').delete().eq('user_id', userId))
      return
    }
    check(
      await this.client.from('spotify_connections').upsert({
        user_id: userId,
        access_token: t.accessToken,
        refresh_token: t.refreshToken,
        expires_at: t.expiresAt,
        scope: t.scope,
        display_name: t.displayName ?? null,
        spotify_user_id: t.spotifyUserId ?? null,
        updated_at: new Date().toISOString(),
      }),
    )
  }

  subscribe(onChange: () => void) {
    let timer: ReturnType<typeof setTimeout> | undefined
    const debounced = () => {
      clearTimeout(timer)
      timer = setTimeout(onChange, 250)
    }
    const channel = this.client.channel('alimonus-shared')
    for (const table of ['songs', 'user_song_states', 'playlists', 'playlist_items', 'roadmap_items', 'activity', 'profiles'])
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, debounced)
    channel.subscribe()
    return () => {
      clearTimeout(timer)
      void this.client.removeChannel(channel)
    }
  }
}
