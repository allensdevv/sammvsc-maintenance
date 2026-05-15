const { getJson, setJson } = require("../../lib/cache");

const CACHE_TTL_SECONDS = Number(process.env.FINDCORD_LEADERBOARD_CACHE_TTL_SECONDS || 5);
const FETCH_TIMEOUT_MS = Number(process.env.FINDCORD_LEADERBOARD_TIMEOUT_MS || 8000);

function sendJson(response, status, payload, cacheControl = "no-store") {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Sammvsc-Api", "discord-leaderboard");
  response.end(JSON.stringify(payload));
}

function toNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const normalized = value.replace(/\./g, "").replace(/,/g, "").trim();
    const number = Number(normalized);
    return Number.isFinite(number) ? number : 0;
  }
  return 0;
}

function firstValue(...values) {
  return values.find(value => value !== undefined && value !== null && String(value).trim() !== "");
}

function cleanBase(value) {
  return String(value || "").trim().replace(/\/+$/, "");
}

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function endpointCandidates() {
  const explicit = String(process.env.FINDCORD_LEADERBOARD_URL || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);
  const hasFindcordKey = Boolean(String(process.env.FINDCORD_API_KEY || process.env.FINDCORD_LEADERBOARD_API_KEY || "").trim());
  const allowPublicFindcord = process.env.FINDCORD_ALLOW_PUBLIC_LEADERBOARD === "1";

  const bases = unique([
    process.env.FINDCORD_API_BASE,
    hasFindcordKey ? "https://app.findcord.com" : "",
    allowPublicFindcord ? "https://findcord.com" : "",
    allowPublicFindcord ? "https://api.findcord.com" : ""
  ].map(cleanBase));

  const derived = [];
  for (const base of bases) {
    derived.push(`${base}/api/leaderboard`);
    derived.push(`${base}/leaderboard`);
  }

  return unique([...explicit, ...derived]);
}

function findcordAuthHeaders() {
  const key = String(process.env.FINDCORD_API_KEY || process.env.FINDCORD_LEADERBOARD_API_KEY || "").trim();
  if (!key) return {};
  return {
    Authorization: key,
    "X-API-Key": key
  };
}

function absoluteUrl(value, sourceUrl) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("//")) return `https:${raw}`;

  try {
    return new URL(raw, sourceUrl).toString();
  } catch {
    return raw;
  }
}

function discordAssetUrl(kind, guildId, hash, size) {
  const id = String(guildId || "").trim();
  const assetHash = String(hash || "").trim();
  if (!id || !assetHash) return null;
  const extension = assetHash.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/${kind}/${id}/${assetHash}.${extension}?size=${size}`;
}

function assetCandidate(kind, guildId, value, size) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw) || raw.startsWith("/") || raw.startsWith("//")) return raw;
  return discordAssetUrl(kind, guildId, raw, size);
}

function normalizeServer(item, index, sourceUrl) {
  const guildId = String(firstValue(
    item.id,
    item.guildId,
    item.guild_id,
    item.GuildID,
    item.serverId,
    item.server_id
  ) || "").trim();

  const name = String(firstValue(
    item.name,
    item.guildName,
    item.guild_name,
    item.GuildName,
    item.serverName,
    item.server_name
  ) || `Sunucu ${index + 1}`).trim();

  const iconHash = firstValue(item.iconHash, item.icon_hash, item.icon, item.guildIconHash);
  const bannerHash = firstValue(item.bannerHash, item.banner_hash, item.banner, item.guildBannerHash);
  const iconUrl = firstValue(
    item.icon_url,
    item.iconUrl,
    item.avatar,
    item.avatar_url,
    item.guildIcon,
    item.GuildIcon,
    assetCandidate("icons", guildId, iconHash, 128)
  );
  const bannerUrl = firstValue(
    item.banner_url,
    item.bannerUrl,
    item.banner,
    item.background,
    item.guildBanner,
    item.GuildBanner,
    assetCandidate("banners", guildId, bannerHash, 1024)
  );

  return {
    id: guildId || String(firstValue(item.key, item.slug, name, index)),
    guildId,
    name,
    icon: String(firstValue(item.shortName, item.iconText, name.replace(/[^\p{L}\p{N}]+/gu, " ").trim().split(/\s+/).map(part => part[0]).join("").slice(0, 2), "DC")).toUpperCase(),
    icon_url: absoluteUrl(iconUrl, sourceUrl),
    banner_url: absoluteUrl(bannerUrl, sourceUrl),
    members: toNumber(firstValue(item.members, item.memberCount, item.member_count, item.Members, item.Users)),
    boosts: toNumber(firstValue(item.boosts, item.boostCount, item.boost_count, item.Boosts, item.Boost)),
    totalVoice: toNumber(firstValue(item.totalVoice, item.TotalVoice, item.total_voice)),
    realVoice: toNumber(firstValue(item.realVoice, item.RealVoiceCount, item.real_voice, item.actualVoice)),
    voice: toNumber(firstValue(item.voice, item.voiceCount, item.voice_count, item.Voice)),
    muted: toNumber(firstValue(item.muted, item.afkCount, item.mutedCount, item.afk_count, item.Muted)),
    bots: toNumber(firstValue(item.bots, item.tokenCount, item.botCount, item.token_count, item.Bots)),
    stream: toNumber(firstValue(item.stream, item.streamCount, item.stream_count, item.Stream)),
    camera: toNumber(firstValue(item.camera, item.cameraCount, item.camera_count, item.Camera)),
    source_rank: toNumber(firstValue(item.rank, item.position, index + 1)) || index + 1
  };
}

function unwrapServers(payload) {
  const candidates = [
    payload?.data?.servers,
    payload?.data?.items,
    payload?.data,
    payload?.servers,
    payload?.items,
    payload?.leaderboard,
    payload
  ];

  return candidates.find(Array.isArray) || [];
}

function getSetCookie(headers) {
  if (typeof headers.getSetCookie === "function") {
    return headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
  }

  const raw = headers.get("set-cookie");
  if (!raw) return "";
  return raw
    .split(/,(?=\s*[^;,]+=)/)
    .map(value => value.split(";")[0].trim())
    .filter(Boolean)
    .join("; ");
}

async function fetchText(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent": "sammvsc/1.0",
        ...options.headers
      }
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 260) };
  }
}

function csrfTokenFromPayload(payload) {
  return firstValue(
    payload?.token,
    payload?.csrfToken,
    payload?.csrf,
    payload?.data?.token,
    payload?.data?.csrfToken
  );
}

async function fetchCsrfContext(endpoint) {
  const origin = new URL(endpoint).origin;
  const csrfUrls = [`${origin}/api/csrf-token`, `${origin}/csrf-token`];

  for (const url of csrfUrls) {
    try {
      const response = await fetchText(url, {
        headers: {
          "X-Requested-With": "XMLHttpRequest",
          Referer: `${origin}/leaderboard`,
          ...findcordAuthHeaders()
        }
      });
      if (!response.ok) continue;

      const payload = await parseJsonResponse(response);
      const token = csrfTokenFromPayload(payload);
      if (token) {
        return {
          origin,
          token,
          cookie: getSetCookie(response.headers)
        };
      }
    } catch {
      // Try the next CSRF endpoint.
    }
  }

  return { origin, token: "", cookie: "" };
}

async function fetchLeaderboardEndpoint(endpoint) {
  const direct = await fetchText(endpoint, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      Referer: `${new URL(endpoint).origin}/leaderboard`,
      ...findcordAuthHeaders()
    }
  });

  if (![401, 403, 419].includes(direct.status)) {
    const payload = await parseJsonResponse(direct);
    if (!direct.ok) {
      const error = new Error(payload?.error || payload?.message || `Leaderboard failed with ${direct.status}`);
      error.status = direct.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  }

  const csrf = await fetchCsrfContext(endpoint);
  if (!csrf.token) {
    const payload = await parseJsonResponse(direct);
    const error = new Error(payload?.error || payload?.message || `Leaderboard forbidden with ${direct.status}`);
    error.status = direct.status;
    error.payload = payload;
    throw error;
  }

  const withCsrf = await fetchText(endpoint, {
    headers: {
      "X-Requested-With": "XMLHttpRequest",
      "X-CSRF-Token": csrf.token,
      "X-CSRFToken": csrf.token,
      Origin: csrf.origin,
      Referer: `${csrf.origin}/leaderboard`,
      ...findcordAuthHeaders(),
      ...(csrf.cookie ? { Cookie: csrf.cookie } : {})
    }
  });
  const payload = await parseJsonResponse(withCsrf);

  if (!withCsrf.ok) {
    const error = new Error(payload?.error || payload?.message || `Leaderboard failed with ${withCsrf.status}`);
    error.status = withCsrf.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

async function fetchLiveLeaderboard() {
  const errors = [];
  const endpoints = endpointCandidates();

  if (!endpoints.length) {
    const error = new Error("Findcord leaderboard icin FINDCORD_API_KEY veya FINDCORD_LEADERBOARD_URL gerekli.");
    error.details = ["app.findcord.com/api/leaderboard Authorization header istiyor."];
    throw error;
  }

  for (const endpoint of endpoints) {
    try {
      const payload = await fetchLeaderboardEndpoint(endpoint);
      const servers = unwrapServers(payload)
        .map((server, index) => normalizeServer(server, index, endpoint))
        .filter(server => server.name && (server.guildId || server.id));

      if (servers.length) {
        return {
          endpoint,
          servers,
          count: servers.length,
          fetched_at: new Date().toISOString()
        };
      }

      errors.push(`${endpoint}: empty`);
    } catch (error) {
      errors.push(`${endpoint}: ${error.message}`);
    }
  }

  const error = new Error("Findcord leaderboard kaynaklarindan veri alinamadi.");
  error.details = errors.slice(0, 4);
  throw error;
}

function metricFromQuery(value) {
  const metric = String(value || "realVoice");
  return ["realVoice", "totalVoice", "voice", "members", "boosts", "camera", "stream"].includes(metric)
    ? metric
    : "realVoice";
}

function sortServers(servers, metric) {
  return [...servers].sort((a, b) => {
    const delta = toNumber(b[metric]) - toNumber(a[metric]);
    if (delta !== 0) return delta;
    return toNumber(a.source_rank) - toNumber(b.source_rank);
  });
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method !== "GET") {
    return sendJson(response, 405, { status: "error", error: "method_not_allowed" });
  }

  const startedAt = Date.now();
  const metric = metricFromQuery(request.query?.metric);
  const cacheKey = "discord:leaderboard:findcord:v2";
  const cached = await getJson(cacheKey).catch(() => null);

  if (cached && request.query?.refresh !== "1") {
    return sendJson(response, 200, {
      status: "ready",
      source: "cache",
      tookMs: Date.now() - startedAt,
      data: {
        ...cached,
        servers: sortServers(cached.servers || [], metric)
      }
    }, "s-maxage=5, stale-while-revalidate=30");
  }

  try {
    const data = await fetchLiveLeaderboard();
    await setJson(cacheKey, data, CACHE_TTL_SECONDS).catch(() => null);

    return sendJson(response, 200, {
      status: "ready",
      source: "live",
      tookMs: Date.now() - startedAt,
      data: {
        ...data,
        servers: sortServers(data.servers, metric)
      }
    }, "s-maxage=5, stale-while-revalidate=30");
  } catch (error) {
    if (cached?.servers?.length) {
      return sendJson(response, 200, {
        status: "ready",
        source: "stale",
        tookMs: Date.now() - startedAt,
        data: {
          ...cached,
          servers: sortServers(cached.servers || [], metric)
        },
        warning: "Canli leaderboard yenilenemedi, son cache kullanildi."
      });
    }

    return sendJson(response, 502, {
      status: "error",
      source: "findcord",
      tookMs: Date.now() - startedAt,
      error: "leaderboard_fetch_failed",
      message: "Sunucu siralamasi su an alinamiyor.",
      details: error.details || [error.message]
    });
  }
};
