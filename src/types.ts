export type Username = 'raiyan' | 'afra'
export type ThemeId = 'portal' | 'stage' | 'fusion'

export interface Settings {
  theme: ThemeId
  ambient: 'full' | 'calm' | 'off'
  reducedMotion: boolean
  chordStyle: 'above' | 'inline'
  monospace: boolean
  fontScale: number
  accidental: 'auto' | 'sharp' | 'flat'
  tuning: string
  defaultCapo: number
  metronomeBpm: number
  metronomeVolume: number
  referencePitch: number
  playerSource: 'youtube' | 'spotify'
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'fusion',
  ambient: 'full',
  reducedMotion: false,
  chordStyle: 'above',
  monospace: false,
  fontScale: 1,
  accidental: 'auto',
  tuning: 'standard',
  defaultCapo: 0,
  metronomeBpm: 96,
  metronomeVolume: 0.7,
  referencePitch: 440,
  playerSource: 'youtube',
}

export interface Profile {
  id: string
  username: Username
  displayName: string
  tagline: string
  bio: string
  settings: Settings
}

export type ChordSource = 'verified' | 'suggested' | 'imported' | 'user' | 'sample'

export interface Song {
  id: string
  title: string
  artist: string
  album: string | null
  altTitles: string[]
  artworkUrl: string | null
  durationMs: number | null
  releaseYear: number | null
  genre: string | null
  key: string | null
  bpm: number | null
  description: string | null
  credits: string | null
  spotifyId: string | null
  youtubeId: string | null
  /** ChordPro text; null when no sheet exists yet. */
  chordSheet: string | null
  /** Chord progression when no full sheet is available (progressions aren't lyrics, so they're safe to include). */
  progression: string | null
  chordSource: ChordSource | null
  /** Where the metadata/sheet came from, shown to the user. */
  provenance: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
}

export interface UserSongState {
  userId: string
  songId: string
  wishlist: boolean
  covered: boolean
  coveredAt: string | null
  notes: string
  lastOpenedAt: string | null
  transpose: number
  capo: number
}

export interface Playlist {
  id: string
  ownerId: string
  name: string
  description: string
  shared: boolean
  kind: 'playlist' | 'setlist'
  color: string
  createdAt: string
  updatedAt: string
}

export interface PlaylistItem {
  id: string
  playlistId: string
  songId: string
  position: number
  addedBy: string
}

export type RoadmapStatus = 'idea' | 'todo' | 'doing' | 'done'
export type RoadmapPriority = 'low' | 'medium' | 'high'
export type RoadmapCategory = 'goal' | 'task' | 'learning' | 'music' | 'coding' | 'creative' | 'milestone'

export interface RoadmapItem {
  id: string
  ownerId: string
  /** Shared items show in the shared lane and can be edited by both. */
  shared: boolean
  title: string
  description: string
  status: RoadmapStatus
  priority: RoadmapPriority
  category: RoadmapCategory
  startDate: string | null
  dueDate: string | null
  position: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ActivityEvent {
  id: string
  userId: string
  kind: 'covered' | 'wishlist' | 'playlist' | 'roadmap' | 'song'
  text: string
  songId: string | null
  createdAt: string
}

export interface Snapshot {
  profiles: Profile[]
  songs: Song[]
  states: UserSongState[]
  playlists: Playlist[]
  items: PlaylistItem[]
  roadmap: RoadmapItem[]
  activity: ActivityEvent[]
}

export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
  scope: string
  displayName?: string
  spotifyUserId?: string
}
