import type { Song } from '@/types'
import { usePlayer, type PlayerSource, type Track } from '@/stores/player'
import { toast } from '@/stores/toasts'

export function songToTrack(song: Song, prefer: PlayerSource = 'youtube'): Track | null {
  const yt = song.youtubeId ? { source: 'youtube' as const, youtubeId: song.youtubeId } : null
  const sp = song.spotifyId ? { source: 'spotify' as const, spotifyUri: `spotify:track:${song.spotifyId}` } : null
  const pick = prefer === 'spotify' ? (sp ?? yt) : (yt ?? sp)
  if (!pick) return null
  return { key: `${pick.source}:${song.id}`, songId: song.id, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, ...pick }
}

export function canPlay(song: Song) {
  return !!(song.youtubeId || song.spotifyId)
}

/** Play a song (optionally within a queue of songs). Returns false if it has no linked media. */
export function playSong(song: Song, queueSongs: Song[] = [song], prefer: PlayerSource = 'youtube', source?: PlayerSource): boolean {
  const track = songToTrack(song, source ?? prefer)
  if (!track) {
    toast({ tone: 'info', title: 'No recording linked yet', body: 'Open the song and link a YouTube video or Spotify track.' })
    return false
  }
  const queue = queueSongs.map((s) => (s.id === song.id ? track : songToTrack(s, prefer))).filter((t): t is Track => !!t)
  usePlayer.getState().playTrack(track, queue)
  return true
}
