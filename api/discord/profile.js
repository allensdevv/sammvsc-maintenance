const { getJson, setJson } = require("../../lib/cache");

const FINDCORD_KEY = process.env.FINDCORD_API_KEY || "331b483f722e9077c40365f97fd5b5f28ea25456f7af610a1826dd4eadc96b4d";
const DCSV_KEY = process.env.DCSV_API_KEY || "dcsv_ca6ca829a717d342d2a5e2a48fed0fcef33f1ab3098a1a9a";
const CACHE_TTL = 60 * 30;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function cacheKey(id) {
  return `discord:profile:${id}`;
}

async function fetchDcsvUser(query) {
  const res = await fetch(`https://api.dcsv.me/v1/user/${encodeURIComponent(query)}`, {
    headers: {
      "Authorization": DCSV_KEY,
      "Accept": "application/json"
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DCSV ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

async function fetchFindcordById(id) {
  const res = await fetch(`https://app.findcord.com/api/user/${encodeURIComponent(id)}`, {
    headers: {
      "Authorization": FINDCORD_KEY,
      "Accept": "application/json"
    }
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Findcord ${res.status}: ${body.slice(0, 120)}`);
  }
  return res.json();
}

function buildAvatarUrl(uid, hash) {
  if (!hash) return null;
  return `https://cdn.discordapp.com/avatars/${uid}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=256`;
}

function buildBannerUrl(uid, hash) {
  if (!hash) return null;
  return `https://cdn.discordapp.com/banners/${uid}/${hash}.${hash.startsWith("a_") ? "gif" : "png"}?size=512`;
}

function parseCreatedAt(uid) {
  try {
    const ts = (BigInt(uid) >> 22n) + 1420070400000n;
    return new Date(Number(ts)).toISOString();
  } catch { return null; }
}

function normalizeDcsv(d) {
  const uid = d.id || d.user_id || "";
  const avatarHash = d.avatar || d.avatar_hash || null;
  const bannerHash = d.banner || d.banner_hash || null;
  return {
    id: uid,
    username: d.username || "",
    global_name: d.global_name || d.display_name || d.username || "",
    avatar_url: buildAvatarUrl(uid, avatarHash),
    banner_url: buildBannerUrl(uid, bannerHash),
    accent_color: d.accent_color || null,
    status: d.status || "offline",
    public_flags: d.public_flags || 0,
    premium_type: d.premium_type || 0,
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
    servers: d.mutual_guilds || d.guilds || d.servers || [],
    activity: d.activity || d.activities || null,
    punishments: d.punishments || [],
    admin_servers: d.admin_guilds || d.managed_guilds || [],
    voice_friends: d.voice_friends || [],
    voice_history: d.voice_history || [],
    message_history: d.message_history || [],
    message_friends: d.message_friends || d.friends || []
  };
}

function normalizeFindcord(fc) {
  const uid = fc.id || fc.user_id || "";
  const avatarHash = fc.avatar || null;
  const bannerHash = fc.banner || fc.banner_hash || null;
  return {
    id: uid,
    username: fc.username || "",
    global_name: fc.global_name || fc.display_name || fc.username || "",
    avatar_url: buildAvatarUrl(uid, avatarHash),
    banner_url: buildBannerUrl(uid, bannerHash),
    accent_color: fc.accent_color || null,
    status: fc.status || "offline",
    public_flags: fc.public_flags || 0,
    premium_type: fc.premium_type || 0,
    badges: fc.badges || [],
    created_at: parseCreatedAt(uid),
    age: null,
    gender: null,
    bio: fc.bio || fc.about_me || null,
    custom_status: fc.custom_status || null,
    other_names: fc.previous_usernames || [],
    server_count: fc.mutual_guilds?.length ?? fc.guild_count ?? null,
    voice_friend_count: fc.voice_friends?.length ?? null,
    punishment_count: fc.punishments?.length ?? null,
    servers: fc.mutual_guilds || fc.guilds || [],
    activity: fc.activity || fc.activities || null,
    punishments: fc.punishments || [],
    admin_servers: fc.admin_guilds || fc.managed_guilds || [],
    voice_friends: fc.voice_friends || [],
    voice_history: fc.voice_history || [],
    message_history: fc.message_history || [],
    message_friends: fc.message_friends || fc.friends || []
  };
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end();
    return;
  }

  const numericId = ((req.query.id || "")).trim().replace(/\D/g, "").slice(0, 20);
  const usernameQuery = ((req.query.u || req.query.username || "")).trim().slice(0, 50);
  const query = numericId || usernameQuery;

  if (!query) {
    return sendJson(res, 400, { status: "error", message: "Discord ID veya kullanıcı adı gerekli." });
  }

  const cached = await getJson(cacheKey(query)).catch(() => null);
  if (cached) {
    return sendJson(res, 200, { status: "ready", source: "cache", data: cached });
  }

  const errors = [];

  // 1. Try DCSV first
  try {
    const d = await fetchDcsvUser(query);
    const profile = normalizeDcsv(d);
    await setJson(cacheKey(query), profile, CACHE_TTL).catch(() => {});
    return sendJson(res, 200, { status: "ready", source: "dcsv", data: profile });
  } catch (err) {
    errors.push(`DCSV: ${err.message}`);
  }

  // 2. Fallback: Findcord (ID only)
  const isId = /^\d{15,20}$/.test(query);
  if (isId) {
    try {
      const fc = await fetchFindcordById(query);
      const profile = normalizeFindcord(fc);
      await setJson(cacheKey(query), profile, CACHE_TTL).catch(() => {});
      return sendJson(res, 200, { status: "ready", source: "findcord", data: profile });
    } catch (err) {
      errors.push(`Findcord: ${err.message}`);
    }
  }

  return sendJson(res, 502, { status: "error", message: `Profil alınamadı. ${errors.join(" | ")}` });
};
