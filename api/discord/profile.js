const { getJson, setJson, sleep } = require("../../lib/cache");
const { getSession } = require("../../lib/session");

const FALLBACK_FINDCORD_KEY = "331b483f722e9077c40365f97fd5b5f28ea25456f7af610a1826dd4eadc96b4d";
const FINDCORD_KEYS = Array.from(new Set([
  process.env.FINDCORD_API_KEY,
  process.env.FINDCORD_KEY,
  process.env.FINCORD_API_KEY,
  FALLBACK_FINDCORD_KEY
].map(v => String(v || "").trim()).filter(Boolean)));
const DCSV_KEY = process.env.DCSV_API_KEY || "dcsv_ca6ca829a717d342d2a5e2a48fed0fcef33f1ab3098a1a9a";
const DCSV_API_BASE = "https://dcsv.me/api/v1/user";
const DCSV_PUBLIC_BASE = "https://dcsv.me/users";
const CACHE_TTL = 60 * 30;
const PARTIAL_CACHE_TTL = 60;
const STALE_CACHE_TTL = 60 * 60 * 12;
const EXTERNAL_TIMEOUT_MS = 9000;
const CACHE_VERSION = "v8";
const TRANSIENT_STATUS = new Set([408, 409, 425, 429, 500, 502, 503, 504]);

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-IGME-Profile-Version", CACHE_VERSION);
  res.end(JSON.stringify(payload));
}

function cacheKey(id) {
  return `discord:profile:${CACHE_VERSION}:${String(id).toLowerCase()}`;
}

function staleCacheKey(id) {
  return `discord:profile:${CACHE_VERSION}:stale:${String(id).toLowerCase()}`;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = EXTERNAL_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err?.name === "AbortError") {
      throw new Error(`timeout ${timeoutMs}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isPlainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value);
}

function firstArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
  }
  return [];
}

function clientStatusArray(...values) {
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) return value;
    if (typeof value === "string" && value.trim()) return value.split(/[,\s]+/).filter(Boolean);
    if (isPlainObject(value)) {
      const devices = Object.entries(value)
        .filter(([, state]) => state && String(state).toLowerCase() !== "offline")
        .map(([device]) => device);
      if (devices.length > 0) return devices;
    }
  }
  return [];
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function fillObject(base = {}, incoming = {}) {
  const merged = { ...(base || {}) };
  for (const [key, value] of Object.entries(incoming || {})) {
    if (value !== undefined && value !== null && value !== "") merged[key] = value;
  }
  return merged;
}

function serverKey(server) {
  return String(firstValue(server?.guild_id, server?.id, server?.GuildID, server?.GuildId, server?.name, server?.guild_name, "") || "").toLowerCase();
}

function mergeServerArrays(...arrays) {
  const merged = new Map();
  for (const list of arrays) {
    if (!Array.isArray(list)) continue;
    for (const server of list) {
      const key = serverKey(server);
      if (!key) continue;
      merged.set(key, fillObject(merged.get(key), server));
    }
  }
  return Array.from(merged.values());
}

function toSeconds(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 100000 ? Math.round(n / 1000) : Math.round(n);
}

function toIso(value) {
  if (!value) return null;
  if (typeof value === "number") {
    const d = new Date(value > 100000000000 ? value : value * 1000);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof value === "string") {
    const clean = value.trim();
    const tr = clean.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
    if (tr) {
      const [, dd, mm, yyyy, hh = "0", mi = "0", ss = "0"] = tr;
      const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd), Number(hh), Number(mi), Number(ss));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    const d = new Date(clean);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function imageUrl(gid, hashOrUrl, kind = "icons", size = 128) {
  if (!hashOrUrl) return null;
  if (/^https?:\/\//i.test(String(hashOrUrl))) return hashOrUrl;
  if (!gid) return null;
  const ext = String(hashOrUrl).startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/${kind}/${gid}/${hashOrUrl}.${ext}?size=${size}`;
}

async function fetchDcsvUser(query) {
  const token = DCSV_KEY.startsWith("Bearer ") ? DCSV_KEY : `Bearer ${DCSV_KEY}`;
  const res = await fetchWithTimeout(`${DCSV_API_BASE}/${encodeURIComponent(query)}`, {
    headers: {
      "Authorization": token,
      "Accept": "application/json",
      "User-Agent": "IGME/1.0 (+https://sammvsc.top)"
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DCSV ${res.status}: ${body.slice(0, 200)}`);
  }
  const payload = await res.json();
  const data = payload?.data || payload?.user || payload;
  if (/^\d{15,20}$/.test(String(query))) {
    data.id = String(query);
  }
  return data;
}

function decodeHtml(value = "") {
  return String(value)
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+\n/g, "\n")
    .trim();
}

function stripTags(value = "") {
  return decodeHtml(String(value).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""))
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function metaContent(html, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']*)["']`, "i"));
  return match ? decodeHtml(match[1]) : null;
}

async function fetchDcsvPublicProfile(query) {
  const res = await fetchWithTimeout(`${DCSV_PUBLIC_BASE}/${encodeURIComponent(query)}`, {
    headers: {
      "Accept": "text/html",
      "User-Agent": "Mozilla/5.0 IGME/1.0 (+https://sammvsc.top)"
    }
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DCSV public ${res.status}: ${body.slice(0, 160)}`);
  }

  const html = await res.text();
  const title = metaContent(html, "og:title") || "";
  const description = metaContent(html, "og:description") || "";
  const avatarUrl = metaContent(html, "og:image");
  const canonical = (html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i) || [])[1] || "";
  const id = (html.match(/discord\.com\/users\/(\d{15,20})/) || html.match(/avatars\/(\d{15,20})\//) || [])[1] || "";
  if (!id) {
    throw new Error("DCSV public: kullanıcı bulunamadı");
  }
  const username = decodeURIComponent((canonical.match(/\/users\/([^/?#]+)/) || [])[1] || query).trim();
  const displayName = title.replace(/\s*-\s*Kullanıcı Profili\s*$/i, "").trim() || username;
  const aboutHtml = (html.match(/Hakkında[\s\S]*?<div class=["'][^"']*whitespace-pre-line[^"']*["'][^>]*>([\s\S]*?)<\/div>/i) || [])[1] || "";
  const serverCount = Number((description.match(/(\d+)\s+sunucu/i) || [])[1] || NaN);

  return {
    id,
    username,
    display_name: displayName,
    avatar_url: avatarUrl,
    bio: aboutHtml ? stripTags(aboutHtml) : null,
    server_count: Number.isFinite(serverCount) ? serverCount : null,
    profile_url: canonical || `${DCSV_PUBLIC_BASE}/${encodeURIComponent(query)}`
  };
}

async function fetchFindcordById(id) {
  const errors = [];
  for (const key of FINDCORD_KEYS) {
    for (let attempt = 0; attempt < 2; attempt++) {
      let res = null;
      try {
        res = await fetchWithTimeout(`https://app.findcord.com/api/user/${encodeURIComponent(id)}`, {
          headers: {
            "Authorization": key,
            "Accept": "application/json",
            "User-Agent": "IGME/1.0 (+https://sammvsc.top)"
          }
        });
      } catch (err) {
        errors.push(`timeout/network: ${err.message}`);
        if (attempt === 0) {
          await sleep(350);
          continue;
        }
        break;
      }

      if (res.ok) return res.json();

      const body = await res.text().catch(() => "");
      errors.push(`${res.status}: ${body.slice(0, 120)}`);

      if ([401, 403].includes(res.status)) break;
      if (TRANSIENT_STATUS.has(res.status) && attempt === 0) {
        await sleep(450);
        continue;
      }
      if (!TRANSIENT_STATUS.has(res.status)) {
        throw new Error(`Findcord ${errors.join(" | ")}`);
      }
    }
  }
  throw new Error(`Findcord ${errors.join(" | ")}`);
}

function buildAvatarUrl(uid, hash) {
  if (!hash) return null;
  if (/^https?:\/\//i.test(String(hash))) return hash;
  return `https://cdn.discordapp.com/avatars/${uid}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=256`;
}

function buildBannerUrl(uid, hash) {
  if (!hash) return null;
  if (/^https?:\/\//i.test(String(hash))) return hash;
  return `https://cdn.discordapp.com/banners/${uid}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=512`;
}

function parseCreatedAt(uid) {
  try {
    const ts = (BigInt(uid) >> 22n) + 1420070400000n;
    return new Date(Number(ts)).toISOString();
  } catch { return null; }
}

function normalizeDcsv(d) {
  const uid = String(d.id || d.user_id || "");
  const avatarHash = d.avatar || d.avatar_hash || null;
  const bannerHash = d.banner || d.banner_hash || null;
  return {
    id: uid,
    username: d.username || "",
    global_name: d.global_name || d.display_name || d.username || "",
    avatar_url: d.avatar_url || buildAvatarUrl(uid, avatarHash),
    banner_url: d.banner_url || buildBannerUrl(uid, bannerHash),
    accent_color: d.accent_color || null,
    status: d.status || "offline",
    client_status: clientStatusArray(d.client_status, d.devices, d.Presence?.Type, d.Presence?.ClientStatus),
    public_flags: d.public_flags || 0,
    premium_type: d.premium_type || (d.is_premium ? 2 : 0),
    premium_since: toIso(d.premium_since || d.nitro_since),
    boost_since: toIso(d.boost_since || d.guild_boost_since),
    legacy_username: d.legacy_username || d.LegacyUserName || null,
    badges: d.badges || [],
    created_at: parseCreatedAt(uid),
    age: d.age || null,
    gender: d.gender || null,
    bio: d.bio || d.about_me || null,
    custom_status: d.custom_status || null,
    other_names: d.other_names || d.previous_usernames || [],
    server_count: d.mutual_guilds?.length ?? d.guild_count ?? d.server_count ?? null,
    voice_friend_count: d.voice_friends?.length ?? d.voice_friend_count ?? null,
    punishment_count: d.punishments?.length ?? d.punishment_count ?? null,
    servers: mergeServerArrays(d.mutual_guilds, d.guilds, d.servers, d.Guilds),
    activity: d.activity || d.activities || null,
    punishments: d.punishments || [],
    admin_servers: d.admin_guilds || d.managed_guilds || [],
    voice_friends: d.voice_friends || [],
    voice_history: d.voice_history || [],
    message_history: d.message_history || [],
    message_friends: d.message_friends || d.friends || [],
    findcord_loaded: false,
    findcord_has_guilds: false
  };
}

function normalizeFindcord(fc) {
  const user = fc.UserInfo || fc.user || fc.data?.UserInfo || fc;
  const uid = String(firstValue(user.UserID, fc.id, fc.user_id, "") || "");
  const findcordHasGuilds = (Array.isArray(fc.Guilds) && fc.Guilds.length > 0)
    || (Array.isArray(fc.GuildStats) && fc.GuildStats.length > 0);
  const guildStatsById = new Map((fc.GuildStats || []).map(g => [String(g.GuildID || g.guild_id || g.id), g]));

  const servers = (fc.Guilds || []).map(g => {
    const gid = String(firstValue(g.GuildId, g.GuildID, g.guild_id, g.id, "") || "");
    const stat = guildStatsById.get(gid) || {};
    const userStats = g.UserStats || {};
    return {
      id: gid,
      guild_id: gid,
      name: firstValue(g.GuildName, stat.GuildName, g.name, "Sunucu"),
      guild_name: firstValue(g.GuildName, stat.GuildName, g.name, "Sunucu"),
      icon_url: firstValue(g.GuildIcon, stat.GuildIcon),
      banner_url: firstValue(g.GuildBanner, stat.GuildBanner),
      nick: firstValue(g.displayName, g.nick, g.nickname),
      joined_at: toIso(firstValue(g.JoinTime, g.joined_at)),
      booster: Boolean(g.Booster),
      roles: Array.isArray(g.Roles) ? g.Roles : [],
      messages: firstValue(userStats.total?.messages, stat.MessageStat, g.messages, 0) || 0,
      message_count: firstValue(userStats.total?.messages, stat.MessageStat, g.message_count, 0) || 0,
      voice_time: toSeconds(firstValue(userStats.total?.voiceTime, stat.VoiceStat, g.voice_time, 0)),
      voice_seconds: toSeconds(firstValue(userStats.total?.voiceTime, stat.VoiceStat, g.voice_seconds, 0)),
      peak_hours: userStats.peakHours || null,
      active_hours: userStats.activeHours || null,
      top_channels: userStats.topChannels || null,
      daily_activity: userStats.dailyActivity || []
    };
  });

  const statOnlyServers = (fc.GuildStats || [])
    .filter(g => !servers.some(s => String(s.guild_id) === String(g.GuildID)))
    .map(g => ({
      id: String(g.GuildID || ""),
      guild_id: String(g.GuildID || ""),
      name: g.GuildName || "Sunucu",
      guild_name: g.GuildName || "Sunucu",
      icon_url: g.GuildIcon || null,
      banner_url: g.GuildBanner || null,
      messages: g.MessageStat || 0,
      message_count: g.MessageStat || 0,
      voice_time: toSeconds(g.VoiceStat),
      voice_seconds: toSeconds(g.VoiceStat)
    }));

  const allServers = mergeServerArrays(servers, statOnlyServers);
  const hourBuckets = Array.from({ length: 24 }, (_, hour) => ({ hour, messages: 0, voice_seconds: 0, score: 0 }));
  for (const server of allServers) {
    const active = server.active_hours || {};
    for (const [hour, count] of Object.entries(active.messages || {})) {
      const bucket = hourBuckets[Number(hour)];
      if (!bucket) continue;
      bucket.messages += Number(count) || 0;
      bucket.score += Number(count) || 0;
    }
    for (const [hour, value] of Object.entries(active.voice || {})) {
      const bucket = hourBuckets[Number(hour)];
      if (!bucket) continue;
      const seconds = toSeconds(value);
      bucket.voice_seconds += seconds;
      bucket.score += Math.max(1, Math.round(seconds / 60));
    }
  }

  const badges = (user.UserBadge || user.badges || []).map(b => ({
    id: firstValue(b.id, b.name, b.description, b.hash, b.icon, ""),
    hash: firstValue(b.icon, b.hash, b.BadgeIcon, b.BadgeHash),
    icon: firstValue(b.icon, b.hash, b.BadgeIcon, b.BadgeHash),
    name: firstValue(b.description, b.name, b.label, b.id, "Badge"),
    description: firstValue(b.description, b.name, b.label, b.id, ""),
    tooltip: firstValue(b.tooltip, b.title, b.description, b.name),
    type: firstValue(b.type, b.badge_type, b.kind),
    tier: firstValue(b.tier, b.level, b.rank),
    months: firstValue(b.months, b.durationMonths, b.subscription_months),
    earned_at: toIso(firstValue(b.earned_at, b.obtained_at, b.acquired_at, b.created_at, b.createdAt, b.date, b.since, b.timestamp)),
    since: toIso(firstValue(b.since, b.started_at, b.startDate, b.boost_since, b.premium_since))
  }));

  const lastSeen = fc.LastSeen || {};
  const messageHistory = (lastSeen.Message || []).map(m => ({
    guild_id: m.GuildID || m.guild_id,
    guild_name: m.GuildName || m.guild_name,
    guild_icon_url: m.GuildIcon || null,
    channel_name: m.ChannelName || m.channel_name,
    content: m.Message || m.content || "",
    timestamp: toIso(m.TimeString || m.timestamp)
  }));
  const voiceHistory = (lastSeen.Voice || []).map(v => ({
    guild_id: v.GuildID || v.guild_id,
    guild_name: v.GuildName || v.guild_name,
    guild_icon_url: v.GuildIcon || null,
    channel_name: v.ChannelName || v.channel_name,
    duration: toSeconds(v.Stat || v.duration),
    duration_label: typeof v.Stat === "string" ? v.Stat : null,
    timestamp: toIso(v.TimeString || v.timestamp),
    users: v.Users || []
  }));

  const activeHours = fc.ActiveHours || {};
  const detailedHours = Array.isArray(activeHours.detailedHours) && activeHours.detailedHours.length
    ? activeHours.detailedHours
    : hourBuckets;
  const topHours = hourBuckets
    .filter(h => h.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(h => `${String(h.hour).padStart(2, "0")}:00`)
    .join(", ");
  const totalVoiceSeconds = allServers.reduce((sum, server) => sum + (Number(server.voice_time) || 0), 0);
  const rawActiveSummary = activeHours.summary || "";
  const activeSummary = rawActiveSummary && !/bulunamadı|yok|none/i.test(rawActiveSummary)
    ? rawActiveSummary
    : (topHours ? `En aktif saatler: ${topHours}` : rawActiveSummary);
  const views = fc.LastViewing?.views;

  return {
    id: uid,
    findcord_loaded: true,
    findcord_has_guilds: findcordHasGuilds,
    username: firstValue(user.UserName, user.username, ""),
    global_name: firstValue(user.UserGlobalName, user.display_name, user.UserName, ""),
    legacy_username: firstValue(user.LegacyUserName, user.legacy_username, user.FormerUsername, user.OldUsername, fc.LegacyUserName, fc.legacy_username, fc.FormerUsername, fc.OldUsername),
    avatar_url: firstValue(user.UserdisplayAvatar, buildAvatarUrl(uid, user.avatar || fc.avatar)),
    banner_url: firstValue(user.UserBanner, buildBannerUrl(uid, user.banner || fc.banner)),
    accent_color: user.accent_color || fc.accent_color || null,
    status: firstValue(user.Presence?.Status, fc.status, "offline"),
    client_status: clientStatusArray(user.Presence?.Type, user.Presence?.ClientStatus, user.Presence?.client_status, fc.client_status, fc.devices),
    guild_tag: user.GuildTag || fc.guild_tag || null,
    public_flags: user.public_flags || fc.public_flags || 0,
    premium_type: Number(firstValue(user.UserPremiumType, user.PremiumType, user.premium_type, fc.UserPremiumType, fc.PremiumType, fc.premium_type, 0)) || 0,
    premium_since: toIso(firstValue(user.PremiumSince, user.PremiumSinceAt, user.UserPremiumSince, user.NitroSince, user.NitroSinceAt, fc.PremiumSince, fc.PremiumSinceAt, fc.UserPremiumSince, fc.nitro_since, fc.premium_since)),
    boost_since: toIso(firstValue(user.BoostSince, user.BoostSinceAt, user.UserBoostSince, user.GuildBoostSince, fc.BoostSince, fc.BoostSinceAt, fc.UserBoostSince, fc.GuildBoostSince, fc.boost_since)),
    badges,
    created_at: toIso(user.UserCreatedTimestamp) || toIso(user.UserCreated) || parseCreatedAt(uid),
    age: firstValue(fc.TopAge, user.age),
    gender: firstValue(fc.TopSex, user.gender),
    bio: firstValue(user.UserBio, user.bio, fc.bio, fc.about_me),
    pronouns: user.UserPronouns || null,
    custom_status: user.Activities?.find?.(a => a?.state)?.state || fc.custom_status || null,
    other_names: firstArray(fc.displayNames, user.previous_usernames, fc.previous_usernames)
      .map(n => (typeof n === "string" ? n : firstValue(n.name, n.displayName, n.UserName, n.toString?.())))
      .filter(Boolean),
    server_count: allServers.length || fc.GuildStats?.length || null,
    voice_friend_count: fc.VoiceFrends?.length ?? fc.voice_friends?.length ?? null,
    punishment_count: fc.Punishments?.length ?? fc.punishments?.length ?? null,
    servers: allServers,
    active_hours: {
      total: toSeconds((activeHours.totalActiveHours || 0) * 60 * 60) || totalVoiceSeconds,
      summary: activeSummary,
      ranges: activeHours.activeTimeRanges || [],
      detailed: detailedHours
    },
    view_count: views?.allTime?.total || views?.total || fc.LastViewing?.uniqueVisitors || null,
    activity: { last_message: messageHistory[0] || null, last_voice: voiceHistory[0] || null },
    punishments: (fc.Punishments || []).map(p => ({
      guild_name: p.GuildName || p.guild_name,
      guild_icon_url: p.GuildIcon || null,
      type: p.Type || p.type,
      reason: p.Reason || p.reason,
      date: toIso(p.Date || p.date)
    })),
    admin_servers: (fc.GuildStaff || fc.admin_guilds || []).map(g => ({
      id: String(firstValue(g.GuildID, g.GuildId, g.id, "")),
      guild_id: String(firstValue(g.GuildID, g.GuildId, g.id, "")),
      name: firstValue(g.GuildName, g.name, "Sunucu"),
      guild_name: firstValue(g.GuildName, g.name, "Sunucu"),
      icon_url: firstValue(g.GuildIcon, g.icon_url)
    })),
    voice_friends: (fc.VoiceFrends || []).map(f => ({
      id: String(firstValue(f.userId, f.id, f.user_id, "")),
      user_id: String(firstValue(f.userId, f.id, f.user_id, "")),
      username: f.username || "",
      global_name: firstValue(f.displayname, f.displayName, f.username, ""),
      avatar_url: f.avatarURL || null,
      total_voice: toSeconds(f.totalDuration),
      voice_time: toSeconds(f.totalDuration),
      duration: toSeconds(f.totalDuration),
      duration_label: f.formattedDuration || null,
      meetings: f.meetingCount || 0,
      sessions: f.meetingCount || 0,
      channels: f.channelsCount || 0,
      channel_count: f.channelsCount || 0,
      average_duration: toSeconds(f.averageDurationPerMeeting),
      average_duration_label: f.formattedAverageDuration || null,
      top_channel: f.topChannels?.[0]?.channelName || f.lastChannelInfo?.channelName || "",
      last_seen: toIso(f.lastSeen || f.formattedLastSeen),
      first_seen: toIso(f.firstSeen || f.formattedFirstSeen),
      status: f.isRecentlyActive ? "online" : "offline"
    })),
    voice_history: voiceHistory,
    message_history: messageHistory,
    message_friends: (fc.MessageFriends || []).map(f => ({
      id: String(firstValue(f.userId, f.id, f.user_id, "")),
      user_id: String(firstValue(f.userId, f.id, f.user_id, "")),
      username: f.username || "",
      global_name: firstValue(f.displayName, f.displayname, f.username, ""),
      avatar_url: f.avatarURL || null,
      messages: f.Message || f.messages || f.message_count || 0,
      message_count: f.Message || f.messages || f.message_count || 0,
      first_interaction: f.firstInteraction || f.first_seen || "",
      last_interaction: f.lastInteraction || f.last_seen || "",
      interaction_score: f.interactionScore || 0,
      bot: Boolean(f.bot)
    }))
  };
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function mergeProfiles(dcsv, findcord) {
  if (!dcsv) return findcord;
  if (!findcord) return dcsv;
  const mergedServers = mergeServerArrays(dcsv.servers, findcord.servers);
  return {
    ...dcsv,
    ...Object.fromEntries(Object.entries(findcord).filter(([, value]) => value !== null && value !== undefined && value !== "")),
    id: firstValue(findcord.id, dcsv.id),
    username: firstValue(findcord.username, dcsv.username),
    global_name: firstValue(findcord.global_name, dcsv.global_name),
    avatar_url: firstValue(findcord.avatar_url, dcsv.avatar_url),
    banner_url: firstValue(findcord.banner_url, dcsv.banner_url),
    bio: firstValue(findcord.bio, dcsv.bio),
    status: firstValue(findcord.status, dcsv.status, "offline"),
    client_status: hasItems(findcord.client_status) ? findcord.client_status : dcsv.client_status,
    guild_tag: firstValue(findcord.guild_tag, dcsv.guild_tag),
    custom_status: firstValue(findcord.custom_status, dcsv.custom_status),
    premium_since: firstValue(findcord.premium_since, dcsv.premium_since),
    boost_since: firstValue(findcord.boost_since, dcsv.boost_since),
    legacy_username: firstValue(findcord.legacy_username, dcsv.legacy_username),
    badges: hasItems(findcord.badges) ? findcord.badges : dcsv.badges,
    other_names: hasItems(findcord.other_names) ? findcord.other_names : dcsv.other_names,
    servers: mergedServers,
    server_count: Math.max(Number(findcord.server_count || 0), Number(dcsv.server_count || 0), mergedServers.length) || null,
    active_hours: isPlainObject(findcord.active_hours) ? findcord.active_hours : dcsv.active_hours,
    activity: isPlainObject(findcord.activity) ? findcord.activity : dcsv.activity,
    punishments: hasItems(findcord.punishments) ? findcord.punishments : dcsv.punishments,
    punishment_count: firstValue(findcord.punishment_count, dcsv.punishment_count),
    admin_servers: hasItems(findcord.admin_servers) ? findcord.admin_servers : dcsv.admin_servers,
    voice_friends: hasItems(findcord.voice_friends) ? findcord.voice_friends : dcsv.voice_friends,
    voice_friend_count: firstValue(findcord.voice_friend_count, dcsv.voice_friend_count),
    voice_history: hasItems(findcord.voice_history) ? findcord.voice_history : dcsv.voice_history,
    message_history: hasItems(findcord.message_history) ? findcord.message_history : dcsv.message_history,
    message_friends: hasItems(findcord.message_friends) ? findcord.message_friends : dcsv.message_friends,
    view_count: firstValue(findcord.view_count, dcsv.view_count),
    findcord_loaded: Boolean(findcord.findcord_loaded || dcsv.findcord_loaded),
    findcord_has_guilds: Boolean(findcord.findcord_has_guilds || dcsv.findcord_has_guilds),
    source: "dcsv+findcord"
  };
}

function hasMeaningfulActiveHours(profile) {
  const hours = profile?.active_hours;
  if (!isPlainObject(hours)) return false;
  if (Number(hours.total || 0) > 0) return true;
  if (Array.isArray(hours.detailed) && hours.detailed.some(h => Number(h?.score || h?.messages || h?.voice_seconds || 0) > 0)) return true;
  return Boolean(hours.summary && !/bulunamadı|bulunamadÄ±|yok|none/i.test(String(hours.summary)));
}

function isCompleteProfile(profile) {
  if (!profile?.id || !profile?.username) return false;
  if (profile.findcord_loaded && profile.findcord_has_guilds) return true;
  if (profile.findcord_loaded && (hasItems(profile.voice_friends) || hasItems(profile.message_friends))) return true;
  if (profile.findcord_loaded && (hasItems(profile.punishments) || hasMeaningfulActiveHours(profile))) return true;
  return false;
}

function markProfile(profile, source) {
  if (!profile) return profile;
  return {
    ...profile,
    source: source || profile.source || null,
    partial: !isCompleteProfile(profile),
    cached_at: new Date().toISOString()
  };
}

async function cacheProfileAliases(query, profile) {
  if (!profile) return;
  const complete = isCompleteProfile(profile);
  const ttl = complete ? CACHE_TTL : PARTIAL_CACHE_TTL;
  await setJson(cacheKey(query), profile, ttl).catch(() => {});
  if (profile.id && profile.id !== query) await setJson(cacheKey(profile.id), profile, ttl).catch(() => {});
  if (complete) {
    await setJson(staleCacheKey(query), profile, STALE_CACHE_TTL).catch(() => {});
    if (profile.id && profile.id !== query) await setJson(staleCacheKey(profile.id), profile, STALE_CACHE_TTL).catch(() => {});
  }
}

async function fetchDcsvProfile(query, isId) {
  if (isId) {
    const apiProfile = await fetchDcsvUser(query);
    const publicProfile = await fetchDcsvPublicProfile(query).catch(() => null);
    return normalizeDcsv({ ...apiProfile, ...(publicProfile || {}), id: query });
  }

  const publicProfile = await fetchDcsvPublicProfile(query);
  let apiProfile = null;
  if (publicProfile.id) {
    apiProfile = await fetchDcsvUser(publicProfile.id).catch(() => null);
  }
  return normalizeDcsv({ ...(apiProfile || {}), ...publicProfile, id: publicProfile.id || apiProfile?.id });
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end();
    return;
  }

  // Auth check
  const session = await getSession(req.headers.cookie).catch(() => null);
  if (!session) {
    return sendJson(res, 401, { status: "error", message: "Bu işlem için Discord ile giriş yapman gerekiyor.", requireLogin: true });
  }

  const numericId = ((req.query.id || "")).trim().replace(/\D/g, "").slice(0, 20);
  const usernameQuery = ((req.query.u || req.query.username || "")).trim().slice(0, 50);
  const query = numericId || usernameQuery;

  if (!query) {
    return sendJson(res, 400, { status: "error", message: "Discord ID veya kullanıcı adı gerekli." });
  }

  let cachedProfile = await getJson(cacheKey(query)).catch(() => null);
  let staleProfile = await getJson(staleCacheKey(query)).catch(() => null);
  if (cachedProfile && isCompleteProfile(cachedProfile)) {
    return sendJson(res, 200, { status: "ready", source: "cache", data: cachedProfile });
  }

  const isId = /^\d{15,20}$/.test(query);
  const errors = [];
  let dcsvProfile = null;
  let findcordProfile = null;
  let resolvedId = isId ? query : "";

  try {
    dcsvProfile = await fetchDcsvProfile(query, isId);
    resolvedId = dcsvProfile.id || resolvedId;
    if (resolvedId && resolvedId !== query) {
      cachedProfile = cachedProfile || await getJson(cacheKey(resolvedId)).catch(() => null);
      staleProfile = staleProfile || await getJson(staleCacheKey(resolvedId)).catch(() => null);
      if (cachedProfile && isCompleteProfile(cachedProfile)) {
        return sendJson(res, 200, { status: "ready", source: "cache", data: cachedProfile });
      }
    }
  } catch (err) {
    errors.push(`DCSV: ${err.message}`);
  }

  if (resolvedId) {
    try {
      findcordProfile = normalizeFindcord(await fetchFindcordById(resolvedId));
    } catch (err) {
      errors.push(`Findcord: ${err.message}`);
    }
  }

  const liveProfile = mergeProfiles(dcsvProfile, findcordProfile);
  const cachedBase = isCompleteProfile(cachedProfile) ? cachedProfile : staleProfile;
  const profile = mergeProfiles(cachedBase, liveProfile) || cachedProfile || liveProfile;
  if (profile) {
    const source = isCompleteProfile(liveProfile)
      ? (liveProfile.source || (findcordProfile ? "findcord" : "dcsv"))
      : (cachedBase ? "stale+live" : (liveProfile?.source || "partial"));
    const marked = markProfile(profile, source);
    await cacheProfileAliases(query, marked);
    return sendJson(res, 200, { status: "ready", source, partial: marked.partial, data: marked });
  }

  return sendJson(res, 502, { status: "error", message: `Profil alınamadı. ${errors.join(" | ")}` });
};
