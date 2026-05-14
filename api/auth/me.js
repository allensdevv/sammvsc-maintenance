const { getSession } = require('../../lib/session');

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

module.exports = async (req, res) => {
  const session = await getSession(req.headers.cookie).catch(() => null);
  if (!session) return sendJson(res, 401, { loggedIn: false });
  return sendJson(res, 200, { loggedIn: true, user: session });
};
