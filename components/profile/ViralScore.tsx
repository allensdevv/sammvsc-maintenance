'use client';

import { motion } from 'framer-motion';
import { calcViralScore } from '@/lib/analytics';
import type { InstagramProfile } from '@/lib/analytics';

interface Props {
  profile: InstagramProfile;
}

const levelColors = {
  low: { text: '#ef4444', glow: 'rgba(239,68,68,0.2)', label: 'Düşük' },
  medium: { text: '#eab308', glow: 'rgba(234,179,8,0.2)', label: 'Orta' },
  high: { text: '#22c55e', glow: 'rgba(34,197,94,0.2)', label: 'Yüksek' },
};

function CircularGauge({ value, color }: { value: number; color: string }) {
  const size = 160;
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth={10}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
      />
    </svg>
  );
}

function AnimatedScore({ value }: { value: number }) {
  return (
    <motion.span
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="text-4xl font-black text-white"
    >
      {value}
    </motion.span>
  );
}

function ComponentBar({ label, value, max = 30 }: { label: string; value: number; max?: number }) {
  const pct = Math.round((value / max) * 100);
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span style={{ color: '#8993a3' }}>{label}</span>
        <span className="font-semibold text-white">{value}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: 'linear-gradient(90deg, #a78bfa, #7c3aed)' }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
        />
      </div>
    </div>
  );
}

export default function ViralScore({ profile }: Props) {
  const vs = calcViralScore(profile);
  const lc = levelColors[vs.level];

  return (
    <div
      className="p-5 rounded-2xl"
      style={{
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: `0 0 30px ${lc.glow}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white font-bold text-lg m-0">Viral Skor</h3>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full"
          style={{ background: `${lc.text}18`, color: lc.text, border: `1px solid ${lc.text}44` }}
        >
          {lc.label}
        </span>
      </div>

      {/* Gauge + score */}
      <div className="flex flex-col items-center mb-5">
        <div className="relative">
          <CircularGauge value={vs.score} color={lc.text} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <AnimatedScore value={vs.score} />
            <span className="text-xs mt-1" style={{ color: '#8993a3' }}>/ 100</span>
          </div>
        </div>
      </div>

      {/* Component bars */}
      <div className="space-y-3">
        <ComponentBar label="Takip Oranı" value={vs.components.followRatio} max={30} />
        <ComponentBar label="İçerik Aktivitesi" value={vs.components.contentActivity} max={25} />
        <ComponentBar label="Hesap Otoritesi" value={vs.components.accountAuthority} max={25} />
        <ComponentBar label="Etkileşim Potansiyeli" value={vs.components.engagementPotential} max={20} />
      </div>
    </div>
  );
}
