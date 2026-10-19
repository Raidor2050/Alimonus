import { useId } from 'react'
import { useReducedMotion } from 'motion/react'
import { cx } from '@/lib/util'

/** Gold used by the celestial sigil and its accents across the app. */
export const GOLD = { light: '#fff1c4', mid: '#f0c75e', deep: '#a8742a' }

/** Four-point sparkle star centred on (x, y). */
export function starPath(x: number, y: number, r: number, waist = 0.22) {
  const w = r * waist
  return `M${x} ${y - r} Q${x + w} ${y - w} ${x + r} ${y} Q${x + w} ${y + w} ${x} ${y + r} Q${x - w} ${y + w} ${x - r} ${y} Q${x - w} ${y - w} ${x} ${y - r} Z`
}

/**
 * The Alimonus sigil: a black disc ringed in gold, a vertical axis threading two crescent
 * moons with stars, a horizontal star-tipped axis, orbit dots and a calligraphic wordmark.
 * `variant="mark"` drops the wordmark and fine details for small sizes (logo, favicon-like).
 */
export function Sigil({ size = 360, variant = 'full', animated = true, className }: { size?: number; variant?: 'full' | 'mark'; animated?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '')
  const reduced = useReducedMotion()
  const live = animated && !reduced
  const gold = `sg-gold-${uid}`
  const glow = `sg-glow-${uid}`
  const crescent = `sg-cres-${uid}`
  const full = variant === 'full'
  const g = `url(#${gold})`

  // Orbit dots + short spokes at the diagonals, like a star chart.
  const diag = [45, 135, 225, 315]

  return (
    <svg viewBox="0 0 400 400" width={size} height={size} className={cx('overflow-visible', className)} role="img" aria-label="Alimonus">
      <defs>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1" spreadMethod="reflect">
          <stop offset="0" stopColor={GOLD.deep} />
          <stop offset="0.35" stopColor={GOLD.mid} />
          <stop offset="0.5" stopColor={GOLD.light} />
          <stop offset="0.65" stopColor={GOLD.mid} />
          <stop offset="1" stopColor={GOLD.deep} />
          {live && <animateTransform attributeName="gradientTransform" type="translate" values="-0.6 -0.6; 0.6 0.6; -0.6 -0.6" dur="9s" repeatCount="indefinite" />}
        </linearGradient>
        <filter id={glow} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation={full ? 2.2 : 1.4} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        {/* crescent = disc minus an offset disc (horns pointing up) */}
        <mask id={crescent} maskUnits="userSpaceOnUse">
          <rect width="400" height="400" fill="black" />
          <circle cx="200" cy="100" r="30" fill="white" />
          <circle cx="200" cy="86" r="27" fill="black" />
          <circle cx="200" cy="302" r="30" fill="white" />
          <circle cx="200" cy="288" r="27" fill="black" />
        </mask>
      </defs>

      {/* soft halo behind the disc */}
      <circle cx="200" cy="200" r="182" fill={GOLD.mid} opacity="0.07" />
      <circle cx="200" cy="200" r="172" fill="#050405" />

      <g filter={`url(#${glow})`} fill="none" stroke={g} strokeLinecap="round">
        {/* rings */}
        <circle cx="200" cy="200" r="172" strokeWidth={full ? 2.2 : 5} />
        {full && <circle cx="200" cy="200" r="160" strokeWidth="0.9" opacity="0.75" />}
        <g style={live ? { transformOrigin: '200px 200px', animation: 'spin 90s linear infinite' } : undefined}>
          <circle cx="200" cy="200" r={full ? 142 : 136} strokeWidth={full ? 1.6 : 4} strokeDasharray={full ? '0.1 7' : '0.1 16'} opacity="0.9" />
        </g>
        {full && <circle cx="200" cy="200" r="120" strokeWidth="0.7" opacity="0.35" />}

        {/* vertical axis */}
        <path d={full ? 'M200 8 V392' : 'M200 30 V370'} strokeWidth={full ? 1.6 : 4} />
        {full && (
          <>
            <circle cx="200" cy="42" r="7" strokeWidth="1.2" />
            <path d="M193 42 H207" strokeWidth="1" />
            <ellipse cx="200" cy="152" rx="15" ry="11" strokeWidth="1.4" />
            <path d="M193 152 H207" strokeWidth="1" opacity="0.8" />
            <path d="M200 368 l-5 10 l5 10 l5 -10 Z" strokeWidth="1.2" />
          </>
        )}

        {/* horizontal axis */}
        {full ? (
          <>
            <path d="M8 200 H392" strokeWidth="1.2" opacity="0.85" />
            <circle cx="66" cy="200" r="3" fill={g} stroke="none" />
            <circle cx="334" cy="200" r="3" fill={g} stroke="none" />
          </>
        ) : (
          <path d="M40 200 H360" strokeWidth="3" opacity="0.8" />
        )}

        {/* star-chart spokes and orbit dots */}
        {full &&
          diag.map((a) => {
            const rad = (a * Math.PI) / 180
            const p = (r: number) => [200 + Math.cos(rad) * r, 200 + Math.sin(rad) * r]
            const [x1, y1] = p(118)
            const [x2, y2] = p(170)
            const [dx, dy] = p(158)
            return (
              <g key={a}>
                <path d={`M${x1} ${y1} L${x2} ${y2}`} strokeWidth="0.8" opacity="0.6" />
                <circle cx={dx} cy={dy} r="3.4" fill={g} stroke="none" />
              </g>
            )
          })}
        {full &&
          [20, 160, 200, 340].map((a, i) => {
            const rad = (a * Math.PI) / 180
            return <circle key={i} cx={200 + Math.cos(rad) * 142} cy={200 + Math.sin(rad) * 142} r="2.4" fill={g} stroke="none" />
          })}
      </g>

      {/* crescent moons with stars */}
      <g filter={`url(#${glow})`}>
        <rect width="400" height="400" fill={g} mask={`url(#${crescent})`} />
        <path d={starPath(200, 92, full ? 13 : 18)} fill={g} className={live ? 'anim-twinkle' : undefined} style={{ transformOrigin: '200px 92px' }} />
        <path d={starPath(200, 294, full ? 13 : 18)} fill={g} className={live ? 'anim-twinkle' : undefined} style={{ animationDelay: '-1.7s' }} />
        {full && (
          <>
            {/* side crescents */}
            <path d="M98 126 a9 9 0 1 0 9 -12 a7 7 0 1 1 -9 12 Z" fill={g} />
            <path d="M302 126 a9 9 0 1 1 -9 -12 a7 7 0 1 0 9 12 Z" fill={g} />
            {/* horizontal sparkle tips */}
            <path d={starPath(30, 200, 15, 0.16)} fill={g} />
            <path d={starPath(370, 200, 15, 0.16)} fill={g} />
            {/* scattered stars */}
            {[
              [128, 252, 4],
              [272, 252, 4],
              [150, 116, 3],
              [260, 120, 3],
              [236, 176, 5],
            ].map(([x, y, r], i) => (
              <path key={i} d={starPath(x, y, r)} fill={g} className={live ? 'anim-twinkle' : undefined} style={{ animationDelay: `${i * -0.7}s` }} />
            ))}
          </>
        )}
      </g>

      {/* wordmark + flourishes */}
      {full && (
        <g filter={`url(#${glow})`}>
          <path
            d="M96 236 C130 252 160 228 186 240 C196 245 196 256 200 256 C204 256 204 245 214 240 C240 228 270 252 304 236"
            fill="none"
            stroke={g}
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <path d="M186 248 C176 262 168 252 176 246 M214 248 C224 262 232 252 224 246" fill="none" stroke={g} strokeWidth="1.1" strokeLinecap="round" />
          <path d="M70 214 C90 196 104 222 120 210" fill="none" stroke={g} strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
          <path d="M330 214 C310 196 296 222 280 210" fill="none" stroke={g} strokeWidth="1.1" strokeLinecap="round" opacity="0.8" />
          <text
            x="200"
            y="221"
            textAnchor="middle"
            fontFamily="'Grenze Gotisch', 'Cinzel', serif"
            fontWeight="600"
            fontSize="66"
            letterSpacing="0.5"
            fill={g}
            stroke="#050405"
            strokeWidth="9"
            strokeLinejoin="round"
            style={{ paintOrder: 'stroke' }}
          >
            Alimonus
          </text>
        </g>
      )}
    </svg>
  )
}

/** Small gold sparkle used as a typographic ornament. */
export function Sparkle({ size = 10, className }: { size?: number; className?: string }) {
  const id = `sparkle-${useId().replace(/:/g, '')}`
  return (
    <svg viewBox="0 0 20 20" width={size} height={size} className={className} aria-hidden>
      <path d={starPath(10, 10, 9.5, 0.18)} fill={`url(#${id})`} />
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={GOLD.light} />
          <stop offset="1" stopColor={GOLD.deep} />
        </linearGradient>
      </defs>
    </svg>
  )
}

/** Thin gold hairline with a centred sparkle — a celestial divider. */
export function GoldDivider({ className }: { className?: string }) {
  return (
    <div className={cx('flex items-center gap-2', className)} aria-hidden>
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-gold/50" />
      <Sparkle size={9} />
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-gold/50" />
    </div>
  )
}

/** Gold star-chart corner ornaments for hero panels. Parent must be `relative`. */
export function CelestialCorners({ className }: { className?: string }) {
  const corner = (rot: number, pos: string) => (
    <svg viewBox="0 0 60 60" className={cx('pointer-events-none absolute h-12 w-12 opacity-60', pos)} style={{ transform: `rotate(${rot}deg)` }} aria-hidden>
      <path d="M4 40 V10 a6 6 0 0 1 6 -6 H40" fill="none" stroke={GOLD.mid} strokeWidth="1" strokeLinecap="round" />
      <path d="M4 52 V46 M52 4 H46" stroke={GOLD.mid} strokeWidth="1" strokeLinecap="round" />
      <path d={starPath(14, 14, 5, 0.2)} fill={GOLD.mid} />
      <circle cx="26" cy="9" r="1.2" fill={GOLD.mid} />
      <circle cx="9" cy="26" r="1.2" fill={GOLD.mid} />
    </svg>
  )
  return (
    <div className={cx('pointer-events-none absolute inset-2', className)} aria-hidden>
      {corner(0, 'left-0 top-0')}
      {corner(90, 'right-0 top-0')}
      {corner(180, 'right-0 bottom-0')}
      {corner(270, 'left-0 bottom-0')}
    </div>
  )
}
