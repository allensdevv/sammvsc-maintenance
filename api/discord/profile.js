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
const CACHE_VERSION = "v14";
const LEGACY_CACHE_VERSIONS = ["v13", "v12", "v11"];
const DISCORD_PROFILE_PAUSED = false;
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

function cacheKeyForVersion(version, id) {
  return `discord:profile:${version}:${String(id).toLowerCase()}`;
}

function staleCacheKeyForVersion(version, id) {
  return `discord:profile:${version}:stale:${String(id).toLowerCase()}`;
}

function cacheKey(id) {
  return cacheKeyForVersion(CACHE_VERSION, id);
}

function staleCacheKey(id) {
  return staleCacheKeyForVersion(CACHE_VERSION, id);
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

function listFrom(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (isPlainObject(value)) {
    for (const key of ["data", "items", "list", "rows", "records", "friends", "users", "Voice", "Message"]) {
      if (Array.isArray(value[key])) return value[key].filter(Boolean);
    }
    return Object.values(value).flatMap(item => {
      if (Array.isArray(item)) return item.filter(Boolean);
      return item ? [item] : [];
    });
  }
  return [];
}

function firstList(...values) {
  for (const value of values) {
    const list = listFrom(value);
    if (list.length > 0) return list;
  }
  return [];
}

function firstObject(...values) {
  for (const value of values) {
    if (isPlainObject(value)) return value;
  }
  return {};
}

function clientStatusArray(...values) {
  const ignored = new Set(["offline", "invisible", "online", "idle", "dnd", "cevrimici", "bosta", "rahatsiz", "etme", "active", "aktif"]);
  const normalizeDevice = value => {
    const token = String(value || "").trim().toLowerCase();
    if (["pc", "computer", "windows", "mac", "macos", "linux", "client"].includes(token)) return "desktop";
    if (["phone", "ios", "android", "tablet"].includes(token)) return "mobile";
    if (token === "browser") return "web";
    return token;
  };
  for (const value of values) {
    if (Array.isArray(value) && value.length > 0) {
      const devices = value.map(normalizeDevice).filter(token => token && !ignored.has(token));
      if (devices.length > 0) return devices;
    }
    if (typeof value === "string" && value.trim()) {
      const devices = value.split(/[,\s]+/).map(normalizeDevice).filter(token => token && !ignored.has(token));
      if (devices.length > 0) return devices;
    }
    if (isPlainObject(value)) {
      const devices = Object.entries(value)
        .filter(([, state]) => state && String(state).toLowerCase() !== "offline")
        .map(([device]) => normalizeDevice(device))
        .filter(token => token && !ignored.has(token));
      if (devices.length > 0) return devices;
    }
  }
  return [];
}

function normalizeStatus(value, clientStatus = []) {
  let rawValue = value;
  if (isPlainObject(value)) {
    rawValue = firstValue(value.Status, value.status, value.State, value.state, value.presence, ...Object.values(value));
  }
  const raw = String(rawValue || "").trim().toLowerCase();
  const plain = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (["online", "cevrimici", "active", "aktif"].includes(plain)) return "online";
  if (["idle", "bosta", "away"].includes(plain)) return "idle";
  if (["dnd", "rahatsiz etme", "busy"].includes(plain)) return "dnd";
  if (clientStatusArray(clientStatus).length > 0) return "online";
  return "offline";
}

function effectiveClientStatus(status, ...values) {
  const devices = clientStatusArray(...values);
  if (devices.length > 0) return devices;
  return normalizeStatus(status) !== "offline" ? ["desktop"] : [];
}

function activityListFrom(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(activityListFrom);
  if (!isPlainObject(value)) return [];

  const directKeys = [
    "name", "Name", "details", "Details", "state", "State", "type", "Type", "emoji", "Emoji",
    "emoji_id", "emojiId", "EmojiId", "EmojiID", "emojiID", "emoji_name", "emojiName", "EmojiName",
    "title", "Title", "song", "Song", "track", "Track", "artist", "Artist", "artists", "Artists",
    "game", "Game", "application_name", "applicationName", "ApplicationName"
  ];
  if (directKeys.some(key => value[key] !== undefined && value[key] !== null && value[key] !== "")) {
    return [value];
  }

  const listKeys = [
    "activities", "Activities", "activity", "Activity", "current_activity", "currentActivity", "CurrentActivity",
    "presence_activities", "PresenceActivities", "rich_presence", "richPresence", "RichPresence",
    "spotify", "Spotify", "playing", "Playing", "listening", "Listening", "data", "items", "list"
  ];
  const out = [];
  for (const key of listKeys) {
    if (value[key]) out.push(...activityListFrom(value[key]));
  }
  return out;
}

function normalizeActivityType(value) {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "0" || raw === "playing" || raw === "game") return "playing";
  if (raw === "1" || raw === "streaming") return "streaming";
  if (raw === "2" || raw === "listening" || raw === "spotify") return "listening";
  if (raw === "3" || raw === "watching") return "watching";
  if (raw === "4" || raw === "custom" || raw === "custom_status") return "custom";
  if (raw === "5" || raw === "competing") return "competing";
  return raw || "playing";
}

function activityImageUrl(activity) {
  const assets = firstObject(activity.assets, activity.Assets);
  const raw = firstValue(
    activity.image_url,
    activity.imageUrl,
    activity.large_image_url,
    activity.largeImageURL,
    assets.large_image_url,
    assets.largeImageURL,
    assets.large_image,
    assets.largeImage,
    activity.album_image_url,
    activity.albumImageUrl
  );
  if (!raw) return null;
  const value = String(raw);
  if (/^spotify:/i.test(value)) return `https://i.scdn.co/image/${value.split(":").pop()}`;
  if (/^https?:\/\//i.test(value)) return value;
  return null;
}

function activityEmojiInfo(activity) {
  const emojiObject = firstObject(activity.emoji, activity.Emoji);
  const plainEmoji = firstValue(activity.emoji, activity.Emoji);
  const id = firstValue(
    emojiObject.id,
    emojiObject.ID,
    emojiObject.emoji_id,
    emojiObject.emojiId,
    emojiObject.EmojiId,
    emojiObject.EmojiID,
    emojiObject.emojiID,
    activity.emoji_id,
    activity.emojiId,
    activity.EmojiId,
    activity.EmojiID,
    activity.emojiID
  );
  const name = firstValue(
    emojiObject.name,
    emojiObject.Name,
    activity.emoji_name,
    activity.emojiName,
    activity.EmojiName,
    isPlainObject(plainEmoji) ? null : plainEmoji
  );
  const animated = Boolean(firstValue(
    emojiObject.animated,
    emojiObject.Animated,
    activity.emoji_animated,
    activity.emojiAnimated,
    activity.EmojiAnimated,
    false
  ));
  const url = id
    ? `https://cdn.discordapp.com/emojis/${id}.${animated ? "gif" : "png"}?size=32&quality=lossless`
    : null;
  return {
    name: name || null,
    id: id ? String(id) : null,
    animated,
    url
  };
}

function normalizePresenceActivities(...values) {
  const raw = values.flatMap(activityListFrom);
  const seen = new Set();
  return raw.map(activity => {
    if (!isPlainObject(activity)) return null;
    let type = normalizeActivityType(firstValue(activity.type, activity.Type, activity.activity_type, activity.ActivityType, activity.kind, activity.Kind));
    const emojiInfo = activityEmojiInfo(activity);
    const emoji = emojiInfo.name;
    const name = firstValue(activity.name, activity.Name, activity.application_name, activity.applicationName, activity.ApplicationName, activity.game, activity.Game, activity.title, activity.Title);
    const details = firstValue(activity.details, activity.Details, activity.detail, activity.song, activity.track, activity.title);
    const state = firstValue(
      activity.state,
      activity.State,
      activity.status,
      activity.Status,
      activity.status_text,
      activity.statusText,
      activity.custom_status,
      activity.customStatus,
      activity.artist,
      activity.artists,
      activity.subtitle
    );
    const url = firstValue(activity.url, activity.Url, activity.spotify_track_url, activity.track_url, activity.link);
    const startedAt = toIso(firstValue(activity.created_at, activity.createdAt, activity.started_at, activity.startedAt, activity.timestamps?.start, activity.Timestamps?.Start));
    const endedAt = toIso(firstValue(activity.ended_at, activity.endedAt, activity.timestamps?.end, activity.Timestamps?.End));
    const text = firstValue(details, state, name, emoji);
    if (!text) return null;
    const spotifyLike = [activity.spotify, activity.Spotify, activity.spotify_track_id, activity.spotifyTrackId, activity.album_image_url, activity.albumImageUrl, activity.artist, activity.artists, activity.song, activity.track, name]
      .some(value => String(value || "").toLowerCase().includes("spotify") || Boolean(value && value !== name));
    if ((type === "playing" || !type) && spotifyLike && (activity.song || activity.track || activity.artist || activity.artists || String(name || "").toLowerCase().includes("spotify"))) {
      type = "listening";
    }
    if (/last[_\s-]?(message|voice)/i.test(String(name || ""))) return null;
    const normalized = {
      type,
      name: name || (type === "custom" ? "Özel Durum" : ""),
      details: details || null,
      state: state || null,
      emoji: emoji || null,
      emoji_name: emojiInfo.name,
      emoji_id: emojiInfo.id,
      emoji_animated: emojiInfo.animated,
      emoji_url: emojiInfo.url,
      url: url || null,
      image_url: activityImageUrl(activity),
      started_at: startedAt,
      ended_at: endedAt
    };
    const key = [normalized.type, normalized.name, normalized.details, normalized.state, normalized.emoji].join("|");
    if (seen.has(key)) return null;
    seen.add(key);
    return normalized;
  }).filter(Boolean).slice(0, 5);
}

function applySessionPresenceFallback(profile, session) {
  if (!profile || !session?.discord_id || String(profile.id) !== String(session.discord_id)) return profile;
  const status = normalizeStatus(profile.status, profile.client_status);
  const devices = clientStatusArray(profile.client_status);
  if (status !== "offline" && devices.length > 0) return profile;
  return {
    ...profile,
    status: status === "offline" ? "online" : status,
    client_status: devices.length > 0 ? devices : ["desktop"]
  };
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
  if (typeof value === "string") {
    const clean = value.trim().toLowerCase();
    let total = 0;
    let matched = false;
    const units = [
      [/(\d+(?:[.,]\d+)?)\s*(?:saat|hour|hours|h)\b/g, 3600],
      [/(\d+(?:[.,]\d+)?)\s*(?:dakika|minute|minutes|min|m)\b/g, 60],
      [/(\d+(?:[.,]\d+)?)\s*(?:saniye|second|seconds|sec|sn|s)\b/g, 1]
    ];
    for (const [regex, multiplier] of units) {
      let match;
      while ((match = regex.exec(clean))) {
        matched = true;
        total += Number(match[1].replace(",", ".")) * multiplier;
      }
    }
    if (matched) return Math.round(total);
  }
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
  const rawStatus = firstValue(
    d.status,
    d.Status,
    d.presence_status,
    d.PresenceStatus,
    d.DiscordStatus,
    d.Presence?.Status,
    d.Presence?.status,
    d.presence?.Status,
    d.presence?.status,
    d.online === true ? "online" : null,
    d.is_online === true ? "online" : null,
    d.isOnline === true ? "online" : null,
    "offline"
  );
  const clientStatus = effectiveClientStatus(
    rawStatus,
    d.client_status,
    d.clientStatus,
    d.devices,
    d.device,
    d.Presence?.Type,
    d.Presence?.ClientStatus,
    d.Presence?.client_status,
    d.presence?.Type,
    d.presence?.ClientStatus,
    d.presence?.client_status
  );
  const status = normalizeStatus(rawStatus, clientStatus);
  return {
    id: uid,
    username: d.username || "",
    global_name: d.global_name || d.display_name || d.username || "",
    avatar_url: d.avatar_url || buildAvatarUrl(uid, avatarHash),
    banner_url: d.banner_url || buildBannerUrl(uid, bannerHash),
    accent_color: d.accent_color || null,
    status,
    client_status: clientStatus,
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
    presence_activities: normalizePresenceActivities(
      d.activities,
      d.Activities,
      d.activity,
      d.Activity,
      d.current_activity,
      d.currentActivity,
      d.CurrentActivity,
      d.rich_presence,
      d.richPresence,
      d.RichPresence,
      d.spotify,
      d.Spotify,
      d.Presence?.Activities,
      d.Presence?.Activity,
      d.presence?.activities,
      d.presence?.activity,
      d.presence?.Activities,
      d.presence?.Activity
    ),
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
  if (isPlainObject(fc?.data)) fc = { ...fc.data, ...fc };
  const user = fc.UserInfo || fc.user || fc.User || fc.data?.UserInfo || fc;
  const uid = String(firstValue(user.UserID, fc.id, fc.user_id, "") || "");
  const guilds = firstList(fc.Guilds, fc.guilds, fc.Servers, fc.servers, fc.MutualGuilds, fc.mutual_guilds, user.Guilds);
  const guildStats = firstList(fc.GuildStats, fc.guildStats, fc.guild_stats, fc.ServerStats, fc.serverStats, fc.server_stats, user.GuildStats);
  const findcordHasGuilds = guilds.length > 0 || guildStats.length > 0;
  const guildStatsById = new Map(guildStats.map(g => [String(firstValue(g.GuildID, g.GuildId, g.guild_id, g.id, "")), g]));

  const servers = guilds.map(g => {
    const gid = String(firstValue(g.GuildId, g.GuildID, g.guild_id, g.id, "") || "");
    const stat = guildStatsById.get(gid) || {};
    const userStats = g.UserStats || {};
    return {
      id: gid,
      guild_id: gid,
      name: firstValue(g.GuildName, stat.GuildName, g.name, "Sunucu"),
      guild_name: firstValue(g.GuildName, stat.GuildName, g.name, "Sunucu"),
      icon_url: firstValue(g.GuildIcon, stat.GuildIcon, g.icon_url, g.icon, stat.icon_url, stat.icon),
      banner_url: firstValue(g.GuildBanner, stat.GuildBanner, g.banner_url, g.banner, stat.banner_url, stat.banner),
      nick: firstValue(g.displayName, g.nick, g.nickname),
      joined_at: toIso(firstValue(g.JoinTime, g.joined_at)),
      booster: Boolean(g.Booster),
      roles: firstList(g.Roles, g.roles, stat.Roles, stat.roles),
      messages: firstValue(userStats.total?.messages, stat.MessageStat, stat.messages, g.messages, 0) || 0,
      message_count: firstValue(userStats.total?.messages, stat.MessageStat, stat.message_count, g.message_count, 0) || 0,
      voice_time: toSeconds(firstValue(userStats.total?.voiceTime, stat.VoiceStat, stat.voice_time, g.voice_time, 0)),
      voice_seconds: toSeconds(firstValue(userStats.total?.voiceTime, stat.VoiceStat, stat.voice_seconds, g.voice_seconds, 0)),
      peak_hours: firstValue(userStats.peakHours, userStats.peak_hours, g.peakHours, g.peak_hours),
      active_hours: firstValue(userStats.activeHours, userStats.active_hours, g.activeHours, g.active_hours, stat.activeHours, stat.active_hours),
      top_channels: firstValue(userStats.topChannels, userStats.top_channels, g.topChannels, g.top_channels),
      daily_activity: firstList(userStats.dailyActivity, userStats.daily_activity, g.dailyActivity, g.daily_activity)
    };
  });

  const statOnlyServers = guildStats
    .filter(g => !servers.some(s => String(s.guild_id) === String(firstValue(g.GuildID, g.GuildId, g.guild_id, g.id, ""))))
    .map(g => ({
      id: String(firstValue(g.GuildID, g.GuildId, g.guild_id, g.id, "")),
      guild_id: String(firstValue(g.GuildID, g.GuildId, g.guild_id, g.id, "")),
      name: firstValue(g.GuildName, g.guild_name, g.name, "Sunucu"),
      guild_name: firstValue(g.GuildName, g.guild_name, g.name, "Sunucu"),
      icon_url: firstValue(g.GuildIcon, g.icon_url, g.icon),
      banner_url: firstValue(g.GuildBanner, g.banner_url, g.banner),
      roles: firstList(g.Roles, g.roles),
      messages: firstValue(g.MessageStat, g.messages, g.message_count, 0) || 0,
      message_count: firstValue(g.MessageStat, g.messages, g.message_count, 0) || 0,
      voice_time: toSeconds(firstValue(g.VoiceStat, g.voice_time, g.voice_seconds)),
      voice_seconds: toSeconds(firstValue(g.VoiceStat, g.voice_time, g.voice_seconds))
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

  const badges = firstList(user.UserBadge, user.Badges, user.badges, fc.UserBadge, fc.Badges, fc.badges).map(b => ({
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

  const lastSeen = firstObject(fc.LastSeen, fc.lastSeen, fc.last_seen, user.LastSeen, user.lastSeen);
  const messageHistory = firstList(
    lastSeen.Message,
    lastSeen.Messages,
    lastSeen.message,
    lastSeen.messages,
    lastSeen.LastMessage,
    lastSeen.lastMessage,
    fc.MessageHistory,
    fc.messageHistory,
    fc.message_history,
    fc.LastMessages,
    fc.lastMessages
  ).map(m => ({
    guild_id: firstValue(m.GuildID, m.GuildId, m.guild_id, m.server_id, m.id),
    guild_name: firstValue(m.GuildName, m.guild_name, m.ServerName, m.server_name, m.name),
    guild_icon_url: firstValue(m.GuildIcon, m.guild_icon_url, m.server_icon_url, m.icon_url),
    channel_name: firstValue(m.ChannelName, m.channel_name, m.channel, m.Channel),
    content: firstValue(m.Message, m.message, m.content, m.Content, ""),
    timestamp: toIso(firstValue(m.TimeString, m.timestamp, m.created_at, m.CreatedAt, m.date, m.Date)),
    author_id: firstValue(m.UserID, m.UserId, m.userId, m.user_id, m.author_id, m.AuthorID),
    author_name: firstValue(m.UserName, m.username, m.displayName, m.displayname, m.author_name, m.AuthorName),
    author_avatar_url: firstValue(m.AvatarURL, m.avatarURL, m.avatar_url, m.author_avatar_url)
  }));
  const voiceHistory = firstList(
    lastSeen.Voice,
    lastSeen.Voices,
    lastSeen.voice,
    lastSeen.voices,
    lastSeen.LastVoice,
    lastSeen.lastVoice,
    fc.VoiceHistory,
    fc.voiceHistory,
    fc.voice_history,
    fc.LastVoices,
    fc.lastVoices
  ).map(v => ({
    guild_id: firstValue(v.GuildID, v.GuildId, v.guild_id, v.server_id, v.id),
    guild_name: firstValue(v.GuildName, v.guild_name, v.ServerName, v.server_name, v.name),
    guild_icon_url: firstValue(v.GuildIcon, v.guild_icon_url, v.server_icon_url, v.icon_url),
    channel_name: firstValue(v.ChannelName, v.channel_name, v.channel, v.Channel),
    duration: toSeconds(firstValue(v.Stat, v.duration, v.Duration, v.voice_time, v.voice_seconds)),
    duration_label: typeof v.Stat === "string" ? v.Stat : firstValue(v.formattedDuration, v.duration_label),
    timestamp: toIso(firstValue(v.TimeString, v.timestamp, v.created_at, v.CreatedAt, v.last_seen, v.Date)),
    users: firstList(v.Users, v.users, v.Members, v.members, v.Friends, v.friends),
    member_count: firstValue(v.member_count, v.MemberCount, listFrom(v.Users).length, listFrom(v.users).length)
  }));

  const addHourBucket = (hour, payload = {}) => {
    const idx = Number(hour);
    if (!Number.isInteger(idx) || idx < 0 || idx > 23) return;
    const bucket = hourBuckets[idx];
    if (typeof payload === "number") {
      bucket.messages += payload;
      bucket.score += payload;
      return;
    }
    const messages = Number(firstValue(payload.messages, payload.message, payload.count, payload.Message, 0)) || 0;
    const voice = toSeconds(firstValue(payload.voice_seconds, payload.voiceTime, payload.voice_time, payload.Voice, payload.voice, 0));
    const score = Number(firstValue(payload.score, payload.value, payload.Score, payload.Value, messages + Math.max(0, Math.round(voice / 60)))) || 0;
    bucket.messages += messages;
    bucket.voice_seconds += voice;
    bucket.score += score;
  };

  const activeHours = firstObject(fc.ActiveHours, fc.activeHours, fc.active_hours, user.ActiveHours, user.activeHours);
  firstList(activeHours.detailedHours, activeHours.DetailedHours, activeHours.hours, activeHours.Hours, activeHours.detailed, fc.ActiveHourStats, fc.active_hour_stats)
    .forEach((item, index) => {
      if (isPlainObject(item)) addHourBucket(firstValue(item.hour, item.Hour, item.key, index), item);
      else addHourBucket(index, Number(item) || 0);
    });
  for (const [hour, count] of Object.entries(firstObject(activeHours.messages, activeHours.Message, fc.active_messages))) {
    addHourBucket(hour, { messages: count });
  }
  for (const [hour, value] of Object.entries(firstObject(activeHours.voice, activeHours.Voice, fc.active_voice))) {
    addHourBucket(hour, { voice_seconds: value });
  }
  for (const msg of messageHistory) {
    const date = msg.timestamp ? new Date(msg.timestamp) : null;
    if (date && !Number.isNaN(date.getTime())) addHourBucket(date.getHours(), { messages: 1, score: 1 });
  }
  for (const voice of voiceHistory) {
    const date = voice.timestamp ? new Date(voice.timestamp) : null;
    if (date && !Number.isNaN(date.getTime())) addHourBucket(date.getHours(), { voice_seconds: voice.duration || 0, score: Math.max(1, Math.round((voice.duration || 0) / 60)) });
  }
  const detailedHours = hourBuckets;
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
  const punishmentItems = firstList(fc.Punishments, fc.punishments, fc.PunishmentHistory, fc.punishment_history);
  const adminServerItems = firstList(fc.GuildStaff, fc.guildStaff, fc.guild_staff, fc.admin_guilds, fc.AdminGuilds);
  const voiceFriendItems = firstList(
    fc.VoiceFrends,
    fc.VoiceFriends,
    fc.voiceFriends,
    fc.voice_friends,
    fc.VoiceFriendsData,
    fc.Friends?.Voice,
    fc.friends?.voice
  );
  const messageFriendItems = firstList(
    fc.MessageFriends,
    fc.MessageFrends,
    fc.messageFriends,
    fc.message_friends,
    fc.Friends?.Message,
    fc.friends?.message
  );
  const voiceFriendsFromHistory = (() => {
    const byUser = new Map();
    for (const item of voiceHistory) {
      for (const userItem of firstList(item.users)) {
        const id = String(firstValue(userItem.UserID, userItem.UserId, userItem.userId, userItem.user_id, userItem.id, "") || "");
        const username = firstValue(userItem.UserName, userItem.username, userItem.name, userItem.displayName, userItem.displayname, "");
        if (!id && !username) continue;
        const key = id || String(username).toLowerCase();
        const prev = byUser.get(key) || {
          id,
          user_id: id,
          username,
          global_name: firstValue(userItem.GlobalName, userItem.global_name, userItem.displayName, userItem.displayname, username, ""),
          avatar_url: firstValue(userItem.AvatarURL, userItem.avatarURL, userItem.avatar_url),
          total_voice: 0,
          voice_time: 0,
          duration: 0,
          meetings: 0,
          sessions: 0,
          channels: 0,
          channel_count: 0,
          top_channel: item.channel_name || "",
          last_seen: item.timestamp,
          status: firstValue(userItem.status, userItem.Status, "offline")
        };
        const seconds = toSeconds(firstValue(userItem.Duration, userItem.duration, userItem.voice_time, userItem.voice_seconds, item.duration));
        prev.total_voice += seconds;
        prev.voice_time += seconds;
        prev.duration += seconds;
        prev.meetings += 1;
        prev.sessions += 1;
        prev.channels = Math.max(prev.channels, item.channel_name ? 1 : 0);
        prev.channel_count = Math.max(prev.channel_count, prev.channels);
        if (item.timestamp && (!prev.last_seen || new Date(item.timestamp) > new Date(prev.last_seen))) prev.last_seen = item.timestamp;
        byUser.set(key, prev);
      }
    }
    return Array.from(byUser.values()).sort((a, b) => (b.total_voice || 0) - (a.total_voice || 0));
  })();
  const messageFriendsFromHistory = (() => {
    const byUser = new Map();
    for (const item of messageHistory) {
      const id = String(firstValue(item.author_id, "") || "");
      const username = firstValue(item.author_name, "");
      if (!id && !username) continue;
      const key = id || String(username).toLowerCase();
      const prev = byUser.get(key) || {
        id,
        user_id: id,
        username,
        global_name: username,
        avatar_url: item.author_avatar_url,
        messages: 0,
        message_count: 0,
        first_interaction: item.timestamp,
        last_interaction: item.timestamp
      };
      prev.messages += 1;
      prev.message_count += 1;
      if (item.timestamp && (!prev.first_interaction || new Date(item.timestamp) < new Date(prev.first_interaction))) prev.first_interaction = item.timestamp;
      if (item.timestamp && (!prev.last_interaction || new Date(item.timestamp) > new Date(prev.last_interaction))) prev.last_interaction = item.timestamp;
      byUser.set(key, prev);
    }
    return Array.from(byUser.values()).sort((a, b) => (b.messages || 0) - (a.messages || 0));
  })();
  const voiceFriends = voiceFriendItems.length ? voiceFriendItems.map(f => ({
    id: String(firstValue(f.userId, f.UserID, f.UserId, f.id, f.user_id, "")),
    user_id: String(firstValue(f.userId, f.UserID, f.UserId, f.id, f.user_id, "")),
    username: firstValue(f.username, f.UserName, f.name, ""),
    global_name: firstValue(f.displayname, f.displayName, f.global_name, f.GlobalName, f.username, f.UserName, ""),
    avatar_url: firstValue(f.avatarURL, f.AvatarURL, f.avatar_url, f.avatar),
    total_voice: toSeconds(firstValue(f.totalDuration, f.total_voice, f.voice_time, f.duration, 0)),
    voice_time: toSeconds(firstValue(f.totalDuration, f.total_voice, f.voice_time, f.duration, 0)),
    duration: toSeconds(firstValue(f.totalDuration, f.total_voice, f.voice_time, f.duration, 0)),
    duration_label: firstValue(f.formattedDuration, f.duration_label),
    meetings: firstValue(f.meetingCount, f.meetings, f.sessions, 0) || 0,
    sessions: firstValue(f.meetingCount, f.meetings, f.sessions, 0) || 0,
    channels: firstValue(f.channelsCount, f.channels, f.channel_count, 0) || 0,
    channel_count: firstValue(f.channelsCount, f.channels, f.channel_count, 0) || 0,
    average_duration: toSeconds(firstValue(f.averageDurationPerMeeting, f.average_duration, 0)),
    average_duration_label: firstValue(f.formattedAverageDuration, f.average_duration_label),
    top_channel: firstValue(f.topChannels?.[0]?.channelName, f.top_channel, f.channel_name, f.lastChannelInfo?.channelName, ""),
    last_seen: toIso(firstValue(f.lastSeen, f.last_seen, f.formattedLastSeen)),
    first_seen: toIso(firstValue(f.firstSeen, f.first_seen, f.formattedFirstSeen)),
    status: f.isRecentlyActive ? "online" : firstValue(f.status, "offline")
  })) : voiceFriendsFromHistory;
  const messageFriends = messageFriendItems.length ? messageFriendItems.map(f => ({
    id: String(firstValue(f.userId, f.UserID, f.UserId, f.id, f.user_id, "")),
    user_id: String(firstValue(f.userId, f.UserID, f.UserId, f.id, f.user_id, "")),
    username: firstValue(f.username, f.UserName, f.name, ""),
    global_name: firstValue(f.displayName, f.displayname, f.global_name, f.GlobalName, f.username, f.UserName, ""),
    avatar_url: firstValue(f.avatarURL, f.AvatarURL, f.avatar_url, f.avatar),
    messages: firstValue(f.Message, f.messages, f.message_count, f.count, 0) || 0,
    message_count: firstValue(f.Message, f.messages, f.message_count, f.count, 0) || 0,
    first_interaction: toIso(firstValue(f.firstInteraction, f.first_interaction, f.first_seen)),
    last_interaction: toIso(firstValue(f.lastInteraction, f.last_interaction, f.last_seen)),
    interaction_score: f.interactionScore || f.interaction_score || 0,
    bot: Boolean(f.bot)
  })) : messageFriendsFromHistory;
  const views = fc.LastViewing?.views;
  const rawStatus = firstValue(
    user.Presence?.Status,
    user.Presence?.status,
    user.presence?.Status,
    user.presence?.status,
    user.Status,
    user.status,
    user.presence_status,
    user.PresenceStatus,
    fc.status,
    fc.Status,
    fc.presence_status,
    fc.PresenceStatus,
    fc.Presence?.Status,
    fc.Presence?.status,
    fc.presence?.Status,
    fc.presence?.status,
    fc.online === true ? "online" : null,
    fc.is_online === true ? "online" : null,
    fc.isOnline === true ? "online" : null,
    "offline"
  );
  const clientStatus = effectiveClientStatus(
    rawStatus,
    user.Presence?.Type,
    user.Presence?.ClientStatus,
    user.Presence?.client_status,
    user.presence?.Type,
    user.presence?.ClientStatus,
    user.presence?.client_status,
    user.ClientStatus,
    user.clientStatus,
    user.devices,
    user.device,
    fc.client_status,
    fc.clientStatus,
    fc.devices,
    fc.device,
    fc.Presence?.Type,
    fc.Presence?.ClientStatus,
    fc.Presence?.client_status,
    fc.presence?.Type,
    fc.presence?.ClientStatus,
    fc.presence?.client_status
  );
  const status = normalizeStatus(rawStatus, clientStatus);
  const presenceActivities = normalizePresenceActivities(
    user.Activities,
    user.activities,
    user.Activity,
    user.activity,
    user.CurrentActivity,
    user.current_activity,
    user.RichPresence,
    user.rich_presence,
    user.Spotify,
    user.spotify,
    user.Presence?.Activities,
    user.Presence?.Activity,
    user.presence?.Activities,
    user.presence?.activities,
    user.presence?.Activity,
    user.presence?.activity,
    fc.Activities,
    fc.activities,
    fc.Activity,
    fc.activity,
    fc.CurrentActivity,
    fc.current_activity,
    fc.RichPresence,
    fc.rich_presence,
    fc.Spotify,
    fc.spotify,
    fc.Presence?.Activities,
    fc.Presence?.Activity,
    fc.presence?.Activities,
    fc.presence?.activities,
    fc.presence?.Activity,
    fc.presence?.activity
  );
  const customActivity = presenceActivities.find(activity => activity.type === "custom");

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
    status,
    client_status: clientStatus,
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
    custom_status: firstValue(customActivity?.state, customActivity?.details, user.Activities?.find?.(a => a?.state)?.state, fc.custom_status),
    other_names: firstArray(fc.displayNames, user.previous_usernames, fc.previous_usernames)
      .map(n => (typeof n === "string" ? n : firstValue(n.name, n.displayName, n.UserName, n.toString?.())))
      .filter(Boolean),
    server_count: allServers.length || guildStats.length || null,
    voice_friend_count: voiceFriends.length || null,
    punishment_count: punishmentItems.length || null,
    servers: allServers,
    active_hours: {
      total: toSeconds((activeHours.totalActiveHours || 0) * 60 * 60) || totalVoiceSeconds,
      summary: activeSummary,
      ranges: activeHours.activeTimeRanges || [],
      detailed: detailedHours
    },
    view_count: views?.allTime?.total || views?.total || fc.LastViewing?.uniqueVisitors || null,
    presence_activities: presenceActivities,
    activity: { last_message: messageHistory[0] || null, last_voice: voiceHistory[0] || null },
    punishments: punishmentItems.map(p => ({
      guild_name: p.GuildName || p.guild_name,
      guild_icon_url: p.GuildIcon || null,
      type: p.Type || p.type,
      reason: p.Reason || p.reason,
      date: toIso(p.Date || p.date)
    })),
    admin_servers: adminServerItems.map(g => ({
      id: String(firstValue(g.GuildID, g.GuildId, g.id, "")),
      guild_id: String(firstValue(g.GuildID, g.GuildId, g.id, "")),
      name: firstValue(g.GuildName, g.name, "Sunucu"),
      guild_name: firstValue(g.GuildName, g.name, "Sunucu"),
      icon_url: firstValue(g.GuildIcon, g.icon_url)
    })),
    voice_friends: voiceFriends,
    voice_history: voiceHistory,
    message_history: messageHistory,
    message_friends: messageFriends
  };
}

function hasItems(value) {
  return Array.isArray(value) && value.length > 0;
}

function mergeProfiles(dcsv, findcord) {
  if (!dcsv) return findcord;
  if (!findcord) return dcsv;
  const mergedServers = mergeServerArrays(dcsv.servers, findcord.servers);
  const mergedClientStatus = hasItems(findcord.client_status) ? findcord.client_status : dcsv.client_status;
  const preferredStatus = normalizeStatus(findcord.status, mergedClientStatus);
  const fallbackStatus = normalizeStatus(dcsv.status, mergedClientStatus);
  const mergedStatus = preferredStatus !== "offline" ? preferredStatus : fallbackStatus;
  const finalClientStatus = effectiveClientStatus(mergedStatus, mergedClientStatus);
  return {
    ...dcsv,
    ...Object.fromEntries(Object.entries(findcord).filter(([, value]) => value !== null && value !== undefined && value !== "")),
    id: firstValue(findcord.id, dcsv.id),
    username: firstValue(findcord.username, dcsv.username),
    global_name: firstValue(findcord.global_name, dcsv.global_name),
    avatar_url: firstValue(findcord.avatar_url, dcsv.avatar_url),
    banner_url: firstValue(findcord.banner_url, dcsv.banner_url),
    bio: firstValue(findcord.bio, dcsv.bio),
    status: mergedStatus,
    client_status: finalClientStatus,
    guild_tag: firstValue(findcord.guild_tag, dcsv.guild_tag),
    custom_status: firstValue(findcord.custom_status, dcsv.custom_status),
    presence_activities: hasItems(findcord.presence_activities) ? findcord.presence_activities : dcsv.presence_activities,
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
  if (hasItems(profile.servers)) return true;
  if (hasItems(profile.voice_friends) || hasItems(profile.message_friends)) return true;
  if (hasItems(profile.voice_history) || hasItems(profile.message_history)) return true;
  if (hasItems(profile.punishments) || hasMeaningfulActiveHours(profile)) return true;
  if (profile.findcord_loaded && profile.findcord_has_guilds) return true;
  if (profile.findcord_loaded && (hasItems(profile.voice_friends) || hasItems(profile.message_friends))) return true;
  if (profile.findcord_loaded && (hasItems(profile.punishments) || hasMeaningfulActiveHours(profile))) return true;
  return false;
}

function profileCompletenessScore(profile) {
  if (!profile || typeof profile !== "object") return 0;

  const servers = Array.isArray(profile.servers) ? profile.servers.length : 0;
  const serverCount = Number(profile.server_count || 0);
  const voiceFriends = Array.isArray(profile.voice_friends) ? profile.voice_friends.length : 0;
  const messageFriends = Array.isArray(profile.message_friends) ? profile.message_friends.length : 0;
  const voiceHistory = Array.isArray(profile.voice_history) ? profile.voice_history.length : 0;
  const messageHistory = Array.isArray(profile.message_history) ? profile.message_history.length : 0;
  const punishments = Array.isArray(profile.punishments) ? profile.punishments.length : 0;
  const badges = Array.isArray(profile.badges) ? profile.badges.length : 0;
  const names = Array.isArray(profile.other_names) ? profile.other_names.length : 0;
  const activities = Array.isArray(profile.presence_activities) ? profile.presence_activities.length : 0;

  let score = 0;
  if (profile.id) score += 20;
  if (profile.username) score += 20;
  if (profile.global_name) score += 6;
  if (profile.avatar_url) score += 5;
  if (profile.banner_url) score += 4;
  if (profile.created_at) score += 4;
  if (profile.status && profile.status !== "offline") score += 6;
  if (hasItems(profile.client_status)) score += 6;
  if (profile.custom_status) score += 5;
  if (profile.bio) score += 5;
  if (profile.age) score += 3;
  if (profile.gender) score += 3;
  if (profile.premium_since) score += 4;
  if (profile.boost_since) score += 4;
  if (profile.findcord_loaded) score += 12;
  if (profile.findcord_has_guilds) score += 24;

  score += servers ? 35 + Math.min(servers, 30) * 3 : Math.min(serverCount, 30);
  score += voiceFriends ? 18 + Math.min(voiceFriends, 20) : 0;
  score += messageFriends ? 18 + Math.min(messageFriends, 20) : 0;
  score += voiceHistory ? 12 + Math.min(voiceHistory, 20) : 0;
  score += messageHistory ? 12 + Math.min(messageHistory, 20) : 0;
  score += punishments ? 8 + Math.min(punishments, 20) : 0;
  score += badges ? 4 + Math.min(badges, 20) : 0;
  score += names ? 4 + Math.min(names, 20) : 0;
  score += activities ? 8 + Math.min(activities, 10) : 0;
  if (hasMeaningfulActiveHours(profile)) score += 16;

  return score;
}

function pickRicherProfile(...profiles) {
  let best = null;
  let bestScore = -1;
  for (const profile of profiles) {
    const score = profileCompletenessScore(profile);
    if (score > bestScore) {
      best = profile || null;
      bestScore = score;
    }
  }
  return best;
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

async function getProfileFromCacheVersions(query) {
  if (!query) return null;
  const versions = [CACHE_VERSION, ...LEGACY_CACHE_VERSIONS];
  const profiles = [];
  for (const version of versions) {
    const cached = await getJson(cacheKeyForVersion(version, query)).catch(() => null);
    if (cached) profiles.push(cached);
    const stale = await getJson(staleCacheKeyForVersion(version, query)).catch(() => null);
    if (stale) profiles.push(stale);
  }
  return pickRicherProfile(...profiles);
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

async function sendCachedProfile(res, query, profile, source = "cache", session = null) {
  const marked = markProfile(applySessionPresenceFallback(profile, session), source);
  await cacheProfileAliases(query, marked);
  return sendJson(res, 200, { status: "ready", source, partial: marked.partial, data: marked });
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

  if (DISCORD_PROFILE_PAUSED) {
    return sendJson(res, 503, {
      status: "paused",
      message: "Discord arama gecici olarak kapali. Su an sadece Instagram calisiyor."
    });
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
  let bestCachedProfile = pickRicherProfile(
    cachedProfile,
    staleProfile,
    await getProfileFromCacheVersions(query).catch(() => null)
  );
  if (bestCachedProfile && isCompleteProfile(bestCachedProfile)) {
    return sendCachedProfile(res, query, bestCachedProfile, "cache", session);
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
      const resolvedCachedProfile = await getProfileFromCacheVersions(resolvedId).catch(() => null);
      cachedProfile = pickRicherProfile(cachedProfile, await getJson(cacheKey(resolvedId)).catch(() => null), resolvedCachedProfile);
      staleProfile = pickRicherProfile(staleProfile, await getJson(staleCacheKey(resolvedId)).catch(() => null), resolvedCachedProfile);
      bestCachedProfile = pickRicherProfile(bestCachedProfile, cachedProfile, staleProfile, resolvedCachedProfile);
      if (bestCachedProfile && isCompleteProfile(bestCachedProfile)) {
        return sendCachedProfile(res, query, bestCachedProfile, "cache", session);
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
  const cachedBase = pickRicherProfile(cachedProfile, staleProfile, bestCachedProfile);
  const profile = applySessionPresenceFallback(mergeProfiles(cachedBase, liveProfile) || cachedBase || liveProfile, session);
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
