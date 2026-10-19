import { lazy, Suspense, useEffect } from 'react'
import { MotionConfig } from 'motion/react'
import { Navigate, Route, Routes, useLocation } from 'react-router'
import { useApp } from '@/stores/app'
import { initSpotify } from '@/integrations/spotify'
import { PortalLoader } from '@/components/art/Art'
import { Toaster } from './Toaster'
import { Shell } from './Shell'
import LoginPage from '@/features/auth/LoginPage'

const HomePage = lazy(() => import('@/features/dashboard/HomePage'))
const ChordbookPage = lazy(() => import('@/features/chordbook/ChordbookPage'))
const SongPage = lazy(() => import('@/features/chordbook/SongPage'))
const PlaylistsPage = lazy(() => import('@/features/playlists/PlaylistsPage'))
const PlaylistDetailPage = lazy(() => import('@/features/playlists/PlaylistDetailPage'))
const RoadmapPage = lazy(() => import('@/features/roadmap/RoadmapPage'))
const ToolsPage = lazy(() => import('@/features/musician-tools/ToolsPage'))
const ProfilePage = lazy(() => import('@/features/profiles/ProfilePage'))
const SpotifyCallbackPage = lazy(() => import('@/features/playlists/SpotifyCallbackPage'))

export function App() {
  const booting = useApp((s) => s.booting)
  const me = useApp((s) => s.me)
  const init = useApp((s) => s.init)
  const location = useLocation()
  const settings = me?.settings

  useEffect(() => {
    void init()
  }, [init])

  useEffect(() => {
    if (me) void initSpotify(me.id)
  }, [me?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Theme + motion preferences live on <html> so CSS can react everywhere.
  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = settings?.theme ?? 'fusion'
    root.dataset.ambient = settings?.ambient ?? 'full'
    root.dataset.reducedMotion = String(settings?.reducedMotion ?? false)
  }, [settings?.theme, settings?.ambient, settings?.reducedMotion])

  if (booting)
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <PortalLoader label="Opening Alimonus…" />
      </div>
    )

  // The Spotify callback must work before the app decides about login redirects.
  if (location.pathname === '/callback/spotify')
    return (
      <Suspense fallback={null}>
        <SpotifyCallbackPage />
      </Suspense>
    )

  return (
    <MotionConfig reducedMotion={settings?.reducedMotion ? 'always' : 'user'}>
      {!me ? (
        <Routes>
          <Route path="*" element={<LoginPage />} />
        </Routes>
      ) : (
        <Routes location={location}>
          <Route element={<Shell />}>
            <Route index element={<HomePage />} />
            <Route path="chordbook" element={<ChordbookPage />} />
            <Route path="song/:id" element={<SongPage />} />
            <Route path="playlists" element={<PlaylistsPage />} />
            <Route path="playlists/:id" element={<PlaylistDetailPage />} />
            <Route path="roadmap" element={<RoadmapPage />} />
            <Route path="tools/:tool?" element={<ToolsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      )}
      <Toaster />
    </MotionConfig>
  )
}
