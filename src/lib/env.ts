// Frontend configuration. Everything here is public (bundled into the browser);
// secrets such as SPOTIFY_CLIENT_SECRET or SUPABASE_SERVICE_ROLE_KEY never belong here.

const e = import.meta.env

export const env = {
  supabaseUrl: (e.VITE_SUPABASE_URL as string | undefined) ?? '',
  supabaseAnonKey: (e.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '',
  raiyanEmail: (e.VITE_ALIMONUS_RAIYAN_EMAIL as string | undefined) || 'raiyan@alimonus.app',
  afraEmail: (e.VITE_ALIMONUS_AFRA_EMAIL as string | undefined) || 'afra@alimonus.app',
  spotifyClientId: (e.VITE_SPOTIFY_CLIENT_ID as string | undefined) ?? '',
  spotifyRedirectUri: (e.VITE_SPOTIFY_REDIRECT_URI as string | undefined) ?? '',
  youtubeApiKey: (e.VITE_YOUTUBE_API_KEY as string | undefined) ?? '',
  appUrl: (e.VITE_APP_URL as string | undefined) ?? '',
  /** Force demo mode even when Supabase is configured (handy for local design work). */
  forceDemo: (e.VITE_ALIMONUS_DEMO as string | undefined) === 'true',
}

export const isSupabaseConfigured = !!(env.supabaseUrl && env.supabaseAnonKey) && !env.forceDemo
export const isSpotifyConfigured = !!env.spotifyClientId

export function spotifyRedirectUri(): string {
  if (env.spotifyRedirectUri) return env.spotifyRedirectUri
  // Spotify rejects "localhost"; loopback must be the literal 127.0.0.1.
  const origin = window.location.origin.replace('://localhost', '://127.0.0.1')
  return `${origin}/callback/spotify`
}
