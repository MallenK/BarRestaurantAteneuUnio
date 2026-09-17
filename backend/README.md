# Ateneu Unió · Wallet API

API Node.js/Express independent que gestiona la targeta de fidelitat
"Sello Ateneu" (Apple Wallet / Google Wallet) fent servir la llibreria
[`addtowallet`](https://www.npmjs.com/package/addtowallet), més un panell
web de gestió per provar-la i operar-la sense necessitat de Postman/curl.

Aquest servei **no forma part del desplegament estàtic** del web principal
(GitHub Pages + FTP a Hostinger, veure `../DEPLOY.md`): cap dels dos executa
processos Node. Cal desplegar-lo per separat en un host que sí n'executi un
(Render, Railway, Fly.io, un VPS amb PM2, etc.) i apuntar el frontend
(`../assets/js/wallet.js`) a la seva URL pública.

---

## Índex

1. [Configuració i arrencada](#1-configuració-i-arrencada)
2. [Panell de gestió visual](#2-panell-de-gestió-visual-admin)
3. [Endpoints de l'API](#3-endpoints-de-lapi)
4. [Model de dades i llibreria addtowallet](#4-model-de-dades-i-llibreria-addtowallet)
5. [Seguretat](#5-seguretat)
6. [Desplegament](#6-desplegament)
7. [Resolució de problemes](#7-resolució-de-problemes)

---

## 1. Configuració i arrencada

```bash
cd backend
cp .env.example .env
npm install
```

Edita `.env`:

| Variable | Descripció |
|---|---|
| `ADDTOWALLET_API_KEY` | Clau secreta del dashboard d'[addtowallet.co](https://app.addtowallet.co) → API Keys. **Mai** l'exposis al frontend ni la deixis a `.env.example`. |
| `STAFF_API_KEY` | Clau alternativa per a integracions màquina-a-màquina (`x-staff-key`). El panell `/admin` **no** la fa servir — hi entres amb un compte real (veure Better Auth sota). Genera-la amb `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `BETTER_AUTH_SECRET` | Secret de signatura de sessions/cookies del login. Genera'l amb `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `BETTER_AUTH_URL` | URL pública on viu aquest backend (el mateix origen que serveix `/admin` i `/api`). En local, `http://localhost:<PORT>`. |
| `ALLOWED_ORIGINS` | Dominis des d'on el frontend públic (`/fidelitat`) pot cridar l'API (CORS). Si es deixa buit, es denega tot origen creuat (fail-safe). El propi `BETTER_AUTH_URL` s'hi afegeix sempre automàticament. |
| `WALLET_LOGO_URL` | URL pública i quadrada del logo mostrat a la targeta. |
| `PORT` | Port on escolta el servidor (per defecte `3000`). |
| `STAMPS_TO_REWARD` | Segells necessaris per desbloquejar el premi (per defecte `10`). |

```bash
npm run dev   # amb recàrrega automàtica (node --watch)
# o
npm start
```

Comprova que ha arrencat:

```bash
curl http://localhost:3000/health
# {"ok":true}
```

### Primer cop: crear la base de dades d'autenticació i el primer compte

Better Auth (secció 2) guarda usuaris/sessions en SQLite (`data/auth.db`,
fora de git). Cal crear-hi les taules i almenys un compte de personal:

```bash
npm run auth:migrate                                      # crea data/auth.db
npm run create-staff -- "tu@ateneuuniorestaurant.com" "una-contrasenya-llarga" "El teu nom"
```

(`npm run auth:migrate` només cal la primera vegada o si actualitzes
`better-auth`; `create-staff` el pots repetir per afegir més comptes.)

---

## 2. Panell de gestió visual (`/admin`)

En lloc de provar l'API amb Postman/curl, el backend serveix un petit
panell estàtic (`public/admin/`) al mateix origen, sense build ni
dependències externes:

```
http://localhost:3000/admin/
```

**Accés protegit amb un compte real** (Better Auth, email + contrasenya —
no és HTTP Basic Auth ni una clau compartida). Sense sessió, `/admin`
redirigeix a `/login.html`. El registre **no és públic**: els comptes es
creen amb `npm run create-staff` (secció 1) — no hi ha cap formulari
d'alta obert a internet.

Un cop dins, el panell permet fer tot el que faries amb curl però amb
formularis i botons:

1. **Login** (`/login.html`) — email + contrasenya del compte de personal.
   La sessió és una cookie `httpOnly` signada (no es pot llegir des de
   JavaScript, mitiga robatori per XSS); dura 7 dies o fins que facis "Sortir".
2. **Crear targeta** — simula el formulari públic de `/fidelitat`: nom,
   telèfon, email opcional → crida real a `POST /api/wallet/pass` (no
   requereix sessió, és el mateix endpoint públic).
3. **Segellar targeta** — introdueix un `cardId` (o s'autoemplena en
   crear-ne una) i suma un segell → `POST /api/wallet/stamp`.
4. **Consultar targeta** — estat actual d'un `cardId` → `GET /api/wallet/pass/:cardId`.
5. **Totes les targetes** — taula amb totes les targetes registrades
   (client, telèfon, segells amb barra de progrés, cerca per nom/telèfon,
   enllaç al Wallet) amb botons "+1 segell" i "Reparar" per fila →
   `GET /api/wallet/cards` + `POST /api/wallet/stamp` / `POST /api/wallet/resync`.
   "Reparar" torna a enviar el disseny complet — útil si una targeta es va
   crear abans d'un canvi de disseny i ha quedat desactualitzada.

La cookie de sessió viatja automàticament en cada crida (`fetch` amb
`credentials: 'include'`, mateix origen): no cal enganxar cap clau enlloc
del panell. Cada acció mostra un avís curt d'èxit/error i, si cal
depurar, la resposta JSON crua de l'API a "Resposta de l'API" (plegat per
defecte).

### Marca de la targeta Wallet

Colors, logo i textos surten dels mateixos tokens que el web públic
(`--ink #111111`, `--paper #F4F4F0`). Dues limitacions reals del
proveïdor, no del nostre codi:

- **Marca d'aigua "Created with addtowallet.co"**: ve del pla gratuït del
  compte d'addtowallet.co (`premiumCard: false` a la resposta de l'API).
  Només desapareix comprant crèdits premium al seu dashboard — no hi ha
  cap paràmetre a l'API per treure-la per codi.
- **`textModulesData` limitat a 3 camps fixos** (`r1start`/`r1middle`/`r1end`,
  veure secció 4): la targeta només pot mostrar tres línies de text a més
  del títol/header i el logo.

Cada acció mostra la resposta JCON real de l'API en una caixa de sortida,
així veus exactament què respon el servidor (codi d'estat inclòs a la
consola de xarxa del navegador).

> El panell és una eina d'operació/QA, no el flux del client final: els
> clients sempre passen per `/fidelitat` al web públic.

---

## 3. Endpoints de l'API

| Mètode | Ruta | Ús | Protecció |
|--------|------|-----|-----------|
| GET | `/health` | Comprovació de vida | Cap |
| POST | `/api/wallet/pass` | Formulari públic: crea la targeta d'un client | Rate limit (8/h/IP) |
| POST | `/api/wallet/stamp` | Personal: suma un segell | Sessió o `x-staff-key` + rate limit |
| GET | `/api/wallet/pass/:cardId` | Consulta l'estat (segells) d'una targeta | Rate limit (30/5min/IP) |
| GET | `/api/wallet/cards` | Personal: llista totes les targetes | Sessió o `x-staff-key` + rate limit |
| POST | `/api/wallet/resync` | Personal: reenvia el disseny complet d'una targeta ja creada | Sessió o `x-staff-key` + rate limit |
| POST | `/api/wallet/notify` | Personal: afegeix un missatge a la targeta (⚠️ silenciós, no push — veure secció 3) | Sessió o `x-staff-key` + rate limit |
| GET/* | `/admin/*` | Panell de gestió visual | Sessió (Better Auth) |
| POST | `/api/auth/sign-in/email` | Login del panell | Rate limit (10/15min/IP) |
| POST | `/api/auth/sign-out` | Logout del panell | Sessió |
| GET | `/api/auth/get-session` | Sessió actual (usat pel panell) | Cap (retorna buit si no n'hi ha) |
| POST | `/api/auth/sign-up/email` | — | **Bloquejat (403)**: registre no públic |

### `POST /api/wallet/pass`

```json
// Body
{ "clientName": "Amy Jane", "clientPhone": "+34 600 000 000", "email": "amy@gmail.com" }

// Resposta 200
{ "success": true, "cardId": "6aac277ade630dcaa80da78d", "passUrl": "https://app.addtowallet.co/card/6aac277ade630dcaa80da78d" }
```

Si el telèfon ja té targeta creada, retorna la targeta existent en lloc de
duplicar-la. Errors possibles: `400 invalid_name` / `invalid_phone` /
`invalid_email`, `429 rate_limited`, `502 wallet_provider_error`.

### `POST /api/wallet/stamp`

Accepta **una de les dues**:

```
Cookie: better-auth.session_token=...     (el panell ja l'hi envia sol)
x-staff-key: <STAFF_API_KEY>              (integracions sense navegador)
```

```json
// Body
{ "cardId": "6aac277ade630dcaa80da78d" }

// Resposta 200
{ "success": true, "cardId": "6aac277ade630dcaa80da78d", "stamps": 4, "stampsToReward": 10, "rewardUnlocked": false }
```

En arribar a `STAMPS_TO_REWARD`, la targeta al mòbil del client s'actualitza
automàticament amb el missatge de premi disponible. Errors: `400 invalid_card_id`,
`401 unauthorized`, `404 card_not_found`, `429 rate_limited`, `502 wallet_provider_error`.

### `GET /api/wallet/pass/:cardId`

```json
{ "success": true, "cardId": "...", "passUrl": "...", "stamps": 4, "stampsToReward": 10, "rewardUnlocked": false, "updatedAt": "..." }
```

### `GET /api/wallet/cards`

Mateixa autenticació que `/api/wallet/stamp` (sessió o `x-staff-key`).

### `POST /api/wallet/notify`

```json
// Body
{ "cardId": "6aac...", "heading": "Oferta especial", "body": "Aquest cap de setmana, 2x1 en vermuts a la terrassa." }

// Resposta 200
{ "success": true, "cardId": "6aac...", "heading": "Oferta especial", "body": "..." }
```

Afegeix un missatge a la targeta. No forma part del client npm
`addtowallet` (que només exposa create/update/delete/getCredits/getPass):
crida directament l'endpoint REST
`POST https://app.addtowallet.co/api/notifications/send`, documentat a
`app.addtowallet.co/api-docs/notifications`, amb la mateixa capçalera
`apikey`.

**⚠️ NO és un push real — comprovat en producció.** Google Wallet
distingeix dos tipus de missatge ([Message.messageType](https://developers.google.com/wallet/reference/rest/v1/Message),
comprovat contra la doc oficial de Google): `TEXT` (per defecte —
silenciós, només visible quan el client obre la targeta) i
`TEXT_AND_NOTIFY` (banner + so al dispositiu). L'API d'addtowallet.co que
fem servir aquí **no exposa cap paràmetre per triar `TEXT_AND_NOTIFY`**:
es va provar explícitament enviant-lo com a camp extra
(`messageType`/`notify`) i el proveïdor va respondre `200 OK` sense que el
missatge arribés mai com a notificació real al dispositiu (confirmat en
un iPhone/Android real amb les notificacions de Wallet activades). És una
limitació del proveïdor triat, no del nostre codi. Si en algun moment cal
garantir notificacions reals (banner + so), l'única via és substituir
aquest wrapper per una integració directa amb l'API de Google Wallet
Objects i el web service de PassKit d'Apple — una feina notablement més
gran (compte de servei de Google, certificats d'Apple, infraestructura de
push APNs) que no s'ha fet en aquest projecte.

**Límit del proveïdor**: Google Wallet talla a 3 notificacions per
targeta cada 24 h — a partir de la 4a, l'API respon `429`.
Errors: `400 invalid_card_id` / `invalid_heading` / `invalid_body`,
`404 card_not_found`, `429 rate_limited`, `502 wallet_provider_error`.

```json
{ "success": true, "cards": [ { "cardId": "...", "clientName": "...", "clientPhone": "...", "stamps": 4, ... } ] }
```

---

## 4. Model de dades i llibreria addtowallet

`addtowallet` és un client prim de l'API SaaS d'[addtowallet.co](https://app.addtowallet.co)
(cal compte + API key allà; no genera passes localment). Limitacions reals
de la seva API descobertes durant la implementació:

- **`textModulesData` accepta com a màxim 3 elements**, amb ids fixos
  `r1start` / `r1middle` / `r1end` (qualsevol altre id o més de 3 elements
  el rebutja amb `400`). Per això la targeta només mostra tres camps:
  segells, nom i telèfon — el missatge de premi es concatena dins el
  camp de segells en lloc d'anar en un mòdul propi.
- No guarda cap "comptador de segells" natiu: el nombre de segells és
  estat nostre, no seu. Per això `backend/data/cards.json` és la font de
  veritat local, i cada `addStampToPass` fa un `updatePass` per reflectir
  el nou comptador al text de la targeta.
- **`client.updatePass()` NO fa un merge parcial — substitueix el document
  sencer.** Enviar-hi només el camp que canvia (p. ex. només
  `textModulesData` en segellar) reinicialitza la resta de camps
  (`cardTitle`, `header`, `logoUrl`, colors...) als valors per defecte de
  la plantilla, que es mostren al mòbil com a text literal `"*required*"`
  i un logo placeholder. `walletService.js` ho evita amb
  `buildFullPayload()`: **sempre** es reenvia el payload complet (títol,
  header, logo, colors, textos, QR) a cada `createPass`/`updatePass`, mai
  un fragment. Si s'afegeix cap crida nova a `client.updatePass`, ha de
  passar per aquesta funció.
- **Important — bug conegut del paquet publicat (`0.1.7`)**: el seu build
  CommonJS (`dist/index.cjs`) està trencat (`ReferenceError: AddToWalletClient
  is not defined` en fer `require('addtowallet')`), perquè oblida importar
  el client abans de reexportar-lo. El build ESM (`dist/index.js`) sí
  funciona. Per això aquest backend és `"type": "module"` i tot fa servir
  `import`/`export` — **no convertir a CommonJS** sense comprovar primer si
  el paquet ha publicat una versió que ho arregli.

### `data/cards.json`

```json
{
  "<cardId>": {
    "cardId": "...", "passUrl": "...", "clientName": "...", "clientPhone": "...",
    "email": "...", "stamps": 4, "createdAt": "...", "updatedAt": "..."
  }
}
```

Fitxer local, sense base de dades — coherent amb la resta del projecte,
que tampoc en fa servir cap. En un host amb sistema de fitxers efímer
caldrà un disc persistent o migrar-ho a una base de dades real (veure
secció de desplegament).

---

## 5. Seguretat

Mesures aplicades a `src/server.js` i middlewares:

- **Cap secret al frontend**: `ADDTOWALLET_API_KEY` només viu al backend.
  El frontend públic mai la veu.
- **Capçaleres de seguretat (`helmet`)**: Content-Security-Policy estricta
  (`script-src 'self'`, sense `unsafe-eval` ni inline scripts al panell),
  `X-Frame-Options` / `frame-ancestors 'none'` (anti-clickjacking),
  `X-Content-Type-Options: nosniff`, HSTS, etc.
- **CORS amb allowlist explícita i fail-safe**: si `ALLOWED_ORIGINS` no
  està configurat, es denega tot origen creuat per defecte (no "permet
  tot" per omissió). Mètodes i capçaleres restringits als imprescindibles.
- **Rate limiting per capes** (`express-rate-limit`):
  - Global: 300 peticions / 15 min / IP (xarxa de seguretat general).
  - `POST /api/wallet/pass`: 8 / hora / IP (evita crear centenars de
    targetes amb un script, mateix criteri que `contact.php`).
  - `GET /api/wallet/pass/:cardId`: 30 / 5 min / IP (dificulta enumerar
    `cardId` a força bruta).
  - Endpoints de personal: 120 / 5 min / IP, a més de l'autenticació.
  - `app.set('trust proxy', 1)` perquè, darrere un proxy invers en
    producció, el rate limit compti la IP real del client i no la del
    proxy.
- **Login del panell amb [Better Auth](https://www.better-auth.com/)**, no
  amb una clau compartida: comptes reals (email + contrasenya, hash amb
  scrypt), sessions com a cookies `httpOnly` + `SameSite=Lax` signades amb
  `BETTER_AUTH_SECRET` (il·legibles i no falsificables des de JavaScript
  del navegador — mitiga robatori de sessió per XSS), guardades en SQLite
  (`data/auth.db`, fora de git).
  - **Registre no públic**: `POST /api/auth/sign-up/email` es bloqueja
    explícitament a `server.js` abans d'arribar al handler de Better Auth.
    Els comptes de personal només es creen des del servidor amb
    `npm run create-staff` (`scripts/create-staff-user.js`), mai via HTTP.
  - **Rate limit dedicat al login** (10 intents / 15 min / IP) contra força
    bruta de contrasenyes.
  - `POST /api/wallet/stamp` i `GET /api/wallet/cards` accepten sessió
    *o* `x-staff-key`, pensat per a una futura integració sense navegador
    (p. ex. un TPV) sense obligar a compartir contrasenyes.
- **Autenticació en temps constant**: `x-staff-key` es compara amb
  `crypto.timingSafeEqual` (`src/lib/safeEqual.js`) en lloc de `===`, per
  no filtrar informació via temporització.
- **Validació estricta d'entrada** a totes les rutes: nom (2-80 chars),
  telèfon (patró + mínim de dígits), email (format + longitud), i
  `cardId` (24 hex, format real dels identificadors d'AddToWallet) —
  qualsevol valor fora de format es rebutja amb `400` abans de tocar el
  store o el proveïdor extern.
- **Sanejament de text**: es treuen caràcters de control (salts de línia
  inclosos) de `clientName` i `email` abans de desar-los o enviar-los a
  AddToWallet.
- **Límit de mida del body** (`express.json({ limit: '10kb' })`): cap
  payload legítim s'hi acosta; talla intents d'esgotar memòria amb bodies
  enormes.
- **Sense fuites d'informació interna**: el gestor d'errors centralitzat
  mai retorna stack traces ni detalls interns al client; només registra
  per consola (`morgan` + `console.error`) per depuració del propi equip.
- **`.env` fora de git** (`.gitignore`), `.env.example` sempre amb
  placeholders — mai claus reals.

### Pendent si es vol reforçar més

- Migrar `data/cards.json` (i `data/auth.db`) a una base de dades real si
  el trànsit creix (el fitxer JSON no gestiona bé escriptures concurrents
  a alta freqüència; SQLite hi aguanta molt més però segueix sent un sol
  fitxer al disc del servidor).
- Activar `requireEmailVerification` a `src/auth.js` si es vol confirmar
  el correu abans de permetre l'accés (útil si en el futur es crea gent
  amb un formulari intern en lloc del script).
- Rotació periòdica de `STAFF_API_KEY` i de `BETTER_AUTH_SECRET`
  (canviar `BETTER_AUTH_SECRET` tanca totes les sessions actives).
- Si es desplega a un host sense TLS integrat, forçar HTTPS explícitament
  (Render/Railway ja el gestionen automàticament) i posar `NODE_ENV=production`
  perquè Better Auth exigeixi cookies `Secure`.

---

## 6. Desplegament suggerit (Render, gratuït per a baix trànsit)

1. Crea un nou "Web Service" a Render apuntant a la carpeta `backend/` d'aquest repo.
2. Build command: `npm install` · Start command: `npm start`.
3. Afegeix totes les variables de `.env.example` com a variables d'entorn del
   servei, amb valors reals (`BETTER_AUTH_URL` = la URL pública que et doni
   Render, `BETTER_AUTH_SECRET` generat de nou per producció — no reutilitzis
   el de local).
4. Activa un disc persistent muntat a `backend/data` — **imprescindible ara**:
   a més de `cards.json`, hi viu `auth.db` amb els comptes de personal. Sense
   disc persistent, cada redeploy esborraria tots dos i caldria tornar a
   crear comptes i clients.
5. Un cop desplegat, corre una sola vegada (via la shell de Render, o
   temporalment amb `render exec`):
   ```bash
   npm run auth:migrate
   npm run create-staff -- "tu@ateneuuniorestaurant.com" "contrasenya-de-producció" "Nom"
   ```
6. Actualitza `WALLET_API_BASE` a `../assets/js/wallet.js` amb la URL
   pública del servei, i `ALLOWED_ORIGINS` amb el domini real del web.
7. Accedeix al panell a `https://<el-teu-servei>/admin/` i inicia sessió
   amb el compte creat al pas 5.

---

## 7. Resolució de problemes

- **`ReferenceError: AddToWalletClient is not defined`**: estàs important
  el paquet amb `require()` des d'un fitxer CommonJS. Assegura't que
  `package.json` té `"type": "module"` i tot el codi fa servir `import`/`export`
  (veure secció 4).
- **`wallet_provider_error` (502) en crear una targeta**: revisa els logs
  del servidor (`console.error` imprimeix l'error real d'AddToWallet, per
  exemple clau invàlida o límits de `textModulesData`).
- **`unauthorized` (401) a `/api/wallet/stamp` o `/api/wallet/cards`**: ni
  la sessió (cookie) ni `x-staff-key` són vàlides. Si ve del panell, torna
  a fer login; si ve d'un script, revisa `STAFF_API_KEY`.
- **`/admin` redirigeix sempre a `/login.html`**: no tens sessió (o ha
  caducat). Inicia sessió amb un compte creat amb `npm run create-staff`.
  Si encara no n'has creat cap, veure secció 1.
- **`signup_disabled` (403) a `/api/auth/sign-up/email`**: és el
  comportament esperat — el registre no és públic (secció 5). Crea
  comptes amb `npm run create-staff`.
- **`origin_not_allowed` (403)**: el domini que fa la crida no és a
  `ALLOWED_ORIGINS` ni coincideix amb `BETTER_AUTH_URL`. Un navegador
  envia la capçalera `Origin` fins i tot en peticions al mateix origen
  (p. ex. el logout del panell), per això `BETTER_AUTH_URL` s'afegeix
  sempre automàticament a la llista permesa — assegura't que sigui la URL
  real des d'on serveixes `/admin`. En local, si proves `/fidelitat` des
  d'un altre port/servidor estàtic, afegeix-lo també a `ALLOWED_ORIGINS`.
- **`Missing or null Origin` en provar l'API d'auth amb curl**: normal —
  Better Auth exigeix `Origin` en peticions que canvien estat (sign-in,
  sign-out). Un navegador ja l'envia sol; amb curl cal afegir
  `-H "Origin: <BETTER_AUTH_URL>"` manualment per provar-ho.
- **`rate_limited` (429)**: has superat el límit d'aquell endpoint; espera
  la finestra indicada a la capçalera `RateLimit-Reset` de la resposta.
