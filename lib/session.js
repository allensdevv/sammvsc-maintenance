const { getJson, setJson, del } = require('./cache');
const crypto = require('crypto');

const SESSION_TTL = 60 * 60 * 24 * 7; // 7 days
const SESSION_COOKIE = 'sammvsc_sid';

function generateId() {
  return crypto.randomBytes(32).toString('hex');
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
  const id = generateId();
  await setJson(`sess:${id}`, data, SESSION_TTL);
  return id;
}

async function getSession(cookieHeader) {
  const id = parseCookie(cookieHeader)[SESSION_COOKIE];
  if (!id) return null;
  return getJson(`sess:${id}`).catch(() => null);
}

async function destroySession(cookieHeader) {
  const id = parseCookie(cookieHeader)[SESSION_COOKIE];
  if (id) await del(`sess:${id}`).catch(() => {});
}

function setCookieHeader(id) {
  return `${SESSION_COOKIE}=${id}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

function clearCookieHeader() {
  return `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

module.exports = { createSession, getSession, destroySession, setCookieHeader, clearCookieHeader, generateId };
