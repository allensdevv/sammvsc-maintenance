const { getText, incr } = require("../../lib/cache");
const { normalizeUsername } = require("../../lib/instagramPrivateApi");

const VIEW_COUNTER_TTL_SECONDS = Number(process.env.INSTAGRAM_VIEW_COUNTER_TTL_SECONDS || 0);

function viewKey(username) {
  return `ig:views:${username.toLowerCase()}`;
}

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Sammvsc-Api", "instagram-profile-views");
  response.end(JSON.stringify(payload));
}

module.exports = async function handler(request, response) {
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

  const shouldTrack = request.query?.track !== "0";
  const key = viewKey(username);
  const count = shouldTrack
    ? await incr(key, VIEW_COUNTER_TTL_SECONDS)
    : Number(await getText(key) || 0);

  return sendJson(response, 200, {
    status: "ready",
    username,
    count,
    tracked: shouldTrack
  });
};
