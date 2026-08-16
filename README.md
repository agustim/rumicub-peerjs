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
5. Si l'altre jugador **no rep resposta en unir-se** (sense cap missatge), mira
   l'avís que apareix i, si cal, posa el teu servidor de senyalització a la
   **⚙️ Servidor de senyalització** (més avall expliquem com).

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

Serveix el directori amb qualsevol servidor estàtic (per ex. `python3 -m http.server 8080`
o `npx serve .`) i obre `http://localhost:8080`.

> Pots provar el joc sencer al mateix ordinador amb dos navegadors/tabs: mira la
> "Prova ràpida al mateix ordinador" a l'apartat de senyalització.

### Requisit: servidor de senyalització

Perquè els dos dispositius **es trobin**, PeerJS fa servir un *signaling server*
que només fa de "punt de trobada": la partida no hi passa, va **directa P2P** (i
xifrada) entre els dos dispositius.

Per defecte el joc usa el **servidor públic de PeerJS (`0.peerjs.com`)**, sense
configurar res. ⚠️ **Aquest servidor públic és sovint inestable o està caigut.**
Com ho sabràs: l'amfitrió es queda a "⏳ Connectant…" i després surt un avís, o el
convidat no rep cap resposta. En aquest cas:

**La manera fiable és allotjar-te el teu propi PeerServer**, per exemple a un
miniPC de casa o a un VPS/servei gratuït:

```bash
# Node ≥ 18
npm install -g peerjs
peerjs --port 9000 --key peerjs
```

I a la pantalla d'inici del joc, desplega **⚙️ Servidor de senyalització** i
escriu:

```
Servidor propi:  <la-ip-o-domini-del-servidor>
port:            9000
```

> El joc tria sol el protocol: si la pàgina es serveix per **https** connectarà
> amb **wss**; si és **http**, amb ws.

#### Prova ràpida al mateix ordinador (avui mateix, sense desplegar res)

Tot en una sola màquina, amb dos navegadors/tabs:

1. Engega el teu servidor de senyalització:  `peerjs --port 9000 --key peerjs`
2. Serveix el joc:  `python3 -m http.server 8080`
3. Obre `http://localhost:8080` en **dues finestres**.
4. A totes dues, ⚙️ → `Servidor propi: localhost`, `port: 9000`.
5. A una prem "🎲 Crear partida"; a l'altra posa el codi i "🔗 Unir-se".

(`localhost` es considera un context segur, per això el WebRTC funciona amb ws
sense necessitat d'HTTPS.)

#### Dos mòbils (o mòbil + ordinador) de veritat

El navegador només permet WebRTC si la pàgina es serveix per **HTTPS** (context
segur). Opcions:

- **Recomanada:** la pàgina a GitHub Pages (https) i el teu PeerServer amb
  **TLS (wss)**, ja sigui al miniPC amb un certificat
  (`peerjs --port 9000 --key peerjs --sslkey clau.pem --sslcert cert.pem`) o en
  un servei al núvol que et doni un domini https gratuït.
- **Alternativa 100% a casa:** serveix la pàgina i el PeerServer des del mateix
  dispositiu de la xarxa local usant un certificat autosignat (per ex. `mkcert`),
  i accediu tots dos per `https://<ip-del-minipc>`. Els dos dispositius han
  d'estar a la mateixa xarxa (o cal obrir el port al router si no).

> ⚠️ **Recorda:** sense HTTPS la pàgina al mòbil pot no poder obrir el canal P2P,
> independentment de la senyalització. Per això la combinació **GitHub Pages
> (https) + PeerServer propi amb wss** és la més fiable.

### ⚠️ Nota sobre xarxes

La connexió P2P fa servir WebRTC (STUN de Google). Normalment funciona amb
Wi‑Fi i dades mòbils, però **algunes xarxes corporatives o amb NAT estricte
bloquegen el P2P**. Consells:

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
