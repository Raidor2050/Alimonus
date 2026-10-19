// Spotify catalog search with the Client Credentials flow, so the Chordbook can search
// Spotify even before a profile connects its own account. The secret stays server-side.

let cached: { token: string; expiresAt: number } | null = null

async function appToken(clientId: string, secret: string): Promise<string> {
  if (cached && cached.expiresAt - Date.now() > 60_000) return cached.token
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!res.ok) throw new Error(`Spotify token request failed (${res.status})`)
  const json = (await res.json()) as { access_token: string; expires_in: number }
  cached = { token: json.access_token, expiresAt: Date.now() + json.expires_in * 1000 }
  return cached.token
}

export default async (req: Request) => {
  const clientId = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID
  const secret = process.env.SPOTIFY_CLIENT_SECRET
  if (!clientId || !secret) return Response.json({ error: 'Spotify search is not configured on the server.' }, { status: 501 })
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length > 200) return Response.json({ error: 'Provide a search query (q), up to 200 characters.' }, { status: 400 })
  try {
    const token = await appToken(clientId, secret)
    // Spotify caps search at 10 results per page (Feb 2026 change).
    const res = await fetch(`https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` } })
    if (!res.ok) return Response.json({ error: `Spotify search failed (${res.status})` }, { status: 502 })
    const json = (await res.json()) as { tracks?: { items: unknown[] } }
    return Response.json({ tracks: json.tracks?.items ?? [] }, { headers: { 'Cache-Control': 'public, max-age=300' } })
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 })
  }
}
