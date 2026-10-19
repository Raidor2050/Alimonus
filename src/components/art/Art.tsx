import { useId } from 'react'
import { Sigil, GOLD, starPath } from './Sigil'
import type { Username } from '@/types'
import { cx } from '@/lib/util'

/** Brand mark: the gold celestial sigil, with the gothic wordmark beside it. */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <div className={cx('flex items-center gap-2.5 select-none', className)}>
      <Sigil variant="mark" size={38} className="shrink-0 drop-shadow-[0_0_8px_rgb(240_199_94/0.35)]" />
      {!compact && <span className="font-sigil text-gold text-2xl font-semibold leading-none">Alimonus</span>}
    </div>
  )
}

/**
 * Original cat avatars. Raiyan's cat wears lab goggles with a portal halo and code
 * glyphs; Afra's wears a fedora and one sparkling glove under a red recording light.
 */
export function CatAvatar({ who, size = 96, className, animated = true }: { who: Username; size?: number; className?: string; animated?: boolean }) {
  const r = who === 'raiyan'
  const c1 = r ? '#b6ff3b' : '#ff4fa3'
  const c2 = r ? '#2ef2ff' : '#a855f7'
  const id = `cat-${who}-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={r ? 'Raiyan’s lab cat' : 'Afra’s stage cat'}>
      <defs>
        <radialGradient id={`${id}-bg`} cx="50%" cy="45%" r="60%">
          <stop offset="0" stopColor={c2} stopOpacity="0.35" />
          <stop offset="1" stopColor="#07060b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-fur`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b1726" />
          <stop offset="1" stopColor="#0b0912" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="60" r="58" fill={`url(#${id}-bg)`} />
      {r ? (
        <g opacity="0.85">
          <circle cx="60" cy="54" r="44" fill="none" stroke={c1} strokeWidth="1.2" strokeDasharray="2 4" className={animated ? 'anim-spin-slow' : ''} style={{ transformOrigin: '60px 54px' }} />
          <circle cx="60" cy="54" r="38" fill="none" stroke={c2} strokeWidth="0.8" opacity="0.6" />
          <text x="10" y="30" fill={c1} fontSize="11" fontFamily="JetBrains Mono" opacity="0.7">{'</>'}</text>
          <text x="92" y="98" fill={c2} fontSize="10" fontFamily="JetBrains Mono" opacity="0.6">{'{}'}</text>
        </g>
      ) : (
        <g>
          <path d="M60 0 L38 120 L82 120 Z" fill={c1} opacity="0.08" />
          <circle cx="100" cy="18" r="5" fill="#ff2b3b" className={animated ? 'anim-blink' : ''} />
          <text x="78" y="21" fill="#ff2b3b" fontSize="8" fontFamily="JetBrains Mono" fontWeight="700" opacity="0.9">REC</text>
        </g>
      )}
      {/* tail */}
      <path
        d="M82 100 C100 98 104 80 96 72"
        fill="none"
        stroke={`url(#${id}-fur)`}
        strokeWidth="7"
        strokeLinecap="round"
        className={animated ? 'anim-tail' : ''}
        style={{ transformOrigin: '82px 100px' }}
      />
      <path d="M82 100 C100 98 104 80 96 72" fill="none" stroke={c1} strokeWidth="1" strokeLinecap="round" opacity="0.5" className={animated ? 'anim-tail' : ''} style={{ transformOrigin: '82px 100px' }} />
      {/* body */}
      <path d="M38 104 C34 84 42 70 60 70 C78 70 86 84 82 104 Z" fill={`url(#${id}-fur)`} stroke={c1} strokeOpacity="0.35" strokeWidth="1" />
      {/* head */}
      <path d="M36 40 L38 18 L52 30 Q60 27 68 30 L82 18 L84 40 Q88 60 60 66 Q32 60 36 40 Z" fill={`url(#${id}-fur)`} stroke={c1} strokeOpacity="0.5" strokeWidth="1.2" />
      <path d="M40 24 L41 34 L48 30 Z" fill={c2} opacity="0.35" />
      <path d="M80 24 L79 34 L72 30 Z" fill={c2} opacity="0.35" />
      {/* eyes */}
      <g>
        <ellipse cx="50" cy="45" rx="5" ry="4.2" fill={c1} />
        <ellipse cx="70" cy="45" rx="5" ry="4.2" fill={c1} />
        <ellipse cx="50" cy="45" rx="1.3" ry="3.6" fill="#07060b" />
        <ellipse cx="70" cy="45" rx="1.3" ry="3.6" fill="#07060b" />
        <circle cx="51.5" cy="43.5" r="0.9" fill="white" />
        <circle cx="71.5" cy="43.5" r="0.9" fill="white" />
      </g>
      <path d="M58 52 L62 52 L60 54.5 Z" fill={c2} />
      <path d="M60 54.5 Q57 58 54 56 M60 54.5 Q63 58 66 56" fill="none" stroke="#c9c4dc" strokeWidth="0.9" strokeLinecap="round" opacity="0.7" />
      <path d="M44 52 L32 50 M44 55 L32 57 M76 52 L88 50 M76 55 L88 57" stroke="#c9c4dc" strokeWidth="0.6" opacity="0.5" />
      {r ? (
        // lab goggles pushed up on the forehead
        <g>
          <path d="M37 33 Q60 26 83 33" fill="none" stroke="#2a2438" strokeWidth="4" />
          <circle cx="50" cy="31" r="6.5" fill="#0b0912" stroke={c1} strokeWidth="2" />
          <circle cx="70" cy="31" r="6.5" fill="#0b0912" stroke={c1} strokeWidth="2" />
          <circle cx="50" cy="31" r="3.6" fill={c2} opacity="0.55" />
          <circle cx="70" cy="31" r="3.6" fill={c2} opacity="0.55" />
          <circle cx="48.5" cy="29.5" r="1.1" fill="white" opacity="0.9" />
          <circle cx="68.5" cy="29.5" r="1.1" fill="white" opacity="0.9" />
        </g>
      ) : (
        // fedora + a single sparkling glove
        <g>
          <path d="M32 28 Q60 20 88 28 Q78 31 60 30 Q42 31 32 28 Z" fill="#14101c" stroke={c2} strokeWidth="1" />
          <path d="M44 27 Q45 10 60 10 Q75 10 76 27 Q60 24 44 27 Z" fill="#14101c" stroke={c2} strokeWidth="1" />
          <path d="M45 24.5 Q60 21.5 75 24.5 L75.6 21 Q60 18 44.5 21 Z" fill={c1} opacity="0.9" />
          <g transform="translate(36 86)">
            <ellipse cx="0" cy="0" rx="7.5" ry="6" fill="#f4f1ff" />
            <path d="M-6 -3 L-8 -9 M-2 -5 L-2 -11 M2 -5 L3 -11 M5.5 -3 L8 -8" stroke="#f4f1ff" strokeWidth="3" strokeLinecap="round" />
            <path d="M-11 -12 l2 4 l4 2 l-4 2 l-2 4 l-2 -4 l-4 -2 l4 -2 Z" fill="white" className={animated ? 'anim-twinkle' : ''} transform="scale(0.55) translate(-6 -10)" />
          </g>
        </g>
      )}
      {/* paws */}
      <ellipse cx="52" cy="104" rx="6" ry="3.5" fill="#1b1726" stroke={c1} strokeOpacity="0.3" />
      <ellipse cx="68" cy="104" rx="6" ry="3.5" fill="#1b1726" stroke={c1} strokeOpacity="0.3" />
    </svg>
  )
}

/** Impossible triangle (Penrose) in neon — a small nod to Raiyan's strange geometry. */
export function Penrose({ size = 64, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 100 90" width={size} height={size * 0.9} className={className} aria-hidden>
      <g fill="none" strokeWidth="2" strokeLinejoin="round">
        <path d="M50 5 L95 83 L75 83 L50 40 L40 57 L30 57 Z" stroke="var(--a1)" fill="color-mix(in oklab, var(--a1) 12%, transparent)" />
        <path d="M95 83 L5 83 L15 66 L66 66 L50 40 L60 23 Z" stroke="var(--a2)" fill="color-mix(in oklab, var(--a2) 12%, transparent)" />
        <path d="M5 83 L50 5 L60 23 L35 66 L66 66 L75 83 Z" stroke="var(--a3)" fill="color-mix(in oklab, var(--a3) 10%, transparent)" opacity="0.9" />
      </g>
    </svg>
  )
}

/** Branded loader: an equaliser inside a spinning portal ring. */
export function PortalLoader({ label = 'Tuning the dimensions…', size = 64 }: { label?: string; size?: number }) {
  return (
    <div className="flex flex-col items-center gap-3 text-mute" role="status" aria-live="polite">
      <div className="relative" style={{ width: size, height: size }}>
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'conic-gradient(from 0deg, var(--a1), transparent 40%, var(--a2) 70%, transparent 85%, var(--a1))',
            mask: 'radial-gradient(closest-side, transparent 78%, black 82%)',
            WebkitMask: 'radial-gradient(closest-side, transparent 78%, black 82%)',
            animation: 'spin 1.2s linear infinite',
          }}
        />
        <svg viewBox="0 0 40 40" className="absolute inset-[18%] opacity-70" aria-hidden>
          <circle cx="20" cy="20" r="18" fill="none" stroke={GOLD.mid} strokeWidth="0.8" strokeDasharray="0.1 3.4" strokeLinecap="round" />
          <path d={starPath(20, 4, 3)} fill={GOLD.mid} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center gap-[3px]">
          {[0, 1, 2, 3, 4].map((i) => (
            <span
              key={i}
              className="w-[3px] rounded-full bg-a1"
              style={{ height: size * 0.36, animation: `eq 0.9s ${i * 0.12}s ease-in-out infinite alternate`, transformOrigin: 'center' }}
            />
          ))}
        </div>
      </div>
      {label && <span className="text-sm">{label}</span>}
      <style>{`@keyframes eq { from { transform: scaleY(0.2) } to { transform: scaleY(1) } }`}</style>
    </div>
  )
}

export function SpotifyMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="11" fill="#1ed760" />
      <path d="M6.5 9.3c3.7-1.1 7.9-.8 11 1M7.2 12.4c3-.8 6.4-.5 9 .9M7.9 15.3c2.4-.6 4.9-.4 6.9.7" stroke="#07060b" strokeWidth="1.6" strokeLinecap="round" fill="none" />
    </svg>
  )
}

export function YouTubeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect x="1.5" y="5" width="21" height="14" rx="4" fill="#ff1f3a" />
      <path d="M10 9 L15.5 12 L10 15 Z" fill="white" />
    </svg>
  )
}

/** Generated artwork when a song has no album art: a hue-shifted portal with the title's initials. */
export function GeneratedArt({ seed, title, className }: { seed: string; title: string; className?: string }) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360
  const h2 = (h + 70) % 360
  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('')
  return (
    <div
      className={cx('relative overflow-hidden', className)}
      style={{ background: `radial-gradient(circle at 30% 25%, hsl(${h} 95% 60% / 0.9), transparent 55%), radial-gradient(circle at 75% 80%, hsl(${h2} 95% 55% / 0.85), transparent 60%), #0b0912` }}
      aria-hidden
    >
      <div
        className="absolute inset-[18%] rounded-full opacity-70"
        style={{
          background: `conic-gradient(from ${h}deg, hsl(${h} 100% 70%), transparent 30%, hsl(${h2} 100% 70%) 60%, transparent 80%, hsl(${h} 100% 70%))`,
          mask: 'radial-gradient(closest-side, transparent 64%, black 68%, black 74%, transparent 78%)',
          WebkitMask: 'radial-gradient(closest-side, transparent 64%, black 68%, black 74%, transparent 78%)',
        }}
      />
      <span className="display absolute inset-0 flex items-center justify-center text-[2.2em] font-extrabold text-white/90 mix-blend-overlay">{initials}</span>
    </div>
  )
}
