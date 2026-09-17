import { AddToWalletClient } from 'addtowallet';
// El client npm fa servir node-fetch internament, no el fetch natiu de Node
// (undici). El fetch natiu ha donat ECONNRESET intermitent contra aquest
// mateix host en producció (Windows): per coherència i fiabilitat, fem
// servir també node-fetch per a la crida REST que el client no cobreix
// (les notificacions push).
import fetch from 'node-fetch';
import * as store from '../store/cardStore.js';

const RESTAURANT_NAME = process.env.RESTAURANT_NAME || 'Ateneu Unió';
const LOGO_URL = process.env.WALLET_LOGO_URL || 'https://ateneuuniorestaurant.com/assets/img/favicon-512.png';
const STAMPS_TO_REWARD = Number(process.env.STAMPS_TO_REWARD || 10);

// Estètica de marca (assets/css/styles.css): fons negre, text paper, vermell d'accent.
const BACKGROUND_COLOR = '#111111';
const FONT_COLOR = '#F4F4F0';

const client = new AddToWalletClient({
  apiKey: process.env.ADDTOWALLET_API_KEY,
});

// L'enviament de notificacions push NO forma part del client npm
// (AddToWalletClient només exposa createPass/updatePass/deletePass/
// getCredits/getPass): és un endpoint REST separat, documentat a
// https://app.addtowallet.co/api-docs/notifications, que cal cridar
// directament amb fetch fent servir la mateixa capçalera "apikey".
const ADDTOWALLET_BASE_URL = process.env.ADDTOWALLET_BASE_URL || 'https://app.addtowallet.co';

function stampsLabel(stamps) {
  return stamps >= STAMPS_TO_REWARD
    ? `${STAMPS_TO_REWARD} / ${STAMPS_TO_REWARD} · 🎁 Premi disponible!`
    : `${stamps} / ${STAMPS_TO_REWARD}`;
}

// L'API d'AddToWallet accepta com a màxim 3 textModulesData, amb aquests
// tres ids fixos (r1start / r1middle / r1end): no se'n poden fer servir
// d'altres ni afegir-ne més.
function buildTextModules({ clientName, clientPhone, stamps }) {
  return [
    { id: 'r1start', header: 'Segells', body: stampsLabel(stamps) },
    { id: 'r1middle', header: 'Client', body: clientName },
    { id: 'r1end', header: 'Telèfon', body: clientPhone },
  ];
}

// IMPORTANT: `client.updatePass()` NO fa un merge parcial — substitueix el
// document sencer. Si s'hi envien només els camps que canvien (p. ex. només
// textModulesData en segellar), la resta de camps (cardTitle, header,
// logoUrl, colors...) es reinicialitzen als valors per defecte de la
// plantilla ("*required*", logo placeholder, fons blanc). Per això SEMPRE
// es reconstrueix i s'envia el payload complet, tant en crear com en
// actualitzar una targeta.
function buildFullPayload({ clientName, clientPhone, stamps, barcodeValue }) {
  return {
    cardTitle: `${RESTAURANT_NAME} · Sello Ateneu`,
    header: clientName,
    logoUrl: LOGO_URL,
    hexBackgroundColor: BACKGROUND_COLOR,
    appleFontColor: FONT_COLOR,
    textModulesData: buildTextModules({ clientName, clientPhone, stamps }),
    linksModuleData: [
      { id: 'web', description: 'Web del restaurant', uri: 'https://ateneuuniorestaurant.com/' },
      { id: 'tel', description: 'Trucar', uri: 'tel:+34931253062' },
    ],
    barcodeType: 'QR_CODE',
    barcodeValue,
    barcodeAltText: barcodeValue,
  };
}

/**
 * Crea (o reutilitza, si el telèfon ja té targeta) el "Sello Ateneu",
 * la targeta de fidelitat per Apple Wallet / Google Wallet.
 */
async function createLoyaltyPass({ clientName, clientPhone, email }) {
  const phone = store.normalizePhone(clientPhone);

  const existing = store.findByPhone(phone);
  if (existing) {
    return { cardId: existing.cardId, passUrl: existing.passUrl, reused: true };
  }

  const stamps = 0;
  // El barcodeValue definitiu és el cardId, que no es coneix fins que la
  // targeta existeix: es crea amb un valor provisional buit i s'arrodoneix
  // tot seguit amb un updatePass (payload complet, veure nota de dalt).
  const { cardId, passUrl } = await client.createPass(
    buildFullPayload({ clientName, clientPhone: phone, stamps, barcodeValue: '' }),
  );

  const card = {
    cardId,
    passUrl,
    clientName,
    clientPhone: phone,
    email: email || null,
    stamps,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  store.saveCard(card);

  await client.updatePass(cardId, buildFullPayload({ clientName, clientPhone: phone, stamps, barcodeValue: cardId }));

  return { cardId, passUrl, reused: false };
}

/**
 * Suma un segell a la targeta. Al arribar a STAMPS_TO_REWARD, actualitza
 * el missatge de la targeta indicant que el premi ja està disponible.
 */
async function addStampToPass({ cardId }) {
  const card = store.getCard(cardId);
  if (!card) {
    const err = new Error('card_not_found');
    err.statusCode = 404;
    throw err;
  }

  const stamps = Math.min(card.stamps + 1, STAMPS_TO_REWARD);
  const rewardUnlocked = stamps >= STAMPS_TO_REWARD;

  await client.updatePass(cardId, buildFullPayload({
    clientName: card.clientName,
    clientPhone: card.clientPhone,
    stamps,
    barcodeValue: cardId,
  }));

  const updated = { ...card, stamps, updatedAt: new Date().toISOString() };
  store.saveCard(updated);

  return { cardId, stamps, stampsToReward: STAMPS_TO_REWARD, rewardUnlocked };
}

/**
 * Consulta l'estat local (segells) d'una targeta.
 */
async function getPassStatus(cardId) {
  const card = store.getCard(cardId);
  if (!card) {
    const err = new Error('card_not_found');
    err.statusCode = 404;
    throw err;
  }
  return {
    cardId: card.cardId,
    passUrl: card.passUrl,
    stamps: card.stamps,
    stampsToReward: STAMPS_TO_REWARD,
    rewardUnlocked: card.stamps >= STAMPS_TO_REWARD,
    updatedAt: card.updatedAt,
  };
}

/**
 * Llista totes les targetes (ús intern del personal / panell de gestió).
 */
async function listCards() {
  const cards = Object.values(store.readAll());
  return cards
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
    .map(card => ({
      cardId: card.cardId,
      passUrl: card.passUrl,
      clientName: card.clientName,
      clientPhone: card.clientPhone,
      stamps: card.stamps,
      stampsToReward: STAMPS_TO_REWARD,
      rewardUnlocked: card.stamps >= STAMPS_TO_REWARD,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
    }));
}

/**
 * Torna a enviar el payload complet d'una targeta existent tal com queda
 * calculat avui (colors, logo, textos, QR) — útil per "reparar" targetes
 * creades abans d'un canvi de disseny sense haver de tornar a registrar
 * el client.
 */
async function resyncPass(cardId) {
  const card = store.getCard(cardId);
  if (!card) {
    const err = new Error('card_not_found');
    err.statusCode = 404;
    throw err;
  }
  await client.updatePass(cardId, buildFullPayload({
    clientName: card.clientName,
    clientPhone: card.clientPhone,
    stamps: card.stamps,
    barcodeValue: cardId,
  }));
  return { cardId };
}

/**
 * Afegeix un missatge a la targeta del titular, visible quan obre la
 * targeta a Wallet. NO és un push real: Google Wallet distingeix entre
 * missatges de tipus TEXT (silenciós, el comportament per defecte) i
 * TEXT_AND_NOTIFY (banner + so al dispositiu); l'endpoint REST
 * d'addtowallet.co que fem servir aquí no exposa cap paràmetre per triar
 * TEXT_AND_NOTIFY (comprovat enviant-lo igualment: l'API el rebutja en
 * silenci i respon 200 sense que el missatge arribi com a notificació al
 * dispositiu) — és una limitació del proveïdor, no del nostre codi. Si en
 * un futur cal garantir notificacions reals, caldria una integració
 * directa amb l'API de Google Wallet / Apple PassKit en lloc d'aquest
 * wrapper.
 */
async function sendNotification({ cardId, heading, body }) {
  const card = store.getCard(cardId);
  if (!card) {
    const err = new Error('card_not_found');
    err.statusCode = 404;
    throw err;
  }

  // ECONNRESET és transitori (TLS/keep-alive contra un host extern, no un
  // error lògic): un parell de reintents amb backoff curt n'absorbeix la
  // majoria sense fer esperar l'usuari massa temps.
  const MAX_ATTEMPTS = 3;
  let lastNetworkError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    try {
      const res = await fetch(`${ADDTOWALLET_BASE_URL}/api/notifications/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: process.env.ADDTOWALLET_API_KEY,
        },
        body: JSON.stringify({ passId: cardId, heading, body }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(data.message || `notify_failed_${res.status}`);
        err.statusCode = res.status === 429 ? 429 : 502;
        throw err;
      }

      return { cardId, heading, body };

    } catch (err) {
      clearTimeout(timeout);
      if (err.statusCode) throw err; // error de resposta de l'API, no de xarxa: no reintentar

      lastNetworkError = err;
      if (attempt < MAX_ATTEMPTS) {
        await new Promise(r => setTimeout(r, 300 * attempt));
      }
    }
  }

  console.error('sendNotification network error after retries:', lastNetworkError);
  const err = new Error('notify_network_error');
  err.statusCode = 502;
  throw err;
}

export { createLoyaltyPass, addStampToPass, getPassStatus, listCards, resyncPass, sendNotification };
