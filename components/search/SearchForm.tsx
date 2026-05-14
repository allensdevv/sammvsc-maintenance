'use client';

import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Clock, ChevronRight, X, Trash2 } from 'lucide-react';

interface RecentEntry {
  username: string;
  avatarUrl?: string;
  viewedAt: number;
}

const STORAGE_KEY = 'igme_recent_searches';
const MAX_RECENT = 5;

function loadRecent(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as RecentEntry[];
  } catch {
    return [];
  }
}

function saveRecent(entries: RecentEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // ignore
  }
}

function getAvatarProxyUrl(username: string): string {
  return `/api/instagram/avatar?username=${encodeURIComponent(username)}`;
}

export function addRecentSearch(username: string, avatarUrl?: string) {
  const entries = loadRecent().filter((e) => e.username.toLowerCase() !== username.toLowerCase());
  const newEntry: RecentEntry = { username, avatarUrl, viewedAt: Date.now() };
  const updated = [newEntry, ...entries].slice(0, MAX_RECENT);
  saveRecent(updated);
}

export default function SearchForm() {
  const router = useRouter();
  const [value, setValue] = useState('');
  const [recent, setRecent] = useState<RecentEntry[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setRecent(loadRecent());
  }, []);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clean = value.trim().replace(/^@/, '');
    if (!clean) return;
    router.push(`/profile/${encodeURIComponent(clean)}`);
  }

  function clearAll() {
    saveRecent([]);
    setRecent([]);
  }

  function removeEntry(username: string) {
    const updated = recent.filter((e) => e.username !== username);
    saveRecent(updated);
    setRecent(updated);
  }

  return (
    <div className="w-full">
      {/* Search box */}
      <form onSubmit={handleSubmit}>
        <div
          className="flex items-center w-full max-w-[512px] mx-auto gap-2 p-2 transition-all duration-200"
          style={{
            minHeight: 64,
            border: '1px solid rgba(139,92,246,0.5)',
            borderRadius: 14,
            background: 'rgba(17,17,17,0.94)',
            boxShadow: '0 0 22px rgba(139,92,246,0.22)',
          }}
          onFocus={() => {}}
        >
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Kullanıcı adı girin… (örn. cristiano)"
            className="flex-1 min-w-0 h-12 px-4 text-sm outline-none rounded-[9px]"
            style={{
              background: '#171717',
              color: '#d9e1ee',
              border: 'none',
            }}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="submit"
            className="w-12 h-12 flex items-center justify-center rounded-[10px] flex-shrink-0"
            style={{
              background: 'linear-gradient(100deg, #7c6dff 0%, #a66cff 48%, #f472d0 100%)',
              boxShadow: '0 0 24px rgba(139,92,246,0.34)',
              border: 'none',
            }}
            aria-label="Ara"
          >
            <Search size={21} color="#f7f3ff" />
          </button>
        </div>
      </form>

      {/* Recent searches */}
      {mounted && recent.length > 0 && (
        <div
          className="w-full max-w-[512px] mx-auto mt-4 overflow-hidden text-left"
          style={{
            border: '1px solid rgba(139,92,246,0.28)',
            borderRadius: 13,
            background: 'rgba(17,17,17,0.88)',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4"
            style={{
              minHeight: 52,
              borderBottom: '1px solid rgba(255,255,255,0.07)',
              color: '#9ba4b4',
              fontSize: 13,
              fontWeight: 850,
            }}
          >
            <span className="inline-flex items-center gap-[9px]">
              <Clock size={16} color="#a78bfa" />
              Son Aramalar
            </span>
            <div className="inline-flex items-center gap-[14px]">
              <button
                onClick={clearAll}
                className="inline-flex items-center gap-[6px] border-0 p-0 bg-transparent text-[#657082] text-xs hover:text-[#9db6d6]"
                type="button"
              >
                <Trash2 size={15} />
                Temizle
              </button>
            </div>
          </div>

          {/* Rows */}
          {recent.map((entry) => (
            <div
              key={entry.username}
              className="flex items-center justify-between gap-4 px-[18px] cursor-pointer hover:bg-white/[0.03] transition-colors"
              style={{
                minHeight: 62,
                borderTop: '1px solid rgba(255,255,255,0.06)',
              }}
              onClick={() => router.push(`/profile/${encodeURIComponent(entry.username)}`)}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Avatar */}
                <div
                  className="flex items-center justify-center flex-shrink-0 rounded-full overflow-hidden"
                  style={{
                    width: 40,
                    height: 40,
                    background: 'rgba(139,92,246,0.18)',
                    border: '1px solid rgba(139,92,246,0.3)',
                    color: '#a78bfa',
                    fontSize: 17,
                    fontWeight: 700,
                  }}
                >
                  {entry.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getAvatarProxyUrl(entry.username)}
                      alt=""
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <span>{entry.username.charAt(0).toUpperCase()}</span>
                  )}
                </div>

                {/* Text */}
                <div className="min-w-0">
                  <strong
                    className="block truncate text-sm"
                    style={{ color: '#d8dfeb', fontWeight: 650 }}
                  >
                    {entry.username}
                  </strong>
                  <span className="block mt-[3px] text-xs" style={{ color: '#687282' }}>
                    Profil analizi
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeEntry(entry.username);
                  }}
                  className="w-[22px] h-[22px] grid place-items-center bg-transparent border-0 text-[#5f6876] hover:text-[#9db6d6] rounded"
                  type="button"
                  aria-label="Kaldır"
                >
                  <X size={15} />
                </button>
                <ChevronRight size={22} color="#657082" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
