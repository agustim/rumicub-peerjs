# 🀄 Rummikub P2P per a mòbil

Versió en línia (**2–8 jugadors**, fins a 2 jocs de fitxes) del **Rummikub** que
funciona des del mòbil, feta amb **PeerJS**: les dades del joc viatgen **directes
entre els dispositius (P2P)**. No cal registrar-se, no hi ha comptes ni servidor
de partides.

- 🔗 Tot el joc és un únic `index.html` (client pur, sense backend).
- 🔒 La partida és P2P i xifrada (WebRTC DTLS) entre els jugadors.
- 📱 Dissenyat per al mòbil (tàctil, sense zoom accidental).

## Com es juga

1. Obre la pàgina des de tants dispositius com jugadors (mòbils i/o ordinador).
2. Un jugador prem **🎲 Crear partida** i veu un **codi de 4 xifres** i un lobby.
3. Els altres introdueixen el codi i prem **🔗 Unir-se**; van apareixent al lobby.
4. L'amfitrió tria *quants jugadors* (2–8) i prem **🚀 Començar partida** (calen
   com a mínim 2). Amb **més de 4 jugadors s'usen automàticament 2 jocs de
   fitxes** (212 en total); amb 2–4, un sol joc (106).
5. La connexió es fa directament entre cada dispositiu i l'amfitrió (per WebRTC);
   l'amfitrió valida els moviments i retransmet el tauler a tothom.
6. Cada jugador comença amb **14 fitxes** siguin quants siguin.
7. Si l'altre jugador **no rep resposta en unir-se** (sense cap missatge), mira
   l'avís que apareix i, si cal, posa el teu servidor de senyalització a la
   **⚙️ Servidor de senyalització** (més avall expliquem com).

### Regles implementades

- Baralla completa: 2–4 jugadors → **1 joc de fitxes (106 amb 2 comodins)**;
  5–8 jugadors → **2 jocs (212 amb 4 comodins)**.
- 14 fitxes a la mà per a cada jugador.
- Jugada inicial obligatòria de **30 punts** (només amb fitxes pròpies).
- Combinacions vàlides: escales del mateix color i grups de 3-4 del mateix número.
- El comodí substitueix qualsevol fitxa i, per a la jugada inicial, compta pel
  valor que representa (ex: grup 13,13,comodí = 39 punts).
- Els torns roten en sentit horari; guanya qui buida la mà primer.
- Accions per torn: **▶ Jugar** (fitxes seleccionades, opcionalment afegides a un
  grup del tauler), **⬇ Agafar de la pila** o **➡ Passar**.

### 🤖 Jugar contra la màquina (bots)

- Al lobby, a més de *quants jugadors*, tria **🤖 Jugadors de la màquina**
  (de 0 fins a jugadors−1). Els llocs de màquina no necessiten cap dispositiu:
  viuen al navegador de l'amfitrió i juguen sols amb el mateix motor i pesos
  que `bot.js`.
- Exemple: **4 jugadors + 3 de màquina** = una persona (l'amfitrió) contra 3 bots.
- Només et cal obrir la pàgina des dels dispositius dels jugadors **humans**.

### Manipular el tauler

Dins del teu torn, el tauler és interactiu:

- **Toca una fitxa del tauler** per agafar-la (comodins inclosos) i
  **toca la capçalera «Grup N»** per marcar on la vols abocar.
- Pots **ampliar** grups i escales amb fitxes de la teva mà **o** del mateix
  tauler, **moure** fitxes d'una combinació a una altra, i **fer combinacions
  noves** mesclant fitxes pròpies amb les del tauler.
- El joc **valida el tauler final**: si en moure fitxes algun grup queda en mal
  estat (menys de 3 fitxes o combinació invàlida), la jugada es rebutja amb un
  avís i res no canvia. Amb un sol gest pots, per exemple, resoldre un comodí
  del mig d'una escala si el repairs en el mateix moviment.

> ⚠️ **Simplificacions respecte al Rummikub oficial:** no hi ha temporitzador i
> totes les manipulacions es confirmen d'un sol cop (no es poden deixar fitxes a
> mig fer): o acaben en un tauler vàlid, o es rebutgen.

## 🚀 Desplegament a GitHub Pages

El projecte és estàtic (un sol fitxer + la llibreria local `vendor/peerjs.min.js`),
per tant encaixa perfectament amb GitHub Pages gratuït.

### Opció A: amb el workflow inclòs (recomanat)

El repositori ja inclou `.github/workflows/deploy.yml`. Quan el pugis a `main`,
GitHub Pages es desplega automàticament. Només cal activar-lo una vegada:

1. Puja aquest codi al teu repositori GitHub
   (ex. `agustim/rummikub-peerjs`).
2. Al repositori: **Settings → Pages**.
3. A **Build and deployment → Source** tria **"GitHub Actions"**.
4. Fes un push a `main` (o prem **Deploy** a la pestanya **Actions**).
5. La pàgina serà a: `https://<usuari>.github.io/<repo>/`
   (ex. `https://agustim.github.io/rummikub-peerjs/`).

### Opció B: sense workflow (desplegament des de la branca)

Si prefereixes no tocar res de GitHub Actions:

1. Al repositori: **Settings → Pages**.
2. A **Source** tria **"Deploy from a branch"** amb la branca `main` i carpeta `/ (root)`.
3. Guarda; en un minut la pàgina és en línia a la mateixa URL que l'Opció A.

> El camí `vendor/peerjs.min.js` és **relatiu**, així que funciona tant a
> `https://usuari.github.io/rummikub-peerjs/` com si algun dia ho poses a un
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
npm install -g peer        # servidor PeerJS modern (nom a npm: "peer"; bin: "peerjs")
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

Tot en una sola màquina, amb diversos navegadors/tabs (2, 3… fins a 8):

1. Engega el teu servidor de senyalització:  `peerjs --port 9000 --key peerjs`
2. Serveix el joc:  `python3 -m http.server 8080`
3. Obre `http://localhost:8080` en **dues (o més) finestres**.
4. A totes, ⚙️ → `Servidor propi: localhost`, `port: 9000`.
5. A una prem "🎲 Crear partida", tria quants jugadors i prem "Començar"; a les
   altres posa el codi i "🔗 Unir-se".

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
game.js               → lògica compartida: regles + motor headless (navegador I Node)
vendor/peerjs.min.js  → llibreria PeerJS 1.5.2 baixada localment (redundància davant caigudes de CDN)
bot.js                → bot heurístic que juga amb el motor (decisió per pesos)
selfplay.js           → juga milers de partides bot-vs-bot i mostra l'estadística
fit-weights.js        → entrena els pesos del bot (el "model d'AI") → weights.json
weights.json          → el model entrenat (pesos)
tests/                → proves automàtiques (motor + E2E de navegador)
playwright.config.js  → configuració de les proves E2E
package.json          → scripts i dependències de desenvolupament
.github/workflows/    → desplegament automàtic a GitHub Pages
```

## 🤖 Provar el codi i entrenar l'AI

Tota la lògica del joc viu ara a `game.js` i és **la mateixa** al navegador
(`index.html` la carrega amb `<script src="game.js">`) i a Node (els scripts
d'AI la fan servir amb `require('./game.js')`). Això garanteix que el bot juga
**exactament** amb les mateixes regles que l'app.

### Proves automàtiques

```bash
npm install                 # devDeps: @playwright/test i peer (servidor PeerJS modern)
npx playwright install chromium   # només la primera vegada (baixa el navegador per a l'E2E)
npm run test:engine         # 12 proves del motor («node --test») — sense dependències
npm run e2e                 # proves E2E al navegador real (requereixen 2 serveis locals)
```

- `npm run test:engine` valida baralla, combinacions, **puntuació del comodí**
  (el cas 13,13,comodí=39), obertura de 30, manipulació del tauler, el motor
  headless, `legalPlays` + final de ronda, i la **paritat navegador↔Node**
  (carrega `index.html` en un entorn simulat i comprova que juga igual).
- `npm run e2e` obre **dos navegadors** (amfitrió d'escriptori + convidat mòbil),
  crea la partida, el convidat s'hi uneix amb el codi, juguen diversos torns a
  través de la UI real i es comprova que els **dos taulells es sincronitzen**
  (el P2P reenvia l'estat) i que el **disseny mòbil** està actiu. Calen, en local:
  1) `npm run e2e:server` (PeerServer a `:9000`) i 2) `python3 -m http.server 8080`.

### El bot i l'entrenament del "model d'AI"

El bot (`bot.js`) és heurístic: per cada torn enumera les jugades legals
(`legalPlays` a `game.js`) i puntua cada una amb un vector de **pesos** que,
en conjunt, són el **model**. `fit-weights.js` entrena aquests pesos per
**auto-partides**: el candidat juga contra la base (mateixes llavors, rols
canviats, en paral·lel amb el pool de workers) i es queden els pesos amb més
victòries.

```bash
node selfplay.js --games 1000        # milers de partides bot-vs-bot, amb estadístiques
node selfplay.js --all               # prova ràpida a 2, 3, 4 i 5 jugadors
node selfplay.js --weights weights.json   # amb el model entrenat
node fit-weights.js                  # reentrena → escriu weights.json (~2-4 min)
```

Sortida d'exemple de `selfplay.js` (100 partides, 4 workers):

```
=== selfplay · 2 jugadors · 100 partides (1.3s, 77 jocs/s) ===
  jugador 0: 60 victòries (60.0%)
  jugador 1: 40 victòries (40.0%)
  acabades: 100/100 · per mà buida: 8 · per final de ronda: 92 · torns mitjà: 131
```

> El fitxer `weights.json` generat conté els pesos entrenats per auto-joc
> (al repositori ja hi ha una versió entrenada: fan que el bot jugui fitxes una
> mica més agressivament i guanyin **~51% vs. la base**, avaluat amb 400
> partides). El model actual és heurístic de l'estil que vam acordar (etapes 1+2):
> llegir més partides i pesos és barat; si algun dia vols més força, el següent
> pas natural és un model apresa (lookahead o xarxa) reutilitzant el mateix motor.

## 📌 Limitacions i idees futures

- Reordenar combinacions del tauler (partir/moure/recuperar comodins).
- Temporitzador per torn i tauler de puntuació.
- Enviar els 4 dits llargs amb el teu PeerServer com a TURN per a xarxes estrictes.
