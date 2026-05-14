import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'IGME | Instagram Profil Analizi',
  description: 'Instagram profil analizleri ve istatistikleri',
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  themeColor: '#050505',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={inter.variable}>
      <body
        className="min-h-screen text-[#f7f9ff] antialiased font-sans"
        style={{
          background: 'radial-gradient(circle at 50% 30%, rgba(139,92,246,0.11), transparent 26rem), #050505',
        }}
      >
        <div
          className="fixed inset-0 pointer-events-none z-0"
          style={{
            background: 'linear-gradient(180deg, rgba(5,5,5,0.12), rgba(5,5,5,0.92))',
          }}
          aria-hidden="true"
        />
        <div
          className="relative z-20 flex min-h-[38px] items-center justify-center px-4 py-[7px] text-center text-sm font-semibold leading-tight text-white"
          style={{
            background:
              'linear-gradient(55deg, transparent 0 7%, rgba(255,255,255,0.09) 7.2%, transparent 13%), linear-gradient(55deg, transparent 62%, rgba(255,255,255,0.08) 62.3%, transparent 70%), linear-gradient(90deg, #5747bd 0%, #6b58d2 50%, #604ec5 100%)',
            boxShadow: '0 1px 0 rgba(255,255,255,0.08) inset',
            letterSpacing: 0,
          }}
        >
          🎉 Premium ve Özel Analiz kısa süreliğine %10 indirim almak için &quot;analiz10&quot; kodunu kullanın!
        </div>
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
