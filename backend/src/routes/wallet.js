import express from 'express';
import * as walletService from '../services/walletService.js';
import staffAuth from '../middleware/staffAuth.js';
import { createPassLimiter, staffLimiter, lookupLimiter } from '../middleware/rateLimit.js';

const router = express.Router();

function isValidPhone(phone) {
  const digits = (phone.match(/\d/g) || []).length;
  return /^[0-9+\s\-()]{9,20}$/.test(phone) && digits >= 9;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// L'API d'AddToWallet retorna identificadors tipus ObjectId de Mongo
// (24 caràcters hexadecimals). Validar el format abans de tocar el store
// o el proveïdor talla intents d'enumeració/injecció amb valors arbitraris.
function isValidCardId(cardId) {
  return /^[a-f0-9]{24}$/i.test(cardId);
}

// Treu caràcters de control (inclosos salts de línia) que no haurien
// d'aparèixer mai en un nom o email; evita qualsevol intent d'injecció
// en camps de text que després viatgen a un proveïdor extern.
function stripControlChars(str) {
  // eslint-disable-next-line no-control-regex
  return str.replace(/[\x00-\x1F\x7F]/g, '');
}

// POST /api/wallet/pass — formulari públic: registra un client i li crea la targeta.
router.post('/pass', createPassLimiter, async (req, res) => {
  const clientName = stripControlChars(String(req.body.clientName || '').trim());
  const clientPhone = stripControlChars(String(req.body.clientPhone || '').trim());
  const email = stripControlChars(String(req.body.email || '').trim());

  if (clientName.length < 2 || clientName.length > 80) {
    return res.status(400).json({ success: false, error: 'invalid_name' });
  }
  if (!isValidPhone(clientPhone)) {
    return res.status(400).json({ success: false, error: 'invalid_phone' });
  }
  if (email && (email.length > 120 || !isValidEmail(email))) {
    return res.status(400).json({ success: false, error: 'invalid_email' });
  }

  try {
    const { cardId, passUrl } = await walletService.createLoyaltyPass({ clientName, clientPhone, email });
    res.json({ success: true, cardId, passUrl });
  } catch (err) {
    console.error('createLoyaltyPass error:', err);
    res.status(502).json({ success: false, error: 'wallet_provider_error' });
  }
});

// POST /api/wallet/stamp — ús intern del personal: suma un segell.
router.post('/stamp', staffLimiter, staffAuth, async (req, res) => {
  const cardId = String(req.body.cardId || '').trim();
  if (!isValidCardId(cardId)) {
    return res.status(400).json({ success: false, error: 'invalid_card_id' });
  }

  try {
    const result = await walletService.addStampToPass({ cardId });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('addStampToPass error:', err);
    res.status(502).json({ success: false, error: 'wallet_provider_error' });
  }
});

// GET /api/wallet/pass/:cardId — estat d'una targeta (segells actuals).
router.get('/pass/:cardId', lookupLimiter, async (req, res) => {
  if (!isValidCardId(req.params.cardId)) {
    return res.status(400).json({ success: false, error: 'invalid_card_id' });
  }

  try {
    const status = await walletService.getPassStatus(req.params.cardId);
    res.json({ success: true, ...status });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('getPassStatus error:', err);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// GET /api/wallet/cards — ús intern del personal: llista totes les targetes
// (alimenta el panell de gestió). Protegit igual que /stamp.
router.get('/cards', staffLimiter, staffAuth, async (req, res) => {
  try {
    const cards = await walletService.listCards();
    res.json({ success: true, cards });
  } catch (err) {
    console.error('listCards error:', err);
    res.status(500).json({ success: false, error: 'internal_error' });
  }
});

// POST /api/wallet/resync — ús intern del personal: torna a enviar el
// disseny/text complet d'una targeta ja creada (colors, logo, textos).
// Útil per "reparar" targetes afectades per un canvi de disseny sense
// obligar el client a tornar-se a registrar.
router.post('/resync', staffLimiter, staffAuth, async (req, res) => {
  const cardId = String(req.body.cardId || '').trim();
  if (!isValidCardId(cardId)) {
    return res.status(400).json({ success: false, error: 'invalid_card_id' });
  }

  try {
    const result = await walletService.resyncPass(cardId);
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('resyncPass error:', err);
    res.status(502).json({ success: false, error: 'wallet_provider_error' });
  }
});

// POST /api/wallet/notify — ús intern del personal: envia una notificació
// push (banner a la pantalla de bloqueig) al titular d'una targeta.
router.post('/notify', staffLimiter, staffAuth, async (req, res) => {
  const cardId = String(req.body.cardId || '').trim();
  const heading = stripControlChars(String(req.body.heading || '').trim());
  const body = stripControlChars(String(req.body.body || '').trim());

  if (!isValidCardId(cardId)) {
    return res.status(400).json({ success: false, error: 'invalid_card_id' });
  }
  if (heading.length < 1 || heading.length > 100) {
    return res.status(400).json({ success: false, error: 'invalid_heading' });
  }
  if (body.length < 1 || body.length > 500) {
    return res.status(400).json({ success: false, error: 'invalid_body' });
  }

  try {
    const result = await walletService.sendNotification({ cardId, heading, body });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode) {
      return res.status(err.statusCode).json({ success: false, error: err.message });
    }
    console.error('sendNotification error:', err);
    res.status(502).json({ success: false, error: 'wallet_provider_error' });
  }
});

export default router;
