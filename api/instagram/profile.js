const {
  acquireLock,
  getJson,
  releaseLock,
  setJson,
  sleep
} = require("../../lib/cache");
const { fetchPrivateProfile, normalizeUsername } = require("../../lib/instagramPrivateApi");

const PROFILE_TTL_SECONDS = Number(process.env.INSTAGRAM_PROFILE_TTL_SECONDS || 60 * 60 * 6);
const STALE_PROFILE_TTL_SECONDS = Number(process.env.INSTAGRAM_PROFILE_STALE_TTL_SECONDS || 60 * 60 * 24 * 7);
const LOCK_TTL_SECONDS = Number(process.env.INSTAGRAM_PROFILE_LOCK_TTL_SECONDS || 45);
const USER_MESSAGE = "Profil bilgileri \u015fu an al\u0131nam\u0131yor. L\u00fctfen sonra tekrar deneyin.";

function profileKey(username) {
  return `ig:profile:${username.toLowerCase()}`;
}

function staleProfileKey(username) {
  return `ig:profile:stale:${username.toLowerCase()}`;
}

function lockKey(username) {
  return `ig:lock:${username.toLowerCase()}`;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Sammvsc-Api", "instagram-private-profile");
  response.end(JSON.stringify(payload));
}

function tookMs(startedAt) {
  return Date.now() - startedAt;
}

function makeRecord(data, cachedAt = new Date().toISOString()) {
  return { cachedAt, data };
}

function unwrapRecord(record) {
  if (!record) return null;
  if (record.data) return record;
  return makeRecord(record, null);
}

function ready(source, record, startedAt) {
  const normalized = unwrapRecord(record);
  return {
    status: "ready",
    source,
    tookMs: tookMs(startedAt),
    cachedAt: normalized?.cachedAt || null,
    data: normalized?.data || null
  };
}

function pick(source, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return 0;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return false;
  if (typeof value === "string") return value.toLowerCase() === "true";
  return Boolean(value);
}

function normalizeApifyProfile(raw, requestedUsername) {
  if (!raw || typeof raw !== "object") return null;

  const username = pick(raw, ["username", "user.username"]) || requestedUsername;
  return {
    username,
    fullName: pick(raw, ["fullName", "full_name", "name", "user.full_name"]) || username,
    biography: pick(raw, ["biography", "bio", "user.biography"]) || "",
    profilePicUrl: pick(raw, [
      "profilePicUrlHD",
      "profilePicUrl",
      "profile_pic_url_hd",
      "profile_pic_url",
      "profile_picture_url",
      "user.profile_pic_url"
    ]) || "",
    followers: toNumber(pick(raw, ["followersCount", "followers", "follower_count", "followers_count"])),
    following: toNumber(pick(raw, ["followsCount", "following", "following_count", "follows_count"])),
    posts: toNumber(pick(raw, ["postsCount", "mediaCount", "media_count", "posts"])),
    isPrivate: toBoolean(pick(raw, ["private", "isPrivate", "is_private"])),
    isVerified: toBoolean(pick(raw, ["verified", "isVerified", "is_verified"]))
  };
}

async function fetchApifyFallbackProfile(username) {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR || "apify/instagram-profile-scraper";

  if (!token) {
    const error = new Error("missing_APIFY_TOKEN");
    error.code = "missing_apify_token";
    throw error;
  }

  const actorId = actor.replace("/", "~");
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${encodeURIComponent(token)}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify({
      usernames: [username],
      resultsLimit: 1
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error("apify_fallback_failed");
    error.code = "apify_fallback_failed";
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  const first = Array.isArray(payload) ? payload[0] : payload;
  const profile = normalizeApifyProfile(first, username);
  if (!profile) {
    const error = new Error("apify_parse_failed");
    error.code = "apify_parse_failed";
    throw error;
  }

  return profile;
}

async function writeProfileCache(username, data) {
  const record = makeRecord(data);
  await Promise.all([
    setJson(profileKey(username), record, PROFILE_TTL_SECONDS),
    setJson(staleProfileKey(username), record, STALE_PROFILE_TTL_SECONDS)
  ]);
  return record;
}

function errorStatus(error) {
  if (error?.code === "missing_credentials") return 500;
  if (error?.code === "login_cooldown" || error?.code === "login_in_progress") return 429;
  if (error?.code === "missing_username") return 400;
  return 502;
}

module.exports = async function handler(request, response) {
  const startedAt = Date.now();

  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method !== "GET") {
    return sendJson(response, 405, { status: "error", error: "method_not_allowed" });
  }

  const username = normalizeUsername(request.query?.username);
  if (!username) {
    return sendJson(response, 400, {
      status: "error",
      error: "missing_username",
      message: "Kullan\u0131c\u0131 ad\u0131 gerekli."
    });
  }

  const key = profileKey(username);
  const cached = unwrapRecord(await getJson(key));
  if (cached) {
    return sendJson(response, 200, ready("cache", cached, startedAt));
  }

  const locked = await acquireLock(lockKey(username), LOCK_TTL_SECONDS);
  if (!locked) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await sleep(900);
      const refreshed = unwrapRecord(await getJson(key));
      if (refreshed) {
        return sendJson(response, 200, ready("cache", refreshed, startedAt));
      }
    }

    return sendJson(response, 202, {
      status: "loading",
      source: "live",
      tookMs: tookMs(startedAt),
      cachedAt: null,
      message: "Profil bilgileri haz\u0131rlan\u0131yor."
    });
  }

  try {
    const profile = await fetchPrivateProfile(username);
    const record = await writeProfileCache(username, profile);
    return sendJson(response, 200, ready("live", record, startedAt));
  } catch (error) {
    console.log("[instagram-private-profile] failed", {
      code: error?.code,
      name: error?.name,
      message: error?.message
    });

    const stale = unwrapRecord(await getJson(staleProfileKey(username)));
    if (stale) {
      return sendJson(response, 200, ready("stale", stale, startedAt));
    }

    try {
      const apifyProfile = await fetchApifyFallbackProfile(username);
      const record = await writeProfileCache(username, apifyProfile);
      return sendJson(response, 200, ready("apify", record, startedAt));
    } catch (apifyError) {
      console.log("[instagram-private-profile] apify_fallback_failed", {
        code: apifyError?.code,
        status: apifyError?.status,
        message: apifyError?.message
      });
    }

    return sendJson(response, errorStatus(error), {
      status: "error",
      source: "live",
      tookMs: tookMs(startedAt),
      cachedAt: null,
      error: error?.code || "instagram_private_api_failed",
      message: USER_MESSAGE
    });
  } finally {
    await releaseLock(lockKey(username));
  }
};
