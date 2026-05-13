'use client';

import Link from 'next/link';
import Image from 'next/image';

export default function Navbar() {
  return (
    <header
      className="min-h-[70px] grid items-center gap-5"
      style={{
        gridTemplateColumns: '1fr auto 1fr',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Brand */}
      <Link
        href="/"
        className="inline-flex items-center gap-[10px] justify-self-start text-2xl font-black whitespace-nowrap leading-none"
        aria-label="IGME ana sayfa"
      >
        <span
          className="inline-flex items-center justify-center"
          style={{ width: 42, height: 42 }}
          aria-hidden="true"
        >
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

      {/* Center nav */}
      <nav className="justify-self-center flex items-center gap-[clamp(18px,4vw,42px)] text-[#b8c0ce] text-sm font-bold">
        <span className="inline-flex items-center gap-2" style={{ color: '#facc15' }}>
          Beta
        </span>
        <span className="inline-flex items-center gap-2">Kullanıcı Analizi</span>
        <span className="inline-flex items-center gap-2">Sistem Durumu</span>
      </nav>

      {/* Right spacer */}
      <span aria-hidden="true" />
    </header>
  );
}
