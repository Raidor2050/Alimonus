import type { Playlist, PlaylistItem, RoadmapItem, Song, UserSongState } from '@/types'

/**
 * Starter catalog. Full lyric sheets are limited to public-domain songs and originals
 * written for Alimonus. Popular songs ship as metadata + key only (plus a progression
 * where we're confident), so Raiyan and Afra can add their own arrangements.
 */

const now = '2026-10-01T12:00:00.000Z'

function song(p: Partial<Song> & Pick<Song, 'id' | 'title' | 'artist'>): Song {
  return {
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
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...p,
  }
}

export const SEED_SONGS: Song[] = [
  song({
    id: 'seed-amazing-grace',
    title: 'Amazing Grace',
    artist: 'Traditional (John Newton)',
    album: 'Public domain hymn',
    releaseYear: 1779,
    genre: 'Folk / Hymn',
    key: 'G',
    bpm: 80,
    durationMs: 200000,
    description: 'A 3/4 classic and a great first song for practising chord changes on the beat.',
    credits: 'Words: John Newton (1779). Melody: "New Britain" (1829).',
    chordSource: 'verified',
    provenance: 'Public-domain lyrics; Alimonus arrangement',
    chordSheet: `{title: Amazing Grace}
{key: G}
{tempo: 80}
{time: 3/4}
{c: Intro}
[G] [C] [G] [D]

{start_of_verse: Verse 1}
A[G]mazing grace, how [G7]sweet the [C]sound
That [G]saved a wretch like [D]me
I [G]once was lost, but [G7]now am [C]found
Was [G]blind, but [D7]now I [G]see
{end_of_verse}

{start_of_verse: Verse 2}
'Twas [G]grace that taught my [G7]heart to [C]fear
And [G]grace my fears re[D]lieved
How [G]precious did that [G7]grace ap[C]pear
The [G]hour I [D7]first be[G]lieved
{end_of_verse}

{start_of_verse: Verse 3}
Through [G]many dangers, [G7]toils and [C]snares
I [G]have already [D]come
'Tis [G]grace hath brought me [G7]safe thus [C]far
And [G]grace will [D7]lead me [G]home
{end_of_verse}

{c: Outro}
[C] [G] [D7] [G]`,
  }),
  song({
    id: 'seed-scarborough-fair',
    title: 'Scarborough Fair',
    artist: 'Traditional',
    album: 'English folk ballad',
    genre: 'Folk',
    key: 'Am',
    bpm: 100,
    durationMs: 190000,
    description: 'Dorian-flavoured ballad: watch the D major in a minor key — that raised 6th is the magic.',
    credits: 'Traditional English ballad. Lyrics public domain.',
    chordSource: 'verified',
    provenance: 'Public-domain lyrics; Alimonus arrangement',
    chordSheet: `{title: Scarborough Fair}
{key: Am}
{time: 3/4}
{start_of_verse: Verse 1}
[Am]Are you going to [G]Scarborough [Am]Fair?
[C]Parsley, [Am]sage, [C]rose[D]mary and [Am]thyme
Re[Am]member [C]me to one who [G]lives [Am]there
[Am]She once [G]was a true love of [Am]mine
{end_of_verse}

{start_of_verse: Verse 2}
[Am]Tell her to make me a [G]cambric [Am]shirt
[C]Parsley, [Am]sage, [C]rose[D]mary and [Am]thyme
With[Am]out no [C]seams nor [G]needle[Am]work
[Am]Then she'll [G]be a true love of [Am]mine
{end_of_verse}`,
  }),
  song({
    id: 'seed-greensleeves',
    title: 'Greensleeves',
    artist: 'Traditional',
    genre: 'Folk / Renaissance',
    key: 'Am',
    bpm: 90,
    durationMs: 180000,
    description: 'Renaissance tune in 6/8. Great for practising E major inside A minor (harmonic minor).',
    credits: 'Traditional English tune, 16th century.',
    chordSource: 'verified',
    provenance: 'Public-domain lyrics; Alimonus arrangement',
    chordSheet: `{title: Greensleeves}
{key: Am}
{time: 6/8}
{start_of_verse: Verse}
A[Am]las, my love, you [G]do me wrong
To [Am]cast me off dis[E]courteously
For [Am]I have loved [G]you well and long
De[Am]lighting [E]in your [Am]company
{end_of_verse}

{start_of_chorus: Chorus}
[C]Greensleeves was [G]all my joy
And [Am]Greensleeves was my [E]delight
[C]Greensleeves was my [G]heart of gold
And [Am]who but my [E]lady [Am]Greensleeves
{end_of_chorus}`,
  }),
  song({
    id: 'seed-danny-boy',
    title: 'Danny Boy',
    artist: 'Frederic Weatherly',
    album: 'Londonderry Air',
    releaseYear: 1913,
    genre: 'Folk / Ballad',
    key: 'C',
    bpm: 70,
    durationMs: 240000,
    description: 'A slow ballad with secondary dominants (A7, D7). Lovely on piano.',
    credits: 'Words: Frederic Weatherly (1913). Melody: Londonderry Air (traditional).',
    chordSource: 'verified',
    provenance: 'Public-domain lyrics; Alimonus arrangement',
    chordSheet: `{title: Danny Boy}
{key: C}
{start_of_verse: Verse 1}
Oh [C]Danny boy, the [C7]pipes, the pipes are [F]calling
From [C]glen to glen, and [Am]down the mountain [D7]side [G7]
The [C]summer's gone, and [C7]all the roses [F]falling
'Tis [C]you, 'tis you must [G7]go and I must [C]bide
{end_of_verse}

{start_of_chorus: Chorus}
But come ye [G7]back when summer's [C]in the [F]meadow
Or [C]when the valley's [Am]hushed and white with [D7]snow [G7]
'Tis [C]I'll be here in [C7]sunshine or in [F]shadow
Oh [C]Danny boy, oh [Am]Danny [Dm]boy, I [G7]love you [C]so
{end_of_chorus}`,
  }),
  song({
    id: 'seed-portal-lullaby',
    title: 'Portal Lullaby',
    artist: 'Raiyan Kabir',
    album: 'Alimonus Originals',
    releaseYear: 2026,
    genre: 'Psychedelic / Dream pop',
    key: 'Em',
    bpm: 84,
    durationMs: 214000,
    description: 'An Alimonus original. Em → Cmaj7 with an open B string droning through the whole thing — let it ring.',
    credits: 'Written for Alimonus.',
    chordSource: 'user',
    provenance: 'Alimonus original',
    createdBy: 'raiyan',
    chordSheet: `{title: Portal Lullaby}
{key: Em}
{tempo: 84}
{c: Intro}
[Em] [Cmaj7] [Em] [Cmaj7]

{start_of_verse: Verse 1}
[Em]Green light humming in the [Cmaj7]garage at night
[Em]Solder on my fingers and a [Cmaj7]sky gone white
[Am7]Every equation folds [Em]into a door
[Am7]I don't know which version of [B7]me this is for
{end_of_verse}

{start_of_chorus: Chorus}
So [G]close your eyes, the [D]walls are thin
The [Em]universe is [Cmaj7]leaking in
[G]Count the stars, then [D]count again
We [Am7]left a light on [B7]somewhere in the [Em]end
{end_of_chorus}

{start_of_bridge: Bridge}
[Cmaj7]Ones and zeroes [D]falling like rain
[Bm7]Every loop comes [Em]back around again
{end_of_bridge}`,
  }),
  song({
    id: 'seed-night-shift-cat',
    title: 'Night Shift Cat',
    artist: 'Afra Anani',
    album: 'Alimonus Originals',
    releaseYear: 2026,
    genre: 'Pop / Funk',
    key: 'Dm',
    bpm: 112,
    durationMs: 198000,
    description: 'An Alimonus original. A minor-key funk strut — mute the strings between hits and keep the 16ths tight.',
    credits: 'Written for Alimonus.',
    chordSource: 'user',
    provenance: 'Alimonus original',
    createdBy: 'afra',
    chordSheet: `{title: Night Shift Cat}
{key: Dm}
{tempo: 112}
{c: Intro}
[Dm7] [G7] [Dm7] [G7]

{start_of_verse: Verse 1}
[Dm7]Twelve o'clock, the [G7]stage lights hum
[Dm7]Something's tapping [G7]like a drum
[Bbmaj7]Velvet paws on the [A7]checkered floor
[Dm7]She's been here a [G7]thousand nights before
{end_of_verse}

{c: Pre-Chorus}
[Gm7]Red light blinking, [A7]camera two
[Gm7]Don't look now, she's [A7sus4]watching [A7]you

{start_of_chorus: Chorus}
Night shift [Dm]cat, night shift [Bb]cat
[F]Moonwalking out where the [C]shadows are at
Night shift [Dm]cat, gonna [Bb]bring it back
[Gm7]Six a.m. and she [A7]never looks [Dm]back
{end_of_chorus}`,
  }),
  song({
    id: 'seed-wiring-the-moon',
    title: 'Wiring the Moon',
    artist: 'Raiyan Kabir & Afra Anani',
    album: 'Alimonus Originals',
    releaseYear: 2026,
    genre: 'Indie / Duet',
    key: 'A',
    bpm: 92,
    durationMs: 226000,
    description: 'An Alimonus duet: Raiyan takes verse 1, Afra takes verse 2, both on the chorus. Try capo 2 with G shapes.',
    credits: 'Written for Alimonus.',
    chordSource: 'user',
    provenance: 'Alimonus original',
    createdBy: 'afra',
    chordSheet: `{title: Wiring the Moon}
{key: A}
{tempo: 92}
{start_of_verse: Verse 1 (Raiyan)}
[A]I wrote a little program that [E/G#]only says your name
[F#m]Compiled it in the dark and it [D]ran it just the same
{end_of_verse}

{start_of_verse: Verse 2 (Afra)}
[A]I wrote a little melody, the [E/G#]cat sat on the keys
[F#m]Now it's in a minor and it [D]sounds a lot like me
{end_of_verse}

{start_of_chorus: Chorus (both)}
So we're [D]wiring the [E]moon
With [F#m]copper and a [D]tune
[A]Every frequency we [E]find
Plays [D]back a little [E]out of time [A]
{end_of_chorus}`,
  }),
  song({
    id: 'seed-billie-jean',
    title: 'Billie Jean',
    artist: 'Michael Jackson',
    album: 'Thriller',
    releaseYear: 1982,
    genre: 'Pop / Funk',
    key: 'F#m',
    bpm: 117,
    durationMs: 294000,
    description: 'The bassline is the song. Lyrics are not included; add your own arrangement or practise from the progression.',
    progression: 'F#m G#m/F# A/F# G#m/F#',
    chordSource: 'suggested',
    provenance: 'Suggested verse progression, not checked against a licensed sheet. Lyrics not included (copyright).',
  }),
  song({
    id: 'seed-smooth-criminal',
    title: 'Smooth Criminal',
    artist: 'Michael Jackson',
    album: 'Bad',
    releaseYear: 1987,
    genre: 'Pop / Funk',
    key: 'Am',
    bpm: 118,
    durationMs: 257000,
    description: 'Metadata only. Lyrics are not included; add your own arrangement.',
    provenance: 'Metadata only. Lyrics not included (copyright).',
  }),
  song({
    id: 'seed-man-in-the-mirror',
    title: 'Man in the Mirror',
    artist: 'Michael Jackson',
    album: 'Bad',
    releaseYear: 1987,
    genre: 'Pop / Gospel',
    durationMs: 319000,
    description: 'Metadata only. Lyrics are not included; add your own arrangement.',
    provenance: 'Metadata only. Lyrics not included (copyright).',
  }),
  song({
    id: 'seed-human-nature',
    title: 'Human Nature',
    artist: 'Michael Jackson',
    album: 'Thriller',
    releaseYear: 1982,
    genre: 'Pop / Soft rock',
    durationMs: 246000,
    description: 'Metadata only. Lyrics are not included; add your own arrangement.',
    provenance: 'Metadata only. Lyrics not included (copyright).',
  }),
  song({
    id: 'seed-fnaf-song',
    title: 'Five Nights at Freddy’s',
    artist: 'The Living Tombstone',
    altTitles: ['FNAF song', 'FNAF 1 song'],
    releaseYear: 2014,
    genre: 'Electronic / Rock',
    description: 'Metadata only. Lyrics are not included; add your own arrangement.',
    provenance: 'Metadata only. Lyrics not included (copyright).',
  }),
  song({
    id: 'seed-for-the-damaged-coda',
    title: 'For the Damaged Coda',
    artist: 'Blonde Redhead',
    album: 'Melody of Certain Damaged Lemons',
    altTitles: ['Evil Morty theme'],
    releaseYear: 2000,
    genre: 'Experimental / Piano',
    description: 'Mostly piano. Metadata only; add your own arrangement.',
    provenance: 'Metadata only.',
  }),
  song({
    id: 'seed-goodbye-moonmen',
    title: 'Goodbye Moonmen',
    artist: 'Jemaine Clement',
    altTitles: ['Rick and Morty'],
    releaseYear: 2015,
    genre: 'Folk / Comedy',
    description: 'Metadata only. Lyrics are not included; add your own arrangement.',
    provenance: 'Metadata only. Lyrics not included (copyright).',
  }),
]

export function seedPlaylists(raiyanId: string, afraId: string): { playlists: Playlist[]; items: PlaylistItem[] } {
  const playlists: Playlist[] = [
    { id: 'seed-pl-duets', ownerId: afraId, name: 'Duets to learn together', description: 'Songs we can split between voice, guitar and keys.', shared: true, kind: 'setlist', color: '#c084fc', createdAt: now, updatedAt: now },
    { id: 'seed-pl-raiyan-lab', ownerId: raiyanId, name: 'Lab experiments', description: 'Weird chords, open strings, drones.', shared: false, kind: 'playlist', color: '#a3e635', createdAt: now, updatedAt: now },
    { id: 'seed-pl-afra-stage', ownerId: afraId, name: 'Stage lights', description: 'Groove and performance pieces.', shared: false, kind: 'playlist', color: '#f472b6', createdAt: now, updatedAt: now },
  ]
  const entries: [string, string, string][] = [
    ['seed-pl-duets', 'seed-wiring-the-moon', afraId],
    ['seed-pl-duets', 'seed-scarborough-fair', raiyanId],
    ['seed-pl-duets', 'seed-danny-boy', afraId],
    ['seed-pl-raiyan-lab', 'seed-portal-lullaby', raiyanId],
    ['seed-pl-raiyan-lab', 'seed-greensleeves', raiyanId],
    ['seed-pl-raiyan-lab', 'seed-for-the-damaged-coda', raiyanId],
    ['seed-pl-afra-stage', 'seed-night-shift-cat', afraId],
    ['seed-pl-afra-stage', 'seed-billie-jean', afraId],
    ['seed-pl-afra-stage', 'seed-smooth-criminal', afraId],
  ]
  const counters: Record<string, number> = {}
  const items = entries.map(([playlistId, songId, addedBy]) => ({
    id: `${playlistId}-${songId}`,
    playlistId,
    songId,
    addedBy,
    position: (counters[playlistId] = (counters[playlistId] ?? -1) + 1),
  }))
  return { playlists, items }
}

export function seedStates(raiyanId: string, afraId: string): UserSongState[] {
  const base = (userId: string, songId: string, p: Partial<UserSongState>): UserSongState => ({
    userId, songId, wishlist: false, covered: false, coveredAt: null, notes: '', lastOpenedAt: null, transpose: 0, capo: 0, ...p,
  })
  return [
    base(raiyanId, 'seed-portal-lullaby', { covered: true, coveredAt: '2026-09-20T20:00:00.000Z', lastOpenedAt: '2026-10-15T21:00:00.000Z' }),
    base(raiyanId, 'seed-for-the-damaged-coda', { wishlist: true }),
    base(raiyanId, 'seed-scarborough-fair', { wishlist: true, lastOpenedAt: '2026-10-12T19:00:00.000Z' }),
    base(raiyanId, 'seed-amazing-grace', { covered: true, coveredAt: '2026-08-02T18:00:00.000Z' }),
    base(afraId, 'seed-night-shift-cat', { covered: true, coveredAt: '2026-09-28T22:00:00.000Z', lastOpenedAt: '2026-10-16T22:00:00.000Z' }),
    base(afraId, 'seed-billie-jean', { wishlist: true, lastOpenedAt: '2026-10-14T20:00:00.000Z' }),
    base(afraId, 'seed-smooth-criminal', { wishlist: true }),
    base(afraId, 'seed-amazing-grace', { covered: true, coveredAt: '2026-08-10T18:00:00.000Z' }),
  ]
}

export function seedRoadmap(raiyanId: string, afraId: string): RoadmapItem[] {
  let pos = 0
  const item = (ownerId: string, p: Partial<RoadmapItem> & Pick<RoadmapItem, 'title'>): RoadmapItem => ({
    id: `seed-rm-${pos}`,
    ownerId,
    shared: false,
    description: '',
    status: 'todo',
    priority: 'medium',
    category: 'task',
    startDate: null,
    dueDate: null,
    position: pos++,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...p,
  })
  return [
    item(raiyanId, { title: 'Learn the F barre chord cleanly', category: 'learning', status: 'doing', priority: 'high' }),
    item(raiyanId, { title: 'Finish Portal Lullaby bridge', category: 'music', status: 'todo' }),
    item(raiyanId, { title: 'Ship Alimonus to Netlify', category: 'coding', status: 'doing', priority: 'high' }),
    item(raiyanId, { title: 'Write a generative visualiser for the tuner', category: 'coding', status: 'idea', priority: 'low' }),
    item(raiyanId, { title: 'Covered Amazing Grace', category: 'music', status: 'done', completedAt: '2026-08-02T18:00:00.000Z' }),
    item(afraId, { title: 'Nail the Billie Jean groove on keys', category: 'music', status: 'doing', priority: 'high' }),
    item(afraId, { title: 'Record a moonwalk-tempo practice loop', category: 'creative', status: 'todo' }),
    item(afraId, { title: 'Sketch cat characters for the album art', category: 'creative', status: 'idea', priority: 'low' }),
    item(afraId, { title: 'Learn the minor pentatonic box 1', category: 'learning', status: 'todo' }),
    item(afraId, { title: 'Wrote Night Shift Cat', category: 'music', status: 'done', completedAt: '2026-09-28T22:00:00.000Z' }),
    item(afraId, { title: 'Record "Wiring the Moon" duet', category: 'milestone', shared: true, status: 'todo', priority: 'high' }),
    item(raiyanId, { title: 'Learn 5 songs together this month', category: 'goal', shared: true, status: 'doing' }),
    item(raiyanId, { title: 'Play an open-mic night', category: 'milestone', shared: true, status: 'idea' }),
  ]
}
