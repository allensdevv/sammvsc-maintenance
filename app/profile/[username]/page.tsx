import { Suspense } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import ProfileHero from '@/components/profile/ProfileHero';
import ProfileTabs from '@/components/profile/ProfileTabs';
import type { InstagramProfile } from '@/lib/analytics';

interface PageProps {
  params: { username: string };
}

export const dynamic = 'force-dynamic';

function getBaseUrl() {
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL.replace(/\/$/, '');
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'http://localhost:3000';
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Internal fetch from our own API route
async function fetchProfile(username: string): Promise<{ profile: InstagramProfile; source: string } | null> {
  const baseUrl = getBaseUrl();

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      const res = await fetch(
        `${baseUrl}/api/instagram/profile?username=${encodeURIComponent(username)}`,
        { cache: 'no-store' }
      );
      const json = await res.json().catch(() => null);

      if (res.ok && json?.status === 'ready' && json.data) {
        return { profile: json.data as InstagramProfile, source: json.source };
      }

      if (res.status !== 202 && json?.status !== 'loading') return null;
    } catch {
      return null;
    }

    await wait(1200);
  }

  return null;
}

async function fetchViewCount(username: string): Promise<number> {
  const baseUrl = getBaseUrl();

  try {
    const res = await fetch(
      `${baseUrl}/api/instagram/views?username=${encodeURIComponent(username)}&track=1`,
      { cache: 'no-store' }
    );
    if (!res.ok) return 0;
    const json = await res.json();
    return Number(json.count) || 0;
  } catch {
    return 0;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const username = decodeURIComponent(params.username);
  return {
    title: `@${username} | IGME — Instagram Profil Analizi`,
    description: `${username} Instagram profilinin analizi — takipçi kalitesi, viral skor, etkileşim oranı ve daha fazlası.`,
    robots: 'noindex, nofollow',
  };
}

function ProfileSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      {/* Banner skeleton */}
      <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="h-[130px]" style={{ background: 'rgba(255,255,255,0.04)' }} />
        <div className="p-7 pt-14">
          <div className="h-8 w-48 rounded skeleton-pulse mb-3" />
          <div className="h-4 w-32 rounded skeleton-pulse" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="h-[60px] rounded-[10px] skeleton-pulse" />
      {/* Panel skeleton */}
      <div className="h-[374px] rounded-2xl skeleton-pulse" />
    </div>
  );
}

async function ProfileContent({ username }: { username: string }) {
  const [result, viewCount] = await Promise.all([
    fetchProfile(username),
    fetchViewCount(username),
  ]);

  if (!result) {
    return (
      <div
        className="p-10 rounded-2xl text-center min-h-[374px] grid place-items-center"
        style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)' }}
      >
        <div>
          <p className="text-2xl font-bold text-white mb-2">Profil Bulunamadı</p>
          <p className="text-sm mb-6" style={{ color: '#6b7280' }}>
            @{username} profili şu an alınamıyor. Lütfen sonra tekrar deneyin.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
          >
            Ana Sayfaya Dön
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <ProfileHero profile={result.profile} viewCount={viewCount} />
      <ProfileTabs profile={result.profile} />
    </>
  );
}

export default function ProfilePage({ params }: PageProps) {
  const username = decodeURIComponent(params.username)
    .trim()
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_.]/g, '')
    .slice(0, 30);

  if (!username) notFound();

  return (
    <div
      className="mx-auto pb-14"
      style={{ width: 'min(1220px, calc(100% - 32px))' }}
    >
      {/* Header */}
      <header
        className="min-h-[70px] grid items-center gap-5"
        style={{
          gridTemplateColumns: '1fr auto 1fr',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        <Link
          href="/"
          className="inline-flex items-center gap-[10px] justify-self-start text-2xl font-black whitespace-nowrap leading-none"
          aria-label="IGME ana sayfa"
        >
          <span className="inline-flex items-center justify-center" style={{ width: 42, height: 42 }}>
            <Image
              src="/assets/si.png"
              alt=""
              width={42}
              height={42}
              className="object-contain"
              style={{ filter: 'drop-shadow(0 0 12px rgba(167,139,250,0.28))' }}
            />
          </span>
          <span className="text-white font-black">
            IG<span style={{ color: '#a99cff' }}>ME</span>
          </span>
          <span
            className="inline-grid place-items-center px-[7px] text-[10px] font-black leading-none"
            style={{
              minHeight: 19,
              border: '1px solid rgba(139,92,246,0.5)',
              borderRadius: 5,
              background: 'rgba(104,71,220,0.24)',
              color: '#c9c0ff',
            }}
          >
            BETA
          </span>
        </Link>

        <nav
          className="justify-self-center hidden md:flex items-center gap-8 text-sm font-bold"
          style={{ color: '#b8c0ce' }}
        >
          <span style={{ color: '#facc15' }}>Beta</span>
          <span>Kullanıcı Analizi</span>
          <span>Sistem Durumu</span>
        </nav>

        <span aria-hidden="true" />
      </header>

      <main className="pt-[38px]">
        <Suspense fallback={<ProfileSkeleton />}>
          <ProfileContent username={username} />
        </Suspense>
      </main>

      {/* Report button */}
      <a
        className="fixed right-[34px] bottom-[34px] z-[4] inline-flex items-center justify-center gap-3 text-[15px] font-[850]"
        href="mailto:destek@sammvsc.top?subject=Hata%20Bildirimi"
        aria-label="Hata bildir"
        style={{
          minHeight: 64,
          padding: '0 24px 0 18px',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 18,
          background: 'rgba(19,19,19,0.9)',
          color: '#f4f7fc',
          boxShadow: '0 18px 50px rgba(0,0,0,0.34)',
          backdropFilter: 'blur(14px)',
        }}
      >
        <span
          className="w-9 h-9 grid place-items-center rounded-xl flex-shrink-0"
          style={{
            border: '1px solid rgba(167,139,250,0.34)',
            background: 'rgba(109,59,231,0.18)',
            color: '#a78bfa',
          }}
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" width={19} height={19}>
            <path d="M6 5h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4V7a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
            <path d="M8 9h8M8 13h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </span>
        Hata Bildir
      </a>
    </div>
  );
}
