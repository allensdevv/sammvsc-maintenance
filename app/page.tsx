'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import SearchForm from '@/components/search/SearchForm';

function LaserCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let width = 0;
    let height = 0;

    function resize() {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    interface Streak {
      x: number;
      y: number;
      vx: number;
      vy: number;
      length: number;
      alpha: number;
      hue: number;
      life: number;
      maxLife: number;
    }

    const streaks: Streak[] = [];

    function spawn(): Streak {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        length: 60 + Math.random() * 120,
        alpha: 0.15 + Math.random() * 0.25,
        hue: 260 + Math.random() * 60,
        life: 0,
        maxLife: 60 + Math.random() * 80,
      };
    }

    for (let i = 0; i < 12; i++) streaks.push(spawn());

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);

      for (let i = streaks.length - 1; i >= 0; i--) {
        const s = streaks[i];
        const progress = s.life / s.maxLife;
        const fade = Math.sin(progress * Math.PI);

        const gradient = ctx.createLinearGradient(
          s.x - s.vx * s.length,
          s.y - s.vy * s.length,
          s.x,
          s.y
        );
        gradient.addColorStop(0, `hsla(${s.hue}, 85%, 70%, 0)`);
        gradient.addColorStop(1, `hsla(${s.hue}, 85%, 70%, ${s.alpha * fade})`);

        ctx.beginPath();
        ctx.moveTo(s.x - s.vx * s.length, s.y - s.vy * s.length);
        ctx.lineTo(s.x, s.y);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1 + Math.random() * 0.5;
        ctx.stroke();

        s.x += s.vx;
        s.y += s.vy;
        s.life++;

        if (s.life >= s.maxLife) {
          streaks[i] = spawn();
        }
      }

      animationId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.6 }}
      aria-hidden="true"
    />
  );
}

export default function HomePage() {
  return (
    <>
      <LaserCanvas />

      <div
        className="relative z-10 mx-auto pb-16"
        style={{ width: 'min(1220px, calc(100% - 32px))' }}
      >
        {/* Topbar */}
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
            style={{ color: '#b9c0ce' }}
            aria-label="Ana menü"
          >
            <span className="inline-flex items-center gap-2" style={{ color: '#facc15' }}>
              Beta
            </span>
            <span className="inline-flex items-center gap-2">Kullanıcı Analizi</span>
            <span className="inline-flex items-center gap-2">Sistem Durumu</span>
          </nav>

          <span aria-hidden="true" />
        </header>

        {/* Main content */}
        <main className="flex flex-col items-center justify-center min-h-[calc(100vh-70px)] py-10">
          <section className="w-full max-w-[760px] text-center" aria-labelledby="page-title">
            {/* Heading */}
            <div className="flex items-center justify-center gap-[18px] flex-wrap">
              <span
                className="flex-shrink-0 grid place-items-center rounded-2xl"
                style={{
                  width: 58,
                  height: 58,
                  border: '1px solid rgba(167,139,250,0.34)',
                  background: 'rgba(109,59,231,0.18)',
                  color: '#a78bfa',
                  boxShadow: '0 0 44px rgba(139,92,246,0.22)',
                }}
                aria-hidden="true"
              >
                <svg viewBox="0 0 24 24" fill="none" width={32} height={32}>
                  <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="2" />
                  <path d="m16 16 4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </span>
              <h1
                id="page-title"
                className="m-0 font-black leading-[0.95]"
                style={{ fontSize: 'clamp(56px, 9vw, 78px)', color: '#f8fbff' }}
              >
                Instagram&apos;ı{' '}
                <span
                  style={{
                    background: 'linear-gradient(100deg, #8c7bff 0%, #a771ff 46%, #f47bd7 100%)',
                    WebkitBackgroundClip: 'text',
                    backgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    color: 'transparent',
                    position: 'relative',
                    display: 'inline-block',
                  }}
                >
                  Keşfet
                </span>
              </h1>
            </div>

            <p
              className="max-w-[640px] mx-auto mt-[22px] leading-[1.55]"
              style={{ color: '#a7b0c0', fontSize: 'clamp(18px, 2.2vw, 21px)', fontWeight: 450 }}
            >
              Instagram profil analizleri artık hazır.{' '}
              <strong className="text-white font-black">
                Takipçi kalitesi, viral skor, etkileşim oranı
              </strong>{' '}
              ve daha fazlası.
            </p>

            {/* Search form */}
            <div className="mt-6">
              <SearchForm />
            </div>
          </section>
        </main>

        {/* Footer */}
        <footer
          className="w-full grid gap-[54px] pb-[34px] pt-12"
          style={{
            gridTemplateColumns: 'clamp(200px, 1.35fr, 340px) 1fr 1fr 1fr',
            borderTop: '1px solid rgba(255,255,255,0.08)',
            color: '#6d7788',
          }}
        >
          <div>
            <div className="inline-flex items-center gap-[10px]" style={{ color: '#f4f7ff', fontSize: 19, fontWeight: 900 }}>
              <Image src="/assets/si.png" alt="" width={36} height={36} className="object-contain" />
              <span>IG<span style={{ color: '#a99cff' }}>ME</span></span>
            </div>
            <p className="mt-[22px] text-sm leading-[1.7]" style={{ maxWidth: 310, color: '#7b8597' }}>
              Instagram profil analiz platformu. Yetkili metrikler, güvenli veri akışı ve profesyonel raporlama.
            </p>
          </div>

          <div>
            <strong className="flex items-center gap-[9px] mb-[18px] text-[15px]" style={{ color: '#f4f7ff' }}>Sayfalar</strong>
            <a className="flex items-center gap-[9px] mt-[13px] text-sm" style={{ color: '#7b8597' }} href="/">Ana Sayfa</a>
            <a className="flex items-center gap-[9px] mt-[13px] text-sm" style={{ color: '#7b8597' }} href="/">Kullanıcı Analizi</a>
          </div>

          <div>
            <strong className="flex items-center gap-[9px] mb-[18px] text-[15px]" style={{ color: '#f4f7ff' }}>Yasal</strong>
            <a className="flex items-center gap-[9px] mt-[13px] text-sm" style={{ color: '#7b8597' }} href="/">Gizlilik Politikası</a>
            <a className="flex items-center gap-[9px] mt-[13px] text-sm" style={{ color: '#7b8597' }} href="/">Kullanım Şartları</a>
          </div>

          <div>
            <strong className="flex items-center gap-[9px] mb-[18px] text-[15px]" style={{ color: '#f4f7ff' }}>Topluluk</strong>
            <a
              className="flex items-center gap-[9px] mt-[13px] text-sm"
              style={{ color: '#7b8597' }}
              href="https://instagram.com/kenanalperr"
              target="_blank"
              rel="noopener noreferrer"
            >
              Instagram Profilimiz
            </a>
          </div>

          <div
            className="col-span-full flex items-center justify-between gap-5 mt-7 pt-7 text-[13px] flex-wrap"
            style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
          >
            <span>© 2026 IGME. Tüm hakları saklıdır.</span>
            <span>
              Meta veya Instagram ile bağlantılı değildir.{' '}
              <b style={{ color: '#a78bfa' }}>sammvsc.top</b>
            </span>
          </div>
        </footer>
      </div>
    </>
  );
}
