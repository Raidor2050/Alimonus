import { memo } from 'react'
import type { ThemeId } from '@/types'

export type Scene = 'login' | 'home' | 'chordbook' | 'song' | 'playlists' | 'roadmap' | 'tools' | 'profile'

const SCENE: Record<Scene, { portal: [number, number, number]; spot: number; dim: number; wave: number }> = {
  //            portal x%, y%, size(vmin)   spotlight strength, overall dim, wave opacity
  login: { portal: [50, 24, 66], spot: 0.7, dim: 0.15, wave: 0.5 },
  home: { portal: [84, 18, 70], spot: 0.8, dim: 0.15, wave: 0.45 },
  chordbook: { portal: [8, 88, 64], spot: 0.5, dim: 0.25, wave: 0.35 },
  song: { portal: [92, 92, 48], spot: 0.25, dim: 0.55, wave: 0.18 },
  playlists: { portal: [12, 14, 58], spot: 0.6, dim: 0.25, wave: 0.4 },
  roadmap: { portal: [50, 108, 90], spot: 0.55, dim: 0.3, wave: 0.3 },
  tools: { portal: [88, 70, 66], spot: 0.4, dim: 0.3, wave: 0.6 },
  profile: { portal: [70, 30, 80], spot: 0.9, dim: 0.1, wave: 0.4 },
}

// Deterministic star field so it doesn't reshuffle on every render.
const STARS = Array.from({ length: 70 }, (_, i) => {
  const r = (n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1
  return { x: r(1) * 100, y: r(2) * 100, s: r(3) * 1.6 + 0.4, d: r(4) * 4 }
})

/**
 * The procedural Alimonus backdrop: drifting colour fields, a rotating portal, stage
 * spotlights, a scrolling waveform and stars. Everything animates with transform/opacity
 * only, so it stays cheap; the `.ambient` class lets settings pause or hide it.
 */
export const Cosmos = memo(function Cosmos({ scene, theme }: { scene: Scene; theme: ThemeId }) {
  const s = SCENE[scene]
  const showPortal = theme !== 'stage'
  const showStage = theme !== 'portal'
  return (
    <div className="ambient pointer-events-none fixed inset-0 overflow-hidden" aria-hidden style={{ zIndex: 0 }}>
      {/* colour fields */}
      <div
        className="anim-drift-a absolute -left-[20vw] -top-[20vh] h-[80vh] w-[80vw] rounded-full opacity-60"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--a2) 55%, transparent), transparent)' }}
      />
      <div
        className="anim-drift-b absolute -bottom-[25vh] -right-[15vw] h-[85vh] w-[75vw] rounded-full opacity-50"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--a3) 45%, transparent), transparent)' }}
      />
      <div
        className="anim-drift-a absolute left-[30vw] top-[40vh] h-[50vh] w-[50vw] rounded-full opacity-30"
        style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--a1) 40%, transparent), transparent)', animationDelay: '-12s' }}
      />

      {/* stars */}
      <svg className="absolute inset-0 h-full w-full">
        {STARS.map((st, i) => (
          <circle key={i} cx={`${st.x}%`} cy={`${st.y}%`} r={st.s} fill="white" className="anim-twinkle" style={{ animationDelay: `${st.d}s`, opacity: 0.5 }} />
        ))}
      </svg>

      {/* interdimensional portal */}
      {showPortal && (
        <div
          className="absolute"
          style={{
            left: `${s.portal[0]}%`,
            top: `${s.portal[1]}%`,
            width: `${s.portal[2]}vmin`,
            height: `${s.portal[2]}vmin`,
            transform: 'translate(-50%, -50%)',
            transition: 'left 1.2s var(--ease-out-expo), top 1.2s var(--ease-out-expo), width 1.2s var(--ease-out-expo), height 1.2s var(--ease-out-expo)',
          }}
        >
          <div
            className="anim-spin-slow absolute inset-0 rounded-full opacity-70"
            style={{
              background: 'conic-gradient(from 0deg, var(--a1), transparent 18%, var(--a2) 32%, transparent 48%, var(--a1) 64%, transparent 78%, var(--a4) 90%, var(--a1))',
              mask: 'radial-gradient(closest-side, transparent 62%, black 66%, black 72%, transparent 78%)',
              WebkitMask: 'radial-gradient(closest-side, transparent 62%, black 66%, black 72%, transparent 78%)',
            }}
          />
          <div
            className="anim-spin-rev absolute inset-[9%] rounded-full opacity-50"
            style={{
              background: 'conic-gradient(from 90deg, transparent, var(--a2), transparent 30%, var(--a1) 55%, transparent 70%, var(--a2))',
              mask: 'radial-gradient(closest-side, transparent 70%, black 74%, black 76%, transparent 80%)',
              WebkitMask: 'radial-gradient(closest-side, transparent 70%, black 74%, black 76%, transparent 80%)',
            }}
          />
          <div className="absolute inset-[22%] rounded-full opacity-40" style={{ background: 'radial-gradient(closest-side, color-mix(in oklab, var(--a1) 30%, transparent), transparent 75%)' }} />
          <svg className="anim-spin-mid absolute inset-[14%] opacity-30" viewBox="0 0 100 100">
            {Array.from({ length: 12 }, (_, i) => (
              <path key={i} d="M50 50 Q62 30 50 6" fill="none" stroke="var(--a1)" strokeWidth="0.35" transform={`rotate(${i * 30} 50 50)`} />
            ))}
          </svg>
        </div>
      )}

      {/* stage spotlights */}
      {showStage && (
        <div className="absolute inset-x-0 top-0 h-full" style={{ opacity: s.spot * 0.55 }}>
          <div
            className="anim-sweep absolute -top-[10vh] left-[18%] h-[120vh] w-[36vw] origin-top"
            style={{ background: 'conic-gradient(from 168deg at 50% 0%, transparent, color-mix(in oklab, var(--a1) 32%, transparent) 12deg, transparent 24deg)' }}
          />
          <div
            className="anim-sweep absolute -top-[10vh] right-[14%] h-[120vh] w-[36vw] origin-top"
            style={{ background: 'conic-gradient(from 168deg at 50% 0%, transparent, color-mix(in oklab, var(--a2) 30%, transparent) 12deg, transparent 24deg)', animationDelay: '-4.5s' }}
          />
        </div>
      )}

      {/* waveform horizon */}
      <div className="absolute inset-x-0 bottom-[10vh] h-24 overflow-hidden" style={{ opacity: s.wave }}>
        <svg className="anim-wave h-full" style={{ width: '200%' }} viewBox="0 0 1600 100" preserveAspectRatio="none">
          <defs>
            <linearGradient id="wavegrad" x1="0" x2="1">
              <stop offset="0" stopColor="var(--a1)" />
              <stop offset="0.5" stopColor="var(--a2)" />
              <stop offset="1" stopColor="var(--a1)" />
            </linearGradient>
          </defs>
          {[0, 1, 2].map((k) => (
            <path
              key={k}
              d={wavePath(1600, 50, 18 - k * 5, 8 + k * 8, k * 0.9)}
              fill="none"
              stroke="url(#wavegrad)"
              strokeWidth={1.4 - k * 0.35}
              opacity={0.8 - k * 0.22}
            />
          ))}
        </svg>
      </div>

      {/* vignette / dimmer per scene */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at center, transparent 30%, rgb(3 3 4 / ${0.55 + s.dim * 0.4}) 100%), rgb(3 3 4 / ${s.dim})`,
          transition: 'background 0.8s',
        }}
      />
    </div>
  )
})

/** A seamlessly tiling sine-ish path (two periods fit the width exactly). */
function wavePath(width: number, mid: number, amp: number, cycles: number, phase: number) {
  const pts: string[] = []
  for (let x = 0; x <= width; x += 8) {
    const t = (x / width) * Math.PI * 2 * cycles
    const y = mid + amp * Math.sin(t + phase) * (0.6 + 0.4 * Math.sin(t * 0.25 + phase))
    pts.push(`${x === 0 ? 'M' : 'L'}${x} ${y.toFixed(1)}`)
  }
  return pts.join(' ')
}
