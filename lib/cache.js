const memoryStore = globalThis.__sammvscCacheStore || new Map();
globalThis.__sammvscCacheStore = memoryStore;

const redisUrl = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_REST_API_URL;
const redisToken = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.REDIS_REST_API_TOKEN;

function hasRedis() {
  return Boolean(redisUrl && redisToken);
}

function now() {
  return Date.now();
}

function getMemory(key) {
  const item = memoryStore.get(key);
  if (!item) return null;
  if (item.expiresAt && item.expiresAt <= now()) {
    memoryStore.delete(key);
    return null;
  }
  return item.value;
}

function setMemory(key, value, ttlSeconds) {
  memoryStore.set(key, {
    value,
    expiresAt: ttlSeconds ? now() + ttlSeconds * 1000 : null
  });
}

async function redisCommand(command) {
  if (!hasRedis()) return null;

  const response = await fetch(redisUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${redisToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(command)
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error || `Redis command failed: ${command[0]}`);
  }
  return payload?.result ?? null;
}

async function getText(key) {
  if (!hasRedis()) return getMemory(key);
  return redisCommand(["GET", key]);
}

async function setText(key, value, ttlSeconds) {
  if (!hasRedis()) {
    setMemory(key, value, ttlSeconds);
    return "OK";
  }

  const command = ttlSeconds
    ? ["SET", key, value, "EX", ttlSeconds]
    : ["SET", key, value];
  return redisCommand(command);
}

async function incr(key, ttlSeconds = 0) {
  if (!hasRedis()) {
    const current = Number(getMemory(key) || 0) + 1;
    setMemory(key, String(current), ttlSeconds || null);
    return current;
  }

  const current = Number(await redisCommand(["INCR", key]));
  if (ttlSeconds) {
    await redisCommand(["EXPIRE", key, ttlSeconds]);
  }
  return current;
}

async function getJson(key) {
  const value = await getText(key);
  if (!value) return null;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function setJson(key, value, ttlSeconds) {
  return setText(key, JSON.stringify(value), ttlSeconds);
}

async function del(key) {
  if (!hasRedis()) {
    memoryStore.delete(key);
    return 1;
  }
  return redisCommand(["DEL", key]);
}

async function acquireLock(key, ttlSeconds = 30) {
  if (!hasRedis()) {
    if (getMemory(key)) return false;
    setMemory(key, "1", ttlSeconds);
    return true;
  }

  const result = await redisCommand(["SET", key, "1", "EX", ttlSeconds, "NX"]);
  return result === "OK";
}

async function releaseLock(key) {
  return del(key);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = {
  acquireLock,
  del,
  getJson,
  getText,
  hasRedis,
  incr,
  releaseLock,
  setJson,
  setText,
  sleep
};
