const {
  acquireLock,
  getJson,
  getText,
  releaseLock,
  setJson,
  setText,
  sleep
} = require("./cache");

const SESSION_TTL_SECONDS = Number(process.env.IG_SESSION_TTL_SECONDS || 60 * 60 * 24 * 14);
const LOGIN_LOCK_TTL_SECONDS = Number(process.env.IG_LOGIN_LOCK_TTL_SECONDS || 45);
const LOGIN_COOLDOWN_SECONDS = Number(process.env.IG_LOGIN_COOLDOWN_SECONDS || 10 * 60);
const MIN_REQUEST_DELAY_MS = Number(process.env.IG_REQUEST_MIN_DELAY_MS || 1200);
const RANDOM_REQUEST_DELAY_MS = Number(process.env.IG_REQUEST_RANDOM_DELAY_MS || 1800);

function getLoginUsername() {
  return process.env.IG_PRIVATE_USERNAME || process.env.IG_USERNAME || "";
}

function getLoginPassword() {
  return process.env.IG_PRIVATE_PASSWORD || process.env.IG_PASSWORD || "";
}

function getSessionKey() {
  return process.env.IG_SESSION_KEY || `ig:session:${getLoginUsername().toLowerCase()}`;
}

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@/, "").replace(/[^a-zA-Z0-9_.]/g, "").slice(0, 30);
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

function isAuthError(error) {
  const text = [
    error?.name,
    error?.message,
    error?.response?.body?.message,
    error?.response?.body?.error_type
  ].filter(Boolean).join(" ").toLowerCase();

  return [
    "login_required",
    "checkpoint",
    "challenge",
    "feedback_required",
    "please wait",
    "rate limit",
    "not authorized"
  ].some((needle) => text.includes(needle));
}

function normalizePrivateUser(user, requestedUsername) {
  if (!user || typeof user !== "object") return null;

  const username = pick(user, ["username"]) || requestedUsername;
  return {
    username,
    fullName: pick(user, ["full_name", "fullName", "name"]) || username,
    biography: pick(user, ["biography", "bio"]) || "",
    profilePicUrl: pick(user, [
      "profile_pic_url_hd",
      "hd_profile_pic_url_info.url",
      "profile_pic_url",
      "profilePictureUrl"
    ]) || "",
    followers: toNumber(pick(user, ["follower_count", "followers_count", "followers"])),
    following: toNumber(pick(user, ["following_count", "follows_count", "following"])),
    posts: toNumber(pick(user, ["media_count", "edge_owner_to_timeline_media.count", "posts"])),
    isPrivate: toBoolean(pick(user, ["is_private", "isPrivate"])),
    isVerified: toBoolean(pick(user, ["is_verified", "isVerified"]))
  };
}

async function createClient() {
  const { IgApiClient } = require("instagram-private-api");
  const username = getLoginUsername();
  const ig = new IgApiClient();

  if (!username) {
    const error = new Error("missing_IG_PRIVATE_USERNAME");
    error.code = "missing_credentials";
    throw error;
  }

  ig.state.generateDevice(username);
  if (process.env.IG_PROXY) {
    ig.state.proxyUrl = process.env.IG_PROXY;
  }

  ig.request.end$.subscribe(async () => {
    try {
      const serialized = await ig.state.serialize();
      delete serialized.constants;
      await setJson(getSessionKey(), serialized, SESSION_TTL_SECONDS);
    } catch (error) {
      console.log("[instagram-private-api] session_save_failed", error?.message || error);
    }
  });

  const savedSession = await getJson(getSessionKey());
  if (savedSession) {
    await ig.state.deserialize(savedSession);
  }

  return ig;
}

async function inspectSessionRestore() {
  const username = getLoginUsername();
  const sessionKey = getSessionKey();
  const result = {
    moduleFormat: "commonjs",
    nodeVersion: process.version,
    hasUsername: Boolean(username),
    hasPassword: Boolean(getLoginPassword()),
    hasProxy: Boolean(process.env.IG_PROXY),
    hasSession: false,
    restoreSuccess: false,
    restoreError: null
  };

  try {
    const { IgApiClient } = require("instagram-private-api");
    const savedSession = await getJson(sessionKey);
    result.hasSession = Boolean(savedSession);

    if (!username || !savedSession) {
      return result;
    }

    const ig = new IgApiClient();
    ig.state.generateDevice(username);
    if (process.env.IG_PROXY) {
      ig.state.proxyUrl = process.env.IG_PROXY;
    }
    await ig.state.deserialize(savedSession);
    result.restoreSuccess = true;
    return result;
  } catch (error) {
    result.restoreError = error?.message || "session_restore_failed";
    return result;
  }
}

async function throttleRequest() {
  const key = "ig:private-api:last-request-at";
  const lastRequestAt = Number(await getText(key));
  const randomDelay = Math.floor(Math.random() * RANDOM_REQUEST_DELAY_MS);
  const targetDelay = MIN_REQUEST_DELAY_MS + randomDelay;
  const elapsed = Date.now() - lastRequestAt;

  if (lastRequestAt && elapsed < targetDelay) {
    await sleep(targetDelay - elapsed);
  }

  await setText(key, String(Date.now()), 60);
}

async function login(ig) {
  const username = getLoginUsername();
  const password = getLoginPassword();
  const cooldownKey = `ig:login-cooldown:${username.toLowerCase()}`;
  const lockKey = `ig:login-lock:${username.toLowerCase()}`;

  if (!password) {
    const error = new Error("missing_IG_PRIVATE_PASSWORD");
    error.code = "missing_credentials";
    throw error;
  }

  if (await getText(cooldownKey)) {
    const error = new Error("instagram_login_cooldown");
    error.code = "login_cooldown";
    throw error;
  }

  const locked = await acquireLock(lockKey, LOGIN_LOCK_TTL_SECONDS);
  if (!locked) {
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await sleep(750);
      const session = await getJson(getSessionKey());
      if (session) {
        await ig.state.deserialize(session);
        return;
      }
    }

    const error = new Error("instagram_login_in_progress");
    error.code = "login_in_progress";
    throw error;
  }

  try {
    await throttleRequest();
    await ig.simulate.preLoginFlow();
    await ig.account.login(username, password);
    const serialized = await ig.state.serialize();
    delete serialized.constants;
    await setJson(getSessionKey(), serialized, SESSION_TTL_SECONDS);
    ig.simulate.postLoginFlow().catch(() => {});
  } catch (error) {
    await setText(cooldownKey, "1", LOGIN_COOLDOWN_SECONDS);
    throw error;
  } finally {
    await releaseLock(lockKey);
  }
}

async function usernameInfoWithRetry(ig, username) {
  await throttleRequest();

  try {
    return await ig.user.usernameinfo(username);
  } catch (error) {
    if (!isAuthError(error)) throw error;
    await login(ig);
    await throttleRequest();
    return ig.user.usernameinfo(username);
  }
}

async function fetchPrivateProfile(username) {
  const clean = normalizeUsername(username);
  if (!clean) {
    const error = new Error("missing_username");
    error.code = "missing_username";
    throw error;
  }

  const ig = await createClient();
  const user = await usernameInfoWithRetry(ig, clean);
  const profile = normalizePrivateUser(user, clean);

  if (!profile) {
    const error = new Error("profile_parse_failed");
    error.code = "profile_parse_failed";
    throw error;
  }

  return profile;
}

module.exports = {
  fetchPrivateProfile,
  inspectSessionRestore,
  normalizePrivateUser,
  normalizeUsername
};
