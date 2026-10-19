import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { cx } from '@/lib/util'
import { Sparkle } from './art/Sigil'

export const spring = { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.8 }
export const softSpring = { type: 'spring' as const, stiffness: 220, damping: 28 }

/** Page wrapper with the shared enter/exit transition. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <motion.main
      initial={{ opacity: 0, y: 14, filter: 'blur(6px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(4px)' }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className={cx('relative z-10 mx-auto w-full max-w-[1500px] px-4 pb-40 pt-4 sm:px-6 lg:px-8', className)}
    >
      {children}
    </motion.main>
  )
}

export function PageHeader({ eyebrow, title, children, art }: { eyebrow?: string; title: ReactNode; children?: ReactNode; art?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        {art}
        <div>
          {eyebrow && (
            <div className="label mb-1 flex items-center gap-1.5">
              <Sparkle size={9} /> {eyebrow}
            </div>
          )}
          <h1 className="display text-3xl font-extrabold sm:text-4xl">{title}</h1>
        </div>
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </header>
  )
}

/** Card entrance used by grids/lists: pass the index for a gentle stagger. */
export function Rise({ i = 0, children, className, as = 'div' }: { i?: number; children: ReactNode; className?: string; as?: 'div' | 'li' }) {
  const C = as === 'li' ? motion.li : motion.div
  return (
    <C initial={{ opacity: 0, y: 16, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ ...softSpring, delay: Math.min(i, 12) * 0.035 }} className={className}>
      {children}
    </C>
  )
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cx('panel relative max-h-[92dvh] w-full overflow-auto rounded-b-none p-5 sm:rounded-b-[22px] sm:p-6', wide ? 'max-w-3xl' : 'max-w-lg')}
            initial={{ y: 40, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 30, scale: 0.97, opacity: 0 }}
            transition={spring}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <h2 className="display text-xl font-bold">{title}</h2>
              <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export function EmptyState({ icon, title, body, action }: { icon?: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[22px] border border-dashed border-white/10 px-6 py-10 text-center">
      {icon && <div className="anim-float text-a1">{icon}</div>}
      <div className="display text-lg font-bold">{title}</div>
      {body && <div className="max-w-md text-sm text-mute">{body}</div>}
      {action}
    </div>
  )
}

export function Segmented<T extends string>({ value, options, onChange, size = 'md', layoutId }: { value: T; options: { value: T; label: ReactNode }[]; onChange: (v: T) => void; size?: 'sm' | 'md'; layoutId: string }) {
  return (
    <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1" role="tablist">
      {options.map((o) => (
        <button
          type="button"
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx('relative rounded-full font-semibold transition-colors', size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm', value === o.value ? 'text-ink' : 'text-soft hover:text-white')}
        >
          {value === o.value && <motion.span layoutId={layoutId} className="absolute inset-0 rounded-full bg-a1" transition={spring} />}
          <span className="relative z-10 flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="text-xs text-mute">{hint}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="flex items-center gap-3 text-sm">
      <span className={cx('relative h-6 w-11 rounded-full border transition-colors', checked ? 'border-transparent bg-a1' : 'border-white/15 bg-white/5')}>
        <motion.span layout transition={spring} className={cx('absolute top-0.5 rounded-full', checked ? 'right-0.5 bg-ink' : 'left-0.5 bg-soft')} style={{ width: 18, height: 18 }} />
      </span>
      <span>{label}</span>
    </button>
  )
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'a1' | 'a2' | 'a3' | 'warn' }) {
  const tones = {
    default: 'border-white/10 text-soft bg-white/[0.04]',
    a1: 'border-a1/40 text-a1 bg-a1/10',
    a2: 'border-a2/40 text-a2 bg-a2/10',
    a3: 'border-a3/40 text-a3 bg-a3/10',
    warn: 'border-ember/40 text-ember bg-ember/10',
  }
  return <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wider', tones[tone])}>{children}</span>
}

export function Section({ title, action, children, className }: { title: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('panel p-4 sm:p-5', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="display text-base font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}
