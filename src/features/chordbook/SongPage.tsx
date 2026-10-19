import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  FileMusic,
  Link2,
  Minus,
  Pencil,
  Play,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Type,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router'
import { useApp, useSettings, useSongState } from '@/stores/app'
import { Artwork, CoverButton, DuetBadge, WishlistStar } from '@/components/SongControls'
import { Badge, EmptyState, Field, Modal, Segmented, spring } from '@/components/ui'
import { SpotifyMark, YouTubeMark, CatAvatar } from '@/components/art/Art'
import { parseChordPro, transposeSheet, uniqueChords, type Sheet } from '@/lib/theory/chordpro'
import { formatKey, parseKey, suggestCapo, transposeChord, transposeKey, type SpellingPref } from '@/lib/theory/chords'
import { preferredAccidental, type Accidental } from '@/lib/theory/notes'
import { findChordSheets, SOURCE_LABEL, type ChordSheetCandidate } from '@/integrations/chords'
import { playSong, songToTrack } from '@/features/player/tracks'
import { usePlayer } from '@/stores/player'
import { cx, formatDate, formatDuration } from '@/lib/util'
import { AddToPlaylist } from '@/features/playlists/AddToPlaylist'
import { SheetView } from './SheetView'
import { ChordPanels } from './ChordPanels'
import { SheetEditor } from './SheetEditor'
import { LinkMediaModal } from './LinkMediaModal'
import type { Song } from '@/types'

export default function SongPage() {
  const { id } = useParams()
  const song = useApp((s) => s.data.songs.find((x) => x.id === id))
  const navigate = useNavigate()

  if (!song)
    return (
      <div className="relative z-10 mx-auto max-w-xl px-4 pt-16">
        <EmptyState
          icon={<Search size={34} />}
          title="This song slipped into another dimension"
          body="It may have been deleted, or it hasn’t synced yet."
          action={
            <button className="btn btn-primary" onClick={() => navigate('/chordbook')}>
              Back to the Chordbook
            </button>
          }
        />
      </div>
    )
  return <Workspace song={song} />
}

function Workspace({ song }: { song: Song }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const me = useApp((s) => s.me)!
  const settings = useSettings()
  const updateSettings = useApp((s) => s.updateSettings)
  const touchSong = useApp((s) => s.touchSong)
  const setSongPrefs = useApp((s) => s.setSongPrefs)
  const saveSong = useApp((s) => s.saveSong)
  const deleteSong = useApp((s) => s.deleteSong)
  const state = useSongState(song.id)
  const allSongs = useApp((s) => s.data.songs)
  const items = useApp((s) => s.data.items)
  const playlists = useApp((s) => s.data.playlists)

  const transpose = state?.transpose ?? 0
  const capo = state?.capo ?? settings.defaultCapo
  const [selectedOrig, setSelectedOrig] = useState<string | null>(null)
  const [mobileTab, setMobileTab] = useState<'sheet' | 'info' | 'chords'>('sheet')
  const [editing, setEditing] = useState(false)
  const [linking, setLinking] = useState<null | 'youtube' | 'spotify'>(null)
  const [editMeta, setEditMeta] = useState(false)
  const [focus, setFocus] = useState(false)

  // Mark as opened (once per song visit).
  useEffect(() => {
    touchSong(song.id)
    setSelectedOrig(null)
  }, [song.id]) // eslint-disable-line react-hooks/exhaustive-deps

  /* ---------- sheet + transposition ---------- */
  const original = useMemo<Sheet | null>(() => (song.chordSheet ? parseChordPro(song.chordSheet) : null), [song.chordSheet])
  const progressionSheet = useMemo<Sheet | null>(() => {
    if (original || !song.progression) return null
    return { meta: {}, sections: [{ type: 'other', label: 'Progression', lines: [{ kind: 'lyric', segments: song.progression.split(/\s+/).filter(Boolean).map((c) => ({ chord: c, text: '' })) }] }] }
  }, [original, song.progression])
  const base = original ?? progressionSheet
  const songKey = parseKey(song.key ?? base?.meta.key)
  const pref: SpellingPref = settings.accidental
  const accidental: Accidental = pref === 'auto' ? (songKey ? preferredAccidental(songKey.tonic + transpose, songKey.minor) : 'sharp') : pref
  const shapeShift = transpose - capo
  // Spell by the key you're reading in (minor keys matter: F#m, not Gbm).
  const shapePref: SpellingPref = pref !== 'auto' ? pref : songKey ? preferredAccidental(songKey.tonic + shapeShift, songKey.minor) : 'auto'
  const soundPref: SpellingPref = pref !== 'auto' ? pref : songKey ? preferredAccidental(songKey.tonic + transpose, songKey.minor) : 'auto'
  const display = useMemo(() => (base ? transposeSheet(base, shapeShift, shapeShift === 0 && pref === 'auto' ? 'auto' : shapePref) : null), [base, shapeShift, pref, shapePref])
  const origChords = useMemo(() => (base ? uniqueChords(base) : []), [base])
  const toShape = useCallback((c: string) => transposeChord(c, shapeShift, shapeShift === 0 && pref === 'auto' ? 'auto' : shapePref), [shapeShift, pref, shapePref])
  const toSounding = useCallback((c: string) => transposeChord(c, transpose, transpose === 0 && pref === 'auto' ? 'auto' : soundPref), [transpose, pref, soundPref])
  const palette = useMemo(() => origChords.map((c) => ({ key: c, shape: toShape(c) })), [origChords, toShape])
  const selectedShape = selectedOrig ? toShape(selectedOrig) : null
  const selectedSounding = selectedOrig ? toSounding(selectedOrig) : null
  const onSelectShape = useCallback((shape: string) => setSelectedOrig(origChords.find((c) => toShape(c) === shape) ?? null), [origChords, toShape])
  useEffect(() => {
    if (!selectedOrig && origChords.length) setSelectedOrig(origChords[0])
  }, [origChords, selectedOrig])

  const soundingKey = song.key ? transposeKey(song.key, transpose, pref) : null
  const shapeKey = song.key ? transposeKey(song.key, shapeShift, pref) : null
  const capoIdeas = useMemo(() => suggestCapo(origChords.map(toSounding)).slice(0, 3), [origChords, toSounding])

  const setTranspose = (n: number) => setSongPrefs(song.id, { transpose: ((n + 17) % 12) - 5 })
  const setCapo = (n: number) => setSongPrefs(song.id, { capo: Math.max(0, Math.min(11, n)) })

  /* ---------- prev / next song ---------- */
  const listId = params.get('list')
  const sequence = useMemo(() => {
    if (listId) return items.filter((i) => i.playlistId === listId).sort((a, b) => a.position - b.position).map((i) => i.songId)
    return [...allSongs].sort((a, b) => a.title.localeCompare(b.title)).map((s) => s.id)
  }, [listId, items, allSongs])
  const idx = sequence.indexOf(song.id)
  const go = useCallback(
    (d: number) => {
      const next = sequence[idx + d]
      if (next) navigate(`/song/${next}${listId ? `?list=${listId}` : ''}`)
    },
    [sequence, idx, navigate, listId],
  )

  // Keyboard: [ ] prev/next song, + - transpose, e edit, f focus, ←/→ cycle chords.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, select, [contenteditable="true"]') || e.metaKey || e.ctrlKey) return
      if (document.querySelector('[role="dialog"]')) return
      if (e.key === '[') go(-1)
      else if (e.key === ']') go(1)
      else if (e.key === '+' || e.key === '=') setTranspose(transpose + 1)
      else if (e.key === '-') setTranspose(transpose - 1)
      else if (e.key === 'e') setEditing(true)
      else if (e.key === 'f') setFocus((v) => !v)
      else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && origChords.length) {
        const i = selectedOrig ? origChords.indexOf(selectedOrig) : -1
        const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + origChords.length) % origChords.length
        setSelectedOrig(origChords[n])
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const songPlaylists = playlists.filter((p) => (p.ownerId === me.id || p.shared) && items.some((i) => i.playlistId === p.id && i.songId === song.id))
  const canDelete = song.createdBy === me.id || song.createdBy === me.username

  const sheetPanel = (
    <SheetColumn
      song={song}
      display={display}
      hasFullSheet={!!original}
      selected={selectedShape}
      onSelect={onSelectShape}
      settings={settings}
      updateSettings={updateSettings}
      transpose={transpose}
      capo={capo}
      setTranspose={setTranspose}
      setCapo={setCapo}
      soundingKey={soundingKey}
      shapeKey={shapeKey}
      capoIdeas={capoIdeas}
      accidental={pref}
      onEdit={() => setEditing(true)}
      onFocus={() => setFocus(true)}
      allSongs={allSongs}
    />
  )
  const chordsPanel = (
    <ChordPanels
      shapeChord={selectedShape}
      soundingChord={selectedSounding}
      capo={capo}
      tuningId={settings.tuning}
      onTuning={(t) => updateSettings({ tuning: t })}
      accidental={accidental}
      palette={palette}
      onPick={(k) => setSelectedOrig(k)}
    />
  )
  const infoPanel = (
    <InfoColumn
      song={song}
      soundingKey={soundingKey}
      notes={state?.notes ?? ''}
      onNotes={(n) => setSongPrefs(song.id, { notes: n })}
      onLink={setLinking}
      onEditMeta={() => setEditMeta(true)}
      playlists={songPlaylists}
      coveredAt={state?.coveredAt ?? null}
    />
  )

  return (
    <motion.div className="relative z-10 flex min-h-[calc(100dvh-68px)] flex-col px-3 pb-36 sm:px-5 lg:px-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      {/* Header */}
      <div className="glass sticky top-[68px] z-20 mb-4 flex flex-wrap items-center gap-2 rounded-[22px] px-3 py-2.5 sm:gap-3">
        <button className="btn btn-ghost btn-icon" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={18} />
        </button>
        <AnimatePresence mode="wait">
          <motion.div key={song.id} initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.2 }} className="flex min-w-0 flex-1 items-center gap-3">
            <Artwork song={song} className="hidden h-10 w-10 shrink-0 text-[0.5rem] sm:block" rounded="rounded-xl" />
            <div className="min-w-0">
              <h1 className="display truncate text-lg font-extrabold leading-tight sm:text-xl">{song.title}</h1>
              <div className="truncate text-sm text-mute">
                {song.artist}
                {soundingKey && (
                  <>
                    {' · '}
                    <span className="font-mono text-a1">{soundingKey}</span>
                    {capo > 0 && <span className="font-mono"> · capo {capo}</span>}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
        <div className="hidden items-center gap-1 sm:flex">
          <button className="btn btn-ghost btn-icon" onClick={() => go(-1)} disabled={idx <= 0} aria-label="Previous song" title="Previous song ([)">
            <ChevronLeft size={18} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => go(1)} disabled={idx < 0 || idx >= sequence.length - 1} aria-label="Next song" title="Next song (])">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          {songToTrack(song) && (
            <button className="btn btn-primary" onClick={() => playSong(song, [song], settings.playerSource)}>
              <Play size={15} fill="currentColor" /> <span className="hidden sm:inline">Play</span>
            </button>
          )}
          <WishlistStar songId={song.id} size={20} />
          <CoverButton songId={song.id} />
          <span className="hidden sm:inline-flex">
            <DuetBadge songId={song.id} />
          </span>
          <div className="hidden lg:block">
            <AddToPlaylist songId={song.id} label="Playlist" />
          </div>
          <MoreMenu onEdit={() => setEditing(true)} onMeta={() => setEditMeta(true)} onPrint={() => window.print()} canDelete={canDelete} onDelete={() => { deleteSong(song.id); navigate('/chordbook') }} />
        </div>
      </div>

      {/* Mobile tabs */}
      <div className="mb-3 flex justify-center xl:hidden">
        <Segmented
          layoutId="song-tabs"
          value={mobileTab}
          onChange={setMobileTab}
          options={[
            { value: 'info', label: 'Info' },
            { value: 'sheet', label: 'Sheet' },
            { value: 'chords', label: 'Chords' },
          ]}
        />
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={song.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ type: 'spring', stiffness: 320, damping: 32 }} className="grid flex-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
          <div className={cx('xl:block', mobileTab === 'info' ? 'block' : 'hidden')}>{infoPanel}</div>
          <div className={cx('min-w-0 lg:block', mobileTab === 'sheet' ? 'block' : 'hidden')}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] xl:block">
              {sheetPanel}
              <div className="hidden lg:block xl:hidden">{chordsPanel}</div>
            </div>
          </div>
          <div className={cx('xl:block', mobileTab === 'chords' ? 'block lg:hidden' : 'hidden')}>{chordsPanel}</div>
        </motion.div>
      </AnimatePresence>

      <SheetEditor
        key={`${song.id}-${String(editing)}`}
        open={editing}
        onClose={() => setEditing(false)}
        song={song}
        onSave={(sheet, progression, source) => void saveSong({ ...song, chordSheet: sheet, progression, chordSource: source, provenance: sheet && song.chordSheet !== sheet ? (song.provenance?.includes('original') ? song.provenance : 'Edited in Alimonus') : song.provenance })}
      />
      {linking && <LinkMediaModal open onClose={() => setLinking(null)} song={song} initialTab={linking} onLink={(patch) => void saveSong({ ...song, ...patch })} />}
      <MetaEditor key={`${song.id}-${String(editMeta)}`} open={editMeta} onClose={() => setEditMeta(false)} song={song} onSave={(s) => void saveSong(s)} />
      <AnimatePresence>
        {focus && display && <FocusMode sheet={display} title={song.title} artist={song.artist} selected={selectedShape} onSelect={onSelectShape} onClose={() => setFocus(false)} settings={settings} />}
      </AnimatePresence>
    </motion.div>
  )
}

/* ---------------------------------------------------------------------------------------- */

function SheetColumn(props: {
  song: Song
  display: Sheet | null
  hasFullSheet: boolean
  selected: string | null
  onSelect: (c: string) => void
  settings: ReturnType<typeof useSettings>
  updateSettings: (p: Partial<ReturnType<typeof useSettings>>) => void
  transpose: number
  capo: number
  setTranspose: (n: number) => void
  setCapo: (n: number) => void
  soundingKey: string | null
  shapeKey: string | null
  capoIdeas: ReturnType<typeof suggestCapo>
  accidental: SpellingPref
  onEdit: () => void
  onFocus: () => void
  allSongs: Song[]
}) {
  const { song, display, settings, updateSettings, transpose, capo, setTranspose, setCapo } = props
  const [showCapo, setShowCapo] = useState(false)
  const [candidates, setCandidates] = useState<ChordSheetCandidate[] | null>(null)
  const saveSong = useApp((s) => s.saveSong)

  return (
    <section className="panel flex min-h-[60vh] flex-col p-0 xl:h-[calc(100dvh-180px)]">
      {/* toolbar */}
      <div className="no-print flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3">
        <Stepper label="Key" value={transpose === 0 ? 'Original' : `${transpose > 0 ? '+' : ''}${transpose}`} onDec={() => setTranspose(transpose - 1)} onInc={() => setTranspose(transpose + 1)} sub={props.soundingKey ?? undefined} />
        {transpose !== 0 && (
          <button className="btn btn-ghost btn-icon" onClick={() => setTranspose(0)} aria-label="Reset to original key" title="Reset to original key">
            <RotateCcw size={14} />
          </button>
        )}
        <div className="relative">
          <Stepper label="Capo" value={capo ? String(capo) : 'None'} onDec={() => setCapo(capo - 1)} onInc={() => setCapo(capo + 1)} sub={capo ? `shapes in ${props.shapeKey ?? '—'}` : undefined} onLabel={() => setShowCapo((v) => !v)} />
          <AnimatePresence>
            {showCapo && props.capoIdeas.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={spring} className="panel absolute left-0 top-12 z-30 w-64 p-2">
                <div className="label px-2 py-1">Easiest capo positions</div>
                {props.capoIdeas.map((c) => (
                  <button key={c.capo} className="flex w-full flex-col rounded-xl px-2 py-1.5 text-left hover:bg-white/5" onClick={() => { setCapo(c.capo); setShowCapo(false) }}>
                    <span className="text-sm font-semibold">{c.capo ? `Capo ${c.capo}` : 'No capo'}</span>
                    <span className="truncate font-mono text-xs text-a1">{c.shapes.join(' ')}</span>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <select className="input w-auto py-1.5 text-xs" value={settings.accidental} onChange={(e) => updateSettings({ accidental: e.target.value as SpellingPref })} aria-label="Sharps or flats">
          <option value="auto">♯/♭ auto</option>
          <option value="sharp">Sharps ♯</option>
          <option value="flat">Flats ♭</option>
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button className="btn btn-ghost btn-icon" onClick={() => updateSettings({ fontScale: Math.max(0.75, +(settings.fontScale - 0.1).toFixed(2)) })} aria-label="Smaller text">
            <Type size={13} />
          </button>
          <button className="btn btn-ghost btn-icon" onClick={() => updateSettings({ fontScale: Math.min(1.8, +(settings.fontScale + 0.1).toFixed(2)) })} aria-label="Larger text">
            <Type size={18} />
          </button>
          <Segmented
            size="sm"
            layoutId="chord-style"
            value={settings.chordStyle}
            onChange={(v) => updateSettings({ chordStyle: v })}
            options={[
              { value: 'above', label: 'Above' },
              { value: 'inline', label: 'Inline' },
            ]}
          />
          <button className={cx('btn btn-ghost px-2 py-1 font-mono text-xs', settings.monospace && 'text-a1')} onClick={() => updateSettings({ monospace: !settings.monospace })} aria-pressed={settings.monospace} title="Monospace alignment">
            Mono
          </button>
          {display && (
            <button className="btn btn-ghost btn-icon" onClick={props.onFocus} aria-label="Focus mode" title="Distraction-free mode (f)">
              <Expand size={16} />
            </button>
          )}
          <button className="btn btn-ghost btn-icon" onClick={props.onEdit} aria-label="Edit arrangement" title="Edit arrangement (e)">
            <Pencil size={15} />
          </button>
        </div>
      </div>

      <div className="relative flex-1 overflow-auto px-5 py-5 sm:px-7">
        {song.chordSource && (
          <div className="no-print mb-4 flex flex-wrap items-center gap-2 text-xs text-mute">
            <Badge tone={song.chordSource === 'verified' ? 'a1' : song.chordSource === 'suggested' ? 'warn' : 'default'}>{SOURCE_LABEL[song.chordSource]}</Badge>
            {song.provenance && <span>{song.provenance}</span>}
          </div>
        )}
        {display ? (
          <>
            <SheetView sheet={display} selected={props.selected} onSelect={props.onSelect} mode={settings.chordStyle} mono={settings.monospace} scale={settings.fontScale} />
            {!props.hasFullSheet && (
              <div className="no-print mt-8">
                <EmptyState
                  icon={<FileMusic size={30} />}
                  title="Only a progression so far"
                  body="Lyrics for this song aren’t included (copyright). Write your own arrangement with the parts you need."
                  action={
                    <button className="btn btn-primary" onClick={props.onEdit}>
                      <Pencil size={15} /> Write arrangement
                    </button>
                  }
                />
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col gap-4">
            <EmptyState
              icon={<FileMusic size={34} />}
              title="No chord sheet yet"
              body="Alimonus doesn’t scrape chord sites. Add an arrangement you’ve written (or have rights to), or look for one already in the Chordbook."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <button className="btn btn-primary" onClick={props.onEdit}>
                    <Pencil size={15} /> Add arrangement
                  </button>
                  <button className="btn" onClick={() => void findChordSheets(song, props.allSongs).then(setCandidates)}>
                    <Search size={15} /> Find available chords
                  </button>
                </div>
              }
            />
            {candidates && (
              <div className="panel p-4">
                {candidates.length ? (
                  <ul className="flex flex-col gap-2">
                    {candidates.map((c, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold">{c.label}</div>
                          <div className="text-xs text-mute">
                            {SOURCE_LABEL[c.source]} · {c.provenance}
                          </div>
                        </div>
                        <button className="btn text-xs" onClick={() => void saveSong({ ...song, chordSheet: c.chordPro, progression: c.progression, chordSource: c.source, provenance: c.provenance })}>
                          Use this
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-mute">No authorized chord sheets found for this song. Write one — it’ll be shared with your duo partner.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Stepper({ label, value, onDec, onInc, sub, onLabel }: { label: string; value: string; onDec: () => void; onInc: () => void; sub?: string; onLabel?: () => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <button type="button" className={cx('label', onLabel && 'underline decoration-dotted underline-offset-4 hover:text-white')} onClick={onLabel} disabled={!onLabel}>
        {label}
      </button>
      <div className="flex items-center rounded-full border border-line bg-white/[0.03]">
        <button className="rounded-full p-1.5 text-mute hover:text-white" onClick={onDec} aria-label={`${label} down`}>
          <Minus size={13} />
        </button>
        <motion.span key={value} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="min-w-14 text-center font-mono text-xs font-bold text-a1">
          {value}
        </motion.span>
        <button className="rounded-full p-1.5 text-mute hover:text-white" onClick={onInc} aria-label={`${label} up`}>
          <Plus size={13} />
        </button>
      </div>
      {sub && <span className="hidden font-mono text-[0.68rem] text-mute 2xl:inline">{sub}</span>}
    </div>
  )
}

/* ---------------------------------------------------------------------------------------- */

function InfoColumn({
  song,
  soundingKey,
  notes,
  onNotes,
  onLink,
  onEditMeta,
  playlists,
  coveredAt,
}: {
  song: Song
  soundingKey: string | null
  notes: string
  onNotes: (n: string) => void
  onLink: (t: 'youtube' | 'spotify') => void
  onEditMeta: () => void
  playlists: { id: string; name: string; color: string; shared: boolean }[]
  coveredAt: string | null
}) {
  const [draft, setDraft] = useState(notes)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => setDraft(notes), [song.id]) // eslint-disable-line react-hooks/exhaustive-deps
  const profiles = useApp((s) => s.data.profiles)
  const states = useApp((s) => s.data.states)
  const playTrack = usePlayer((s) => s.playTrack)
  const coveredBy = profiles.filter((p) => states.some((st) => st.userId === p.id && st.songId === song.id && st.covered))

  const meta: [string, React.ReactNode][] = [
    ['Album', song.album],
    ['Released', song.releaseYear],
    ['Duration', song.durationMs ? formatDuration(song.durationMs) : null],
    ['Key', song.key ? <span className="font-mono text-a1">{song.key}{soundingKey && soundingKey !== song.key ? <span className="text-a2"> → {soundingKey}</span> : null}</span> : null],
    ['Tempo', song.bpm ? `${song.bpm} BPM` : null],
    ['Genre', song.genre],
  ]

  return (
    <aside className="flex flex-col gap-4">
      <div className="panel overflow-hidden p-0">
        <motion.div layoutId={`art-${song.id}`} className="relative aspect-square">
          <Artwork song={song} className="h-full w-full text-[3rem]" rounded="rounded-none" />
          <div className="absolute inset-0 bg-gradient-to-t from-panel via-transparent" />
        </motion.div>
        <div className="-mt-10 relative px-4 pb-4">
          <h2 className="display text-2xl font-extrabold leading-tight">{song.title}</h2>
          <div className="text-soft">{song.artist}</div>
          {song.altTitles.length > 0 && <div className="mt-1 text-xs text-mute">aka {song.altTitles.join(', ')}</div>}
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
            {meta
              .filter(([, v]) => v !== null && v !== undefined && v !== '')
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="label">{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
          </dl>
          <button className="mt-3 text-xs text-mute underline-offset-2 hover:text-white hover:underline" onClick={onEditMeta}>
            Edit details
          </button>
        </div>
      </div>

      {song.description && <div className="panel p-4 text-sm leading-relaxed text-soft">{song.description}</div>}

      <div className="panel p-4">
        <div className="label mb-2">Sources</div>
        <div className="flex flex-col gap-2">
          <SourceRow
            icon={<YouTubeMark className="h-5 w-5" />}
            label="YouTube"
            linked={!!song.youtubeId}
            href={song.youtubeId ? `https://www.youtube.com/watch?v=${song.youtubeId}` : undefined}
            onPlay={song.youtubeId ? () => playTrack({ key: `youtube:${song.id}`, songId: song.id, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, source: 'youtube', youtubeId: song.youtubeId! }) : undefined}
            onLink={() => onLink('youtube')}
          />
          <SourceRow
            icon={<SpotifyMark className="h-5 w-5" />}
            label="Spotify"
            linked={!!song.spotifyId}
            href={song.spotifyId ? `https://open.spotify.com/track/${song.spotifyId}` : undefined}
            onPlay={song.spotifyId ? () => playTrack({ key: `spotify:${song.id}`, songId: song.id, title: song.title, artist: song.artist, artworkUrl: song.artworkUrl, source: 'spotify', spotifyUri: `spotify:track:${song.spotifyId}` }) : undefined}
            onLink={() => onLink('spotify')}
          />
        </div>
      </div>

      <div className="panel p-4">
        <div className="label mb-2">Your notes</div>
        <textarea
          className="input min-h-24 text-sm"
          value={draft}
          placeholder="Strumming pattern, where to breathe, who sings what…"
          onChange={(e) => {
            setDraft(e.target.value)
            clearTimeout(timer.current)
            const v = e.target.value
            timer.current = setTimeout(() => onNotes(v), 600)
          }}
          onBlur={() => {
            clearTimeout(timer.current)
            if (draft !== notes) onNotes(draft)
          }}
          aria-label="Personal notes"
        />
        <p className="mt-1 text-[0.68rem] text-mute">Private to you.</p>
      </div>

      <div className="panel p-4 text-sm">
        <div className="label mb-2">Status</div>
        <div className="flex flex-col gap-2">
          {coveredBy.length ? (
            coveredBy.map((p) => (
              <div key={p.id} className="flex items-center gap-2">
                <CatAvatar who={p.username} size={26} animated={false} /> <span>{p.displayName.split(' ')[0]} covered it</span>
              </div>
            ))
          ) : (
            <span className="text-mute">Nobody has covered this yet.</span>
          )}
          {coveredAt && <span className="text-xs text-mute">You covered it {formatDate(coveredAt)}</span>}
        </div>
        <div className="label mb-2 mt-4">Playlists</div>
        <div className="flex flex-wrap gap-1.5">
          {playlists.map((p) => (
            <Link key={p.id} to={`/playlists/${p.id}`} className="chip">
              <span className="h-2 w-2 rounded-full" style={{ background: p.color }} /> {p.name}
            </Link>
          ))}
          {!playlists.length && <span className="text-mute">Not in any playlist.</span>}
        </div>
        <div className="mt-3 lg:hidden">
          <AddToPlaylist songId={song.id} />
        </div>
        {song.credits && (
          <>
            <div className="label mb-1 mt-4">Credits</div>
            <p className="text-xs text-soft">{song.credits}</p>
          </>
        )}
      </div>
    </aside>
  )
}

function SourceRow({ icon, label, linked, href, onPlay, onLink }: { icon: React.ReactNode; label: string; linked: boolean; href?: string; onPlay?: () => void; onLink: () => void }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="flex-1 text-sm">{linked ? label : <span className="text-mute">{label} · not linked</span>}</span>
      {onPlay && (
        <button className="btn btn-ghost btn-icon" onClick={onPlay} aria-label={`Play on ${label}`}>
          <Play size={14} />
        </button>
      )}
      {href && (
        <a className="btn btn-ghost btn-icon" href={href} target="_blank" rel="noreferrer" aria-label={`Open in ${label}`}>
          <ExternalLink size={14} />
        </a>
      )}
      <button className="btn py-1 text-xs" onClick={onLink}>
        <Link2 size={13} /> {linked ? 'Change' : 'Link'}
      </button>
    </div>
  )
}

function MoreMenu({ onEdit, onMeta, onPrint, canDelete, onDelete }: { onEdit: () => void; onMeta: () => void; onPrint: () => void; canDelete: boolean; onDelete: () => void }) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && (setOpen(false), setConfirm(false))
    window.addEventListener('mousedown', h)
    return () => window.removeEventListener('mousedown', h)
  }, [open])
  return (
    <div className="relative" ref={ref}>
      <button className="btn btn-ghost btn-icon" onClick={() => setOpen((v) => !v)} aria-label="More actions" aria-expanded={open}>
        <span className="text-lg leading-none">⋯</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} transition={spring} className="panel absolute right-0 top-11 z-40 w-56 p-1.5" role="menu">
            {[
              { label: 'Edit arrangement', icon: <Pencil size={14} />, run: onEdit },
              { label: 'Edit song details', icon: <Type size={14} />, run: onMeta },
              { label: 'Print / save as PDF', icon: <Printer size={14} />, run: onPrint },
            ].map((a) => (
              <button key={a.label} role="menuitem" className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-white/5" onClick={() => { setOpen(false); a.run() }}>
                {a.icon} {a.label}
              </button>
            ))}
            {canDelete && (
              <button role="menuitem" className={cx('flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-sm', confirm ? 'bg-rec/20 text-rec' : 'text-rec/80 hover:bg-rec/10')} onClick={() => (confirm ? onDelete() : setConfirm(true))}>
                <Trash2 size={14} /> {confirm ? 'Click again to delete' : 'Delete song'}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MetaEditor({ open, onClose, song, onSave }: { open: boolean; onClose: () => void; song: Song; onSave: (s: Song) => void }) {
  const [f, setF] = useState({
    title: song.title,
    artist: song.artist,
    album: song.album ?? '',
    key: song.key ?? '',
    bpm: song.bpm ? String(song.bpm) : '',
    year: song.releaseYear ? String(song.releaseYear) : '',
    genre: song.genre ?? '',
    alt: song.altTitles.join(', '),
    description: song.description ?? '',
    credits: song.credits ?? '',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  const keyOk = !f.key || !!parseKey(f.key)
  return (
    <Modal open={open} onClose={onClose} title="Song details" wide>
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (!keyOk) return
          const k = parseKey(f.key)
          onSave({
            ...song,
            title: f.title.trim() || song.title,
            artist: f.artist.trim() || song.artist,
            album: f.album.trim() || null,
            key: k ? formatKey(k, f.key.includes('b') ? 'flat' : f.key.includes('#') ? 'sharp' : 'auto') : null,
            bpm: f.bpm ? Number(f.bpm) : null,
            releaseYear: f.year ? Number(f.year) : null,
            genre: f.genre.trim() || null,
            altTitles: f.alt.split(',').map((s) => s.trim()).filter(Boolean),
            description: f.description.trim() || null,
            credits: f.credits.trim() || null,
          })
          onClose()
        }}
      >
        <Field label="Title"><input className="input" value={f.title} onChange={set('title')} /></Field>
        <Field label="Artist"><input className="input" value={f.artist} onChange={set('artist')} /></Field>
        <Field label="Album"><input className="input" value={f.album} onChange={set('album')} /></Field>
        <Field label="Alternative titles" hint="Comma-separated"><input className="input" value={f.alt} onChange={set('alt')} /></Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Key" hint={keyOk ? undefined : 'e.g. G, F#m'}><input className="input font-mono" value={f.key} onChange={set('key')} /></Field>
          <Field label="BPM"><input className="input" type="number" value={f.bpm} onChange={set('bpm')} /></Field>
          <Field label="Year"><input className="input" type="number" value={f.year} onChange={set('year')} /></Field>
        </div>
        <Field label="Genre"><input className="input" value={f.genre} onChange={set('genre')} /></Field>
        <div className="sm:col-span-2"><Field label="Description"><textarea className="input min-h-20" value={f.description} onChange={set('description')} /></Field></div>
        <div className="sm:col-span-2"><Field label="Credits"><input className="input" value={f.credits} onChange={set('credits')} /></Field></div>
        <div className="flex justify-end gap-2 sm:col-span-2">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={!keyOk}>Save</button>
        </div>
      </form>
    </Modal>
  )
}

/** Distraction-free reading with optional auto-scroll for playing through a song. */
function FocusMode({ sheet, title, artist, selected, onSelect, onClose, settings }: { sheet: Sheet; title: string; artist: string; selected: string | null; onSelect: (c: string) => void; onClose: () => void; settings: ReturnType<typeof useSettings> }) {
  const ref = useRef<HTMLDivElement>(null)
  const [speed, setSpeed] = useState(0)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === ' ') {
        e.preventDefault()
        setSpeed((s) => (s ? 0 : 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  useEffect(() => {
    if (!speed) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const tick = (t: number) => {
      acc += ((t - last) / 1000) * speed * 18
      last = t
      if (acc >= 1 && ref.current) {
        ref.current.scrollTop += Math.floor(acc)
        acc -= Math.floor(acc)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [speed])
  return (
    <motion.div className="fixed inset-0 z-[70] flex flex-col bg-ink" initial={{ opacity: 0, scale: 1.02 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.02 }} transition={{ duration: 0.25 }}>
      <div className="flex items-center gap-3 border-b border-line px-5 py-3">
        <div className="min-w-0 flex-1">
          <div className="display truncate text-lg font-bold">{title}</div>
          <div className="truncate text-xs text-mute">{artist}</div>
        </div>
        <span className="label hidden sm:inline">Auto-scroll</span>
        {[0, 0.5, 1, 1.6, 2.4].map((s) => (
          <button key={s} className="chip" data-active={speed === s} onClick={() => setSpeed(s)}>
            {s === 0 ? 'Off' : `${s}×`}
          </button>
        ))}
        <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Exit focus mode">
          <X size={18} />
        </button>
      </div>
      <div ref={ref} className="flex-1 overflow-auto px-6 py-8">
        <div className="mx-auto max-w-3xl pb-[50vh]">
          <SheetView sheet={sheet} selected={selected} onSelect={onSelect} mode={settings.chordStyle} mono={settings.monospace} scale={settings.fontScale * 1.3} />
        </div>
      </div>
    </motion.div>
  )
}
