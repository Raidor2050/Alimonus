import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { useNavigate, useParams, NavLink } from 'react-router'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowUpDown, AudioLines, Gauge, Grid3x3, Hourglass, ListMusic, Metronome, type LucideIcon } from 'lucide-react'
import { Page, PageHeader, spring } from '@/components/ui'
import { cx } from '@/lib/util'

interface ToolDef {
  id: string
  name: string
  blurb: string
  icon: LucideIcon
  Component: ComponentType
}

const TOOLS: ToolDef[] = [
  { id: 'tuner', name: 'Tuner', blurb: 'Chromatic, mic-powered', icon: Gauge, Component: lazy(() => import('./tools/Tuner')) },
  { id: 'metronome', name: 'Metronome', blurb: 'Sample-accurate clicks', icon: Metronome, Component: lazy(() => import('./tools/MetronomeTool')) },
  { id: 'chords', name: 'Chords', blurb: 'Guitar + piano shapes', icon: Grid3x3, Component: lazy(() => import('./tools/ChordExplorer')) },
  { id: 'transposer', name: 'Transposer', blurb: 'Shift keys, find a capo', icon: ArrowUpDown, Component: lazy(() => import('./tools/Transposer')) },
  { id: 'pitch-pipe', name: 'Pitch pipe', blurb: 'Reference tones', icon: AudioLines, Component: lazy(() => import('./tools/PitchPipe')) },
  { id: 'progression', name: 'Progressions', blurb: 'Build and play changes', icon: ListMusic, Component: lazy(() => import('./tools/ProgressionBuilder')) },
  { id: 'practice', name: 'Practice', blurb: 'Timer, checklist, log', icon: Hourglass, Component: lazy(() => import('./tools/PracticeTimer')) },
]

export default function ToolsPage() {
  const { tool } = useParams()
  const navigate = useNavigate()
  const active = TOOLS.find((t) => t.id === tool) ?? TOOLS[0]

  // Unknown or missing tool id: normalise the URL so links and back/forward behave.
  useEffect(() => {
    if (tool !== active.id) navigate(`/tools/${active.id}`, { replace: true })
  }, [tool, active.id, navigate])

  const Active = active.Component

  return (
    <Page>
      <PageHeader
        eyebrow="Musician tools"
        title={
          <>
            The <span className="text-gradient">workbench</span>
          </>
        }
      />

      <nav aria-label="Tools" className="-mx-4 mb-6 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        <ul className="flex min-w-max gap-2 lg:grid lg:min-w-0 lg:grid-cols-7">
          {TOOLS.map((t) => {
            const on = t.id === active.id
            const Icon = t.icon
            return (
              <li key={t.id}>
                <NavLink
                  to={`/tools/${t.id}`}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    'group relative flex items-center gap-3 overflow-hidden rounded-2xl border px-3.5 py-2.5 transition-colors lg:flex-col lg:items-start lg:gap-2 lg:p-4',
                    on ? 'border-a1/40 text-white' : 'border-white/[0.07] bg-white/[0.02] text-soft hover:border-white/15 hover:text-white',
                  )}
                >
                  {on && <motion.span layoutId="tool-tab-bg" transition={spring} className="absolute inset-0 bg-gradient-to-br from-a1/[0.16] via-a2/[0.08] to-transparent" />}
                  <motion.span
                    className={cx('relative grid h-9 w-9 shrink-0 place-items-center rounded-xl', on ? 'bg-a1 text-ink shadow-[0_0_24px_-4px_rgb(var(--glow)/0.8)]' : 'bg-white/[0.05] text-a1')}
                    whileHover={{ rotate: -8, scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    transition={spring}
                  >
                    <Icon size={18} />
                  </motion.span>
                  <span className="relative">
                    <span className="block text-sm font-bold leading-tight">{t.name}</span>
                    <span className="hidden text-xs text-mute lg:block">{t.blurb}</span>
                  </span>
                </NavLink>
              </li>
            )
          })}
        </ul>
      </nav>

      <AnimatePresence mode="wait">
        <motion.div key={active.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}>
          <Suspense fallback={<div className="skeleton h-[420px] rounded-[22px]" aria-busy="true" aria-label="Loading tool" />}>
            <Active />
          </Suspense>
        </motion.div>
      </AnimatePresence>
    </Page>
  )
}
