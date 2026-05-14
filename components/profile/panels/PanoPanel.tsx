'use client';

import type { InstagramProfile } from '@/lib/analytics';
import { formatNumber, calcEngagementRate, calcViralScore, calcFollowerQuality } from '@/lib/analytics';
import AIInsight from '@/components/profile/AIInsight';
import { Users, Image as ImageIcon, TrendingUp, Activity } from 'lucide-react';

interface Props {
  profile: InstagramProfile;
}

export default function PanoPanel({ profile }: Props) {
  const engRate = calcEngagementRate(profile);
  const vs = calcViralScore(profile);
  const q = calcFollowerQuality(profile);

  const stats = [
    { label: 'Takipçi', value: formatNumber(profile.followers), icon: <Users size={18} />, color: '#a78bfa' },
    { label: 'Takip', value: formatNumber(profile.following), icon: <Users size={18} />, color: '#818cf8' },
    { label: 'Gönderi', value: formatNumber(profile.posts), icon: <ImageIcon size={18} />, color: '#60a5fa' },
    { label: 'Etkileşim (~)', value: `%${engRate}`, icon: <Activity size={18} />, color: '#34d399' },
    { label: 'Viral Skor (~)', value: `${vs.score}/100`, icon: <TrendingUp size={18} />, color: '#f472b6' },
    { label: 'Kalite Notu (~)', value: q.grade, icon: <Activity size={18} />, color: '#fbbf24' },
  ];

  return (
    <div className="space-y-6">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div
            key={s.label}
            className="p-4 rounded-xl"
            style={{ background: '#171717', border: '1px solid rgba(255,255,255,0.07)' }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span style={{ color: s.color }}>{s.icon}</span>
              <span className="text-xs" style={{ color: '#6b7280' }}>{s.label}</span>
            </div>
            <span className="block text-xl font-bold text-white">{s.value}</span>
          </div>
        ))}
      </div>

      {/* Account summary */}
      <div
        className="p-5 rounded-2xl"
        style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <h3 className="text-white font-bold text-base mb-4 m-0">Hesap Özeti</h3>
        <div className="grid gap-3">
          {[
            { label: 'Kullanıcı Adı', value: `@${profile.username}` },
            { label: 'Tam Ad', value: profile.fullName || '-' },
            { label: 'Hesap Türü', value: profile.isPrivate ? 'Özel Hesap' : 'Herkese Açık' },
            { label: 'Doğrulama', value: profile.isVerified ? 'Doğrulanmış' : 'Doğrulanmamış' },
            { label: 'Takipçi/Takip Oranı', value: profile.following > 0 ? `${(profile.followers / profile.following).toFixed(2)}x` : '-' },
          ].map((row) => (
            <div
              key={row.label}
              className="flex justify-between items-center py-2 text-sm"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
            >
              <span style={{ color: '#6b7280' }}>{row.label}</span>
              <span className="font-semibold text-white">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* AI Insight preview */}
      <AIInsight profile={profile} />
    </div>
  );
}
