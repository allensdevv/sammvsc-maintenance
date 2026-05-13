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
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
