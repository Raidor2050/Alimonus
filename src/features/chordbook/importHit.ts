import { useApp } from '@/stores/app'
import { toast } from '@/stores/toasts'
import type { Song } from '@/types'
import { matchExisting, type ExternalHit } from './search'

/** Turn a Spotify/YouTube result into a Chordbook song, reusing an existing entry when it matches. */
export function importHit(hit: ExternalHit): Song {
  const { data, createSong, saveSong } = useApp.getState()
  const existing = matchExisting(data.songs, hit)
  if (existing) {
    // Fill in the missing provider link rather than creating a duplicate.
    const patch: Partial<Song> = {}
    if (hit.provider === 'spotify' && !existing.spotifyId) patch.spotifyId = hit.externalId
    if (hit.provider === 'youtube' && !existing.youtubeId) patch.youtubeId = hit.externalId
    if (!existing.artworkUrl && hit.provider === 'spotify' && hit.artworkUrl) patch.artworkUrl = hit.artworkUrl
    if (!existing.durationMs && hit.durationMs) patch.durationMs = hit.durationMs
    if (!existing.album && hit.album) patch.album = hit.album
    if (Object.keys(patch).length) {
      void saveSong({ ...existing, ...patch })
      toast({ tone: 'success', title: 'Linked to existing song', body: `${existing.title} now has a ${hit.provider === 'spotify' ? 'Spotify' : 'YouTube'} link.` })
    }
    return { ...existing, ...patch }
  }
  return createSong({
    title: hit.title,
    artist: hit.artist,
    album: hit.album,
    artworkUrl: hit.provider === 'spotify' ? hit.artworkUrl : null,
    durationMs: hit.durationMs,
    releaseYear: hit.releaseYear,
    spotifyId: hit.provider === 'spotify' ? hit.externalId : null,
    youtubeId: hit.provider === 'youtube' ? hit.externalId : null,
    provenance: hit.provider === 'spotify' ? 'Metadata from Spotify' : 'Metadata from YouTube',
  })
}
