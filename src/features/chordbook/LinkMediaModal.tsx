import { ExternalLink, Link2, LoaderCircle, Search, Unlink } from 'lucide-react'
import { useState } from 'react'
import { Modal, Segmented } from '@/components/ui'
import { SpotifyMark, YouTubeMark } from '@/components/art/Art'
import { parseYouTubeId, youtubeSearchUrl, YouTubeNotConfigured } from '@/integrations/youtube'
import { spotifyTrackUrl } from '@/integrations/spotify'
import { spotifyProvider, youtubeProvider, type ExternalHit } from './search'
import { formatDuration } from '@/lib/util'
import type { Song } from '@/types'

function parseSpotifyId(input: string): string | null {
  const s = input.trim()
  const m = /(?:spotify:track:|open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/)([A-Za-z0-9]{22})/.exec(s)
  if (m) return m[1]
  return /^[A-Za-z0-9]{22}$/.test(s) ? s : null
}

/**
 * Associate the right recording with a song. Search results are suggestions only —
 * nothing is linked until you pick one, because the first hit is often a cover or live take.
 */
export function LinkMediaModal({ open, onClose, song, initialTab, onLink }: { open: boolean; onClose: () => void; song: Song; initialTab: 'youtube' | 'spotify'; onLink: (patch: Partial<Song>) => void }) {
  const [tab, setTab] = useState(initialTab)
  const [q, setQ] = useState(`${song.title} ${song.artist}`)
  const [paste, setPaste] = useState('')
  const [hits, setHits] = useState<ExternalHit[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async () => {
    setLoading(true)
    setError(null)
    setHits(null)
    try {
      setHits(await (tab === 'youtube' ? youtubeProvider : spotifyProvider).search(q))
    } catch (e) {
      setError(e instanceof YouTubeNotConfigured ? e.message : (e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const link = (hit: ExternalHit) => {
    if (hit.provider === 'youtube') onLink({ youtubeId: hit.externalId })
    else onLink({ spotifyId: hit.externalId, ...(song.artworkUrl ? {} : { artworkUrl: hit.artworkUrl }), ...(song.durationMs ? {} : { durationMs: hit.durationMs }), ...(song.album ? {} : { album: hit.album }) })
    onClose()
  }

  const pasted = tab === 'youtube' ? parseYouTubeId(paste) : parseSpotifyId(paste)
  const current = tab === 'youtube' ? song.youtubeId : song.spotifyId

  return (
    <Modal open={open} onClose={onClose} title="Link a recording" wide>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          layoutId="link-tab"
          value={tab}
          onChange={(v) => {
            setTab(v)
            setHits(null)
            setError(null)
          }}
          options={[
            { value: 'youtube', label: <><YouTubeMark className="h-4 w-4" /> YouTube</> },
            { value: 'spotify', label: <><SpotifyMark className="h-4 w-4" /> Spotify</> },
          ]}
        />
        {current && (
          <div className="flex items-center gap-2 text-xs text-mute">
            Linked:{' '}
            <a className="font-mono text-a1 hover:underline" href={tab === 'youtube' ? `https://www.youtube.com/watch?v=${current}` : spotifyTrackUrl(current)} target="_blank" rel="noreferrer">
              {current}
            </a>
            <button type="button" className="btn py-1 text-xs" onClick={() => onLink(tab === 'youtube' ? { youtubeId: null } : { spotifyId: null })}>
              <Unlink size={13} /> Unlink
            </button>
          </div>
        )}
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void run()
        }}
      >
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search query" />
        <button className="btn btn-primary" disabled={loading}>
          {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Search size={15} />} Search
        </button>
      </form>

      <div className="mt-3 min-h-24">
        {error && (
          <div className="text-sm text-mute">
            <p>{error}</p>
            {tab === 'youtube' && (
              <a className="btn mt-2" href={youtubeSearchUrl(q)} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Search on YouTube
              </a>
            )}
          </div>
        )}
        {hits && !hits.length && <p className="text-sm text-mute">{tab === 'spotify' ? 'No results — connect Spotify in Settings or paste a track link below.' : 'No results.'}</p>}
        {hits && hits.length > 0 && (
          <ul className="flex max-h-72 flex-col gap-1 overflow-auto">
            {hits.map((h) => (
              <li key={h.externalId} className="flex items-center gap-3 rounded-xl p-1.5 hover:bg-white/[0.04]">
                {h.artworkUrl ? <img src={h.artworkUrl} alt="" className="h-11 w-16 shrink-0 rounded-lg object-cover" /> : <div className="h-11 w-16 rounded-lg bg-white/5" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{h.title}</div>
                  <div className="truncate text-xs text-mute">
                    {h.artist} · {formatDuration(h.durationMs)}
                  </div>
                </div>
                <a className="btn btn-ghost btn-icon" href={h.url} target="_blank" rel="noreferrer" aria-label="Open source">
                  <ExternalLink size={14} />
                </a>
                <button type="button" className="btn py-1.5 text-xs" onClick={() => link(h)}>
                  <Link2 size={13} /> {current === h.externalId ? 'Linked' : 'Link'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-line pt-4">
        <div className="label mb-2">Or paste a {tab === 'youtube' ? 'YouTube link' : 'Spotify track link'}</div>
        <div className="flex gap-2">
          <input className="input font-mono text-sm" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={tab === 'youtube' ? 'https://www.youtube.com/watch?v=…' : 'https://open.spotify.com/track/…'} aria-label="Paste link" />
          <button
            type="button"
            className="btn"
            disabled={!pasted}
            onClick={() => {
              onLink(tab === 'youtube' ? { youtubeId: pasted } : { spotifyId: pasted })
              onClose()
            }}
          >
            <Link2 size={14} /> Link
          </button>
        </div>
        {paste && !pasted && <p className="mt-1 text-xs text-ember">That doesn’t look like a {tab === 'youtube' ? 'YouTube video' : 'Spotify track'} link.</p>}
      </div>
    </Modal>
  )
}
