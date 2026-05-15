const { getJson, del } = require('../../../lib/cache');
const { createSession, setCookieHeader } = require('../../../lib/session');

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://www.sammvsc.top/api/auth/discord/callback';
const DISCORD_AUTH_PAUSED = false;

function safeNext(value) {
  const next = typeof value === 'string' ? value : '/?auth=profile';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next.slice(0, 240);
}

function parseCookie(str = '') {
  const out = {};
  for (const part of str.split(';')) {
    const idx = part.indexOf('=');
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    try { out[key] = decodeURIComponent(value); } catch { out[key] = value; }
  }
  return out;
}

function clearCookie(name) {
  return `${name}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`;
}

module.exports = async (req, res) => {
  if (DISCORD_AUTH_PAUSED) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=discord-paused');
    res.end();
    return;
  }

  const { code, state, error } = req.query;

  if (error) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=cancelled');
    res.end();
    return;
  }

  if (!code || !state) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=error');
    res.end();
    return;
  }

  // CSRF state check
  const cookies = parseCookie(req.headers.cookie || '');
  let storedState = await getJson(`oauth_state:${state}`).catch(() => null);
  if (!storedState && cookies.sammvsc_oauth_state === state) {
    storedState = { next: safeNext(cookies.sammvsc_oauth_next) };
  }
  if (!storedState) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=error');
    res.end();
    return;
  }
  await del(`oauth_state:${state}`).catch(() => {});

  if (!CLIENT_ID || !CLIENT_SECRET) {
    res.statusCode = 302;
    res.setHeader('Location', `/login?reason=config&next=${encodeURIComponent(safeNext(storedState.next))}`);
    res.end();
    return;
  }

  // Exchange code → token
  const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI
    })
  });

  if (!tokenRes.ok) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=error');
    res.end();
    return;
  }

  const tokens = await tokenRes.json();

  // Fetch Discord user info
  const userRes = await fetch('https://discord.com/api/users/@me', {
    headers: { 'Authorization': `Bearer ${tokens.access_token}` }
  });

  if (!userRes.ok) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=error');
    res.end();
    return;
  }

  const user = await userRes.json();

  const sessionId = await createSession({
    discord_id: user.id,
    username: user.username,
    global_name: user.global_name || user.username,
    avatar: user.avatar
  });

  res.statusCode = 302;
  res.setHeader('Set-Cookie', [
    setCookieHeader(sessionId),
    clearCookie('sammvsc_oauth_state'),
    clearCookie('sammvsc_oauth_next')
  ]);
  res.setHeader('Location', safeNext(storedState.next));
  res.end();
};
