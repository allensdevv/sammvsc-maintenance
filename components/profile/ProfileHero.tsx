'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Eye, X, BadgeCheck } from 'lucide-react';
import type { InstagramProfile } from '@/lib/analytics';
import { formatNumber } from '@/lib/analytics';

interface ProfileHeroProps {
  profile: InstagramProfile;
  viewCount: number;
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    let start = 0;
    const target = value;
    if (target === 0) return;

    const step = Math.ceil(target / 40);
    const timer = setInterval(() => {
      start = Math.min(start + step, target);
      setDisplayed(start);
      if (start >= target) clearInterval(timer);
    }, 20);
    return () => clearInterval(timer);
  }, [value]);

  return <>{formatNumber(displayed)}</>;
}

export default function ProfileHero({ profile, viewCount }: ProfileHeroProps) {
  const [copied, setCopied] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [bannerLoaded, setBannerLoaded] = useState(false);

  const avatarProxyUrl = `/api/instagram/avatar?username=${encodeURIComponent(profile.username)}`;

  function copyHandle() {
    navigator.clipboard.writeText(`@${profile.username}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9000] flex items-center justify-center"
            aria-modal="true"
            role="dialog"
          >
            <div
              className="absolute inset-0 cursor-zoom-out"
              style={{ background: 'rgba(0,0,0,0.88)' }}
              onClick={() => setLightboxOpen(false)}
            />
            <div className="relative z-10 flex flex-col items-center gap-[14px]">
              <button
                onClick={() => setLightboxOpen(false)}
                className="absolute -top-[14px] -right-[14px] w-8 h-8 grid place-items-center rounded-full"
                style={{
                  border: '1px solid rgba(255,255,255,0.14)',
                  background: 'rgba(18,18,18,0.92)',
                  color: '#d0d7e2',
                }}
                aria-label="Kapat"
              >
                <X size={18} />
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarProxyUrl}
                alt={`@${profile.username}`}
                className="object-cover block"
                style={{
                  maxWidth: 'min(420px, 88vw)',
                  maxHeight: '78vh',
                  borderRadius: '50%',
                  border: '3px solid rgba(167,139,250,0.42)',
                  boxShadow: '0 0 60px rgba(0,0,0,0.7)',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section
        className="relative overflow-hidden"
        style={{
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 13,
          background: 'rgba(17,17,17,0.92)',
        }}
      >
        {/* Banner */}
        <div className="relative" style={{ height: 130 }}>
          {/* Blurred bg */}
          {!imgError && (
            <div
              className="absolute inset-[-12px] pointer-events-none"
              style={{
                backgroundImage: `url(${avatarProxyUrl})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                filter: 'blur(20px) brightness(0.28)',
                transform: 'scale(1.06)',
                zIndex: 0,
                opacity: bannerLoaded ? 1 : 0,
                transition: 'opacity 400ms ease',
              }}
              onLoad={() => setBannerLoaded(true)}
            />
          )}

          {/* "Click to view" button */}
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[4] inline-flex items-center gap-2 text-sm font-semibold backdrop-blur-[6px]"
            style={{
              padding: '10px 18px',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: 10,
              background: 'rgba(0,0,0,0.48)',
              color: 'rgba(255,255,255,0.88)',
              whiteSpace: 'nowrap',
            }}
          >
            <Eye size={16} />
            Görüntülemek için tıkla
          </button>

          {/* View pill */}
          <div
            className="absolute right-[14px] top-[14px] z-[4] inline-flex items-center gap-[7px] text-sm font-bold cursor-default group"
            style={{
              minHeight: 34,
              padding: '0 12px',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.055)',
              color: '#d7deea',
            }}
          >
            <Eye size={14} />
            <AnimatedNumber value={viewCount} />
            {/* Tooltip */}
            <span
              className="absolute whitespace-nowrap pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              style={{
                top: 'calc(100% + 8px)',
                right: 0,
                padding: '6px 12px',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                background: 'rgba(18,18,18,0.96)',
                color: '#c8d0de',
                fontSize: 13,
                fontWeight: 500,
                backdropFilter: 'blur(8px)',
              }}
            >
              Profili görüntüleyen kişi sayısı
            </span>
          </div>
        </div>

        {/* Hero body */}
        <div
          className="relative z-[2] flex items-end justify-between gap-6 flex-wrap"
          style={{ padding: '54px 28px 26px' }}
        >
          {/* Avatar */}
          <div
            className="absolute grid place-items-center overflow-hidden rounded-full flex-shrink-0"
            style={{
              width: 92,
              height: 92,
              left: 28,
              top: -46,
              border: '3px solid #111111',
              background: 'linear-gradient(135deg, #151b2a, #263b66)',
              color: '#fff',
              fontSize: 38,
              fontWeight: 780,
              zIndex: 3,
            }}
          >
            {!imgError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarProxyUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
                onLoad={() => setBannerLoaded(true)}
              />
            ) : (
              <span className="uppercase">{profile.username.charAt(0)}</span>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {/* Name */}
            <h1 className="flex items-center gap-2 m-0 text-white leading-[1.08] font-[760]" style={{ fontSize: 32 }}>
              <span className="truncate">{profile.fullName}</span>
              {profile.isVerified && (
                <span className="flex-shrink-0 inline-grid place-items-center" style={{ width: 22, height: 22 }}>
                  <BadgeCheck size={22} style={{ color: '#1d9bf0', filter: 'drop-shadow(0 0 12px rgba(0,149,246,0.32))' }} />
                </span>
              )}
            </h1>

            {/* Handle */}
            <div className="inline-flex items-center gap-[6px] mt-2 text-sm" style={{ color: '#687386' }}>
              <span>@{profile.username}</span>
              <button
                onClick={copyHandle}
                className="w-[22px] h-[22px] inline-grid place-items-center border-0 rounded-[6px] bg-transparent cursor-pointer"
                style={{ color: copied ? '#a78bfa' : '#7f8da2', background: copied ? 'rgba(167,139,250,0.12)' : 'transparent' }}
                aria-label="Kullanıcı adını kopyala"
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
              </button>
            </div>

            {/* Verify badge */}
            <div className="mt-2">
              <span
                className="inline-flex items-center gap-[6px] text-xs font-semibold"
                style={{
                  minHeight: 25,
                  padding: '0 10px 0 8px',
                  border: profile.isVerified ? '1px solid rgba(167,139,250,0.24)' : '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 999,
                  background: profile.isVerified ? 'rgba(139,92,246,0.09)' : 'rgba(255,255,255,0.045)',
                  color: profile.isVerified ? '#b7d8ff' : '#aab3c2',
                }}
              >
                <span
                  className="w-[15px] h-[15px] inline-grid place-items-center rounded-full flex-shrink-0"
                  style={{
                    background: profile.isVerified ? '#1d9bf0' : 'rgba(255,255,255,0.12)',
                    color: '#fff',
                  }}
                >
                  <svg viewBox="0 0 10 10" fill="none" width={10} height={10}>
                    <path d="M2.5 5l2 2 3-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                {profile.isVerified ? 'Doğrulanmış Hesap' : 'Doğrulanmamış'}
              </span>
            </div>

            {/* Biography */}
            {profile.biography && (
              <p className="mt-3 text-sm leading-[1.5]" style={{ color: '#687386', maxWidth: 480 }}>
                {profile.biography}
              </p>
            )}
          </div>

          {/* Stats */}
          <div className="flex gap-7 flex-shrink-0 items-end">
            {[
              { label: 'Takipçi', value: profile.followers },
              { label: 'Takip', value: profile.following },
              { label: 'Gönderi', value: profile.posts },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <motion.strong
                  className="block text-white leading-none"
                  style={{ fontSize: 28, fontWeight: 760 }}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.1 }}
                >
                  <AnimatedNumber value={stat.value} />
                </motion.strong>
                <span className="block text-center text-[13px] mt-[3px]" style={{ color: '#8a94a4', fontWeight: 450 }}>
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
