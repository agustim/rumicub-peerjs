// ═══════════════════════════════════════════════════════════════
// proves E2E del Rummikub (Playwright).
// Requereix, en local:  python3 -m http.server 8080   i   peerjs --port 9000 --key peerjs
// Execució:  npx playwright test   (o:  npm run e2e)
// ═══════════════════════════════════════════════════════════════
const { test, expect } = require('@playwright/test');

const SIGNALLING = {
  host: process.env.E2E_HOST || 'localhost',
  port: process.env.E2E_PORT || '9000',
};
const GUEST_VIEWPORT = { width: 390, height: 844 };   // mòbil

/* Crea un context amb la configuració del servidor de senyalització i
   una pàgina carregada a l'app. */
async function openPlayer(browser, viewport) {
  const ctx = await browser.newContext({ viewport });
  await ctx.addInitScript(([h, p]) => {
    localStorage.setItem('rumikub_host', h);
    localStorage.setItem('rumikub_port', p);
  }, [SIGNALLING.host, String(SIGNALLING.port)]);
  const page = await ctx.newPage();
  return { ctx, page };
}

/* Una acció per al torn del jugador d'aquesta pàgina, a través de la lògica real
   de l'app (selecció + clickPlay/clickDraw/clickPass). Totes les jugades es
   validen PRIMER amb Rummy.resolvePlay (el mateix que fa servir l'amfitrió),
   així que sempre s'accepten i no hi ha intents rebutjats en bucle.
   Retorna què ha fet: {over} | {extended} | {opened} | {drew} | {passed}. */
async function smartMove(page) {
  return page.evaluate(() => {
    if (!myTurn() || G.gameOver) return { over: G.gameOver };
    sel.clear(); selMeld = null;
    const t = rack;
    const tryMove = (tiles, target) => {
      const r = Rummy.resolvePlay({ table: G.table, initial: G.initial }, me, tiles, target, []);
      if (!r.ok) return false;
      tiles.forEach((x) => sel.add(x.id));
      selMeld = target;
      clickPlay();               // amfitrió: valida i aplica · convidat: envia al host
      return true;
    };
    // enumera tots els subconjunts de mida k del raquis i crida fn per cadascun
    const subsets = (k, fn) => {
      const idx = Array(k);
      const rec = (c) => {
        if (c === k) { fn(idx.map((p) => t[p])); return; }
        const start = c ? idx[c - 1] + 1 : 0;
        const last = t.length - (k - c);
        for (let i = start; i <= last; i++) { idx[c] = i; rec(c + 1); }
      };
      rec(0);
    };

    // 1) extensió de combinacions del tauler amb 1-2 fitxes de la mà
    if (G.initial[me]) {
      for (let mi = 0; mi < G.table.length; mi++) {
        const base = G.table[mi];
        for (let i = 0; i < t.length; i++) {
          if (Rummy.validMeld([...base, t[i]]) && tryMove([t[i]], mi)) return { extended: 1 };
          for (let j = i + 1; j < t.length; j++) {
            if (Rummy.validMeld([...base, t[i], t[j]]) && tryMove([t[i], t[j]], mi)) return { extended: 2 };
          }
        }
      }
    }

    // 2) meld NOU amb 3-5 fitxes de la mà (exigeix 30 punts només si encara no ha obert)
    for (let k = 3; k <= 5; k++) {
      let found = false;
      subsets(k, (s) => {
        if (found) return;
        if (!Rummy.validMeld(s)) return;
        if (G.initial[me] !== true && Rummy.meldScore(s) < 30) return;
        if (tryMove(s, null)) found = true;
      });
      if (found) return G.initial[me] ? { newMeld: true } : { opened: true };
    }
    // 2b) tota la mà en vàries combinacions: necessita 30 si encara no ha obert
    if (t.length > 0 && t.length <= 8) {
      const parts = Rummy.bestPartition(t);
      const sum = parts ? parts.reduce((a, m) => a + Rummy.meldScore(m), 0) : 0;
      if (parts && (G.initial[me] || sum >= 30)) {
        t.forEach((x) => sel.add(x.id)); selMeld = null; clickPlay(); return { openedAll: sum };
      }
    }

    // 3) sense jugada: agafar de la pila si n'hi ha; si no, passar
    if (G.pileCount > 0) { clickDraw(); return { drew: true }; }
    clickPass(); return { passed: true };
  });
}

async function tableCount(page) {
  return page.locator('#table .tile').count();
}

test('partida completa: amfitrió + convidat juguen i els taulells es sincronitzen', async ({ browser }) => {
  test.setTimeout(90000);
  const host = await openPlayer(browser, { width: 1280, height: 800 });   // amfitrió d'escriptori
  const guest = await openPlayer(browser, GUEST_VIEWPORT);                // convidat mòbil

  try {
    // 1) l'amfitrió crea la partida i en veu el codi
    await host.page.goto('/');
    await expect(host.page.locator('#btnCreate')).toBeVisible();
    await host.page.click('#btnCreate');
    await expect(host.page.locator('#lobby')).toBeVisible({ timeout: 25000 });
    // myCode és una variable global (let), no window.myCode:
    await host.page.waitForFunction(() => String(myCode).length === 4, null, { timeout: 25000 });
    const code = await host.page.evaluate(() => myCode);
    expect(code).toMatch(/^\d{4}$/);

    // 2) el convidat s'hi uneix amb el codi (des del seu dispositiu)
    await guest.page.goto('/');
    await guest.page.fill('#inpCode', code);
    await guest.page.click('#connTop .row button.ok');
    await expect(guest.page.locator('#lobby')).toBeVisible({ timeout: 30000 });
    // l'amfitrió ha reservat plaça al convidat (plConn també és `let` global)
    await host.page.waitForFunction(() => plConn.length >= 2, null, { timeout: 20000 });

    // 3) l'amfitrió comença la partida
    await host.page.click('#btnStart');
    await expect(host.page.locator('#gameCard')).toBeVisible({ timeout: 30000 });
    await expect(guest.page.locator('#gameCard')).toBeVisible({ timeout: 30000 });

    // 4) tots dos reben 14 fitxes
    await expect(host.page.locator('#rack .tile')).toHaveCount(14, { timeout: 20000 });
    await expect(guest.page.locator('#rack .tile')).toHaveCount(14, { timeout: 20000 });

    // 5) simulació de partida real fins que algú guanyi (buit de mà) o un màxim de torns
    let guard = 0;
    for (; guard < 40; guard++) {
      await smartMove(host.page);
      await host.page.waitForTimeout(300);                 // propagació a través de PeerJS
      if ((await tableCount(guest.page)) !== (await tableCount(host.page)))
        await expect.poll(() => tableCount(guest.page), { timeout: 15000 }).toBe(await tableCount(host.page));
      if (await host.page.evaluate(() => G.gameOver)) break;

      await smartMove(guest.page);
      await guest.page.waitForTimeout(300);
      if ((await tableCount(host.page)) !== (await tableCount(guest.page)))
        await expect.poll(() => tableCount(host.page), { timeout: 15000 }).toBe(await tableCount(guest.page));
      if (await host.page.evaluate(() => G.gameOver)) break;
    }

    // 6) els dos taulells mostren exactament el mateix joc i algú ha obert
    const hostN = await tableCount(host.page);
    const guestN = await tableCount(guest.page);
    expect(guestN).toBe(hostN);
    expect(hostN).toBeGreaterThanOrEqual(3);   // algú ha plantat 30 punts
    const outcome = await host.page.evaluate(() => ({
      over: G.gameOver, winner: G.winner, pile: G.pileCount, hostRack: rack.length,
    }));
    if (outcome.over)
      console.log(`\n  🏁  Simulació: ha guanyat el Jugador ${outcome.winner + 1} perquè s'ha quedat sense fitxes (després de ${guard} torns). Tauler: ${hostN} fitxes · pila: ${outcome.pile}`);
    else if (outcome.pile === 0)
      console.log(`\n  ⏸  Simulació de ${guard} torns sense guanyador i pila esgotada → els jugadors passen (el joc no s'acaba per punts, tal com vols) · Tauler: ${hostN} fitxes · raquis de l'amfitrió: ${outcome.hostRack}`);
    else
      console.log(`\n  ⏸  Simulació de ${guard} torns sense guanyador → al joc real la partida continua fins que algú buidi la mà · Tauler: ${hostN} fitxes · pila: ${outcome.pile}`);
    console.log(`  ✅  taulell sincronitzat: ambdós veuen exactament el mateix joc (${hostN} fitxes)`);

    // 7) disseny mòbil aplicat al convidat (fitxa compacta; si el raquis és buit, es mira una del tauler)
    const guestRack = guest.page.locator('#rack .tile');
    const loc = (await guestRack.count()) > 0 ? guestRack.first() : guest.page.locator('#table .tile').first();
    const tileBox = await loc.boundingBox();
    expect(tileBox).not.toBeNull();
    expect(tileBox.width).toBeLessThan(40);      // 33px per la media query ≤520px
    expect(tileBox.height).toBeLessThan(52);     // 47px
    console.log(`  ✅  disseny mòbil: fitxa ${tileBox.width.toFixed(0)}×${tileBox.height.toFixed(0)}px al convidat`);
  } finally {
    await host.ctx.close();
    await guest.ctx.close();
  }
});

test('partida amb bots: 1 humà + 3 màquines juguen i el torn torna a l\'amfitrió', async ({ browser }) => {
  test.setTimeout(90000);
  // només cal l'amfitrió: els 3 bots viuen al seu navegador
  const host = await openPlayer(browser, { width: 1280, height: 800 });
  try {
    await host.page.goto('/');
    await expect(host.page.locator('#btnCreate')).toBeVisible();
    await host.page.click('#btnCreate');
    await expect(host.page.locator('#lobby')).toBeVisible({ timeout: 25000 });
    await host.page.waitForFunction(() => String(myCode).length === 4, null, { timeout: 25000 });

    // 4 jugadors en total, 3 de màquina
    await host.page.click('#maxBtns button:has-text("4")');
    await host.page.click('#botBtns button:has-text("3")');
    // amb només l'amfitrió present, el botó de començar ja és actiu (1 humà i prou)
    await expect(host.page.locator('#btnStart')).toBeEnabled();

    await host.page.click('#btnStart');
    await expect(host.page.locator('#gameCard')).toBeVisible({ timeout: 30000 });
    await expect(host.page.locator('#rack .tile')).toHaveCount(14, { timeout: 20000 });

    const setup = await host.page.evaluate(() => ({ pl: G.plCount, bots: G.bots.length, over: G.gameOver }));
    expect(setup.pl).toBe(4);
    expect(setup.bots).toBe(3);
    expect(setup.over).toBe(false);

    // l'amfitrió agafa una fitxa → el torn ha de passar pels 3 bots i tornar-li
    await host.page.click('#btnDraw');
    await expect
      .poll(async () => host.page.evaluate(() => ({ t: G.turn, over: G.gameOver })), { timeout: 25000 })
      .toEqual({ t: 0, over: false });
    console.log('  ✅  1 humà + 3 bots: els 3 bots han jugat el seu torn i el joc continua');
  } finally {
    await host.ctx.close();
  }
});

test('la pantalla d\'inici carrega i respecta la maquetació al mòbil', async ({ page }) => {
  await page.setViewportSize(GUEST_VIEWPORT);
  await page.goto('/');
  await expect(page.locator('h1').first()).toContainText(/Rummikub/i);
  await expect(page.locator('#btnCreate')).toBeVisible();
  await expect(page.locator('#inpCode')).toBeVisible();
  // cap desbordament horitzontal amb la finestra estreta
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  expect(overflow).toBeTruthy();
});
