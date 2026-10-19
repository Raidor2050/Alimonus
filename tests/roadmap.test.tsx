import { render, screen, fireEvent, within, act } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import RoadmapPage from '@/features/roadmap/RoadmapPage'
import { useApp } from '@/stores/app'
import { DEFAULT_SETTINGS, type Profile, type RoadmapItem, type Snapshot } from '@/types'
import type { Backend } from '@/lib/backend/types'

const raiyan: Profile = { id: 'u-raiyan', username: 'raiyan', displayName: 'Raiyan Kabir', tagline: 'Portal tinkerer', bio: '', settings: DEFAULT_SETTINGS }
const afra: Profile = { id: 'u-afra', username: 'afra', displayName: 'Afra Anani', tagline: 'Stage cat', bio: '', settings: DEFAULT_SETTINGS }

const item = (p: Partial<RoadmapItem> & Pick<RoadmapItem, 'id' | 'title' | 'ownerId'>): RoadmapItem => ({
  shared: false,
  description: '',
  status: 'todo',
  priority: 'medium',
  category: 'task',
  startDate: null,
  dueDate: null,
  position: 0,
  completedAt: null,
  createdAt: '2026-10-01T00:00:00.000Z',
  updatedAt: '2026-10-01T00:00:00.000Z',
  ...p,
})

const noop = async () => {}
const fakeBackend = { mode: 'demo', upsertRoadmap: noop, deleteRoadmap: noop, logActivity: noop } as unknown as Backend

function seed() {
  const data: Snapshot = {
    profiles: [raiyan, afra],
    songs: [],
    states: [],
    playlists: [],
    items: [],
    activity: [],
    roadmap: [
      item({ id: 'r1', ownerId: raiyan.id, title: 'Learn the F barre chord', position: 0 }),
      item({ id: 'r2', ownerId: raiyan.id, title: 'Ship the tuner', status: 'doing', position: 1 }),
      item({ id: 'a1', ownerId: afra.id, title: 'Nail the Billie Jean groove', position: 2 }),
      item({ id: 's1', ownerId: afra.id, title: 'Play our first gig', shared: true, category: 'milestone', position: 3 }),
    ],
  }
  useApp.setState({ me: raiyan, data, backend: fakeBackend })
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <RoadmapPage />
    </MemoryRouter>,
  )

describe('RoadmapPage', () => {
  beforeEach(seed)

  it('renders both personal lanes with their items and marks the signed-in lane', () => {
    renderPage()
    const mine = screen.getByRole('region', { name: 'Raiyan’s lane' })
    const hers = screen.getByRole('region', { name: 'Afra’s lane' })
    expect(within(mine).getByText('Learn the F barre chord')).toBeInTheDocument()
    expect(within(mine).getByText('Ship the tuner')).toBeInTheDocument()
    expect(within(mine).getByText('You')).toBeInTheDocument()
    expect(within(hers).getByText('Nail the Billie Jean groove')).toBeInTheDocument()
    expect(within(hers).queryByText('You')).not.toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Shared goals lane' })).getByText('Play our first gig')).toBeInTheDocument()
  })

  it('shows edit controls on own items but not on the partner’s', () => {
    renderPage()
    expect(screen.getByRole('button', { name: 'Edit “Learn the F barre chord”' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit “Nail the Billie Jean groove”' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View “Nail the Billie Jean groove” (read-only)' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Mark “Nail the Billie Jean groove” done' })).toBeDisabled()
    // shared items are editable by both
    expect(screen.getByRole('button', { name: 'Edit “Play our first gig”' })).toBeInTheDocument()
    // only own lane + shared lane get quick-add
    expect(screen.getByRole('textbox', { name: 'Quick add to your lane' })).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Afra’s lane' })).queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('quick-add creates an item owned by the signed-in user without inventing dates', () => {
    renderPage()
    const input = screen.getByRole('textbox', { name: 'Quick add to your lane' })
    fireEvent.change(input, { target: { value: 'Write a portal riff' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    const created = useApp.getState().data.roadmap.find((r) => r.title === 'Write a portal riff')
    expect(created).toMatchObject({ ownerId: raiyan.id, shared: false, dueDate: null, startDate: null })
    expect(within(screen.getByRole('region', { name: 'Raiyan’s lane' })).getByText('Write a portal riff')).toBeInTheDocument()
    expect(input).toHaveValue('')
  })

  it('toggling completion sets the status to done', () => {
    renderPage()
    act(() => {
      fireEvent.click(screen.getByRole('checkbox', { name: 'Mark “Learn the F barre chord” done' }))
    })
    const saved = useApp.getState().data.roadmap.find((r) => r.id === 'r1')!
    expect(saved.status).toBe('done')
    expect(saved.completedAt).not.toBeNull()
  })
})
