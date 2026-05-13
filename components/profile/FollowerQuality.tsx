'use client';

import { motion } from 'framer-motion';
import { calcFollowerQuality } from '@/lib/analytics';
import type { InstagramProfile } from '@/lib/analytics';

interface Props {
  profile: InstagramProfile;
}

const gradeColors: Record<string, string> = {
  A: '#22c55e',
  B: '#84cc16',
  C: '#eab308',
  D: '#f97316',
  F: '#ef4444',
};

function CircularGauge({ value, color, size = 120 }: { value: number; color: string; size?: number }) {
  const r = (size - 16) / 2;
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
        strokeWidth={8}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={8}
        strokeLinecap="round"
        strokeDasharray={circ}
        initial={{ strokeDashoffset: circ }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
      />
    </svg>
  );
}

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span style={{ color: '#8993a3' }}>{label}</span>
        <span className="font-semibold text-white">{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  );
}

export default function FollowerQuality({ profile }: Props) {
  const q = calcFollowerQuality(profile);
  const gradeColor = gradeColors[q.grade] || '#a78bfa';
  const overallScore = q.realRate;

  return (
    <div
      className="p-5 rounded-2xl"
      style={{
        background: '#111111',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 0 30px rgba(167,139,250,0.15)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-white font-bold text-lg m-0">Takipçi Kalite Analizi</h3>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full"
          style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
        >
          Tahmini
        </span>
      </div>

      {/* Main layout */}
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Circular gauge */}
        <div className="relative flex-shrink-0">
          <CircularGauge value={overallScore} color={gradeColor} size={140} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-3xl font-black"
              style={{ color: gradeColor }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {q.grade}
            </motion.span>
            <span className="text-xs mt-1" style={{ color: '#8993a3' }}>Kalite Notu</span>
          </div>
        </div>

        {/* Metrics */}
        <div className="flex-1 w-full space-y-4">
          <MetricBar label="Gerçek Takipçi" value={q.realRate} color="linear-gradient(90deg, #22c55e, #86efac)" />
          <MetricBar label="Şüpheli Takipçi" value={q.suspiciousRate} color="linear-gradient(90deg, #ef4444, #fca5a5)" />
          <MetricBar label="Pasif Takipçi" value={q.passiveRate} color="linear-gradient(90deg, #6b7280, #9ca3af)" />
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-3 gap-3 mt-5">
        {[
          { label: 'Gerçek', value: q.realRate, color: '#22c55e', bg: 'rgba(34,197,94,0.08)' },
          { label: 'Şüpheli', value: q.suspiciousRate, color: '#ef4444', bg: 'rgba(239,68,68,0.08)' },
          { label: 'Pasif', value: q.passiveRate, color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
        ].map((item) => (
          <motion.div
            key={item.label}
            className="text-center p-3 rounded-xl"
            style={{ background: item.bg, border: `1px solid ${item.color}22` }}
            whileHover={{ scale: 1.04 }}
            transition={{ type: 'spring', stiffness: 300 }}
          >
            <span className="block text-2xl font-black" style={{ color: item.color }}>
              {item.value}%
            </span>
            <span className="block text-xs mt-1" style={{ color: '#8993a3' }}>{item.label}</span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
