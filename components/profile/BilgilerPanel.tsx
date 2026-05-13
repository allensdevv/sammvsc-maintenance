'use client';

import type { InstagramProfile } from '@/lib/analytics';
import { formatNumber } from '@/lib/analytics';

interface Props {
  profile: InstagramProfile;
}

export default function BilgilerPanel({ profile }: Props) {
  const rows: { label: string; value: string | number | boolean }[] = [
    { label: 'Kullanıcı Adı', value: `@${profile.username}` },
    { label: 'Tam Ad', value: profile.fullName || '-' },
    { label: 'Hesap Türü', value: profile.isPrivate ? 'Özel Hesap' : 'Herkese Açık' },
    { label: 'Gizli Hesap', value: profile.isPrivate ? 'Evet' : 'Hayır' },
    { label: 'Doğrulanmış Hesap', value: profile.isVerified ? 'Evet' : 'Hayır' },
    { label: 'Takipçi Sayısı', value: formatNumber(profile.followers) },
    { label: 'Takip Edilen', value: formatNumber(profile.following) },
    { label: 'Gönderi Sayısı', value: formatNumber(profile.posts) },
    { label: 'Biyografi', value: profile.biography || '-' },
  ];

  return (
    <div
      className="p-5 rounded-2xl min-h-[374px]"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <h3 className="text-white font-[760] text-xl mb-6 m-0 inline-flex items-center gap-[10px]">
        <svg viewBox="0 0 24 24" fill="none" width={20} height={20} style={{ color: '#a78bfa' }}>
          <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2"/>
          <path d="M4 20c0-3.314 3.582-6 8-6s8 2.686 8 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        Hesap Bilgileri
      </h3>

      <div className="space-y-0">
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="grid gap-[18px] min-h-9 items-center text-sm"
            style={{
              gridTemplateColumns: '1fr auto',
              color: '#9aa3b1',
              fontWeight: 430,
              borderBottom: i < rows.length - 1 ? '1px solid rgba(255,255,255,0.05)' : undefined,
              padding: '8px 0',
            }}
          >
            <span>{row.label}</span>
            <strong className="text-right" style={{ color: '#f2f5fb', fontWeight: 650 }}>
              {String(row.value)}
            </strong>
          </div>
        ))}
      </div>

      {profile.biography && (
        <div
          className="mt-3 p-4 rounded-[9px] text-sm leading-relaxed"
          style={{
            background: 'rgba(255,255,255,0.035)',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#d4dae5',
          }}
        >
          {profile.biography}
        </div>
      )}
    </div>
  );
}
