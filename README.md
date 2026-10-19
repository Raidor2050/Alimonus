# Alimonus

A private creative OS for **Raiyan Kabir** and **Afra Anani**: a shared Chordbook with guitar and piano diagrams, a persistent YouTube/Spotify player, personal and shared playlists, a side-by-side roadmap and a set of working musician tools. It's wrapped in an animated universe of portals, stage lights, cats and a gold celestial sigil.

It runs in two modes:

| Mode | When | Data |
|---|---|---|
| **Local demo** | Supabase env vars are empty | Saved in this browser only (two tabs stay in sync). Clearly labelled in the UI. |
| **Synced** | `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` are set | Supabase Postgres + Auth + Realtime, so both people get the same data on every device. |

---

## 1. Features

- **Login**: an animated gold sigil and two profile cards (`raiyan` / `afra`). Hovering a card recolours the universe. The default password is `Alimonus`, and you can change it in Settings.
- **Chordbook**:
  - Ranked search over title, artist, album, alt titles and key; you can move through results with the arrow keys.
  - Filters: recent, added, wishlist, covered, not covered, has chords, playlist, artist, genre and key. You can also sort.
  - Spotify search runs automatically. YouTube search runs on demand to protect its small daily quota.
  - Search results can be imported without creating duplicates.
- **Song workspace** (three columns on desktop, tabs on mobile):
  - Info column: artwork, metadata, sources, private notes, who covered it, and playlists.
  - Sheet column: ChordPro chords placed above or inline with the lyrics, a monospace mode and text size.
    - Transpose and capo are saved per person, with ♯/♭ spelling and capo suggestions.
    - Also: distraction-free focus mode with auto-scroll, an editor with live preview, print/PDF, and source labels (verified, suggested, imported, user-entered).
  - Chords column: guitar diagrams (any tuning, alternate voicings, barres, finger numbers) and piano diagrams (inversions, two-hand voicing, root and notes). Both have Web Audio previews.
  - Keys: `[` and `]` previous/next song, `+` and `-` transpose, `e` edit, `f` focus mode, `←` and `→` cycle chords.
- **Wishlist star and Cover button**: per person, with animations (star burst, check-draw and note flourish). When you both cover a song you get a "Duet" badge.
- **Playlists**:
  - Personal or shared, playlist or practice setlist, colour, drag-to-reorder with buttons as a keyboard alternative, and cover progress for both of you.
  - Each profile can connect its own Spotify account to browse playlists (paginated) and pull tracks into the Chordbook.
- **Persistent player**:
  - Uses the YouTube IFrame API and Spotify's Embed iFrame API, with a mini bar, picture-in-picture and a fluid expanded panel with a queue.
  - Errors are spelled out; for example, "owner disallows embedding (code 150)".
- **Roadmap**:
  - Raiyan's and Afra's lanes side by side, plus Shared goals, in list, board (drag between columns) and timeline views.
  - You can edit your own items; shared items can be edited by both.
  - Also: milestones, overdue and due-soon badges, and completion bursts.
- **Musician tools**: chromatic tuner (autocorrelation, smoothing, A4 415–466), metronome (look-ahead Web Audio scheduler, tap tempo, subdivisions, accents), chord explorer, transposer, pitch pipe, progression builder and practice timer with checklists.
- **Profiles and settings**:
  - Each profile has its own "corner" (Portal Lab or Midnight Stage), and you can view your partner's.
  - Settings: theme (Portal / Stage / Fusion), ambient animation (full, still or off), reduced motion, chord display, tuning, capo, metronome and tuner defaults, preferred player, service status, password change, JSON export and logout.
- **Shell**:
  - ⌘K or `/` opens the command palette.
  - `g` then `h`, `c`, `p`, `r`, `t` or `s` jumps to a page.
  - Also: notifications for your partner's activity, a save-status indicator, a Spotify status indicator and a "Local demo mode" badge.

### Visual design
The UI uses AMOLED black with quiet panels and theme accents: acid lime, cyan and ultraviolet for Raiyan; magenta, purple and a red REC light for Afra; or both together.

Gold celestial ornaments from the sigil appear only at brand moments: the logo, the login screen, page eyebrows and hero corners.

All artwork is original SVG or CSS: portals, spotlights, waveforms, a Penrose triangle and two cat avatars (one in lab goggles, one in a fedora with a single sparkling glove).

Ambient motion uses only transform and opacity. It respects reduced-motion settings and can be paused or turned off.

## 2. Stack

React 19 · TypeScript · Vite · Tailwind CSS v4 · Motion (`motion/react`) · React Router · Zustand · Supabase (Auth, Postgres, RLS, Realtime) · Netlify (hosting + Functions) · Vitest + Testing Library.

## 3. Prerequisites

- Node.js 22 or newer (`node -v`)
- npm
- Optional: [Netlify CLI](https://docs.netlify.com/cli/get-started/) (`npm i -g netlify-cli`) to run the Functions locally.

## 4. Local development

```bash
npm install
```

```bash
npm run dev
```

Open **http://127.0.0.1:5173**. Use 127.0.0.1 rather than localhost, because Spotify only accepts the loopback IP. With no `.env.local` you're in **demo mode**: sign in as `raiyan` or `afra` with the password `Alimonus`.

To run the Netlify Functions as well (YouTube and Spotify server search, service health):

```bash
netlify dev
```

## 5. Environment variables

Copy `.env.example` to `.env.local` for local work. Add the **same names** in Netlify (Site configuration → Environment variables).

| Variable | Where | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Netlify + local | Turns on synced mode. The anon key is public by design; Row Level Security protects data. |
| `VITE_ALIMONUS_RAIYAN_EMAIL`, `VITE_ALIMONUS_AFRA_EMAIL` | Netlify + local | Internal login emails the usernames map to. |
| `VITE_SPOTIFY_CLIENT_ID` | Netlify + local | Spotify login (PKCE, so no secret in the browser). |
| `VITE_SPOTIFY_REDIRECT_URI` | optional | Defaults to `<origin>/callback/spotify`. |
| `VITE_YOUTUBE_API_KEY` | optional | Browser-side search key. Prefer `YOUTUBE_API_KEY`. |
| `VITE_APP_URL` | optional | Your public URL. |
| `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET` | **Netlify only** | `/api/spotify-search`: search Spotify before connecting an account. |
| `YOUTUBE_API_KEY` | **Netlify only** | `/api/youtube-search`, which keeps the key server-side. |
| `SUPABASE_SERVICE_ROLE_KEY`, `ALIMONUS_*` | **your computer only** | Used by `npm run provision`. **Never add the service role key to Netlify.** |

`VITE_*` values are baked into the build. After changing them in Netlify, trigger a new deploy.

## 6. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: paste and run `supabase/migrations/20261019000000_alimonus.sql`. It creates the tables, the RLS policies and the Realtime publication.
   - With the Supabase CLI you can run `supabase link` then `supabase db push` instead.
3. **Authentication → Sign In / Providers**: keep Email enabled and **turn off "Allow new users to sign up"**. Only the two provisioned accounts exist.
4. **Project Settings → API**: copy the Project URL and the `anon` key into `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Copy the `service_role` key into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY` (local only).

### Initial account provisioning

```bash
npm run provision -- --seed
```

This creates the two users with `ALIMONUS_INITIAL_PASSWORD` (default `Alimonus`), creates their profiles and loads the starter Chordbook, playlists, song states and roadmap. It only loads into empty tables, and running it again is safe.

- `npm run provision -- --reset-passwords` sets both passwords back to the initial one.
- `supabase/seed.sql` holds the starter songs as plain SQL; regenerate it with `node --experimental-strip-types scripts/generate-seed-sql.ts`.
- Passwords can be changed later in **Settings → Account** without rebuilding.

### Access model (kept simple on purpose)
- The song catalog, profiles, roadmap and activity can be read by both of you.
- Wishlist, covered status, notes, transpose/capo and Spotify tokens can only be written by their owner.
- Personal playlists are private. Shared playlists and shared roadmap items can be edited by both.
- You can delete only what you own.

## 7. Spotify

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard) → **Create app**. Select **Web API** (the Embed player needs no extra setting).
2. Add the **Redirect URIs**. They must match exactly:
   - `http://127.0.0.1:5173/callback/spotify` (local — Spotify rejects `localhost`)
   - `https://YOUR-SITE.netlify.app/callback/spotify` (production; add your custom domain too if you use one)
3. **User Management**: add both Spotify accounts by name and email. Development-mode apps only work for listed users, up to 5.
4. Put the Client ID in `VITE_SPOTIFY_CLIENT_ID`. Optionally add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` in Netlify for search without connecting.
5. In Alimonus: **Profile → Services → Connect**. Each profile connects its own account.

**Limitations to know about** (these follow Spotify's Web API rules as of February 2026):
- The app owner's Spotify account needs Premium for a development-mode app.
- Spotify only returns the tracks of playlists you own or collaborate on; other playlists show metadata only.
- Search returns at most 10 results.
- The player uses Spotify's official Embed. Listeners who aren't signed in to Spotify in that browser hear 30-second previews.
- Alimonus never downloads audio, and adding a track to an Alimonus playlist never changes your Spotify library.

## 8. YouTube

- **Playback works without a key** through the official IFrame Player. You can always paste a video link into a song's **Sources → Link** dialog.
- For search: Google Cloud Console → create a project → enable **YouTube Data API v3** → create an API key. Then:
  - set it as `YOUTUBE_API_KEY` in Netlify (recommended), or
  - set it as `VITE_YOUTUBE_API_KEY`, restricted to your site's referrers.
- `search.list` has a small daily allowance (about 100 searches per day by default). Alimonus caches results for 7 days, and in the Chordbook it only searches YouTube when you ask.
- Search results are suggestions. You choose which video to link, because the first hit is often a cover.
- Some videos block embedding (error 101/150). The player says so and offers "Open in YouTube".

## 9. GitHub

The repo is ready to push as-is: `.env*` files, `node_modules`, `dist`, `.netlify` and local tool folders are ignored, line endings are normalised (`.gitattributes`), and `.nvmrc` pins Node 22.

```bash
git remote add origin https://github.com/<you>/alimonus.git
```

```bash
git push -u origin main
```

Keep the repository **private**: the code holds no secrets, but it is a personal app.

`.github/workflows/ci.yml` runs typecheck, tests and a build on every push and pull request. It needs no secrets, because without Supabase variables the build is simply the demo mode.

## 10. Netlify deployment

`netlify.toml` already configures:
- the build: `npm run build` → `dist`, with Functions in `netlify/functions`
- `/api/*` → `/.netlify/functions/*`
- an SPA fallback so deep links and refreshes work (real files and assets are served first)
- long-term caching for hashed assets

It also sets light security headers (nosniff, referrer policy kept compatible with YouTube embeds, microphone allowed for the tuner) and stops `index.html` from being cached so new deploys show up immediately.

Steps:
1. In Netlify go to **Add new site → Import an existing project → GitHub** and pick the repo. Netlify reads `netlify.toml`, so leave the build settings as detected (build `npm run build`, publish `dist`, functions `netlify/functions`, Node 22). Every push to `main` then deploys automatically.
2. Add the environment variables from section 5.
3. Deploy, then add `https://<site>/callback/spotify` to the Spotify dashboard.
4. Sign in, open **Profile → Services** and check that each service shows as configured.

Netlify preview deploys get their own URLs. For Spotify to work on a preview, add that preview's callback URL to the Spotify dashboard, or test Spotify only on production.

## 11. Tests

```bash
npm test
```

```bash
npm run typecheck
```

```bash
npm run build
```

Or all three at once: `npm run check`.

The tests cover:
- music theory: chord parsing, transposition, capo suggestions, guitar voicing search including the familiar open shapes, piano inversions and ChordPro parsing
- pitch detection on synthetic tones
- metronome and tuner helpers
- the musician tools mounting
- Roadmap ownership rules
- store behaviour: wishlist and covered status kept separate per person, undo, playlists, settings
- search and matching, YouTube link parsing

## 12. Troubleshooting

| Symptom | Fix |
|---|---|
| "Local demo mode" badge in production | `VITE_SUPABASE_*` weren't set at build time. Set them and redeploy. |
| "This account has no Alimonus profile" | Run `npm run provision`. |
| Wrong password in synced mode | `npm run provision -- --reset-passwords`. |
| Spotify `INVALID_CLIENT: Invalid redirect URI` | The URI must match the dashboard exactly, including `127.0.0.1` vs `localhost` and trailing slashes. |
| Spotify 403 | The Spotify account isn't in User Management, or the playlist isn't owned by you. |
| YouTube "code 150" | The uploader disabled embedding. Link a different upload. |
| YouTube search says "not configured" under `npm run dev` | Functions only run with `netlify dev` or on Netlify. You can also set `VITE_YOUTUBE_API_KEY`. |
| Tuner says microphone blocked | Allow the mic in the browser's site settings. The tuner needs https (or 127.0.0.1). |
| Changes don't appear on the other device | Check that the migration's Realtime section ran (Database → Publications → `supabase_realtime`). |

## 13. Chord sheets and copyright

Alimonus **does not scrape** chord or lyric sites.
- The starter catalog includes full sheets only for public-domain songs (Amazing Grace, Scarborough Fair, Greensleeves, Danny Boy) and three Alimonus originals.
- Popular songs ship as metadata only, plus a chord progression where one is reliable, labelled "Suggested · unverified".
- Add your own arrangements in the editor; it accepts ChordPro or pasted chords-over-lyrics. These are shared through the Chordbook.
- The chord-provider interface (`src/integrations/chords`) is ready for a licensed provider later.

## 14. Project map

```
src/
  app/            App routes, Shell (dock, top bar, notifications), command palette, toasts
  components/     ui primitives, song controls, chord diagrams, art (Cosmos, Sigil, cats)
  features/       auth · dashboard · chordbook · playlists · player · roadmap · musician-tools · profiles
  integrations/   spotify (PKCE + Web API) · youtube (Data API + IFrame) · chords (provider interface)
  lib/            theory (notes, chords, guitar, piano, ChordPro) · audio · backend (local + Supabase) · env
  stores/         app data (optimistic saves + status), player, toasts
netlify/functions health · spotify-search · youtube-search
.github/workflows CI (typecheck, test, build)
supabase/         migrations + seed.sql
scripts/          provision.ts · generate-seed-sql.ts
```

## 15. Making it real: checklist for Raiyan

1. `npm install`, then `npm run dev`. Try demo mode.
2. Create a Supabase project, run the migration and turn off sign-ups.
3. Fill in `.env.local` (Supabase URL, anon key, service role key), then run `npm run provision -- --seed`.
4. Create the Spotify app and set its redirect URIs and users. Set `VITE_SPOTIFY_CLIENT_ID` (and optionally the secret for Netlify).
5. Create a YouTube Data API key and set `YOUTUBE_API_KEY` in Netlify.
6. Push to a private GitHub repo, import it into Netlify, add the env vars and deploy.
7. Add the production `/callback/spotify` URL in Spotify. Both of you sign in, change your passwords and connect Spotify.
