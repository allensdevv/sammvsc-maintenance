const { setJson } = require('../../lib/cache');
const { generateId } = require('../../lib/session');

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://www.sammvsc.top/api/auth/discord/callback';
const DISCORD_AUTH_PAUSED = false;

function safeNext(value) {
  const next = typeof value === 'string' ? value : '/?auth=profile';
  if (!next.startsWith('/') || next.startsWith('//')) return '/';
  return next.slice(0, 240);
}

module.exports = async (req, res) => {
  const next = safeNext(req.query?.next);

  if (DISCORD_AUTH_PAUSED) {
    res.statusCode = 302;
    res.setHeader('Location', '/?auth=discord-paused');
    res.end();
    return;
  }

  if (!CLIENT_ID) {
    res.statusCode = 302;
    res.setHeader('Location', `/login?reason=config&next=${encodeURIComponent(next)}`);
    res.end();
    return;
  }

  const state = generateId();
  await setJson(`oauth_state:${state}`, { t: Date.now(), next }, 600).catch(() => {});

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state
  });

  res.statusCode = 302;
  res.setHeader('Set-Cookie', [
    `sammvsc_oauth_state=${encodeURIComponent(state)}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
    `sammvsc_oauth_next=${encodeURIComponent(next)}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`
  ]);
  res.setHeader('Location', `https://discord.com/api/oauth2/authorize?${params}`);
  res.end();
};
