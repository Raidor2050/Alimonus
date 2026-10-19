/**
 * One-time setup for a real (Supabase) Alimonus:
 *   1. creates the two auth users (raiyan + afra) with the initial password,
 *   2. creates/updates their profiles,
 *   3. with --seed, loads the starter Chordbook, playlists, song states and roadmap.
 *
 * Usage:  npm run provision            (users + profiles)
 *         npm run provision -- --seed  (also starter content, only into empty tables)
 *         npm run provision -- --reset-passwords   (set both passwords back to ALIMONUS_INITIAL_PASSWORD)
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY. Run it on your own computer only — never deploy that key.
 */
import { createClient } from '@supabase/supabase-js'
import { existsSync } from 'node:fs'
import { SEED_SONGS, seedPlaylists, seedRoadmap, seedStates } from '../src/data/seed.ts'

for (const f of ['.env.local', '.env']) if (existsSync(f)) process.loadEnvFile(f)

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const password = process.env.ALIMONUS_INITIAL_PASSWORD || 'Alimonus'
const emails = {
  raiyan: process.env.ALIMONUS_RAIYAN_EMAIL || process.env.VITE_ALIMONUS_RAIYAN_EMAIL || 'raiyan@alimonus.app',
  afra: process.env.ALIMONUS_AFRA_EMAIL || process.env.VITE_ALIMONUS_AFRA_EMAIL || 'afra@alimonus.app',
}
const args = new Set(process.argv.slice(2))

if (!url || !serviceKey) {
  console.error('Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } })

const PROFILES: Record<"raiyan" | "afra", { display_name: string; tagline: string; bio: string; settings: Record<string, unknown> }> = {
  raiyan: {
    display_name: 'Raiyan Kabir',
    tagline: 'Interdimensional sound engineer',
    bio: 'Codes by day, bends strings through portals by night. Collects odd chords and stranger tunings.',
    settings: { theme: 'portal' },
  },
  afra: {
    display_name: 'Afra Anani',
    tagline: 'Midnight headliner & cat whisperer',
    bio: 'Stage lights, moonwalks and a cat on the keyboard. Learns grooves by ear and never misses the downbeat.',
    settings: { theme: 'stage' },
  },
}

async function ensureUser(username: 'raiyan' | 'afra'): Promise<string> {
  const email = emails[username]
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 200 })
  if (error) throw error
  const existing = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
  if (existing) {
    if (args.has('--reset-passwords')) {
      const { error: e } = await admin.auth.admin.updateUserById(existing.id, { password })
      if (e) throw e
      console.log(`• ${username}: password reset`)
    } else console.log(`• ${username}: user exists (${email})`)
    return existing.id
  }
  const { data, error: e } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { username } })
  if (e) throw e
  console.log(`✓ ${username}: created ${email}`)
  return data.user.id
}

async function main() {
  const ids = { raiyan: await ensureUser('raiyan'), afra: await ensureUser('afra') }

  for (const username of ['raiyan', 'afra'] as const) {
    const { data: existing } = await admin.from('profiles').select('id, settings').eq('id', ids[username]).maybeSingle()
    const row = { id: ids[username], username, ...PROFILES[username], settings: { ...PROFILES[username].settings, ...(existing?.settings ?? {}) } }
    const { error } = existing
      ? await admin.from('profiles').update({ username }).eq('id', ids[username]) // keep their edits
      : await admin.from('profiles').insert(row)
    if (error) throw error
    console.log(`✓ ${username}: profile ready`)
  }

  if (args.has('--seed')) {
    const { count } = await admin.from('songs').select('id', { count: 'exact', head: true })
    if (count) console.log(`• songs table already has ${count} rows — skipping starter catalog`)
    else {
      const rows = SEED_SONGS.map((s) => ({
        id: s.id, title: s.title, artist: s.artist, album: s.album, alt_titles: s.altTitles, artwork_url: s.artworkUrl,
        duration_ms: s.durationMs, release_year: s.releaseYear, genre: s.genre, key: s.key, bpm: s.bpm, description: s.description,
        credits: s.credits, spotify_id: s.spotifyId, youtube_id: s.youtubeId, chord_sheet: s.chordSheet, progression: s.progression,
        chord_source: s.chordSource, provenance: s.provenance,
        created_by: s.createdBy === 'raiyan' ? ids.raiyan : s.createdBy === 'afra' ? ids.afra : null,
      }))
      const { error } = await admin.from('songs').insert(rows)
      if (error) throw error
      console.log(`✓ inserted ${rows.length} starter songs`)
    }
    const { count: plCount } = await admin.from('playlists').select('id', { count: 'exact', head: true })
    const { count: seedSongs } = await admin.from('songs').select('id', { count: 'exact', head: true }).like('id', 'seed-%')
    if (plCount) console.log('• playlists already exist — skipping starter playlists/roadmap')
    else if (seedSongs !== SEED_SONGS.length) console.log('• starter songs missing — skipping starter playlists/roadmap')
    else {
      const { playlists, items } = seedPlaylists(ids.raiyan, ids.afra)
      const pl = await admin.from('playlists').insert(playlists.map((p) => ({ id: p.id, owner_id: p.ownerId, name: p.name, description: p.description, shared: p.shared, kind: p.kind, color: p.color })))
      if (pl.error) throw pl.error
      const it = await admin.from('playlist_items').insert(items.map((i) => ({ id: i.id, playlist_id: i.playlistId, song_id: i.songId, position: i.position, added_by: i.addedBy })))
      if (it.error) throw it.error
      const st = await admin.from('user_song_states').insert(
        seedStates(ids.raiyan, ids.afra).map((s) => ({ user_id: s.userId, song_id: s.songId, wishlist: s.wishlist, covered: s.covered, covered_at: s.coveredAt, notes: s.notes, last_opened_at: s.lastOpenedAt })),
      )
      if (st.error) throw st.error
      const rm = await admin.from('roadmap_items').insert(
        seedRoadmap(ids.raiyan, ids.afra).map((r) => ({ id: r.id, owner_id: r.ownerId, shared: r.shared, title: r.title, description: r.description, status: r.status, priority: r.priority, category: r.category, position: r.position, completed_at: r.completedAt })),
      )
      if (rm.error) throw rm.error
      console.log('✓ starter playlists, song states and roadmap added')
    }
  }
  console.log(`\nDone. Sign in as "raiyan" or "afra" with the password from ALIMONUS_INITIAL_PASSWORD${args.has('--reset-passwords') ? '' : ' (unless already changed)'}.`)
}

main().catch((e) => {
  console.error('✗', e.message ?? e)
  process.exit(1)
})
