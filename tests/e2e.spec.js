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

/* Decideix el torn del jugador d'aquesta pàgina des del mateix codi de l'app.
   Retorna: {turn} → no és el seu torn; {canOpen} → no pot fer 30; {done} → ja va obrir.
   Busca un únic meld de 3-5 fitxes ≥ 30 (o la partició de la mà sencera si és petita). */
async function openerPlan(page) {
  return page.evaluate(() => {
    if (!myTurn()) return { turn: false };
    if (G.initial[me]) return { done: true };
    const t = rack;
    for (let i = 0; i < t.length; i++)
      for (let j = i + 1; j < t.length; j++)
        for (let k = j + 1; k < t.length; k++) {
          const s3 = [t[i], t[j], t[k]];
          if (Rummy.validMeld(s3) && Rummy.meldScore(s3) >= 30) return { playIds: s3.map((x) => x.id), score: Rummy.meldScore(s3) };
          for (let l = k + 1; l < t.length; l++) {
            const s4 = [t[i], t[j], t[k], t[l]];
            if (Rummy.validMeld(s4) && Rummy.meldScore(s4) >= 30) return { playIds: s4.map((x) => x.id), score: Rummy.meldScore(s4) };
            for (let m = l + 1; m < t.length; m++) {
              const s5 = [t[i], t[j], t[k], t[l], t[m]];
              if (Rummy.validMeld(s5) && Rummy.meldScore(s5) >= 30) return { playIds: s5.map((x) => x.id), score: Rummy.meldScore(s5) };
            }
          }
        }
    // mà petita: pot ser que s'obri amb tota la mà dividida en vàries combinacions
    if (t.length <= 8) {
      const parts = Rummy.bestPartition(t);
      if (parts) {
        const sum = parts.reduce((a, m) => a + Rummy.meldScore(m), 0);
        if (sum >= 30) return { playIds: t.map((x) => x.id), score: sum };
      }
    }
    return { canOpen: false };
  });
}

/* Juga un torn a través de la UI real (clicar fitxes + botó Jugar/Agafar). */
async function takeTurn(page) {
  const plan = await openerPlan(page);
  if (plan.turn === false) return { skipped: true };      // NO és el seu torn
  if (plan.done) return { done: true };
  if (plan.playIds) {
    await page.evaluate((ids) => ids.forEach((id) => clickTile(id)), plan.playIds);
    await page.click('#btnPlay');
    return { played: true, score: plan.score };
  }
  // és el seu torn però no pot fer 30: agafa de la pila
  await page.click('#btnDraw');
  return { drew: true };
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

    // 5) diversos torns a través de la UI fins que algú hagi posat 30 punts al tauler
    let guard = 0;
    while ((await tableCount(host.page)) < 3 && guard < 10) {
      const hp = await openerPlan(host.page);
      if (hp.turn !== false) await takeTurn(host.page);
      await host.page.waitForTimeout(400);                 // propagació a través de PeerJS
      if ((await tableCount(guest.page)) !== (await tableCount(host.page))) {
        // espera que el convidat rebi l'estat de l'amfitrió
        await expect
          .poll(async () => await tableCount(guest.page), { timeout: 15000 })
          .toBe(await tableCount(host.page));
      }
      const gp = await openerPlan(guest.page);
      if (gp.turn !== false) await takeTurn(guest.page);
      await guest.page.waitForTimeout(400);
      if ((await tableCount(host.page)) !== (await tableCount(guest.page))) {
        await expect
          .poll(async () => await tableCount(host.page), { timeout: 15000 })
          .toBe(await tableCount(guest.page));
      }
      guard++;
    }

    // 6) els dos taulells mostren exactament el mateix joc
    const hostN = await tableCount(host.page);
    const guestN = await tableCount(guest.page);
    expect(guestN).toBe(hostN);
    expect(hostN).toBeGreaterThanOrEqual(3);   // algú ha plantat 30 punts
    console.log(`\n  ✅  taulell sincronitzat: ${hostN} fitxes visibles per als dos jugadors`);

    // 7) disseny mòbil aplicat al convidat (fitxes del raquis compactes)
    const tileBox = await guest.page.locator('#rack .tile').first().boundingBox();
    expect(tileBox).not.toBeNull();
    expect(tileBox.width).toBeLessThan(40);      // 33px per la media query ≤520px
    expect(tileBox.height).toBeLessThan(52);     // 47px
    console.log(`  ✅  disseny mòbil: fitxa del raquis ${tileBox.width.toFixed(0)}×${tileBox.height.toFixed(0)}px al convidat`);
  } finally {
    await host.ctx.close();
    await guest.ctx.close();
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
