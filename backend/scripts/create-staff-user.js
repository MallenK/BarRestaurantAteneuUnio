import 'dotenv/config';
import { auth } from '../src/auth.js';

// Crea un compte de personal per entrar al panell /admin. L'endpoint HTTP
// de sign-up està bloquejat (server.js) perquè el registre no és públic:
// els comptes es creen sempre des d'aquí, en local o al servidor.
//
// Ús: node scripts/create-staff-user.js "email@ateneuuniorestaurant.com" "contrasenya" "Nom"

const [, , email, password, name] = process.argv;

if (!email || !password) {
  console.error('Ús: node scripts/create-staff-user.js "email" "contrasenya" ["Nom"]');
  process.exit(1);
}
if (password.length < 8) {
  console.error('La contrasenya ha de tenir com a mínim 8 caràcters.');
  process.exit(1);
}

try {
  const result = await auth.api.signUpEmail({
    body: { email, password, name: name || email.split('@')[0] },
  });
  console.log('Compte de personal creat:', result.user.email);
  process.exit(0);
} catch (err) {
  console.error('No s\'ha pogut crear el compte:', err.message || err);
  process.exit(1);
}
