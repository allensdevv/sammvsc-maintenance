const { getJson, setJson } = require("../../lib/cache");

const FINDCORD_KEY = process.env.FINDCORD_API_KEY || "331b483f722e9077c40365f97fd5b5f28ea25456f7af610a1826dd4eadc96b4d";
const DCSV_KEY = process.env.DCSV_API_KEY || "dcsv_ca6ca829a717d342d2a5e2a48fed0fcef33f1ab3098a1a9a";
const CACHE_TTL = 60 * 30; // 30 minutes

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

async function fetchFindcord(query) {
  const res = await fetch(`https://app.findcord.com/api/user/${encodeURIComponent(query)}`, {
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

// Findcord username search endpoint
async function searchFindcordByUsername(username) {
  const res = await fetch(`https://app.findcord.com/api/search?q=${encodeURIComponent(username)}&type=user`, {
    headers: {
      "Authorization": FINDCORD_KEY,
      "Accept": "application/json"
    }
  });
  if (!res.ok) return null;
  const data = await res.json();
  // Search returns array or { results: [...] }
  const results = Array.isArray(data) ? data : (data.results || data.users || []);
  if (!results.length) return null;
  // Return the first matching result
  const match = results.find(u =>
    (u.username || "").toLowerCase() === username.toLowerCase() ||
    (u.global_name || "").toLowerCase() === username.toLowerCase()
  ) || results[0];
  return match;
}

async function fetchDcsv(userId) {
  try {
    const res = await fetch(`https://api.dcsv.me/v1/user/${encodeURIComponent(userId)}`, {
      headers: {
        "Authorization": DCSV_KEY,
        "Accept": "application/json"
      }
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

function normalizeProfile(fc, dcsv) {
  const avatarHash = fc.avatar || null;
  const bannerHash = fc.banner || fc.banner_hash || null;
  const uid = fc.id || fc.user_id || "";

  const avatarUrl = avatarHash
    ? `https://cdn.discordapp.com/avatars/${uid}/${avatarHash}.${avatarHash.startsWith("a_") ? "gif" : "png"}?size=256`
    : null;
  const bannerUrl = bannerHash
    ? `https://cdn.discordapp.com/banners/${uid}/${bannerHash}.${bannerHash.startsWith("a_") ? "gif" : "png"}?size=512`
    : null;

  // Parse creation date from snowflake ID
  let createdAt = null;
  try {
    const ts = (BigInt(uid) >> 22n) + 1420070400000n;
    createdAt = new Date(Number(ts)).toISOString();
  } catch {}

  return {
    id: uid,
    username: fc.username || "",
    global_name: fc.global_name || fc.display_name || fc.username || "",
    avatar_url: avatarUrl,
    banner_url: bannerUrl,
    accent_color: fc.accent_color || null,
    status: fc.status || "offline",
    public_flags: fc.public_flags || 0,
    premium_type: fc.premium_type || 0,
    badges: fc.badges || [],
    created_at: createdAt,
    // DCSV enriched fields
    age: dcsv?.age || null,
    gender: dcsv?.gender || null,
    bio: fc.bio || fc.about_me || dcsv?.bio || null,
    custom_status: fc.custom_status || dcsv?.custom_status || null,
    other_names: dcsv?.other_names || fc.previous_usernames || [],
    // Stats
    server_count: fc.mutual_guilds?.length ?? fc.guild_count ?? dcsv?.server_count ?? null,
    voice_friend_count: fc.voice_friends?.length ?? dcsv?.voice_friend_count ?? null,
    punishment_count: fc.punishments?.length ?? dcsv?.punishment_count ?? null,
    // Arrays
    servers: fc.mutual_guilds || fc.guilds || [],
    activity: fc.activity || fc.activities || null,
    punishments: fc.punishments || dcsv?.punishments || [],
    admin_servers: fc.admin_guilds || fc.managed_guilds || [],
    voice_friends: fc.voice_friends || dcsv?.voice_friends || [],
    voice_history: fc.voice_history || [],
    message_history: fc.message_history || [],
    message_friends: fc.message_friends || fc.friends || dcsv?.message_friends || []
  };
}

module.exports = async (req, res) => {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.end();
    return;
  }

  // Accept both ?id= (numeric) and ?u= / ?username= (text)
  const numericId = ((req.query.id || "")).trim().replace(/\D/g, "").slice(0, 20);
  const usernameQuery = ((req.query.u || req.query.username || "")).trim().slice(0, 50);
  const query = numericId || usernameQuery;

  if (!query) {
    return sendJson(res, 400, { status: "error", message: "Discord ID veya kullanıcı adı gerekli." });
  }

  const isId = /^\d{15,20}$/.test(query);

  // Check cache
  const cached = await getJson(cacheKey(query)).catch(() => null);
  if (cached) {
    return sendJson(res, 200, { status: "ready", source: "cache", data: cached });
  }

  try {
    let fc;

    if (isId) {
      // Numeric ID → fetch directly
      fc = await fetchFindcord(query);
    } else {
      // Username → try direct endpoint first, then search
      let directError = null;
      try {
        fc = await fetchFindcord(query);
      } catch (err) {
        directError = err.message;
        // Try search endpoint
        const searchResult = await searchFindcordByUsername(query);
        if (!searchResult) {
          return sendJson(res, 404, { status: "error", message: `"${query}" kullanıcı adı bulunamadı. API hatası: ${directError}` });
        }
        // If search returns a full profile, use it; otherwise fetch by ID
        if (searchResult.username && searchResult.id) {
          fc = searchResult;
          // If we only got basic info, fetch full profile by ID
          if (!searchResult.mutual_guilds && !searchResult.punishments) {
            try { fc = await fetchFindcord(searchResult.id); } catch { fc = searchResult; }
          }
        } else {
          return sendJson(res, 404, { status: "error", message: `"${query}" kullanıcı adı bulunamadı. API hatası: ${directError}` });
        }
      }
    }

    const uid = fc.id || fc.user_id || query;
    const dcsv = await fetchDcsv(uid).catch(() => null);

    const profile = normalizeProfile(fc, dcsv);
    await setJson(cacheKey(query), profile, CACHE_TTL).catch(() => {});
    return sendJson(res, 200, { status: "ready", source: "live", data: profile });
  } catch (err) {
    // Return the real error message for debugging
    const msg = err.message || "Bilinmeyen hata";
    return sendJson(res, 502, { status: "error", message: `Profil alınamadı: ${msg}` });
  }
};
