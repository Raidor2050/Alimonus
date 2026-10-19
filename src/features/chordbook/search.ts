import type { Song } from '@/types'
import { normalize } from '@/lib/util'
import { searchSpotifyTracks, bestImage, type SpotifyTrack } from '@/integrations/spotify'
import { searchYouTube, type YouTubeResult } from '@/integrations/youtube'

/** Ranked, typo-tolerant-ish local search over the Chordbook. */
export function searchSongs(songs: Song[], query: string): Song[] {
  const q = normalize(query.trim())
  if (!q) return [...songs].sort((a, b) => a.title.localeCompare(b.title))
  const terms = q.split(/\s+/)
  const scored: { s: Song; score: number }[] = []
  for (const s of songs) {
    const title = normalize(s.title)
    const artist = normalize(s.artist)
    const fields = [title, artist, normalize(s.album ?? ''), ...s.altTitles.map(normalize), normalize(s.genre ?? ''), normalize(s.key ?? '')]
    const hay = fields.join(' \u0000 ')
    if (!terms.every((t) => hay.includes(t))) continue
    let score = 0
    if (title === q) score += 100
    else if (title.startsWith(q)) score += 60
    else if (title.includes(q)) score += 40
    if (artist.startsWith(q)) score += 30
    if (s.altTitles.some((a) => normalize(a).includes(q))) score += 25
    for (const t of terms) if (title.split(/\s+/).some((w) => w.startsWith(t))) score += 8
    if (s.chordSheet) score += 3
    scored.push({ s, score })
  }
  return scored.sort((a, b) => b.score - a.score || a.s.title.localeCompare(b.s.title)).map((x) => x.s)
}

/* ---------- Provider adapters ---------- */

/** A song candidate from outside the Chordbook, normalised so the UI doesn't care where it came from. */
export interface ExternalHit {
  provider: 'spotify' | 'youtube'
  externalId: string
  title: string
  artist: string
  album: string | null
  artworkUrl: string | null
  durationMs: number | null
  releaseYear: number | null
  url: string
}

export interface SongSearchProvider {
  id: ExternalHit['provider']
  label: string
  search(q: string, signal?: AbortSignal): Promise<ExternalHit[]>
}

export const spotifyProvider: SongSearchProvider = {
  id: 'spotify',
  label: 'Spotify',
  async search(q, signal) {
    const tracks = await searchSpotifyTracks(q, signal)
    return tracks.map(spotifyTrackToHit)
  },
}

export function spotifyTrackToHit(t: SpotifyTrack): ExternalHit {
  return {
    provider: 'spotify',
    externalId: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(', '),
    album: t.album?.name ?? null,
    artworkUrl: bestImage(t.album?.images),
    durationMs: t.duration_ms,
    releaseYear: t.album?.release_date ? Number(t.album.release_date.slice(0, 4)) : null,
    url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
  }
}

export const youtubeProvider: SongSearchProvider = {
  id: 'youtube',
  label: 'YouTube',
  async search(q, signal) {
    const results = await searchYouTube(q, signal)
    return results.map(youtubeToHit)
  },
}

export function youtubeToHit(r: YouTubeResult): ExternalHit {
  // Common "Artist - Title (Official Video)" shape; fall back to channel name.
  const clean = r.title.replace(/\s*[([](official|lyrics?|audio|video|hd|4k|remaster(ed)?|mv)[^)\]]*[)\]]/gi, '').trim()
  const parts = clean.split(/\s[-–—]\s/)
  const [artist, title] = parts.length >= 2 ? [parts[0], parts.slice(1).join(' - ')] : [r.channel.replace(/\s*-\s*Topic$/, '').replace(/VEVO$/i, ''), clean]
  return { provider: 'youtube', externalId: r.videoId, title, artist, album: null, artworkUrl: r.thumbnail, durationMs: r.durationMs, releaseYear: null, url: r.url }
}

/** Find an existing Chordbook song for an external hit (by provider id, then by title+artist). */
export function matchExisting(songs: Song[], hit: Pick<ExternalHit, 'provider' | 'externalId' | 'title' | 'artist'>): Song | null {
  const byId = songs.find((s) => (hit.provider === 'spotify' ? s.spotifyId === hit.externalId : s.youtubeId === hit.externalId))
  if (byId) return byId
  const t = normalize(hit.title).replace(/\s*-\s*(remaster|live|mono|stereo).*$/, '')
  const a = normalize(hit.artist.split(',')[0])
  return songs.find((s) => normalize(s.title) === t && normalize(s.artist).includes(a)) ?? null
}
