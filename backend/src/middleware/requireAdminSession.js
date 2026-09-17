import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';

/**
 * Porta d'entrada al panell estàtic /admin: cal una sessió vàlida de
 * Better Auth (cookie httpOnly). Sense sessió, redirigeix a /login.html
 * conservant la pàgina de destí per tornar-hi després d'entrar.
 */
async function requireAdminSession(req, res, next) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (session) return next();

  const next_ = encodeURIComponent(req.originalUrl || '/admin/');
  res.redirect(`/login.html?next=${next_}`);
}

export default requireAdminSession;
