const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v20.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;
const PUBLIC_PROFILE_URL = "https://i.instagram.com/api/v1/users/web_profile_info/";
const USER_MESSAGE = "Profil bilgileri \u015fu an al\u0131nam\u0131yor. L\u00fctfen sonra tekrar deneyin.";

function sanitizeUsername(value = "") {
  return String(value).trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 30);
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Sammvsc-Api", "instagram");
  response.end(JSON.stringify(payload));
}

function providerError(status = 502, details = null) {
  return {
    status,
    payload: {
      error: "instagram_provider_failed",
      message: USER_MESSAGE,
      details
    }
  };
}

function pick(source, keys) {
  for (const key of keys) {
    const value = key.split(".").reduce((obj, part) => obj?.[part], source);
    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }
  return null;
}

function toNumber(value) {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return value;
  const parsed = Number(String(value).replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return Boolean(value);
}

function getRawKeys(value) {
  if (!value || typeof value !== "object") return [];
  return Object.keys(value).slice(0, 30);
}

function parseMaybeJson(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

function hasProfileSignal(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(
    pick(value, [
      "username",
      "user_name",
      "full_name",
      "fullName",
      "biography",
      "bio",
      "profile_pic_url",
      "profilePicUrl",
      "profilePictureUrl",
      "follower_count",
      "followers_count",
      "followersCount",
      "edge_followed_by.count"
    ])
  );
}

function findProfileCandidate(value, depth = 0) {
  const parsed = parseMaybeJson(value);
  if (!parsed || typeof parsed !== "object" || depth > 5) return null;
  if (Array.isArray(parsed)) {
    for (const item of parsed) {
      const found = findProfileCandidate(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (hasProfileSignal(parsed)) return parsed;

  const preferredKeys = [
    "user_data",
    "userData",
    "basic_user",
    "basicUser",
    "profile",
    "user",
    "owner",
    "account",
    "data",
    "result",
    "response",
    "graphql"
  ];

  for (const key of preferredKeys) {
    const found = findProfileCandidate(parsed[key], depth + 1);
    if (found) return found;
  }

  for (const key of Object.keys(parsed)) {
    const found = findProfileCandidate(parsed[key], depth + 1);
    if (found) return found;
  }
  return null;
}

function normalizeProfile(raw, username, source) {
  const candidate = Array.isArray(raw) ? raw[0] : raw;
  const data = findProfileCandidate(candidate) || candidate?.data?.user || candidate?.data || candidate?.user || candidate?.result || candidate?.profile || candidate;
  if (!data || typeof data !== "object") {
    return null;
  }

  const pictureUrl = pick(data, [
    "profile_pic_url_hd",
    "profile_pic_url",
    "profilePicUrlHD",
    "profilePicUrl",
    "profilePictureUrl",
    "profile_picture",
    "profilePicture",
    "hd_profile_pic_url_info.url",
    "hdProfilePicUrlInfo.url",
    "avatar",
    "image"
  ]) || "";
  const followerCount = toNumber(pick(data, [
    "follower_count",
    "followers_count",
    "followersCount",
    "followers",
    "edge_followed_by.count",
    "followerCount"
  ]));
  const followingCount = toNumber(pick(data, [
    "following_count",
    "follows_count",
    "followingCount",
    "followsCount",
    "following",
    "edge_follow.count",
    "followingCount"
  ]));

  const normalized = {
    source,
    connected: true,
    username: pick(data, ["username", "user_name", "account", "handle", "instagram_username"]) || username,
    full_name: pick(data, ["full_name", "fullName", "name", "display_name", "displayName"]) || "",
    name: pick(data, ["full_name", "fullName", "name", "display_name", "displayName", "username"]) || username,
    profile_pic_url: pictureUrl,
    profile_picture_url: pictureUrl,
    follower_count: followerCount,
    following_count: followingCount,
    followers_count: followerCount,
    follows_count: followingCount,
    media_count: toNumber(pick(data, ["media_count", "posts_count", "mediaCount", "postsCount", "posts", "edge_owner_to_timeline_media.count", "post_count"])),
    biography: pick(data, ["biography", "bio", "description", "biography_with_entities.raw_text"]) || "",
    is_private: toBoolean(pick(data, ["is_private", "isPrivate", "private"])),
    is_verified: toBoolean(pick(data, ["is_verified", "isVerified", "verified"])),
    account_type: pick(data, ["account_type", "category_name", "category"]) || "Instagram",
    recent_media: [],
    insights_summary: "Profil bilgileri ucuncu parti saglayici uzerinden alindi."
  };

  if (!normalized.username) {
    return null;
  }

  return normalized;
}

function normalizeOfficialProfile(profile) {
  return {
    source: "official",
    connected: true,
    username: profile.username || "",
    full_name: profile.name || profile.username || "",
    name: profile.name || profile.username || "",
    profile_pic_url: profile.profile_picture_url || "",
    profile_picture_url: profile.profile_picture_url || "",
    follower_count: profile.followers_count ?? null,
    following_count: profile.follows_count ?? null,
    followers_count: profile.followers_count ?? null,
    follows_count: profile.follows_count ?? null,
    media_count: profile.media_count ?? null,
    biography: profile.biography || "",
    is_private: false,
    is_verified: false,
    account_type: profile.account_type || "Instagram",
    recent_media: [],
    insights_summary: "Resmi Instagram API ile bagli hesap verileri alindi."
  };
}

function normalizePublicProfile(payload, username) {
  return normalizeProfile(payload, username, "public_web");
}

async function fetchOfficialSelf(accessToken) {
  const url = new URL(`${GRAPH_BASE}/me`);
  url.searchParams.set("fields", [
    "user_id",
    "username",
    "name",
    "account_type",
    "profile_picture_url",
    "followers_count",
    "follows_count",
    "media_count",
    "biography",
    "website"
  ].join(","));
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url);
  const payload = await response.json();
  if (!response.ok) {
    throw payload;
  }
  return normalizeOfficialProfile(payload);
}

async function fetchRapidApiProfile(username) {
  const key = process.env.RAPIDAPI_KEY;
  const host = process.env.RAPIDAPI_HOST || "instagram-scraper-api2.p.rapidapi.com";
  const template = process.env.RAPIDAPI_URL_TEMPLATE || `https://${host}/v1/info?username_or_id_or_url={username}`;
  const method = (process.env.RAPIDAPI_METHOD || "GET").toUpperCase();
  const bodyTemplate = process.env.RAPIDAPI_BODY_TEMPLATE || "";

  if (!key) {
    throw providerError(500, "missing_RAPIDAPI_KEY");
  }

  const url = template.replaceAll("{username}", encodeURIComponent(username));
  const headers = {
    "Accept": "application/json",
    "X-RapidAPI-Key": key,
    "X-RapidAPI-Host": host
  };
  const options = { method, headers };

  if (method !== "GET" && bodyTemplate) {
    const body = bodyTemplate.replaceAll("{username}", username).replaceAll("{encodedUsername}", encodeURIComponent(username));
    if (body.trim().startsWith("{") || body.trim().startsWith("[")) {
      headers["Content-Type"] = "application/json";
      options.body = body;
    } else {
      headers["Content-Type"] = "application/x-www-form-urlencoded";
      options.body = body;
    }
  }

  const response = await fetch(url, options);
  const payload = await response.json().catch(() => null);
  const debug = {
    provider: "rapidapi",
    rapidApiStatus: response.status,
    usedUrl: url,
    rawKeys: getRawKeys(payload),
    dataKeys: getRawKeys(payload?.data),
    userDataKeys: getRawKeys(payload?.user_data || payload?.data?.user_data || payload?.data?.user)
  };

  console.log("[instagram-api] rapidapi", debug);

  if (!response.ok) {
    throw providerError(response.status, payload);
  }

  const profile = normalizeProfile(payload, username, "rapidapi");
  if (!profile) {
    throw providerError(502, { reason: "rapidapi_parse_error", debug });
  }
  profile.debug = debug;
  return profile;
}

async function fetchApifyProfile(username) {
  const token = process.env.APIFY_TOKEN;
  const actor = process.env.APIFY_ACTOR || "apify/instagram-profile-scraper";

  if (!token) {
    throw providerError(500, "missing_APIFY_TOKEN");
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
    throw providerError(response.status, payload);
  }

  const first = Array.isArray(payload) ? payload[0] : payload;
  const profile = normalizeProfile(first, username, "apify");
  if (!profile) {
    throw providerError(502, "apify_parse_error");
  }
  return profile;
}

async function fetchBrightDataProfile(username) {
  const token = process.env.BRIGHTDATA_API_KEY;
  const datasetId = process.env.BRIGHTDATA_DATASET_ID || "gd_l1vikfch901nx3by4";

  if (!token) {
    throw providerError(500, "missing_BRIGHTDATA_API_KEY");
  }

  const url = `https://api.brightdata.com/datasets/v3/scrape?dataset_id=${encodeURIComponent(datasetId)}&format=json`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json"
    },
    body: JSON.stringify([{ url: `https://www.instagram.com/${username}/` }])
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw providerError(response.status, payload);
  }

  const first = Array.isArray(payload) ? payload[0] : payload;
  const profile = normalizeProfile(first, username, "brightdata");
  if (!profile) {
    throw providerError(502, "brightdata_parse_error");
  }
  return profile;
}

async function fetchScrapingBeeProfile(username) {
  const key = process.env.SCRAPINGBEE_API_KEY;

  if (!key) {
    throw providerError(500, "missing_SCRAPINGBEE_API_KEY");
  }

  const target = new URL(PUBLIC_PROFILE_URL);
  target.searchParams.set("username", username);

  const url = new URL("https://app.scrapingbee.com/api/v1/");
  url.searchParams.set("api_key", key);
  url.searchParams.set("url", target.toString());
  url.searchParams.set("render_js", "false");
  url.searchParams.set("premium_proxy", "true");

  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "X-IG-App-ID": "936619743392459"
    }
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    throw providerError(response.status, payload);
  }

  const profile = normalizePublicProfile(payload, username);
  if (!profile) {
    throw providerError(502, "scrapingbee_parse_error");
  }
  profile.source = "scrapingbee";
  profile.insights_summary = "Profil bilgileri ScrapingBee proxy uzerinden alindi.";
  return profile;
}

async function fetchPublicProfile(username) {
  const url = new URL(PUBLIC_PROFILE_URL);
  url.searchParams.set("username", username);

  const headers = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    "X-IG-App-ID": "936619743392459"
  };

  if (process.env.IG_SESSION_ID) {
    headers.Cookie = `sessionid=${process.env.IG_SESSION_ID}`;
  }

  const response = await fetch(url, { headers });
  const text = await response.text();

  if (response.status === 404) {
    throw providerError(404, "not_found");
  }

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw providerError(response.status, "login_required_or_rate_limited");
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw providerError(502, "parse_error");
  }

  if (!response.ok || payload.status === "fail") {
    throw providerError(response.status || 502, payload.message || payload);
  }

  const profile = normalizePublicProfile(payload, username);
  if (!profile) {
    throw providerError(404, "empty_profile");
  }

  return profile;
}

function getConfiguredProvider() {
  const provider = (process.env.INSTAGRAM_PROVIDER || "auto").toLowerCase();
  const configured = ["rapidapi", "apify", "brightdata", "scrapingbee", "official", "public", "auto"];
  return configured.includes(provider) ? provider : "auto";
}

function hasConfiguredScraperProvider() {
  return Boolean(
    process.env.RAPIDAPI_KEY ||
    process.env.APIFY_TOKEN ||
    process.env.BRIGHTDATA_API_KEY ||
    process.env.SCRAPINGBEE_API_KEY
  );
}

async function fetchByProvider(provider, username, accessToken) {
  if (provider === "official") {
    if (!accessToken) {
      throw providerError(500, "missing_IG_ACCESS_TOKEN");
    }
    const profile = await fetchOfficialSelf(accessToken);
    if (profile.username.toLowerCase() !== username.toLowerCase()) {
      throw providerError(404, "official_token_only_matches_connected_account");
    }
    return profile;
  }
  if (provider === "rapidapi") return fetchRapidApiProfile(username);
  if (provider === "apify") return fetchApifyProfile(username);
  if (provider === "brightdata") return fetchBrightDataProfile(username);
  if (provider === "scrapingbee") return fetchScrapingBeeProfile(username);
  return fetchPublicProfile(username);
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method !== "GET") {
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  const username = sanitizeUsername(request.query?.username);
  const provider = getConfiguredProvider();
  const accessToken = process.env.IG_ACCESS_TOKEN;

  if (!username) {
    return sendJson(response, 400, {
      error: "missing_username",
      message: "Kullanıcı adı gerekli."
    });
  }

  try {
    if (provider !== "auto") {
      const profile = await fetchByProvider(provider, username, accessToken);
      return sendJson(response, 200, profile);
    }

    if (accessToken) {
      try {
        const officialProfile = await fetchOfficialSelf(accessToken);
        if (officialProfile.username.toLowerCase() === username.toLowerCase()) {
          return sendJson(response, 200, officialProfile);
        }
      } catch {
        // Continue to configured scraper provider.
      }
    }

    if (process.env.RAPIDAPI_KEY) return sendJson(response, 200, await fetchRapidApiProfile(username));
    if (process.env.APIFY_TOKEN) return sendJson(response, 200, await fetchApifyProfile(username));
    if (process.env.BRIGHTDATA_API_KEY) return sendJson(response, 200, await fetchBrightDataProfile(username));
    if (process.env.SCRAPINGBEE_API_KEY) return sendJson(response, 200, await fetchScrapingBeeProfile(username));

    if (process.env.ALLOW_PUBLIC_WEB_FALLBACK === "true") {
      return sendJson(response, 200, await fetchPublicProfile(username));
    }

    if (!hasConfiguredScraperProvider()) {
      throw providerError(500, "provider_not_configured");
    }

    throw providerError(502, "provider_failed");
  } catch (error) {
    if (error?.payload) {
      return sendJson(response, error.status, error.payload);
    }

    return sendJson(response, 502, {
      error: "instagram_request_failed",
      message: USER_MESSAGE,
      details: error?.message || error
    });
  }
};
