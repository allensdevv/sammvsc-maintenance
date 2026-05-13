'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Info,
  Image as ImageIcon,
  Film,
  BarChart2,
  Shield,
} from 'lucide-react';
import type { InstagramProfile } from '@/lib/analytics';

import PanoPanel from '@/components/profile/panels/PanoPanel';
import BilgilerPanel from '@/components/profile/BilgilerPanel';
import FollowerQuality from '@/components/profile/FollowerQuality';
import ViralScore from '@/components/profile/ViralScore';
import ReelsAnalysis from '@/components/profile/ReelsAnalysis';
import GizlilikPanel from '@/components/profile/GizlilikPanel';

interface Props {
  profile: InstagramProfile;
}

const tabs = [
  { id: 'pano', label: 'Pano', icon: <LayoutDashboard size={17} /> },
  { id: 'bilgiler', label: 'Bilgiler', icon: <Info size={17} /> },
  { id: 'medya', label: 'Medya', icon: <ImageIcon size={17} /> },
  { id: 'reels', label: 'Reels', icon: <Film size={17} /> },
  { id: 'analitik', label: 'Analitik', icon: <BarChart2 size={17} /> },
  { id: 'gizlilik', label: 'Gizlilik', icon: <Shield size={17} /> },
] as const;

type TabId = (typeof tabs)[number]['id'];

function MediaPanel({ profile }: { profile: InstagramProfile }) {
  return (
    <div
      className="p-5 rounded-2xl min-h-[374px]"
      style={{ background: '#111111', border: '1px solid rgba(255,255,255,0.1)' }}
    >
      <h3 className="text-white font-[760] text-xl mb-6 m-0">Medya</h3>
      <div className="min-h-[250px] grid place-items-center text-center" style={{ color: '#626d7f' }}>
        <div>
          <ImageIcon size={40} className="mx-auto mb-3 opacity-30" />
          <p className="m-0 text-sm">
            {profile.posts > 0
              ? `${profile.posts} gönderi var ancak medya içerikleri bu sürümde desteklenmiyor.`
              : 'Gönderi bulunamadı.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function AnalitikPanel({ profile }: { profile: InstagramProfile }) {
  return (
    <div className="grid md:grid-cols-2 gap-5">
      <FollowerQuality profile={profile} />
      <ViralScore profile={profile} />
    </div>
  );
}

export default function ProfileTabs({ profile }: Props) {
  const [activeTab, setActiveTab] = useState<TabId>('pano');

  function renderPanel() {
    switch (activeTab) {
      case 'pano':
        return <PanoPanel profile={profile} />;
      case 'bilgiler':
        return <BilgilerPanel profile={profile} />;
      case 'medya':
        return <MediaPanel profile={profile} />;
      case 'reels':
        return <ReelsAnalysis profile={profile} />;
      case 'analitik':
        return <AnalitikPanel profile={profile} />;
      case 'gizlilik':
        return <GizlilikPanel profile={profile} />;
    }
  }

  return (
    <div>
      {/* Tab bar */}
      <div
        className="min-h-[60px] grid gap-3 mt-6 p-2"
        style={{
          gridTemplateColumns: 'repeat(6, 1fr)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10,
          background: 'rgba(17,17,17,0.94)',
        }}
      >
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="relative inline-flex items-center justify-center gap-[9px] min-h-[42px] px-3 rounded-[8px] text-sm font-[650] border transition-none"
              style={{
                border: isActive ? '1px solid rgba(255,255,255,0.1)' : '1px solid transparent',
                background: isActive ? 'rgba(255,255,255,0.045)' : 'transparent',
                color: isActive ? '#fff' : '#8f98a8',
              }}
              type="button"
            >
              <span style={{ color: '#a78bfa' }}>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {isActive && (
                <motion.div
                  layoutId="tab-active-indicator"
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] rounded-full"
                  style={{ width: '60%', background: '#a78bfa' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="mt-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
          >
            {renderPanel()}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
