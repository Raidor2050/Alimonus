import { create } from 'zustand'
import { env, isSpotifyConfigured, spotifyRedirectUri } from '@/lib/env'
import { getBackend } from '@/lib/backend'
import type { SpotifyTokens } from '@/types'

/**
 * Spotify Web API via Authorization Code + PKCE (no client secret in the browser).
 * Notes from the Feb-2026 API changes: playlist contents live at /playlists/{id}/items
 * with each entry under `item`, contents are only returned for playlists the user owns
 * or collaborates on, and search returns at most 10 results per page.
 */

const AUTH_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const API = 'https://api.spotify.com/v1'
export const SPOTIFY_SCOPES = 'playlist-read-private playlist-read-collaborative user-library-read'
const PKCE_KEY = 'alimonus:spotify:pkce'

export type SpotifyStatus = 'unconfigured' | 'disconnected' | 'connected' | 'expired' | 'error' | 'loading'

interface SpotifyState {
  status: SpotifyStatus
  userId: string | null
  displayName: string | null
  error: string | null
  tokens: SpotifyTokens | null
}

export const useSpotify = create<SpotifyState>(() => ({
  status: isSpotifyConfigured ? 'loading' : 'unconfigured',
  userId: null,
  displayName: null,
  error: null,
  tokens: null,
}))

function base64url(bytes: Uint8Array) {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function pkcePair() {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return { verifier, challenge: base64url(new Uint8Array(digest)) }
}

/** Load the stored connection for an Alimonus user (called after login). */
export async function initSpotify(userId: string) {
  if (!isSpotifyConfigured) {
    useSpotify.setState({ status: 'unconfigured', userId })
    return
  }
  useSpotify.setState({ status: 'loading', userId, error: null })
  try {
    const tokens = await (await getBackend()).loadSpotifyTokens(userId)
    if (!tokens) {
      useSpotify.setState({ status: 'disconnected', tokens: null, displayName: null })
      return
    }
    useSpotify.setState({ tokens, displayName: tokens.displayName ?? null, status: 'connected' })
    await getAccessToken() // refresh now if needed so the status is honest
  } catch (e) {
    useSpotify.setState({ status: 'error', error: (e as Error).message })
  }
}

export async function connectSpotify(returnTo = window.location.pathname) {
  const { userId } = useSpotify.getState()
  if (!isSpotifyConfigured || !userId) return
  const { verifier, challenge } = await pkcePair()
  const state = base64url(crypto.getRandomValues(new Uint8Array(16)))
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({ verifier, state, returnTo, userId }))
  const p = new URLSearchParams({
    client_id: env.spotifyClientId,
    response_type: 'code',
    redirect_uri: spotifyRedirectUri(),
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
    scope: SPOTIFY_SCOPES,
  })
  window.location.assign(`${AUTH_URL}?${p}`)
}

/** Handle /callback/spotify. Returns the path to go back to. */
export async function completeSpotifyLogin(search: string): Promise<string> {
  const params = new URLSearchParams(search)
  const saved = JSON.parse(sessionStorage.getItem(PKCE_KEY) ?? 'null') as { verifier: string; state: string; returnTo: string; userId: string } | null
  sessionStorage.removeItem(PKCE_KEY)
  if (params.get('error')) throw new Error(params.get('error') === 'access_denied' ? 'Spotify connection was cancelled.' : `Spotify said: ${params.get('error')}`)
  if (!saved || saved.state !== params.get('state')) throw new Error('This Spotify sign-in link expired or was opened in another tab. Try connecting again.')
  const code = params.get('code')
  if (!code) throw new Error('Spotify didn’t return an authorization code.')
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: spotifyRedirectUri(), client_id: env.spotifyClientId, code_verifier: saved.verifier }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(json.error_description ?? json.error ?? 'Token exchange failed.')
  let tokens: SpotifyTokens = {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    scope: json.scope,
  }
  const me = await fetch(`${API}/me`, { headers: { Authorization: `Bearer ${tokens.accessToken}` } })
  if (me.status === 403) throw new Error('Spotify refused access (403). In development mode, this Spotify account must be added under User Management in the Spotify developer dashboard.')
  if (me.ok) {
    const mj = await me.json()
    tokens = { ...tokens, displayName: mj.display_name ?? mj.id, spotifyUserId: mj.id }
  }
  await (await getBackend()).saveSpotifyTokens(saved.userId, tokens)
  useSpotify.setState({ tokens, status: 'connected', displayName: tokens.displayName ?? null, userId: saved.userId, error: null })
  return saved.returnTo || '/playlists'
}

export async function disconnectSpotify() {
  const { userId } = useSpotify.getState()
  if (userId) await (await getBackend()).saveSpotifyTokens(userId, null)
  useSpotify.setState({ tokens: null, status: isSpotifyConfigured ? 'disconnected' : 'unconfigured', displayName: null })
}

let refreshing: Promise<string | null> | null = null

/** A valid access token, refreshing (PKCE refresh needs no secret) when within a minute of expiry. */
export async function getAccessToken(): Promise<string | null> {
  const { tokens, userId } = useSpotify.getState()
  if (!tokens) return null
  if (tokens.expiresAt - Date.now() > 60_000) return tokens.accessToken
  if (refreshing) return refreshing
  refreshing = (async () => {
    try {
      const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken, client_id: env.spotifyClientId }),
      })
      const json = await res.json()
      if (!res.ok) {
        useSpotify.setState({ status: 'expired', error: json.error_description ?? 'Spotify authorization expired.' })
        return null
      }
      const next: SpotifyTokens = {
        ...tokens,
        accessToken: json.access_token,
        // Spotify may or may not rotate the refresh token; keep the old one if not.
        refreshToken: json.refresh_token ?? tokens.refreshToken,
        expiresAt: Date.now() + json.expires_in * 1000,
        scope: json.scope ?? tokens.scope,
      }
      useSpotify.setState({ tokens: next, status: 'connected', error: null })
      if (userId) await (await getBackend()).saveSpotifyTokens(userId, next)
      return next.accessToken
    } catch (e) {
      useSpotify.setState({ status: 'error', error: (e as Error).message })
      return null
    } finally {
      refreshing = null
    }
  })()
  return refreshing
}

async function api<T>(path: string): Promise<T> {
  const token = await getAccessToken()
  if (!token) throw new Error('Spotify isn’t connected.')
  const res = await fetch(path.startsWith('http') ? path : `${API}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  if (res.status === 401) {
    useSpotify.setState({ status: 'expired' })
    throw new Error('Spotify authorization expired — reconnect from Settings.')
  }
  if (res.status === 403) throw new Error('Spotify refused this request (403). Development-mode apps only work for users added in the Spotify dashboard, and some playlists only return details to their owner.')
  if (res.status === 429) throw new Error('Spotify rate limit hit — wait a moment and try again.')
  if (!res.ok) throw new Error(`Spotify error ${res.status}`)
  return res.json() as Promise<T>
}

/* ---------- Data shapes ---------- */

export interface SpotifyImage {
  url: string
  width: number | null
}
export interface SpotifyTrack {
  id: string
  uri: string
  name: string
  duration_ms: number
  artists: { name: string }[]
  album: { name: string; images: SpotifyImage[]; release_date?: string }
  external_urls: { spotify: string }
  type?: string
}
export interface SpotifyPlaylist {
  id: string
  name: string
  description: string | null
  images: SpotifyImage[] | null
  owner: { display_name: string; id: string }
  collaborative: boolean
  external_urls: { spotify: string }
  /** `items` after Feb 2026; `tracks` on older responses. */
  items?: { total: number }
  tracks?: { total: number }
}
export interface Paged<T> {
  items: T[]
  total: number
  next: string | null
  offset: number
  limit: number
}

export const playlistTotal = (p: SpotifyPlaylist) => p.items?.total ?? p.tracks?.total ?? 0
export const bestImage = (imgs: SpotifyImage[] | null | undefined, target = 300) =>
  imgs?.length ? [...imgs].sort((a, b) => Math.abs((a.width ?? target) - target) - Math.abs((b.width ?? target) - target))[0].url : null

export function getMyPlaylists(offset = 0, limit = 30) {
  return api<Paged<SpotifyPlaylist>>(`/me/playlists?limit=${limit}&offset=${offset}`)
}

export async function getPlaylistTracks(playlistId: string, offset = 0, limit = 50): Promise<Paged<SpotifyTrack>> {
  type Entry = { item?: SpotifyTrack | null; track?: SpotifyTrack | null }
  const page = await api<Paged<Entry>>(`/playlists/${playlistId}/items?limit=${limit}&offset=${offset}`)
  return {
    ...page,
    // Skip podcast episodes and local/unavailable entries.
    items: page.items.map((e) => e.item ?? e.track ?? null).filter((t): t is SpotifyTrack => !!t && !!t.id && (t.type ?? 'track') === 'track'),
  }
}

export async function getSavedTracks(offset = 0, limit = 50): Promise<Paged<SpotifyTrack>> {
  const page = await api<Paged<{ track: SpotifyTrack }>>(`/me/tracks?limit=${limit}&offset=${offset}`)
  return { ...page, items: page.items.map((e) => e.track).filter(Boolean) }
}

/**
 * Track search. With a connected account we call Spotify directly; otherwise the
 * /api/spotify-search Netlify Function uses client credentials (needs SPOTIFY_CLIENT_SECRET).
 */
export async function searchSpotifyTracks(q: string, signal?: AbortSignal): Promise<SpotifyTrack[]> {
  if (!q.trim()) return []
  if (useSpotify.getState().tokens) {
    const token = await getAccessToken()
    if (token) {
      const res = await fetch(`${API}/search?type=track&limit=10&q=${encodeURIComponent(q)}`, { headers: { Authorization: `Bearer ${token}` }, signal })
      if (res.ok) return ((await res.json()).tracks?.items ?? []) as SpotifyTrack[]
    }
  }
  const res = await fetch(`/api/spotify-search?q=${encodeURIComponent(q)}`, { signal }).catch(() => null)
  if (!res || res.status === 404 || res.status === 501 || !(res.headers.get('content-type') ?? '').includes('json')) return []
  if (!res.ok) return []
  return ((await res.json()).tracks ?? []) as SpotifyTrack[]
}

export function spotifyTrackUrl(id: string) {
  return `https://open.spotify.com/track/${id}`
}
