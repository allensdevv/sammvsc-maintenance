const { getJson, setJson } = require("../../lib/cache");
const { getSession } = require("../../lib/session");

const FINDCORD_KEY = process.env.FINDCORD_API_KEY || "331b483f722e9077c40365f97fd5b5f28ea25456f7af610a1826dd4eadc96b4d";
const DCSV_KEY = process.env.DCSV_API_KEY || "dcsv_ca6ca829a717d342d2a5e2a48fed0fcef33f1ab3098a1a9a";
const DCSV_API_BASE = "https://dcsv.me/api/v1/user";
const DCSV_PUBLIC_BASE = "https://dcsv.me/users";
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
  const token = DCSV_KEY.startsWith("Bearer ") ? DCSV_KEY : `Bearer ${DCSV_KEY}`;
  const res = await fetch(`${DCSV_API_BASE}/${encodeURIComponent(query)}`, {
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
  const res = await fetch(`${DCSV_PUBLIC_BASE}/${encodeURIComponent(query)}`, {
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
    public_flags: d.public_flags || 0,
    premium_type: d.premium_type || (d.is_premium ? 2 : 0),
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

  const cached = await getJson(cacheKey(query)).catch(() => null);
  if (cached) {
    return sendJson(res, 200, { status: "ready", source: "cache", data: cached });
  }

  const errors = [];

  const isId = /^\d{15,20}$/.test(query);

  // 1. Try DCSV first. Username searches are resolved from the public profile
  // page because the API endpoint is ID-only and returns 500 for usernames.
  try {
    let d;

    if (isId) {
      const apiProfile = await fetchDcsvUser(query);
      const publicProfile = await fetchDcsvPublicProfile(query).catch((err) => {
        errors.push(`DCSV public: ${err.message}`);
        return null;
      });
      d = { ...apiProfile, ...(publicProfile || {}), id: query };
    } else {
      const publicProfile = await fetchDcsvPublicProfile(query);
      let apiProfile = null;

      if (publicProfile.id) {
        apiProfile = await fetchDcsvUser(publicProfile.id).catch((err) => {
          errors.push(`DCSV API: ${err.message}`);
          return null;
        });
      }

      d = { ...(apiProfile || {}), ...publicProfile, id: publicProfile.id || apiProfile?.id };
    }

    const profile = normalizeDcsv(d);
    await setJson(cacheKey(query), profile, CACHE_TTL).catch(() => {});
    return sendJson(res, 200, { status: "ready", source: "dcsv", data: profile });
  } catch (err) {
    errors.push(`DCSV: ${err.message}`);
  }

  // 2. Fallback: Findcord (ID only)
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
