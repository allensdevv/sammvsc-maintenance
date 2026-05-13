'use client';

import { calcReelsEstimate, formatNumber } from '@/lib/analytics';
import type { InstagramProfile } from '@/lib/analytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';

interface Props {
  profile: InstagramProfile;
}

// Generate seeded pseudo-random data consistent per username
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function generateReelsData(username: string, avgViews: number) {
  const seed = username.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return Array.from({ length: 12 }, (_, i) => {
    const r = seededRand(seed + i * 7);
    const variance = 0.4 + r * 1.2;
    return {
      day: `G${i + 1}`,
      views: Math.round(avgViews * variance),
    };
  });
}

interface TooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="text-sm font-semibold"
      style={{
        background: 'rgba(17,17,17,0.96)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8,
        padding: '8px 12px',
        color: '#d9e1ee',
      }}
    >
      <div style={{ color: '#8993a3', fontSize: 11 }}>{label}</div>
      <div style={{ color: '#a78bfa' }}>{formatNumber(payload[0].value)} görüntülenme</div>
    </div>
  );
}

export default function ReelsAnalysis({ profile }: Props) {
  const est = calcReelsEstimate(profile);
  const chartData = generateReelsData(profile.username, est.avgViews);
  const bestHours = est.bestHours;

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
        <h3 className="text-white font-bold text-lg m-0">Reels Analizi</h3>
        <span
          className="text-xs font-bold px-2 py-1 rounded-full"
          style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
        >
          Tahmini
        </span>
      </div>

      {/* Top metrics */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          { label: 'Ort. Görüntülenme', value: formatNumber(est.avgViews), suffix: '' },
          { label: 'Erişim Oranı', value: `%${est.reachRate}`, suffix: '' },
          { label: 'Viral Potansiyel', value: `${est.viralPotential}`, suffix: '/100' },
        ].map((m) => (
          <div
            key={m.label}
            className="text-center p-3 rounded-xl"
            style={{ background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.15)' }}
          >
            <span className="block text-xl font-black" style={{ color: '#a78bfa' }}>
              {m.value}<span className="text-sm font-normal" style={{ color: '#8993a3' }}>{m.suffix}</span>
            </span>
            <span className="block text-xs mt-1" style={{ color: '#8993a3' }}>{m.label}</span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="mb-5">
        <p className="text-xs mb-3 font-semibold" style={{ color: '#8993a3' }}>Son 30 Gün — Tahmini Görüntülenme</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="rgba(255,255,255,0.04)" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#6b7280', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              hide
              domain={[0, 'dataMax']}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(167,139,250,0.06)' }} />
            <Bar
              dataKey="views"
              fill="#a78bfa"
              radius={[4, 4, 0, 0]}
              opacity={0.85}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Best posting hours */}
      <div>
        <p className="text-xs mb-3 font-semibold" style={{ color: '#8993a3' }}>En İyi Paylaşım Saatleri</p>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(12, 1fr)', gap: 3 }}>
          {Array.from({ length: 24 }, (_, h) => {
            const isBest = bestHours.includes(h);
            return (
              <div
                key={h}
                className="flex flex-col items-center gap-1"
                title={`${h}:00`}
              >
                <div
                  className="w-full rounded"
                  style={{
                    height: 20,
                    background: isBest
                      ? 'linear-gradient(180deg, #a78bfa, #7c3aed)'
                      : 'rgba(255,255,255,0.05)',
                    border: isBest ? '1px solid rgba(167,139,250,0.5)' : '1px solid transparent',
                  }}
                />
                {h % 6 === 0 && (
                  <span className="text-[9px]" style={{ color: '#6b7280' }}>{h}h</span>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs mt-2" style={{ color: '#6b7280' }}>
          En iyi saatler: {bestHours.map(h => `${h}:00`).join(', ')}
        </p>
      </div>
    </div>
  );
}
