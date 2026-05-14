const { destroySession, clearCookieHeader } = require('../../lib/session');

module.exports = async (req, res) => {
  await destroySession(req.headers.cookie).catch(() => {});
  res.statusCode = 302;
  res.setHeader('Set-Cookie', clearCookieHeader());
  res.setHeader('Location', '/');
  res.end();
};
