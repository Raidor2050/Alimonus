// YouTube Data API search proxy so YOUTUBE_API_KEY never reaches the browser.
// search.list has a small daily allowance (~100 calls/day by default), so results are cached by the CDN.

function isoToMs(iso: string): number | null {
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso)
  if (!m) return null
  return ((Number(m[1] ?? 0) * 60 + Number(m[2] ?? 0)) * 60 + Number(m[3] ?? 0)) * 1000
}

const decode = (s: string) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')

export default async (req: Request) => {
  const key = process.env.YOUTUBE_API_KEY
  if (!key) return Response.json({ error: 'YouTube search is not configured on the server.' }, { status: 501 })
  const q = new URL(req.url).searchParams.get('q')?.trim()
  if (!q || q.length > 200) return Response.json({ error: 'Provide a search query (q), up to 200 characters.' }, { status: 400 })

  const sp = new URLSearchParams({ part: 'snippet', type: 'video', videoEmbeddable: 'true', maxResults: '8', q, key })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${sp}`)
  const json = (await res.json()) as any
  if (!res.ok) return Response.json({ error: json?.error?.message ?? `YouTube search failed (${res.status})` }, { status: res.status === 403 ? 429 : 502 })

  const items = (json.items ?? []) as { id: { videoId: string }; snippet: { title: string; channelTitle: string; thumbnails: Record<string, { url: string }> } }[]
  const durations: Record<string, number | null> = {}
  if (items.length) {
    const vp = new URLSearchParams({ part: 'contentDetails', id: items.map((i) => i.id.videoId).join(','), key })
    const vres = await fetch(`https://www.googleapis.com/youtube/v3/videos?${vp}`)
    if (vres.ok) for (const v of ((await vres.json()) as any).items ?? []) durations[v.id] = isoToMs(v.contentDetails?.duration ?? '')
  }
  const results = items.map((i) => ({
    videoId: i.id.videoId,
    title: decode(i.snippet.title),
    channel: decode(i.snippet.channelTitle),
    thumbnail: i.snippet.thumbnails.medium?.url ?? i.snippet.thumbnails.default?.url ?? '',
    durationMs: durations[i.id.videoId] ?? null,
    url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
  }))
  return Response.json({ results }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
