import type { ChordSource, Song } from '@/types'
import { normalize } from '@/lib/util'

/**
 * Chord-sheet providers. Alimonus deliberately does not scrape chord sites; sheets come
 * from the shared Chordbook, public-domain/original seeds, or arrangements Raiyan and
 * Afra enter themselves. A licensed provider can be added by implementing this interface.
 */
export interface ChordSheetCandidate {
  providerId: string
  label: string
  chordPro: string | null
  progression: string | null
  source: ChordSource
  provenance: string
}

export interface ChordProvider {
  id: string
  label: string
  find(song: Pick<Song, 'id' | 'title' | 'artist'>, catalog: Song[]): Promise<ChordSheetCandidate[]>
}

/** Looks for another Chordbook entry of the same song that already has a sheet (e.g. a YouTube import of a song we already have). */
export const chordbookProvider: ChordProvider = {
  id: 'chordbook',
  label: 'Alimonus Chordbook',
  async find(song, catalog) {
    const t = normalize(song.title)
    const a = normalize(song.artist)
    return catalog
      .filter((s) => s.id !== song.id && (s.chordSheet || s.progression) && normalize(s.title) === t && (normalize(s.artist).includes(a) || a.includes(normalize(s.artist))))
      .map((s) => ({
        providerId: 'chordbook',
        label: `${s.title} — ${s.artist}`,
        chordPro: s.chordSheet,
        progression: s.progression,
        source: s.chordSource ?? 'user',
        provenance: s.provenance ?? 'Alimonus Chordbook',
      }))
  },
}

export const CHORD_PROVIDERS: ChordProvider[] = [chordbookProvider]

export async function findChordSheets(song: Pick<Song, 'id' | 'title' | 'artist'>, catalog: Song[]): Promise<ChordSheetCandidate[]> {
  const results = await Promise.allSettled(CHORD_PROVIDERS.map((p) => p.find(song, catalog)))
  return results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []))
}

export const SOURCE_LABEL: Record<ChordSource, string> = {
  verified: 'Verified',
  suggested: 'Suggested · unverified',
  imported: 'Imported',
  user: 'User-entered',
  sample: 'Sample',
}
