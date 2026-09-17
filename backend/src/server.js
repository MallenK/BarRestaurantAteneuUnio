import 'dotenv/config';

import path from 'path';
import { fileURLToPath } from 'url';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { toNodeHandler } from 'better-auth/node';

import { auth } from './auth.js';
import walletRoutes from './routes/wallet.js';
import requireAdminSession from './middleware/requireAdminSession.js';
import { globalLimiter, authLimiter } from './middleware/rateLimit.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

// Darrere d'un proxy invers (Render, Railway, Nginx...) cal confiar en el
// primer salt perquè req.ip (usat pels rate limiters) sigui la IP real del
// client i no la del proxy — si no, tots els clients comparteixen el mateix
// límit de peticions.
app.set('trust proxy', 1);

app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      // Mateixes Google Fonts que el web públic (index.html): Archivo,
      // Archivo Black, IBM Plex Mono — coherència de marca amb el panell.
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      imgSrc: ["'self'", 'data:', 'https://ateneuuniorestaurant.com'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
}));

// El propi origen del backend (on viuen /admin i /login.html) ha d'estar
// sempre permès: un navegador envia la capçalera Origin també en peticions
// same-origin (p. ex. el sign-out del panell), i el nostre CORS l'avalua
// igualment. BETTER_AUTH_URL ja és "la URL pública d'aquest backend", així
// que la fem servir com a font de veritat en lloc de duplicar-la.
const selfOrigin = process.env.BETTER_AUTH_URL ? new URL(process.env.BETTER_AUTH_URL).origin : null;

const allowedOrigins = [
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(o => o.trim()).filter(Boolean),
  selfOrigin,
].filter(Boolean);

app.use(cors({
  origin(origin, callback) {
    // Peticions sense origin (curl, apps natives, health checks) sempre passen.
    // Si ALLOWED_ORIGINS no està configurat, es denega tot origen creuat per
    // defecte (fail-safe): cal llistar-los explícitament.
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    callback(new Error('not_allowed_by_cors'));
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-staff-key'],
  credentials: true, // el panell envia la cookie de sessió de Better Auth
}));

app.use(globalLimiter);

// --- Better Auth: registre NO públic ---
// L'endpoint de sign-up de Better Auth (/api/auth/sign-up/email) es
// bloqueja abans d'arribar al seu handler: aquest no és un servei
// multiusuari obert, el personal té comptes creats a mà amb
// `npm run create-staff` (veure scripts/create-staff-user.js i README).
// Sign-in, sessió i sign-out sí que queden operatius amb normalitat.
app.post('/api/auth/sign-up/email', (req, res) => {
  res.status(403).json({ success: false, error: 'signup_disabled' });
});

// Limita intents de login per IP (força bruta de contrasenyes).
app.use('/api/auth/sign-in', authLimiter);

// El handler de Better Auth necessita el body cru: s'ha de muntar ABANS
// d'express.json(), que si no consumiria el stream de la petició primer.
app.all('/api/auth/*', toNodeHandler(auth));

// Límit de mida del body per a la resta de rutes: cap payload legítim
// nostre s'hi acosta.
app.use(express.json({ limit: '10kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/wallet', walletRoutes);

// Panell de gestió visual (backend/public/admin), protegit amb una sessió
// real de Better Auth — si no n'hi ha, redirigeix a /login.html. Es munta
// ABANS de l'estàtic obert de sota, perquè cap petició a /admin/* arribi
// mai a servir-se sense passar primer per requireAdminSession.
app.use('/admin', requireAdminSession, express.static(path.join(__dirname, '..', 'public', 'admin')));

// Pàgina de login (pública: cal poder veure-la sense sessió) i altres
// estàtics oberts de backend/public.
app.use(express.static(path.join(__dirname, '..', 'public'), { index: false }));

// 404 per a qualsevol altra ruta de l'API.
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, error: 'not_found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err && err.message === 'not_allowed_by_cors') {
    return res.status(403).json({ success: false, error: 'origin_not_allowed' });
  }
  // No filtrem stack traces ni detalls interns al client.
  console.error(err);
  res.status(500).json({ success: false, error: 'internal_error' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Ateneu Unió wallet API escoltant al port ${PORT}`);
});
