import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '..', '..', 'data', 'cards.json');

function readAll() {
  if (!fs.existsSync(DATA_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeAll(cards) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(cards, null, 2), 'utf8');
}

function normalizePhone(phone) {
  return String(phone || '').replace(/[^\d+]/g, '');
}

function findByPhone(phone) {
  const cards = readAll();
  const target = normalizePhone(phone);
  return Object.values(cards).find(c => c.clientPhone === target) || null;
}

function getCard(cardId) {
  const cards = readAll();
  return cards[cardId] || null;
}

function saveCard(card) {
  const cards = readAll();
  cards[card.cardId] = card;
  writeAll(cards);
  return card;
}

export { readAll, getCard, saveCard, findByPhone, normalizePhone };
