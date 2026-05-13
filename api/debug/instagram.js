const { del, getJson, hasRedis, setJson } = require("../../lib/cache");
const {
  fetchPrivateProfile,
  inspectSessionRestore,
  normalizeUsername
} = require("../../lib/instagramPrivateApi");

function sendJson(response, status, payload) {
  response.statusCode = status;
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type, Accept");
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Sammvsc-Api", "instagram-debug");
  response.end(JSON.stringify(payload));
}

function errorReason(error) {
  return {
    code: error?.code || null,
    name: error?.name || null,
    message: error?.message || "unknown_error",
    responseMessage: error?.response?.body?.message || null,
    responseType: error?.response?.body?.error_type || null,
    statusCode: error?.response?.statusCode || error?.status || null
  };
}

async function testCache() {
  const key = `ig:debug:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  const value = {
    ok: true,
    createdAt: new Date().toISOString()
  };

  await setJson(key, value, 60);
  const read = await getJson(key);
  await del(key);

  return {
    provider: hasRedis() ? "redis" : "memory",
    writeSuccess: true,
    readSuccess: read?.ok === true
  };
}

module.exports = async function handler(request, response) {
  const startedAt = Date.now();

  if (request.method === "OPTIONS") {
    return sendJson(response, 204, {});
  }

  if (request.method !== "GET") {
    return sendJson(response, 405, { status: "error", error: "method_not_allowed" });
  }

  const username = normalizeUsername(request.query?.username || process.env.IG_DEBUG_USERNAME || "instagram");
  const debug = {
    status: "ok",
    username,
    runtime: {
      node: process.version,
      moduleSystem: "commonjs",
      vercelRegion: process.env.VERCEL_REGION || null
    },
    loginStatus: "unknown",
    session: null,
    cache: null,
    instagramFetch: null,
    tookMs: 0
  };

  try {
    debug.cache = await testCache();
  } catch (error) {
    debug.cache = {
      provider: hasRedis() ? "redis" : "memory",
      writeSuccess: false,
      readSuccess: false,
      error: error.message
    };
  }

  debug.session = await inspectSessionRestore();
  if (!debug.session.hasUsername || !debug.session.hasPassword) {
    debug.loginStatus = "missing_credentials";
  } else if (debug.session.restoreSuccess) {
    debug.loginStatus = "session_restored";
  } else if (debug.session.hasSession) {
    debug.loginStatus = "session_restore_failed";
  } else {
    debug.loginStatus = "no_session";
  }

  try {
    const profile = await fetchPrivateProfile(username);
    debug.instagramFetch = {
      success: true,
      reason: null,
      username: profile.username,
      hasProfilePic: Boolean(profile.profilePicUrl),
      hasCounts: Boolean(profile.followers || profile.following || profile.posts)
    };

    if (debug.loginStatus === "no_session") {
      debug.loginStatus = "login_success";
    }
  } catch (error) {
    debug.status = "warning";
    debug.instagramFetch = {
      success: false,
      reason: errorReason(error)
    };
  }

  debug.tookMs = Date.now() - startedAt;
  return sendJson(response, 200, debug);
};
