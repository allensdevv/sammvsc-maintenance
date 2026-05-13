'use client';

import { motion } from 'framer-motion';
import type { InstagramProfile } from '@/lib/analytics';
import { formatNumber } from '@/lib/analytics';

interface Props {
  profile: InstagramProfile;
}

export default function GizlilikPanel({ profile }: Props) {
  const ratio = profile.following > 0 ? profile.followers / profile.following : 0;
  const ratioLabel = ratio >= 5 ? 'Mükemmel' : ratio >= 2 ? 'İyi' : ratio >= 1 ? 'Ortalama' : 'Düşük';
  const ratioColor = ratio >= 5 ? '#22c55e' : ratio >= 2 ? '#84cc16' : ratio >= 1 ? '#eab308' : '#ef4444';

  const privacyItems = [
    { label: 'Hesap Gizliliği', value: profile.isPrivate ? 'Özel Hesap' : 'Herkese Açık', good: profile.isPrivate },
    { label: 'Doğrulanmış Kimlik', value: profile.isVerified ? 'Doğrulanmış' : 'Doğrulanmamış', good: profile.isVerified },
    { label: 'Takipçi/Takip Oranı', value: `${ratio.toFixed(2)}x (${ratioLabel})`, good: ratio >= 1 },
  ];

  return (
    <div className="space-y-6">
      {/* Privacy info */}
      <div
        className="p-5 rounded-2xl min-h-[374px]"
        style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <h3 className="text-white font-[760] text-xl mb-6 m-0 inline-flex items-center gap-[10px]">
          <svg viewBox="0 0 24 24" fill="none" width={20} height={20} style={{ color: '#a78bfa' }}>
            <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="2"/>
            <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          Gizlilik Bilgileri
        </h3>

        {/* Items */}
        {privacyItems.map((item) => (
          <div
            key={item.label}
            className="flex justify-between items-center py-3 text-sm"
            style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <span style={{ color: '#9aa3b1' }}>{item.label}</span>
            <span
              className="font-semibold px-3 py-1 rounded-full text-xs"
              style={{
                background: item.good ? 'rgba(34,197,94,0.1)' : 'rgba(107,114,128,0.1)',
                color: item.good ? '#22c55e' : '#9ca3af',
                border: `1px solid ${item.good ? 'rgba(34,197,94,0.2)' : 'rgba(107,114,128,0.2)'}`,
              }}
            >
              {item.value}
            </span>
          </div>
        ))}

        {/* Ratio bar */}
        <div className="mt-6">
          <div className="flex justify-between text-sm mb-2">
            <span style={{ color: '#9aa3b1' }}>Takipçi / Takip Oranı</span>
            <span className="font-bold" style={{ color: ratioColor }}>{ratio.toFixed(2)}x</span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: ratioColor, maxWidth: '100%' }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (ratio / 10) * 100)}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1" style={{ color: '#6b7280' }}>
            <span>{formatNumber(profile.followers)} takipçi</span>
            <span>{formatNumber(profile.following)} takip</span>
          </div>
        </div>

        {/* Note */}
        <div
          className="mt-6 p-4 rounded-[9px] text-sm leading-[1.5]"
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#d4dae5',
          }}
        >
          {profile.isPrivate
            ? 'Bu hesap özel olarak ayarlanmış. İçerikler yalnızca onaylı takipçilere görünür.'
            : 'Bu hesap herkese açık. İçerikler tüm kullanıcılar tarafından görülebilir.'}
        </div>
      </div>
    </div>
  );
}
