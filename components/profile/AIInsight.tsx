'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { generateAIInsight } from '@/lib/analytics';
import type { InstagramProfile } from '@/lib/analytics';

interface Props {
  profile: InstagramProfile;
}

const sentimentStyles = {
  positive: {
    glow: 'rgba(34,197,94,0.15)',
    border: 'rgba(34,197,94,0.3)',
    color: '#22c55e',
    label: 'Pozitif',
  },
  neutral: {
    glow: 'rgba(167,139,250,0.15)',
    border: 'rgba(167,139,250,0.3)',
    color: '#a78bfa',
    label: 'Nötr',
  },
  warning: {
    glow: 'rgba(249,115,22,0.15)',
    border: 'rgba(249,115,22,0.3)',
    color: '#f97316',
    label: 'Dikkat',
  },
};

function TypingText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    let i = 0;
    setDisplayed('');
    const timer = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 12);
    return () => clearInterval(timer);
  }, [text]);

  return <span>{displayed}</span>;
}

export default function AIInsight({ profile }: Props) {
  const insight = generateAIInsight(profile);
  const ss = sentimentStyles[insight.sentiment];

  return (
    <motion.div
      className="p-5 rounded-2xl"
      style={{
        background: '#111111',
        border: `1px solid ${ss.border}`,
        boxShadow: `0 0 40px ${ss.glow}`,
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 grid place-items-center rounded-lg"
            style={{ background: `${ss.color}18`, border: `1px solid ${ss.color}44` }}
          >
            <Sparkles size={16} style={{ color: ss.color }} />
          </div>
          <span className="font-bold text-white text-sm">AI Analiz</span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: `${ss.color}18`, color: ss.color, border: `1px solid ${ss.color}44` }}
          >
            {ss.label}
          </span>
          <span
            className="text-xs font-bold px-2 py-1 rounded-full"
            style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.3)' }}
          >
            Tahmini
          </span>
        </div>
      </div>

      {/* Headline */}
      <h4 className="text-white font-bold text-base mb-3 m-0">
        {insight.headline}
      </h4>

      {/* Body */}
      <p className="text-sm leading-relaxed mb-4 m-0" style={{ color: '#8993a3' }}>
        <TypingText text={insight.body} />
      </p>

      {/* Tags */}
      <div className="flex flex-wrap gap-2">
        {insight.tags.map((tag) => (
          <span
            key={tag}
            className="text-xs font-semibold px-3 py-1 rounded-full"
            style={{
              background: 'rgba(167,139,250,0.1)',
              border: '1px solid rgba(167,139,250,0.2)',
              color: '#c4b5fd',
            }}
          >
            {tag}
          </span>
        ))}
      </div>
    </motion.div>
  );
}
