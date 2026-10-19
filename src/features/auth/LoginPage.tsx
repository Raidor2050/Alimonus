import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { ArrowLeft, ArrowRight, Eye, EyeOff, LoaderCircle } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { Cosmos } from '@/components/art/Cosmos'
import { CatAvatar } from '@/components/art/Art'
import { Sigil, Sparkle, GoldDivider, CelestialCorners } from '@/components/art/Sigil'
import { useApp } from '@/stores/app'
import { isSupabaseConfigured } from '@/lib/env'
import { spring } from '@/components/ui'
import type { Username } from '@/types'
import { cx } from '@/lib/util'

const PEOPLE: { username: Username; name: string; line: string; theme: 'portal' | 'stage' }[] = [
  { username: 'raiyan', name: 'Raiyan Kabir', line: 'Interdimensional sound engineer · code, portals & strange tunings', theme: 'portal' },
  { username: 'afra', name: 'Afra Anani', line: 'Midnight headliner · cats, stage lights & grooves', theme: 'stage' },
]

// Deterministic gold dust positions.
const DUST = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 91.7 + n * 47.3) * 9301.17) % 1 + 1) % 1
  return { x: r(1) * 100, y: r(2) * 100, s: 1 + r(3) * 2.4, d: r(4) * 4 }
})

export default function LoginPage() {
  const sigilSize = Math.min(380, Math.round(window.innerWidth * 0.78), Math.round(window.innerHeight * 0.42))
  const [picked, setPicked] = useState<Username | null>(null)
  const [hover, setHover] = useState<Username | null>(null)
  const [entering, setEntering] = useState(false)
  const theme = (picked ?? hover) === 'raiyan' ? 'portal' : (picked ?? hover) === 'afra' ? 'stage' : 'fusion'

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-10">
      <Cosmos scene="login" theme={theme} />
      <AnimatePresence>
        {entering && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ clipPath: 'circle(0% at 50% 50%)' }}
            animate={{ clipPath: 'circle(150% at 50% 50%)' }}
            exit={{ clipPath: 'circle(0% at 50% 50%)', opacity: 0 }}
            transition={{ duration: 0.9, ease: [0.7, 0, 0.3, 1] }}
            style={{ background: 'radial-gradient(circle, var(--a1), var(--a2) 40%, #030304 75%)' }}
          />
        )}
      </AnimatePresence>

      {/* gold dust drifting around the sigil */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden" aria-hidden>
        {DUST.map((d, i) => (
          <span key={i} className="anim-twinkle absolute rounded-full bg-gold" style={{ left: `${d.x}%`, top: `${d.y}%`, width: d.s, height: d.s, animationDelay: `${d.d}s`, boxShadow: '0 0 6px #f0c75e' }} />
        ))}
      </div>

      <motion.div initial={{ opacity: 0, scale: 0.85, rotate: -8, filter: 'blur(10px)' }} animate={{ opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }} transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }} className="relative z-10 mb-6 flex flex-col items-center text-center">
        <div className="relative">
          <div className="absolute inset-[8%] rounded-full blur-3xl" style={{ background: 'radial-gradient(circle, rgb(240 199 94 / 0.22), transparent 70%)' }} aria-hidden />
          <motion.div animate={{ y: [0, -6, 0] }} transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut' }}>
            <Sigil size={sigilSize} />
          </motion.div>
        </div>
        <h1 className="sr-only">Alimonus</h1>
        <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.9, duration: 0.8 }} className="font-celestial mt-2 text-[0.72rem] text-gold/80 sm:text-xs">
          A creative OS for two musicians
        </motion.p>
        <GoldDivider className="mt-3 w-56" />
      </motion.div>

      <div className="relative z-10 flex w-full max-w-3xl flex-col items-stretch justify-center gap-5 sm:flex-row">
        <AnimatePresence mode="popLayout">
          {PEOPLE.filter((p) => !picked || p.username === picked).map((p, i) => (
            <AccountCard
              key={p.username}
              person={p}
              index={i}
              picked={picked === p.username}
              onPick={() => setPicked(p.username)}
              onBack={() => setPicked(null)}
              onHover={setHover}
              onEntering={setEntering}
            />
          ))}
        </AnimatePresence>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="relative z-10 mt-10 flex flex-col items-center gap-2 text-center text-xs text-mute">
        <Sparkle size={14} className="anim-twinkle" />
        {isSupabaseConfigured ? (
          <span>Synced with Supabase · your data follows you between devices</span>
        ) : (
          <span className="max-w-sm">
            <b className="text-ember">Local demo mode</b> — Supabase isn’t configured, so everything is saved in this browser only. Initial password: <code className="text-soft">Alimonus</code>
          </span>
        )}
      </motion.div>
    </div>
  )
}

function AccountCard({
  person,
  index,
  picked,
  onPick,
  onBack,
  onHover,
  onEntering,
}: {
  person: (typeof PEOPLE)[number]
  index: number
  picked: boolean
  onPick: () => void
  onBack: () => void
  onHover: (u: Username | null) => void
  onEntering: (v: boolean) => void
}) {
  const mx = useMotionValue(0)
  const my = useMotionValue(0)
  const rx = useSpring(useTransform(my, [-0.5, 0.5], [10, -10]), { stiffness: 200, damping: 20 })
  const ry = useSpring(useTransform(mx, [-0.5, 0.5], [-12, 12]), { stiffness: 200, damping: 20 })
  const glowX = useTransform(mx, [-0.5, 0.5], ['0%', '100%'])
  const glowY = useTransform(my, [-0.5, 0.5], ['0%', '100%'])
  const accent = person.theme === 'portal' ? '#b6ff3b' : '#ff4fa3'
  const accent2 = person.theme === 'portal' ? '#2ef2ff' : '#a855f7'

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 30, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: 'blur(8px)' }}
      transition={{ ...spring, delay: picked ? 0 : 0.15 + index * 0.1 }}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect()
        mx.set((e.clientX - r.left) / r.width - 0.5)
        my.set((e.clientY - r.top) / r.height - 0.5)
      }}
      onMouseEnter={() => onHover(person.username)}
      onMouseLeave={() => {
        mx.set(0)
        my.set(0)
        onHover(null)
      }}
      style={{ rotateX: picked ? 0 : rx, rotateY: picked ? 0 : ry, transformPerspective: 900 }}
      className={cx('relative flex-1', picked ? 'max-w-md' : 'sm:max-w-[340px]')}
    >
      <div className="gold-frame relative overflow-hidden rounded-[28px] p-6 backdrop-blur-xl" style={{ boxShadow: `0 30px 80px -40px ${accent}` }}>
        <CelestialCorners className="opacity-50" />
        <motion.div
          className="pointer-events-none absolute -inset-1 opacity-50"
          style={{ background: useTransform([glowX, glowY], ([x, y]) => `radial-gradient(400px circle at ${x} ${y}, ${accent}33, transparent 60%)`) }}
        />
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-2xl" style={{ background: accent2 }} />
        {!picked ? (
          <button onClick={onPick} className="relative flex w-full flex-col items-center gap-4 text-center" aria-label={`Sign in as ${person.name}`}>
            <motion.div whileHover={{ scale: 1.06, rotate: person.theme === 'portal' ? -3 : 3 }} transition={spring}>
              <CatAvatar who={person.username} size={150} />
            </motion.div>
            <div>
              <div className="display text-2xl font-extrabold" style={{ color: accent }}>
                {person.name}
              </div>
              <div className="mt-1 text-sm text-soft">{person.line}</div>
            </div>
            <span className="mt-1 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold" style={{ borderColor: `${accent}66`, color: accent }}>
              Enter <ArrowRight size={15} />
            </span>
          </button>
        ) : (
          <PasswordForm person={person} accent={accent} onBack={onBack} onEntering={onEntering} />
        )}
      </div>
    </motion.div>
  )
}

function PasswordForm({ person, accent, onBack, onEntering }: { person: (typeof PEOPLE)[number]; accent: string; onBack: () => void; onEntering: (v: boolean) => void }) {
  const signIn = useApp((s) => s.signIn)
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => inputRef.current?.focus(), [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      onEntering(true)
      await new Promise((r) => setTimeout(r, 450))
      await signIn(person.username, password)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setShake((s) => s + 1)
      setBusy(false)
      onEntering(false)
    }
  }

  return (
    <motion.form initial={{ opacity: 0 }} animate={{ opacity: 1 }} onSubmit={submit} className="relative flex flex-col items-center gap-4 text-center">
      <button type="button" onClick={onBack} className="btn btn-ghost absolute -left-2 -top-2 text-xs" aria-label="Choose a different profile">
        <ArrowLeft size={14} /> Back
      </button>
      <CatAvatar who={person.username} size={120} />
      <div className="display text-2xl font-extrabold" style={{ color: accent }}>
        Hi, {person.name.split(' ')[0]}
      </div>
      <motion.div key={shake} animate={shake ? { x: [0, -10, 10, -6, 6, 0] } : {}} transition={{ duration: 0.4 }} className="relative w-full">
        <input
          ref={inputRef}
          type={show ? 'text' : 'password'}
          className="input pr-11 text-center text-lg tracking-widest"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          aria-label="Password"
          aria-invalid={!!error}
        />
        <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-white" aria-label={show ? 'Hide password' : 'Show password'}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </motion.div>
      {error && <div className="text-sm text-rec">{error}</div>}
      <button className="btn btn-primary w-full py-3 text-base" disabled={busy || !password} style={{ background: accent }}>
        {busy ? <LoaderCircle size={18} className="animate-spin" /> : <>Open the portal <ArrowRight size={17} /></>}
      </button>
    </motion.form>
  )
}
