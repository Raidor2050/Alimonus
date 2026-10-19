import { useEffect, useRef, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { preferredAccidental, type Accidental } from '@/lib/theory/notes'
import { useSettings } from '@/stores/app'
import { cx } from '@/lib/util'
import { spring } from '@/components/ui'

/** Resolve the user's accidental preference ('auto' follows the key, or sharps without one). */
export function useAccidental(keyPc?: number, minor = false): Accidental {
  const pref = useSettings().accidental
  if (pref !== 'auto') return pref
  return keyPc === undefined ? 'sharp' : preferredAccidental(keyPc, minor)
}

/** Latest-value ref so long-lived callbacks (rAF, timers) never read stale props. */
export function useLatest<T>(value: T) {
  const ref = useRef(value)
  ref.current = value
  return ref
}

/** Debounce a side effect on `value`; flushes the pending call on unmount. */
export function useDebouncedEffect<T>(value: T, delay: number, fn: (v: T) => void, skip = false) {
  const fnRef = useLatest(fn)
  const pending = useRef<{ v: T } | null>(null)
  useEffect(() => {
    if (skip) return
    pending.current = { v: value }
    const t = setTimeout(() => {
      if (pending.current) fnRef.current(pending.current.v)
      pending.current = null
    }, delay)
    return () => clearTimeout(t)
  }, [value, delay, skip, fnRef])
  useEffect(
    () => () => {
      if (pending.current) fnRef.current(pending.current.v)
    },
    [fnRef],
  )
}

/** Spacebar shortcut that ignores typing contexts. */
export function useSpacebar(handler: () => void) {
  const ref = useLatest(handler)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(el.tagName))) return
      if (e.repeat) return
      e.preventDefault()
      ref.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ref])
}

/** Big round transport button with a spring press and a glow when active. */
export function TransportButton({ active, onClick, children, label, size = 'lg' }: { active: boolean; onClick: () => void; children: ReactNode; label: string; size?: 'md' | 'lg' }) {
  return (
    <motion.button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      whileTap={{ scale: 0.9 }}
      whileHover={{ scale: 1.04 }}
      transition={spring}
      className={cx(
        'relative grid place-items-center rounded-full font-bold transition-colors',
        size === 'lg' ? 'h-20 w-20' : 'h-14 w-14',
        active ? 'bg-a1 text-ink shadow-[0_0_40px_-6px_rgb(var(--glow)/0.9)]' : 'border border-white/15 bg-white/[0.05] text-white hover:bg-white/[0.09]',
      )}
    >
      {children}
    </motion.button>
  )
}

export function Stat({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cx('rounded-2xl border border-white/[0.07] bg-white/[0.025] px-3 py-2', className)}>
      <div className="label">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-soft">{value}</div>
    </div>
  )
}
