import { useState } from 'react'
import { useNavigate } from 'react-router'
import { Field, Modal } from '@/components/ui'
import { useApp } from '@/stores/app'
import { chordsOverLyricsToChordPro } from '@/lib/theory/chordpro'
import { parseKey } from '@/lib/theory/chords'

/** Manual song entry, optionally with a pasted arrangement (ChordPro or chords-over-lyrics). */
export function AddSongModal({ open, onClose, initialTitle = '' }: { open: boolean; onClose: () => void; initialTitle?: string }) {
  const createSong = useApp((s) => s.createSong)
  const navigate = useNavigate()
  const [title, setTitle] = useState(initialTitle)
  const [artist, setArtist] = useState('')
  const [album, setAlbum] = useState('')
  const [key, setKey] = useState('')
  const [bpm, setBpm] = useState('')
  const [sheet, setSheet] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !artist.trim()) return
    const text = sheet.trim()
    const chordPro = text ? (/\[[^\]]+\]/.test(text) || /\{\w+/.test(text) ? text : chordsOverLyricsToChordPro(text)) : null
    const song = createSong({
      title: title.trim(),
      artist: artist.trim(),
      album: album.trim() || null,
      key: parseKey(key) ? key.trim() : null,
      bpm: bpm ? Number(bpm) : null,
      chordSheet: chordPro,
      chordSource: chordPro ? 'user' : null,
      provenance: chordPro ? 'Entered in Alimonus' : 'Added manually',
    })
    onClose()
    navigate(`/song/${song.id}`)
  }

  return (
    <Modal open={open} onClose={onClose} title="Add a song to the Chordbook" wide>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Title">
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
        </Field>
        <Field label="Artist">
          <input className="input" value={artist} onChange={(e) => setArtist(e.target.value)} required />
        </Field>
        <Field label="Album">
          <input className="input" value={album} onChange={(e) => setAlbum(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Key" hint={key && !parseKey(key) ? 'Use e.g. G, F#m, Bb' : undefined}>
            <input className="input font-mono" value={key} onChange={(e) => setKey(e.target.value)} placeholder="Am" />
          </Field>
          <Field label="BPM">
            <input className="input" type="number" min={20} max={320} value={bpm} onChange={(e) => setBpm(e.target.value)} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="Arrangement (optional)" hint="Paste ChordPro ([Am]lyrics) or plain chords-above-lyrics text you’ve written or have rights to — it’s converted automatically.">
            <textarea className="input min-h-48 font-mono text-sm" value={sheet} onChange={(e) => setSheet(e.target.value)} placeholder={'Verse 1\nAm        G\nWords of your own arrangement'} />
          </Field>
        </div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" disabled={!title.trim() || !artist.trim()}>
            Add & open
          </button>
        </div>
      </form>
    </Modal>
  )
}
