import { AnimatePresence, motion } from 'motion/react'
import { CircleCheck, Info, Sparkles, TriangleAlert, X } from 'lucide-react'
import { useToasts } from '@/stores/toasts'
import { spring } from '@/components/ui'
import { cx } from '@/lib/util'

const ICONS = { info: Info, success: CircleCheck, error: TriangleAlert, celebrate: Sparkles }

export function Toaster() {
  const toasts = useToasts((s) => s.toasts)
  const dismiss = useToasts((s) => s.dismiss)
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[100] flex w-[min(380px,calc(100vw-24px))] flex-col gap-2" aria-live="polite">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon = ICONS[t.tone]
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={spring}
              className={cx(
                'glass pointer-events-auto relative flex items-start gap-3 overflow-hidden rounded-2xl p-3 pr-9 shadow-xl',
                t.tone === 'error' && 'border-rec/40',
                t.tone === 'celebrate' && 'border-gold/60 shadow-[0_0_30px_-8px_rgb(240_199_94/0.6)]',
              )}
              role={t.tone === 'error' ? 'alert' : 'status'}
            >
              {t.tone === 'celebrate' && <div className="absolute inset-0 -z-10 opacity-40" style={{ background: 'linear-gradient(110deg, var(--a1), var(--a2), var(--a3))' }} />}
              <Icon size={18} className={cx('mt-0.5 shrink-0', t.tone === 'error' ? 'text-rec' : t.tone === 'celebrate' ? 'text-white' : 'text-a1')} />
              <div className="min-w-0">
                <div className="text-sm font-semibold">{t.title}</div>
                {t.body && <div className="mt-0.5 text-xs text-soft">{t.body}</div>}
              </div>
              <button onClick={() => dismiss(t.id)} className="absolute right-2 top-2 rounded-full p-1 text-mute hover:text-white" aria-label="Dismiss">
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
