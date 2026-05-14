const { getJson, setJson } = require("../../lib/cache");

const DEFAULT_INVITE_CODE = process.env.SPONSOR_DISCORD_INVITE_CODE || "7TaeVxPU";
const CACHE_TTL_SECONDS = Number(process.env.DISCORD_INVITE_CACHE_TTL_SECONDS || 120);

function sendJson(response, status, payload, cacheControl = "no-store") {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", cacheControl);
  response.setHeader("X-Sammvsc-Api", "discord-invite");
  response.end(JSON.stringify(payload));
}

function cleanInviteCode(value) {
  const raw = String(value || DEFAULT_INVITE_CODE).trim();
  const match = raw.match(/(?:discord\.gg\/|discord(?:app)?\.com\/invite\/)?([a-zA-Z0-9-]{2,64})/);
  return match ? match[1] : "";
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function guildIconUrl(guild, profile) {
  const guildId = guild?.id || profile?.id;
  const iconHash = guild?.icon || profile?.icon_hash;
  if (!guildId || !iconHash) return null;
  const extension = iconHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/icons/${guildId}/${iconHash}.${extension}?size=128`;
}

function guildBannerUrl(guild, profile) {
  const guildId = guild?.id || profile?.id;
  const bannerHash = guild?.banner || profile?.banner_hash || profile?.custom_banner_hash || guild?.splash;
  if (!guildId || !bannerHash) return null;
  const extension = bannerHash.startsWith("a_") ? "gif" : "png";
  return `https://cdn.discordapp.com/banners/${guildId}/${bannerHash}.${extension}?size=512`;
}

function normalizeInvite(code, payload) {
  const guild = payload?.guild || {};
  const profile = payload?.profile || {};
  const name = profile.name || guild.name || "Sponsor Sunucu";

  return {
    code,
    invite_url: `https://discord.gg/${code}`,
    name,
    online_count: toNumber(payload?.approximate_presence_count ?? profile.online_count),
    member_count: toNumber(payload?.approximate_member_count ?? profile.member_count),
    boost_count: toNumber(profile.premium_subscription_count ?? guild.premium_subscription_count),
    premium_tier: toNumber(profile.premium_tier ?? guild.premium_tier),
    icon_url: guildIconUrl(guild, profile),
    banner_url: guildBannerUrl(guild, profile),
    fetched_at: new Date().toISOString()
  };
}

async function fetchInvite(code) {
  const endpoint = `https://discord.com/api/v10/invites/${encodeURIComponent(code)}?with_counts=true&with_expiration=true`;
  const response = await fetch(endpoint, {
    headers: {
      "Accept": "application/json",
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
    const error = new Error(payload?.message || `Discord invite API failed with ${response.status}`);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return normalizeInvite(code, payload);
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method !== "GET") {
    return sendJson(response, 405, { status: "error", error: "method_not_allowed" });
  }

  const code = cleanInviteCode(request.query?.code);
  if (!code) {
    return sendJson(response, 400, {
      status: "error",
      error: "missing_invite_code",
      message: "Discord davet kodu gerekli."
    });
  }

  const startedAt = Date.now();
  const cacheKey = `discord:invite:${code}`;
  const cached = await getJson(cacheKey).catch(() => null);

  if (cached && request.query?.refresh !== "1") {
    return sendJson(response, 200, {
      status: "ready",
      source: "cache",
      tookMs: Date.now() - startedAt,
      data: cached
    }, "s-maxage=60, stale-while-revalidate=300");
  }

  try {
    const data = await fetchInvite(code);
    await setJson(cacheKey, data, CACHE_TTL_SECONDS).catch(() => null);

    return sendJson(response, 200, {
      status: "ready",
      source: "live",
      tookMs: Date.now() - startedAt,
      data
    }, "s-maxage=60, stale-while-revalidate=300");
  } catch (error) {
    if (cached) {
      return sendJson(response, 200, {
        status: "ready",
        source: "stale",
        tookMs: Date.now() - startedAt,
        data: cached,
        warning: "Discord verisi yenilenemedi, son cache kullanildi."
      });
    }

    return sendJson(response, error.status || 502, {
      status: "error",
      source: "discord",
      tookMs: Date.now() - startedAt,
      error: "discord_invite_failed",
      message: "Sponsor sunucu bilgileri su an alinamiyor."
    });
  }
};
