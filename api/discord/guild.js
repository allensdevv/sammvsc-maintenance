const { getJson, setJson } = require("../../lib/cache");

const CACHE_TTL_SECONDS = Number(process.env.DISCORD_GUILD_CACHE_TTL_SECONDS || 600);

function sendJson(response, status, payload, cacheControl = "no-store") {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Sammvsc-Api", "discord-guild");
  response.end(JSON.stringify(payload));
}

function cleanGuildId(value) {
  const raw = String(value || "").trim();
  return /^\d{16,24}$/.test(raw) ? raw : "";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function assetUrl(kind, guildId, hash, size) {
  if (!guildId || !hash) return null;
  const extension = String(hash).startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/${kind}/${guildId}/${hash}.${extension}?size=${size}`;
}

function normalizeGuild(id, payload) {
  const guildId = String(payload?.id || id);
  const bannerHash = payload?.banner || payload?.splash || payload?.discovery_splash;

  return {
    id: guildId,
    name: payload?.name || null,
    icon_hash: payload?.icon || null,
    banner_hash: bannerHash || null,
    icon_url: assetUrl("icons", guildId, payload?.icon, 128),
    banner_url: payload?.banner
      ? assetUrl("banners", guildId, payload.banner, 1024)
      : assetUrl("splashes", guildId, payload?.splash || payload?.discovery_splash, 1024),
    member_count: toNumber(payload?.approximate_member_count),
    online_count: toNumber(payload?.approximate_presence_count),
    fetched_at: new Date().toISOString()
  };
}

async function fetchGuildPreview(id) {
  const endpoint = `https://discord.com/api/v10/guilds/${encodeURIComponent(id)}/preview`;
  const response = await fetch(endpoint, {
    headers: {
      Accept: "application/json",
      "User-Agent": "sammvsc/1.0"
    }
  });

  const text = await response.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text.slice(0, 240) };
  }

  if (!response.ok) {
    const error = new Error(payload?.message || `Discord guild preview failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return normalizeGuild(id, payload);
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method !== "GET") {
    return sendJson(response, 405, { status: "error", error: "method_not_allowed" });
  }

  const id = cleanGuildId(request.query?.id);
  if (!id) {
    return sendJson(response, 400, {
      status: "error",
      error: "missing_guild_id",
      message: "Discord sunucu ID gerekli."
    });
  }

  const startedAt = Date.now();
  const cacheKey = `discord:guild:${id}`;
  const cached = await getJson(cacheKey).catch(() => null);

  if (cached && request.query?.refresh !== "1") {
    return sendJson(response, 200, {
      status: "ready",
      source: "cache",
      tookMs: Date.now() - startedAt,
      data: cached
    }, "s-maxage=300, stale-while-revalidate=900");
  }

  try {
    const data = await fetchGuildPreview(id);
    await setJson(cacheKey, data, CACHE_TTL_SECONDS).catch(() => null);

    return sendJson(response, 200, {
      status: "ready",
      source: "live",
      tookMs: Date.now() - startedAt,
      data
    }, "s-maxage=300, stale-while-revalidate=900");
  } catch (error) {
    if (cached) {
      return sendJson(response, 200, {
        status: "ready",
        source: "stale",
        tookMs: Date.now() - startedAt,
        data: cached,
        warning: "Discord guild verisi yenilenemedi, son cache kullanildi."
      });
    }

    return sendJson(response, error.status || 502, {
      status: "error",
      source: "discord",
      tookMs: Date.now() - startedAt,
      error: "discord_guild_failed",
      message: "Sunucu bilgileri su an alinamiyor."
    });
  }
};
