const { default: authTokenServices } = require("../modules/auth/shared/services/auth_token_services.");


function middleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: 'Token não informado.' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ error: 'Token mal formatado.' });
  }

  const token = parts[1];

  try {
    const decoded = authTokenServices.validateToken(token);
    req.idUser = decoded.id;
    req.profile = decoded.profile;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido.' });
  }
}

module.exports = middleware;
