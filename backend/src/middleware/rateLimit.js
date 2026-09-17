import rateLimit from 'express-rate-limit';

function jsonRateLimitResponse(req, res) {
  res.status(429).json({ success: false, error: 'rate_limited' });
}

// Límit global, molt permissiu: xarxa de seguretat contra escombrat massiu.
export const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse,
});

// Formulari públic de registre: mateix criteri que contact.php
// (evita que un script creï centenars de targetes).
export const createPassLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse,
});

// Endpoints de personal (segellar / llistar): ja protegits per staff key,
// però limitem igualment per si la clau es filtra o es prova per força bruta.
export const staffLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse,
});

// Consulta pública d'estat per cardId: limita l'enumeració de targetes.
export const lookupLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse,
});

// Login del panell (Better Auth /api/auth/sign-in/*): talla la força bruta
// de contrasenyes sense dependre només del propi Better Auth.
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: jsonRateLimitResponse,
});
