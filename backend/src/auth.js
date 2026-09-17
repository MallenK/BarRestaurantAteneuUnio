import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import { betterAuth } from 'better-auth';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'data', 'auth.db');

// Compte(s) de personal de l'Ateneu Unió per entrar al panell /admin.
// La creació de comptes NO és pública (veure server.js): es fan amb
// scripts/create-staff-user.js, en local o al servidor de producció.
export const auth = betterAuth({
  database: new Database(DB_PATH),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  advanced: {
    // El panell i l'API viuen sota el mateix origen (mateix backend), no
    // cal relaxar la política de cookies entre dominis.
    useSecureCookies: process.env.NODE_ENV === 'production',
  },
});
