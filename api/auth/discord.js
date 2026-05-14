const { setJson } = require('../../lib/cache');
const { generateId } = require('../../lib/session');

const CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const REDIRECT_URI = process.env.DISCORD_REDIRECT_URI || 'https://www.sammvsc.top/api/auth/discord/callback';

module.exports = async (req, res) => {
  if (!CLIENT_ID) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('DISCORD_CLIENT_ID yapılandırılmamış.');
    return;
  }

  const state = generateId();
  await setJson(`oauth_state:${state}`, { t: Date.now() }, 600).catch(() => {});

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: 'identify',
    state
  });

  res.statusCode = 302;
  res.setHeader('Location', `https://discord.com/api/oauth2/authorize?${params}`);
  res.end();
};
