const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v20.0";
const GRAPH_BASE = `https://graph.instagram.com/${GRAPH_VERSION}`;
const PUBLIC_PROFILE_URL = "https://i.instagram.com/api/v1/users/web_profile_info/";

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
  response.end(JSON.stringify(payload));
}

function publicError(status = 502, details = null) {
  return {
    status,
    payload: {
      error: "instagram_blocked",
      message: "Profil bulunamadı veya Instagram veriyi engelledi.",
      details
    }
  };
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
    insights_summary: "Resmi Instagram API ile bağlı hesap verileri alındı."
  };
}

function normalizePublicProfile(payload) {
  const user = payload?.data?.user;
  if (!user) {
    return null;
  }

  return {
    source: "public_web",
    connected: true,
    username: user.username || "",
    full_name: user.full_name || user.username || "",
    name: user.full_name || user.username || "",
    profile_pic_url: user.profile_pic_url_hd || user.profile_pic_url || "",
    profile_picture_url: user.profile_pic_url_hd || user.profile_pic_url || "",
    follower_count: user.edge_followed_by?.count ?? null,
    following_count: user.edge_follow?.count ?? null,
    followers_count: user.edge_followed_by?.count ?? null,
    follows_count: user.edge_follow?.count ?? null,
    media_count: user.edge_owner_to_timeline_media?.count ?? null,
    biography: user.biography || "",
    is_private: Boolean(user.is_private),
    is_verified: Boolean(user.is_verified),
    account_type: user.is_business_account ? "Business" : "Public",
    recent_media: [],
    insights_summary: "Herkese açık web profilinden temel bilgiler alındı. Yorumlar, DM ve gizli içerikler gösterilmez."
  };
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
    throw publicError(404, "not_found");
  }

  if (response.status === 401 || response.status === 403 || response.status === 429) {
    throw publicError(response.status, "login_required_or_rate_limited");
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw publicError(502, "parse_error");
  }

  if (!response.ok || payload.status === "fail") {
    throw publicError(response.status || 502, payload.message || payload);
  }

  const profile = normalizePublicProfile(payload);
  if (!profile) {
    throw publicError(404, "empty_profile");
  }

  return profile;
}

module.exports = async function handler(request, response) {
  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method !== "GET") {
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  const username = sanitizeUsername(request.query?.username);
  const accessToken = process.env.IG_ACCESS_TOKEN;

  if (!username) {
    return sendJson(response, 400, {
      error: "missing_username",
      message: "Kullanıcı adı gerekli."
    });
  }

  if (accessToken) {
    try {
      const officialProfile = await fetchOfficialSelf(accessToken);
      if (officialProfile.username.toLowerCase() === username.toLowerCase()) {
        return sendJson(response, 200, officialProfile);
      }
    } catch {
      // Continue with public lookup. Official token errors should not break username search.
    }
  }

  try {
    const publicProfile = await fetchPublicProfile(username);
    return sendJson(response, 200, publicProfile);
  } catch (error) {
    if (error?.payload) {
      return sendJson(response, error.status, error.payload);
    }

    return sendJson(response, 502, {
      error: "instagram_request_failed",
      message: "Profil bulunamadı veya Instagram veriyi engelledi.",
      details: error?.message || error
    });
  }
};
