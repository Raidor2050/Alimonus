import { beforeEach, describe, expect, it } from 'vitest'
import { useApp } from '@/stores/app'
import { LocalBackend, DEMO_IDS, freshDemoSnapshot } from '@/lib/backend/local'
import { setBackendForTests } from '@/lib/backend'
import { songToTrack } from '@/features/player/tracks'
import { matchExisting, searchSongs, youtubeToHit } from '@/features/chordbook/search'
import { parseYouTubeId } from '@/integrations/youtube'

const flush = () => new Promise((r) => setTimeout(r, 0))

async function signInAs(username: 'raiyan' | 'afra') {
  await useApp.getState().signIn(username, 'Alimonus')
}

describe('app store (demo backend)', () => {
  beforeEach(async () => {
    localStorage.clear()
    const backend = new LocalBackend()
    setBackendForTests(backend)
    useApp.setState({ backend, me: null, data: freshDemoSnapshot(), booting: false })
  })

  it('rejects a wrong password and accepts the default', async () => {
    await expect(useApp.getState().signIn('raiyan', 'nope')).rejects.toThrow()
    await signInAs('raiyan')
    expect(useApp.getState().me?.username).toBe('raiyan')
  })

  it('keeps wishlist and covered status separate per person', async () => {
    await signInAs('raiyan')
    const song = 'seed-greensleeves'
    useApp.getState().toggleWishlist(song)
    useApp.getState().toggleCovered(song)
    await flush()
    await useApp.getState().signOut()
    await signInAs('afra')
    const states = useApp.getState().data.states
    expect(states.find((s) => s.userId === DEMO_IDS.raiyan && s.songId === song)).toMatchObject({ wishlist: true, covered: true })
    expect(states.find((s) => s.userId === DEMO_IDS.afra && s.songId === song)).toBeUndefined()
    // Afra covering doesn't touch Raiyan's record
    useApp.getState().toggleCovered(song)
    expect(useApp.getState().data.states.find((s) => s.userId === DEMO_IDS.raiyan && s.songId === song)?.covered).toBe(true)
  })

  it('undoes covered and clears the date', async () => {
    await signInAs('afra')
    const id = 'seed-danny-boy'
    useApp.getState().toggleCovered(id)
    expect(useApp.getState().data.states.find((s) => s.songId === id && s.userId === DEMO_IDS.afra)?.coveredAt).toBeTruthy()
    useApp.getState().toggleCovered(id)
    const st = useApp.getState().data.states.find((s) => s.songId === id && s.userId === DEMO_IDS.afra)
    expect(st?.covered).toBe(false)
    expect(st?.coveredAt).toBeNull()
  })

  it('creates, fills, reorders and deletes a playlist', async () => {
    await signInAs('raiyan')
    const pl = useApp.getState().createPlaylist({ name: 'Test set', kind: 'setlist' })
    useApp.getState().addToPlaylist(pl.id, 'seed-amazing-grace')
    useApp.getState().addToPlaylist(pl.id, 'seed-greensleeves')
    useApp.getState().addToPlaylist(pl.id, 'seed-greensleeves') // duplicate ignored
    let items = useApp.getState().data.items.filter((i) => i.playlistId === pl.id).sort((a, b) => a.position - b.position)
    expect(items.map((i) => i.songId)).toEqual(['seed-amazing-grace', 'seed-greensleeves'])
    useApp.getState().reorderPlaylist(pl.id, [items[1].id, items[0].id])
    items = useApp.getState().data.items.filter((i) => i.playlistId === pl.id).sort((a, b) => a.position - b.position)
    expect(items.map((i) => i.songId)).toEqual(['seed-greensleeves', 'seed-amazing-grace'])
    await flush()
    // persisted to the demo backend
    const stored = await new LocalBackend().load()
    expect(stored.items.filter((i) => i.playlistId === pl.id)).toHaveLength(2)
    useApp.getState().deletePlaylist(pl.id)
    expect(useApp.getState().data.items.some((i) => i.playlistId === pl.id)).toBe(false)
  })

  it('persists settings to the signed-in profile only', async () => {
    await signInAs('afra')
    useApp.getState().updateSettings({ fontScale: 1.4, tuning: 'drop-d' })
    await flush()
    const stored = await new LocalBackend().load()
    expect(stored.profiles.find((p) => p.id === DEMO_IDS.afra)?.settings).toMatchObject({ fontScale: 1.4, tuning: 'drop-d' })
    expect(stored.profiles.find((p) => p.id === DEMO_IDS.raiyan)?.settings.fontScale).toBe(1)
  })
})

describe('search & matching', () => {
  const songs = freshDemoSnapshot().songs
  it('ranks title matches and searches alt titles', () => {
    expect(searchSongs(songs, 'scarb')[0].id).toBe('seed-scarborough-fair')
    expect(searchSongs(songs, 'evil morty')[0].id).toBe('seed-for-the-damaged-coda')
    expect(searchSongs(songs, 'michael jackson').length).toBeGreaterThanOrEqual(4)
  })
  it('matches external hits to existing songs instead of duplicating', () => {
    expect(matchExisting(songs, { provider: 'spotify', externalId: 'x', title: 'Billie Jean', artist: 'Michael Jackson' })?.id).toBe('seed-billie-jean')
    expect(matchExisting(songs, { provider: 'spotify', externalId: 'x', title: 'Unknown Song', artist: 'Nobody' })).toBeNull()
  })
  it('parses YouTube titles and links', () => {
    const hit = youtubeToHit({ videoId: 'abcdefghijk', title: 'Michael Jackson - Billie Jean (Official Video)', channel: 'michaeljacksonVEVO', thumbnail: '', durationMs: 1, url: '' })
    expect(hit).toMatchObject({ artist: 'Michael Jackson', title: 'Billie Jean' })
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=3')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=x')).toBe('dQw4w9WgXcQ')
    expect(parseYouTubeId('not a link')).toBeNull()
  })
  it('builds player tracks with the preferred source', () => {
    const song = { ...songs[0], youtubeId: 'dQw4w9WgXcQ', spotifyId: '4uLU6hMCjMI75M1A2tKUQC' }
    expect(songToTrack(song, 'spotify')?.source).toBe('spotify')
    expect(songToTrack(song, 'youtube')?.source).toBe('youtube')
    expect(songToTrack({ ...song, youtubeId: null }, 'youtube')?.source).toBe('spotify')
    expect(songToTrack({ ...song, youtubeId: null, spotifyId: null })).toBeNull()
  })
})
