# 🀄 Rummikub P2P per a mòbil

Versió en línia (2 jugadors) del **Rummikub** que funciona des del mòbil, feta amb
**PeerJS**: les dades del joc viatgen **directes entre els dos dispositius (P2P)**.
No cal registrar-se, no hi ha comptes ni servidor de partides.

- 🔗 Tot el joc és un únic `index.html` (client pur, sense backend).
- 🔒 La partida és P2P i xifrada (WebRTC DTLS) entre els dos jugadors.
- 📱 Dissenyat per al mòbil (tàctil, sense zoom accidental).

## Com es juga

1. Obre la pàgina des de dos dispositius (mòbil + ordinador, o dos mòbils).
2. Un jugador prem **🎲 Crear partida** i veu un **codi de 4 xifres**.
3. L'altre introdueix el codi i prem **🔗 Unir-se**.
4. La connexió es fa directament entre els dos dispositius (per WebRTC).

### Regles implementades

- Baralla completa: 106 fitxes (2 baralles de 52 + 2 comodins).
- Jugada inicial obligatòria de **30 punts** (només amb fitxes pròpies).
- Combinacions vàlides: escales del mateix color i grups de 3-4 del mateix número.
- El comodí substitueix qualsevol fitxa.
- Guanya qui buida la mà primer.
- Accions per torn: **▶ Jugar** (fitxes seleccionades, opcionalment afegides a un
  grup del tauler), **⬇ Agafar de la pila** o **➡ Passar**.

> ⚠️ **Simplificacions respecte al Rummikub oficial:** no es permet reordenar les
> combinacions del tauler (partir grups, moure fitxes entre combinacions ni
> recuperar un comodí), només s'hi poden afegir fitxes. La partida és només de
> 2 jugadors i sense temporitzador.

## 🚀 Desplegament a GitHub Pages

El projecte és estàtic (un sol fitxer + la llibreria local `vendor/peerjs.min.js`),
per tant encaixa perfectament amb GitHub Pages gratuït.

### Opció A: amb el workflow inclòs (recomanat)

El repositori ja inclou `.github/workflows/deploy.yml`. Quan el pugis a `main`,
GitHub Pages es desplega automàticament. Només cal activar-lo una vegada:

1. Puja aquest codi al teu repositori GitHub
   (ex. `agustim/rumicub-peerjs`).
2. Al repositori: **Settings → Pages**.
3. A **Build and deployment → Source** tria **"GitHub Actions"**.
4. Fes un push a `main` (o prem **Deploy** a la pestanya **Actions**).
5. La pàgina serà a: `https://<usuari>.github.io/<repo>/`
   (ex. `https://agustim.github.io/rumicub-peerjs/`).

### Opció B: sense workflow (desplegament des de la branca)

Si prefereixes no tocar res de GitHub Actions:

1. Al repositori: **Settings → Pages**.
2. A **Source** tria **"Deploy from a branch"** amb la branca `main` i carpeta `/ (root)`.
3. Guarda; en un minut la pàgina és en línia a la mateixa URL que l'Opció A.

> El camí `vendor/peerjs.min.js` és **relatiu**, així que funciona tant a
> `https://usuari.github.io/rumicub-peerjs/` com si algun dia ho poses a un
> domini propi.

## 🧪 Provar en local

Només cal servir el directori amb qualsevol servidor estàtic:

```bash
# amb Python
python3 -m http.server 8080
# o amb Node (npx)
npx serve .
```

Obre `http://localhost:8080` des de dos navegadors per provar-ho.

### Requisit: servidor de senyalització

Perquè els dos dispositius **es trobin**, PeerJS fa servir un *signaling server*
que només fa de "punt de trobada" (no hi passa la partida). Per defecte el codi
usa el servidor públic de PeerJS (`0.peerjs.com`), que és gratuït i no cal
configurar res.

Si algun dia el servidor públic falla o vols privacitat total, pots **allotjar el
teu propi PeerServer** (per exemple a un miniPC de casa o a un servei gratuït):

```bash
# si tens Node ≥ 18
npx peer --port 9000 --key peerjs
# o installat de forma permanent:
npm install -g peer
peerjs --port 9000 --key peerjs
```

Després, obre l'`index.html` i posa les dades de CONFIG:

```js
const CONFIG = { host: 'el-teu-ip-o-domini', port: 9000, key: 'peerjs', secure: false };
```

> Si fas servir el servern local, els jugadors han d'arribar a la pàgina per
> `http://IP:9000` o per una IP pública (cal obrir el port 9000 al router).

### ⚠️ Nota sobre xarxes

La connexió P2P fa servir WebRTC (STUN de Google). Normalment funciona amb
Wi‑Fi i dades mòbils, però **algunes xarxes corporatives o amb NAT estricte
bloquegen el P2P**. Consells si no us conecteu:

- Prova un dispositiu amb **dades mòbils (4G/5G)** i l'altre amb Wi‑Fi.
- Prova ambdós a la mateixa xarxa.
- Recorda que les dues persones han de tenir la **pàgina oberta** alhora.

## 🛠 Estructura

```
index.html            → el joc sencer (HTML + CSS + JS)
vendor/peerjs.min.js  → llibreria PeerJS 1.5.2 baixada localment (redundància davant caigudes de CDN)
.github/workflows/    → desplegament automàtic a GitHub Pages
```

## 📌 Limitacions i idees futures

- Reordenar combinacions del tauler (partir/moure/recuperar comodins).
- Mode 3-4 jugadors (realment el Rummikub és de 4).
- Temporitzador per torn i tauler de puntuació.
- Enviar els 4 dits llargs amb el teu PeerServer com a TURN per a xarxes estrictes.
