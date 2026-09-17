import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';
import { safeEqual } from '../lib/safeEqual.js';

/**
 * Protegeix els endpoints d'ús intern (segellar targetes, llistar-les).
 * Accepta DUES formes d'autenticació, qualsevol de les dues és suficient:
 *
 *  1. Sessió de Better Auth (cookie httpOnly) — és com hi entra el panell
 *     /admin un cop l'usuari ha fet login amb el seu compte.
 *  2. Capçalera x-staff-key — pensada per a integracions màquina-a-màquina
 *     que no poden mantenir una sessió de navegador (scripts, POS, etc.).
 */
async function staffAuth(req, res, next) {
  const key = req.get('x-staff-key');
  const expectedKey = process.env.STAFF_API_KEY;
  if (key && expectedKey && safeEqual(key, expectedKey)) {
    return next();
  }

  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  if (session) {
    req.staffUser = session.user;
    return next();
  }

  return res.status(401).json({ success: false, error: 'unauthorized' });
}

export default staffAuth;
