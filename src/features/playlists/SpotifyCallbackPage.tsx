import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { completeSpotifyLogin } from '@/integrations/spotify'
import { PortalLoader, SpotifyMark } from '@/components/art/Art'
import { Cosmos } from '@/components/art/Cosmos'
import { toast } from '@/stores/toasts'

/** Landing page for Spotify's OAuth redirect (must match the redirect URI in the Spotify dashboard). */
export default function SpotifyCallbackPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const ran = useRef(false)
  useEffect(() => {
    if (ran.current) return // StrictMode double-invoke: an auth code can only be used once
    ran.current = true
    completeSpotifyLogin(window.location.search)
      .then((to) => {
        toast({ tone: 'success', title: 'Spotify connected' })
        navigate(to, { replace: true })
      })
      .catch((e: Error) => setError(e.message))
  }, [navigate])
  return (
    <div className="relative flex min-h-dvh items-center justify-center p-6">
      <Cosmos scene="login" theme="fusion" />
      <div className="panel relative z-10 flex max-w-md flex-col items-center gap-4 p-8 text-center">
        <SpotifyMark className="h-12 w-12" />
        {error ? (
          <>
            <div className="display text-xl font-bold">Couldn’t connect Spotify</div>
            <p className="text-sm text-soft">{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/profile#services', { replace: true })}>
              Back to settings
            </button>
          </>
        ) : (
          <PortalLoader label="Linking your Spotify…" />
        )}
      </div>
    </div>
  )
}
