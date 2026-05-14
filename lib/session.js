const { getJson, setJson, del } = require('./cache');
const crypto = require('crypto');

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const SESSION_COOKIE = 'sammvsc_sid';
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.DISCORD_CLIENT_SECRET || 'sammvsc-session-v1';

function generateId() {
  return crypto.randomBytes(32).toString('hex');
}

function sign(value) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(value).digest('base64url');
}

function isSameSignature(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function encodeSession(data) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    discord_id: data.discord_id,
    username: data.username,
    global_name: data.global_name || data.username,
    avatar: data.avatar || null,
    iat: now,
    exp: now + SESSION_TTL
  };
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${sign(body)}`;
}

function decodeSession(value) {
  if (!value || !value.includes('.')) return null;
  const [body, signature] = value.split('.');
  if (!body || !signature || !isSameSignature(signature, sign(body))) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }

  if (!payload?.discord_id || !payload?.username) return null;
  if (payload.exp && payload.exp <= Math.floor(Date.now() / 1000)) return null;

  return {
    discord_id: String(payload.discord_id),
    username: String(payload.username),
    global_name: String(payload.global_name || payload.username),
    avatar: payload.avatar ? String(payload.avatar) : null
  };
}

function parseCookie(str = '') {
  const out = {};
  for (const part of str.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    try { out[k] = decodeURIComponent(v); } catch { out[k] = v; }
  }
  return out;
}

async function createSession(data) {
  const token = encodeSession(data);
  await setJson(`sess:${token}`, data, SESSION_TTL).catch(() => {});
  return token;
}

async function getSession(cookieHeader) {
  const id = parseCookie(cookieHeader)[SESSION_COOKIE];
  if (!id) return null;
  const signedSession = decodeSession(id);
  if (signedSession) return signedSession;
  return getJson(`sess:${id}`).catch(() => null);
}

async function destroySession(cookieHeader) {
  const id = parseCookie(cookieHeader)[SESSION_COOKIE];
  if (id) await del(`sess:${id}`).catch(() => {});
}

function setCookieHeader(id) {
  return `${SESSION_COOKIE}=${encodeURIComponent(id)}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookieHeader() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

module.exports = { createSession, getSession, destroySession, setCookieHeader, clearCookieHeader, generateId };
