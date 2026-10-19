import { create } from 'zustand'

export interface Toast {
  id: number
  tone: 'info' | 'success' | 'error' | 'celebrate'
  title: string
  body?: string
}

interface ToastState {
  toasts: Toast[]
  history: (Toast & { at: number })[]
  push(t: Omit<Toast, 'id'>, ms?: number): void
  dismiss(id: number): void
  clearHistory(): void
}

let nextId = 1

export const useToasts = create<ToastState>((set, get) => ({
  toasts: [],
  history: [],
  push(t, ms = 3600) {
    const toast = { ...t, id: nextId++ }
    set((s) => ({ toasts: [...s.toasts, toast].slice(-4), history: [{ ...toast, at: Date.now() }, ...s.history].slice(0, 30) }))
    setTimeout(() => get().dismiss(toast.id), ms)
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
  },
  clearHistory() {
    set({ history: [] })
  },
}))

export const toast = (t: Omit<Toast, 'id'>, ms?: number) => useToasts.getState().push(t, ms)
