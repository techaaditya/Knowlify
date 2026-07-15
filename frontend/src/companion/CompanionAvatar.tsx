/**
 * CompanionAvatar — the "elegant glowing orb" concept.
 *
 * A layered SVG orb (aura → core → gloss → orbit ring → eyes → effects) whose
 * every layer is driven by the current {@link CompanionEmotion}. The avatar is
 * a pure view: emotion in, expression out — so it can later be swapped for a
 * 3D/voice avatar without touching the brain or store.
 */
import React, { useId, useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import type { CompanionEmotion } from './types';

interface Props {
  emotion: CompanionEmotion;
  size?: number;
  /** Bump to fire a one-shot confetti burst (level-up, mastery). */
  celebrationToken?: number;
}

// ── Per-emotion palette (kept inside the app's warm mastery language) ───────

interface Tint { a: string; b: string; aura: string }

const TINTS: Record<CompanionEmotion, Tint> = {
  idle:        { a: '#DCCBAB', b: '#A98C66', aura: 'rgba(188,168,138,0.55)' },
  happy:       { a: '#E2CFA9', b: '#B29467', aura: 'rgba(198,172,130,0.60)' },
  thinking:    { a: '#D5CCBD', b: '#948871', aura: 'rgba(176,164,140,0.50)' },
  teaching:    { a: '#DCC8A2', b: '#A18457', aura: 'rgba(188,168,138,0.62)' },
  celebrating: { a: '#EBD69F', b: '#C9A55C', aura: 'rgba(214,178,106,0.70)' },
  concerned:   { a: '#DBB3AA', b: '#B07A6E', aura: 'rgba(197,143,132,0.50)' },
  waiting:     { a: '#DCCBAB', b: '#A98C66', aura: 'rgba(188,168,138,0.50)' },
  sleeping:    { a: '#D6D0C2', b: '#9B9484', aura: 'rgba(190,183,164,0.32)' },
  surprised:   { a: '#E4D2AC', b: '#B0906A', aura: 'rgba(198,172,130,0.65)' },
  confident:   { a: '#C9D3C4', b: '#7E8F79', aura: 'rgba(143,158,139,0.58)' },
  curious:     { a: '#DFD0B0', b: '#A98C66', aura: 'rgba(188,168,138,0.58)' },
};

// ── Whole-body motion per emotion ────────────────────────────────────────────

const bodyMotion = (emotion: CompanionEmotion, reduce: boolean) => {
  if (reduce) return { animate: {}, transition: {} };
  switch (emotion) {
    case 'celebrating':
      return {
        animate: { y: [0, -13, 0, -7, 0], scale: [1, 1.07, 1, 1.04, 1] },
        transition: { duration: 1.05, repeat: 2, ease: 'easeOut' },
      };
    case 'surprised':
      return {
        animate: { scale: [1, 1.16, 0.97, 1] },
        transition: { duration: 0.5, ease: 'easeOut' },
      };
    case 'sleeping':
      return {
        animate: { y: 3, scale: [1, 1.035, 1] },
        transition: { duration: 5.2, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'concerned':
      return {
        animate: { y: [1, 4, 1], rotate: -1.5 },
        transition: { duration: 5.5, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'thinking':
      return {
        animate: { y: [0, -3, 0], rotate: [-2, 2, -2] },
        transition: { duration: 3.6, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'teaching':
      return {
        animate: { y: [0, -3, 0], rotate: -3 },
        transition: { duration: 3.4, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'confident':
      return {
        animate: { y: [0, -5, 0], scale: [1, 1.03, 1] },
        transition: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'curious':
      return {
        animate: { y: [0, -4, 0], rotate: 5 },
        transition: { duration: 3.8, repeat: Infinity, ease: 'easeInOut' },
      };
    case 'waiting':
      return {
        animate: { y: [0, -3, 0], rotate: [0, 2, 0, -2, 0] },
        transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
      };
    default: // idle, happy — gentle breathing float
      return {
        animate: { y: [0, -4, 0] },
        transition: { duration: 4.2, repeat: Infinity, ease: 'easeInOut' },
      };
  }
};

// ── Eyes ─────────────────────────────────────────────────────────────────────

type EyeShape = 'open' | 'arc' | 'closed';

interface EyeConfig {
  shape: EyeShape;
  /** Group transform pieces. */
  dx: number;
  dy: number;
  scale: number;
  scaleY: number;
  tiltL: number;
  tiltR: number;
  /** Slow side-to-side scan (waiting). */
  scan?: boolean;
}

const EYES: Record<CompanionEmotion, EyeConfig> = {
  idle:        { shape: 'open', dx: 0, dy: 0, scale: 1, scaleY: 1, tiltL: 0, tiltR: 0 },
  happy:       { shape: 'arc', dx: 0, dy: 0, scale: 1, scaleY: 1, tiltL: 0, tiltR: 0 },
  thinking:    { shape: 'open', dx: 4, dy: -6, scale: 0.92, scaleY: 1, tiltL: 0, tiltR: 0 },
  teaching:    { shape: 'open', dx: 0, dy: 0, scale: 1, scaleY: 0.72, tiltL: 0, tiltR: 0 },
  celebrating: { shape: 'arc', dx: 0, dy: -1, scale: 1.08, scaleY: 1, tiltL: 0, tiltR: 0 },
  concerned:   { shape: 'open', dx: 0, dy: 2, scale: 0.9, scaleY: 0.9, tiltL: 10, tiltR: -10 },
  waiting:     { shape: 'open', dx: 0, dy: 0, scale: 1, scaleY: 1, tiltL: 0, tiltR: 0, scan: true },
  sleeping:    { shape: 'closed', dx: 0, dy: 2, scale: 1, scaleY: 1, tiltL: 0, tiltR: 0 },
  surprised:   { shape: 'open', dx: 0, dy: -1, scale: 1.32, scaleY: 1.05, tiltL: 0, tiltR: 0 },
  confident:   { shape: 'open', dx: 0, dy: -1, scale: 1, scaleY: 0.8, tiltL: 0, tiltR: 0 },
  curious:     { shape: 'open', dx: 2, dy: -2, scale: 1, scaleY: 1, tiltL: 0, tiltR: -6 },
};

const EYE_COLOR = '#3F3A32';

const Eye: React.FC<{ cx: number; cfg: EyeConfig; tilt: number; blink: boolean; grow?: number }> = ({
  cx,
  cfg,
  tilt,
  blink,
  grow = 1,
}) => {
  if (cfg.shape === 'arc') {
    // Joyful “∩” arcs.
    return (
      <path
        d={`M ${cx - 8} 61 Q ${cx} 48 ${cx + 8} 61`}
        stroke={EYE_COLOR}
        strokeWidth={4.6}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  if (cfg.shape === 'closed') {
    return (
      <path
        d={`M ${cx - 7} 58 Q ${cx} 62 ${cx + 7} 58`}
        stroke={EYE_COLOR}
        strokeWidth={3.6}
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return (
    <motion.ellipse
      cx={cx}
      cy={57}
      rx={6.4 * grow}
      ry={8.6 * grow * cfg.scaleY}
      fill={EYE_COLOR}
      transform={`rotate(${tilt} ${cx} 57)`}
      animate={blink ? { scaleY: [1, 1, 0.08, 1] } : undefined}
      transition={
        blink
          ? { duration: 0.32, times: [0, 0.7, 0.85, 1], repeat: Infinity, repeatDelay: 3.4 }
          : undefined
      }
      style={{ originX: `${cx}px`, originY: '57px' }}
    />
  );
};

// ── One-shot confetti burst ──────────────────────────────────────────────────

const CONFETTI = [
  { x: -30, y: -34, c: '#C9A55C', r: 3.2 },
  { x: 26, y: -40, c: '#8F9E8B', r: 2.6 },
  { x: -14, y: -46, c: '#C58F84', r: 2.4 },
  { x: 38, y: -22, c: '#BCA88A', r: 3 },
  { x: -40, y: -16, c: '#D2C9B9', r: 2.4 },
  { x: 10, y: -50, c: '#C9A55C', r: 2.2 },
  { x: -24, y: -24, c: '#8F9E8B', r: 2 },
  { x: 34, y: -36, c: '#C58F84', r: 2.8 },
];

const ConfettiBurst: React.FC<{ burstKey: string }> = ({ burstKey }) => (
  <g key={burstKey}>
    {CONFETTI.map((p, i) => (
      <motion.circle
        key={`${burstKey}-${i}`}
        cx={60}
        cy={44}
        r={p.r}
        fill={p.c}
        initial={{ opacity: 1, x: 0, y: 0, scale: 0.4 }}
        animate={{ opacity: 0, x: p.x, y: p.y, scale: 1 }}
        transition={{ duration: 1.15, delay: i * 0.04, ease: 'easeOut' }}
      />
    ))}
  </g>
);

// ── The avatar ───────────────────────────────────────────────────────────────

export const CompanionAvatar: React.FC<Props> = ({ emotion, size = 64, celebrationToken = 0 }) => {
  const reduce = useReducedMotion() ?? false;
  const gid = useId().replace(/[:]/g, '');
  const tint = TINTS[emotion];
  const eyes = EYES[emotion];
  const body = useMemo(() => bodyMotion(emotion, reduce), [emotion, reduce]);
  const blink = !reduce && eyes.shape === 'open' && emotion !== 'surprised';
  const showConfetti = !reduce && (emotion === 'celebrating' || celebrationToken > 0);

  return (
    <motion.div
      className="companion-avatar"
      style={{ width: size, height: size }}
      animate={body.animate}
      transition={body.transition as never}
      role="img"
      aria-label={`Learning companion — ${emotion}`}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ overflow: 'visible', display: 'block' }}>
        <defs>
          <radialGradient id={`core-${gid}`} cx="38%" cy="32%" r="78%">
            <stop offset="0%" stopColor="#FBF4E4" />
            <stop offset="22%" stopColor={tint.a} />
            <stop offset="72%" stopColor={tint.b} />
            <stop offset="100%" stopColor={tint.b} />
          </radialGradient>
          <radialGradient id={`aura-${gid}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={tint.aura} />
            <stop offset="100%" stopColor="rgba(188,168,138,0)" />
          </radialGradient>
        </defs>

        {/* Aura — soft breathing glow */}
        <motion.circle
          cx={60}
          cy={60}
          r={52}
          fill={`url(#aura-${gid})`}
          animate={reduce ? undefined : { scale: [1, 1.12, 1], opacity: emotion === 'sleeping' ? [0.5, 0.65, 0.5] : [0.85, 1, 0.85] }}
          transition={{ duration: emotion === 'confident' ? 2.2 : 3.8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ originX: '60px', originY: '60px' }}
        />

        {/* Orbit ring — a quiet hint of "intelligence at work" */}
        <motion.circle
          cx={60}
          cy={60}
          r={41}
          fill="none"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth={1.4}
          strokeDasharray="6 14"
          strokeLinecap="round"
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: emotion === 'thinking' ? 7 : 18, repeat: Infinity, ease: 'linear' }}
          style={{ originX: '60px', originY: '60px' }}
          opacity={emotion === 'sleeping' ? 0.25 : 0.8}
        />

        {/* Core orb */}
        <circle cx={60} cy={60} r={34} fill={`url(#core-${gid})`} />
        {/* Glass highlight */}
        <ellipse cx={48} cy={44} rx={13} ry={7.5} fill="rgba(255,255,255,0.42)" />

        {/* Eyes */}
        <motion.g
          animate={{
            y: eyes.dy,
            scale: eyes.scale,
            x: eyes.scan && !reduce ? [eyes.dx - 3, eyes.dx + 3, eyes.dx - 3] : eyes.dx,
          }}
          transition={eyes.scan ? { duration: 4.5, repeat: Infinity, ease: 'easeInOut' } : { type: 'spring', stiffness: 260, damping: 22 }}
          style={{ originX: '60px', originY: '57px' }}
        >
          <Eye cx={47} cfg={eyes} tilt={eyes.tiltL} blink={blink} />
          <Eye cx={73} cfg={eyes} tilt={eyes.tiltR} blink={blink} grow={emotion === 'curious' ? 1.18 : 1} />
        </motion.g>

        {/* Thinking dots */}
        {emotion === 'thinking' && !reduce && (
          <g>
            {[0, 1, 2].map((i) => (
              <motion.circle
                key={i}
                cx={88 + i * 9}
                cy={26 - i * 7}
                r={3.4 - i * 0.7}
                fill={tint.b}
                animate={{ opacity: [0.15, 1, 0.15], y: [0, -2.5, 0] }}
                transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: 'easeInOut' }}
              />
            ))}
          </g>
        )}

        {/* Sleeping Zzz */}
        {emotion === 'sleeping' && (
          <g fontFamily="var(--font-heading, sans-serif)" fontWeight={700} fill={tint.b}>
            {[0, 1, 2].map((i) => (
              <motion.text
                key={i}
                x={86 + i * 8}
                y={34 - i * 4}
                fontSize={13 - i * 3}
                initial={{ opacity: 0, y: 6 }}
                animate={reduce ? { opacity: 0.7 } : { opacity: [0, 0.9, 0], y: [6, -8] }}
                transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.7, ease: 'easeOut' }}
              >
                z
              </motion.text>
            ))}
          </g>
        )}

        {/* Confident glint */}
        {emotion === 'confident' && !reduce && (
          <motion.path
            d="M 84 32 l 2.4 5 5 2.4 -5 2.4 -2.4 5 -2.4 -5 -5 -2.4 5 -2.4 Z"
            fill="#FFFDF2"
            animate={{ opacity: [0, 1, 0], scale: [0.6, 1.1, 0.6], rotate: [0, 18, 0] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{ originX: '86px', originY: '39px' }}
          />
        )}

        {/* Celebration confetti */}
        {showConfetti && <ConfettiBurst burstKey={`${emotion}-${celebrationToken}`} />}
      </svg>
    </motion.div>
  );
};

export default CompanionAvatar;
