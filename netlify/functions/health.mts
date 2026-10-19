// Reports which server-side integrations are configured (booleans only, never values).
export default async () =>
  Response.json(
    {
      ok: true,
      spotifySearch: !!(process.env.SPOTIFY_CLIENT_SECRET && (process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID)),
      youtube: !!process.env.YOUTUBE_API_KEY,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
