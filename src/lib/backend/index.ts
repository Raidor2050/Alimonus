import { isSupabaseConfigured } from '@/lib/env'
import { LocalBackend } from './local'
import type { Backend } from './types'

let instance: Backend | null = null

/** Supabase when configured, otherwise the clearly labelled local demo backend. */
export async function getBackend(): Promise<Backend> {
  if (instance) return instance
  if (isSupabaseConfigured) {
    // Loaded lazily so demo mode never downloads the Supabase client.
    const { SupabaseBackend } = await import('./supabase')
    instance = new SupabaseBackend()
  } else {
    instance = new LocalBackend()
  }
  return instance
}

export function setBackendForTests(b: Backend) {
  instance = b
}

export type { Backend } from './types'
export { AuthError } from './types'
