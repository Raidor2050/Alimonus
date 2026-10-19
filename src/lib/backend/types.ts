import type { ActivityEvent, Playlist, PlaylistItem, Profile, RoadmapItem, Snapshot, Song, SpotifyTokens, UserSongState, Username } from '@/types'

/**
 * Storage + auth contract. `LocalBackend` implements it with localStorage for demo
 * mode; `SupabaseBackend` implements it against Postgres with Row Level Security.
 */
export interface Backend {
  mode: 'demo' | 'cloud'
  restore(): Promise<Profile | null>
  signIn(username: Username, password: string): Promise<Profile>
  signOut(): Promise<void>
  changePassword(newPassword: string): Promise<void>
  load(): Promise<Snapshot>
  saveProfile(p: Profile): Promise<void>
  upsertSong(s: Song): Promise<void>
  deleteSong(id: string): Promise<void>
  upsertState(s: UserSongState): Promise<void>
  upsertPlaylist(p: Playlist): Promise<void>
  deletePlaylist(id: string): Promise<void>
  upsertItems(items: PlaylistItem[]): Promise<void>
  deleteItems(ids: string[]): Promise<void>
  upsertRoadmap(item: RoadmapItem): Promise<void>
  deleteRoadmap(id: string): Promise<void>
  logActivity(e: ActivityEvent): Promise<void>
  loadSpotifyTokens(userId: string): Promise<SpotifyTokens | null>
  saveSpotifyTokens(userId: string, tokens: SpotifyTokens | null): Promise<void>
  /** Called when another device/tab changes shared data. Returns an unsubscribe function. */
  subscribe(onChange: () => void): () => void
}

export class AuthError extends Error {}
