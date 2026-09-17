import crypto from 'crypto';

/**
 * Compara dos secrets en temps constant (evita filtrar-ne la longitud o el
 * contingut via temporització). Fes servir sempre per comparar claus/tokens
 * rebuts de l'usuari contra un valor esperat.
 */
export function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) {
    crypto.timingSafeEqual(bufA, bufA); // manté un temps de resposta consistent
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}
