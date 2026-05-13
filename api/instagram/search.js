const GRAPH_VERSION = process.env.META_GRAPH_VERSION || "v20.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

function sanitizeUsername(value = "") {
  return String(value).trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 30);
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(JSON.stringify(payload));
}

function normalizeBusinessDiscovery(payload, username) {
  const profile = payload.business_discovery || {};
  const media = Array.isArray(profile.media?.data) ? profile.media.data : [];

  return {
    connected: true,
    username: profile.username || username,
    name: profile.name || profile.username || username,
    biography: profile.biography || "",
    profile_picture_url: profile.profile_picture_url || "",
    followers_count: profile.followers_count ?? null,
    follows_count: profile.follows_count ?? null,
    media_count: profile.media_count ?? null,
    account_type: "BUSINESS_OR_CREATOR",
    recent_media: media.map((item) => ({
      id: item.id,
      caption: item.caption || "",
      media_type: item.media_type || "",
      media_url: item.media_url || "",
      permalink: item.permalink || "",
      timestamp: item.timestamp || "",
      like_count: item.like_count ?? null,
      comments_count: item.comments_count ?? null,
      comments: Array.isArray(item.comments?.data) ? item.comments.data : []
    })),
    insights_summary: "Business Discovery ile temel profil, medya, beğeni ve yorum sayıları alındı. Hesap sahibi yetki verdiğinde Insights metrikleri ayrıca gösterilebilir."
  };
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    return sendJson(response, 405, { error: "method_not_allowed" });
  }

  const username = sanitizeUsername(request.query?.username);
  const accessToken = process.env.IG_ACCESS_TOKEN;
  const igUserId = process.env.IG_USER_ID;

  if (!username) {
    return sendJson(response, 400, { error: "missing_username" });
  }

  if (!accessToken || !igUserId) {
    return sendJson(response, 503, {
      error: "instagram_api_not_configured",
      message: "IG_ACCESS_TOKEN ve IG_USER_ID ortam değişkenleri gerekiyor."
    });
  }

  const fields = [
    `business_discovery.username(${username}){`,
    "username,name,biography,profile_picture_url,followers_count,follows_count,media_count,",
    "media.limit(8){id,caption,media_type,media_url,permalink,timestamp,like_count,comments_count,comments.limit(5){id,text,username,timestamp}}",
    "}"
  ].join("");

  const url = new URL(`${GRAPH_BASE}/${igUserId}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", accessToken);

  try {
    const graphResponse = await fetch(url);
    const graphPayload = await graphResponse.json();

    if (!graphResponse.ok) {
      return sendJson(response, graphResponse.status, {
        error: "instagram_graph_error",
        details: graphPayload.error || graphPayload
      });
    }

    return sendJson(response, 200, normalizeBusinessDiscovery(graphPayload, username));
  } catch (error) {
    return sendJson(response, 500, {
      error: "instagram_request_failed",
      message: error.message
    });
  }
};
