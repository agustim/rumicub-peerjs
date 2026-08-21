// ═══════════════════════════════════════════════════════════════
// Proves automàtiques del motor (node:test, sense dependències).
//   Execució:  npm run test:engine   (o:  node --test tests/)
//
// Cobreix: baralla, validacions, puntuació amb comodins, partició,
// resolvePlay (inclosa l'obertura de 30), motor headless (createGame),
// legalPlays + final de ronda, i la PARITAT NAVEGADOR↔NODE: es carrega
// game.js + els scripts inline de index.html en un context vm i es comprova
// que juguen exactament igual que l'enginy.
// ═══════════════════════════════════════════════════════════════
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');

const R = require('../game.js');
const { DEFAULT_WEIGHTS, chooseMove, playGame } = require('../bot.js');

const t = (v, c, j) => j ? { id: 'J', joker: true } : { id: 't' + c + '_' + v, c, v };
const grp = (vals) => vals.map((x, i) => ({ id: 'g' + i, v: x, c: i % 4 }));
const runi = (color, vals) => vals.map((x, i) => ({ id: 'r' + i, v: x, c: color }));

test('baralla: 106 amb 1 joc, 212 amb 2', () => {
  assert.strictEqual(R.makeDeck(1).length, 106);
  assert.strictEqual(R.makeDeck(2).length, 212);
  assert.strictEqual(R.makeDeck(1).filter((x) => x.joker).length, 2);
  assert.strictEqual(R.makeDeck(2).filter((x) => x.joker).length, 4);
});

test('validacions bàsiques', () => {
  assert.ok(R.validRun(runi(0, [5, 6, 7])));
  assert.ok(!R.validRun(runi(0, [5, 6, 8])));
  assert.ok(R.validGroup(grp([8, 8, 8])));
  assert.ok(!R.validGroup(grp([8, 8, 9])));
  assert.ok(!R.validGroup(grp([8, 8, 8, 8, 8])));
  assert.ok(R.validMeld(runi(0, [10, 11, 12])));
  assert.ok(R.validMeld(grp([5, 5, 5])));
  assert.ok(!R.validMeld([t(0, 1), t(0, 2)]));
});

test('puntuació del comodí (el bug reportat per l\'usuari)', () => {
  // grup 13,13,comodí → 39 (no 26)
  assert.strictEqual(R.meldScore([{ id: 'a', v: 13, c: 0 }, { id: 'b', v: 13, c: 1 }, { id: 'J', joker: true }]), 39);
  // escala 5,6,comodí → 18
  assert.strictEqual(R.meldScore([{ id: 'a', v: 5, c: 0 }, { id: 'b', v: 6, c: 0 }, { id: 'J', joker: true }]), 18);
  // comodí al mig 8,comodí,10 → 27
  assert.strictEqual(R.meldScore([{ id: 'a', v: 8, c: 0 }, { id: 'J', joker: true }, { id: 'b', v: 10, c: 0 }]), 27);
  // 9..13 amb comodí → 9+10+11+12+13 = 55
  assert.strictEqual(R.meldScore(runi(0, [9, 10, 11, 12, 13])), 55);
  // ── bug dels comodins a les escales: mai al mig de números correlatius ──
  // 6,7,8,C,9,10 → el comodí ha de valer 11 (a l'extrem), no un 9 duplicat
  const jmid = [{ id: 'a', v: 6, c: 0 }, { id: 'b', v: 7, c: 0 }, { id: 'c', v: 8, c: 0 },
                { id: 'J', joker: true }, { id: 'd', v: 9, c: 0 }, { id: 'e', v: 10, c: 0 }];
  assert.strictEqual(R.meldScore(jmid), 51);                                    // 6+7+8+9+10+11
  assert.deepStrictEqual([...new Set(R.meldValues(jmid))].sort((a, b) => a - b), [6, 7, 8, 9, 10, 11]);
  assert.strictEqual(R.displayOrder(jmid).indexOf(jmid[3]), 5);                 // es pinta al final (★=11)
  // estendre una fila que ja duia comodí al capdamunt: 6,7,8,C + 9 → C val 10
  const jext = jmid.slice(0, 5);
  assert.strictEqual(R.meldScore(jext), 40);
  assert.strictEqual(R.displayOrder(jext).indexOf(jext[3]), 4);
  // una escala NO pot tenir més de 13 fitxes (1..13 + comodí seria una 14a)
  assert.ok(!R.validRun([...runi(0, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13]), { id: 'J', joker: true }]));
});

test('partició', () => {
  const tiles = [...runi(0, [5, 6, 7]), ...grp([8, 8, 8])];
  const p = R.bestPartition(tiles);
  assert.notStrictEqual(p, null);
  assert.strictEqual(p.length, 2);
  assert.ok(R.validMeld(p[0]) && R.validMeld(p[1]));
  // impossible → null
  assert.strictEqual(R.bestPartition([t(0, 1), t(0, 2), t(1, 5)]), null);
});

test('resolvePlay: tornar-li el canvi de tauler i obertura de 30', () => {
  const st = { table: [], initial: [false, false] };
  // obertura <30 → rebutjada
  let r = R.resolvePlay(st, 0, [t(0, 1), t(0, 2), t(0, 3)], null, []);
  assert.strictEqual(r.ok, false);
  // obertura ≥30 → acceptada i marca initial (grup 13,13,13 = 39)
  r = R.resolvePlay(st, 0, [{ id: 'a', v: 13, c: 0 }, { id: 'b', v: 13, c: 1 }, { id: 'c', v: 13, c: 2 }], null, []);
  assert.ok(r.ok);
  assert.strictEqual(r.state.initial[0], true);
  assert.strictEqual(r.state.table.length, 1);
  // no pot tocar el tauler a la primera jugada
  assert.strictEqual(R.resolvePlay({ table: [], initial: [false, false] }, 0, [t(0, 5)], 0, []).ok, false);
});

test('resolvePlay: moure un comodí entre combinacions mantenint-ho vàlid', () => {
  const table = [
    [{ id: 'm0', v: 10, c: 2 }, { id: 'm1', v: 11, c: 2 }, { id: 'm2', v: 12, c: 2 }, { id: 'J', joker: true }],
    [{ id: 'n0', v: 4, c: 0 }, { id: 'n1', v: 5, c: 0 }, { id: 'n2', v: 6, c: 0 }],
  ];
  const st = { table, initial: [true, true] };
  const r = R.resolvePlay(st, 0, [], 1, [{ from: 0, id: 'J' }]);
  assert.ok(r.ok);
  assert.strictEqual(r.state.table[0].length, 3);
  assert.strictEqual(r.state.table[1].length, 4);
  assert.ok(R.validMeld(r.state.table[0]) && R.validMeld(r.state.table[1]));
});

test('motor: torns, pila, repartiment per nombre de jugadors', () => {
  const g2 = R.createGame({ players: 2, seed: 1 });
  assert.strictEqual(g2.hand(0).length, 14);
  assert.strictEqual(g2.hand(1).length, 14);
  assert.strictEqual(g2.pileCount(), 106 - 28);
  // 5 jugadors → 2 jocs de fitxes
  const g5 = R.createGame({ players: 5, seed: 1 });
  assert.strictEqual(g5.pileCount(), 212 - 5 * 14);
  // no és el teu torn → rebutjat
  assert.strictEqual(g2.play(1, { tiles: [] }).ok, false);
  // agafar avançar torn
  assert.ok(g2.draw(0).ok);
  assert.strictEqual(g2.who(), 1);
});

test('determinisme: mateixa llavor, mateixa partida', () => {
  const a = R.createGame({ players: 2, seed: 42 }).hand(0).map((x) => x.id);
  const b = R.createGame({ players: 2, seed: 42 }).hand(0).map((x) => x.id);
  assert.deepStrictEqual(a, b);
  const c = R.createGame({ players: 2, seed: 43 }).hand(0).map((x) => x.id);
  assert.notDeepStrictEqual(a, c);
});

test('legalPlays + final de ronda (endWhenStuck)', () => {
  // construïm una partida on la pila s'esgota i ningú pot jugar → final de ronda
  const g = R.createGame({ players: 2, seed: 7, endWhenStuck: true });
  // juguem fins que es desencalli (o guanyi algú); el marc no ha de penjar-se
  let n = 0;
  while (!g.state().gameOver && n < 2000) {
    const who = g.who();
    const mv = chooseMove(who, g);
    const r = mv.type === 'play' ? g.play(who, mv) : (mv.type === 'draw' ? g.draw(who) : g.pass(who));
    if (!r.ok) g.pass(who);
    n++;
  }
  assert.strictEqual(g.state().gameOver, true);
  assert.notStrictEqual(g.state().winner, null);
  assert.ok(n < 1500, 'ha d\'acabar abans de 1500 torns (ha acabat a ' + n + ')');
});

test('self-play: totes les partides acaben i els pesos per defecte carreguen', async () => {
  for (let i = 0; i < 8; i++) {
    const r = playGame({ players: 2, seed: 900 + i });
    assert.strictEqual(r.gameOver, true, 'partida ' + i + ' ha d\'acabar');
    assert.ok(DEFAULT_WEIGHTS.perTile > 0);
    assert.ok(['hand', 'round'].includes(r.winType));
  }
});

/* ── PARITAT NAVEGADOR ↔ NODE ────────────────────────────────────
   Carrega game.js + els scripts inline de index.html en un context vm
   (això simula el navegador) i comprova que donen els mateixos resultats
   que l'enginy de Node. */
function browserContext() {
  const gjs = fs.readFileSync(require('path').join(__dirname, '../game.js'), 'utf8');
  const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  const inline = [];
  let m;
  while ((m = re.exec(html)) !== null) inline.push(m[1]);
  const s = { console, localStorage: { getItem: () => null, setItem: () => {} } };
  s.window = s;
  s.document = { getElementById: () => ({ style: {}, classList: { add() {}, remove() {} } }) };
  vm.createContext(s);
  vm.runInContext(gjs, s);
  for (const b of inline) vm.runInContext(b, s);
  return s;
}

test('reorganització: [13,13,X] + escala 9..12 i un 11 vermell a la mà → 13 a l\'escala i [11,X,13] nou (el cas de l\'usuari)', () => {
  const J = { id: 'J', joker: true };
  const st = {
    table: [
      [{ id: 'g13b', v: 13, c: 2 }, { id: 'g13r', v: 13, c: 0 }, J],
      [{ id: 'c', v: 9, c: 2 }, { id: 'd', v: 10, c: 2 }, { id: 'e', v: 11, c: 2 }, { id: 'f', v: 12, c: 2 }],
    ],
    initial: [true, false],
  };
  const res = R.resolvePlay(st, 0, [{ id: 'h', v: 11, c: 0 }], null,
    [{ from: 0, id: 'g13b' }, { from: 0, id: 'g13r' }, { from: 0, id: 'J' }]);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.table.length, 2);
  const run = res.state.table.find(m => m.some(t => t.id === 'c'));   // escala blava
  assert.strictEqual(run.length, 5);
  assert.strictEqual(R.meldScore(run), 55);
  const nm = res.state.table.find(m => m.some(t => t.id === 'h'));    // escala vermella nova
  assert.strictEqual(nm.length, 3);
  const ji = nm.findIndex(t => t.joker);
  assert.strictEqual(R.meldValues(nm)[ji], 12);   // el comodí fa de 12, entre 11 i 13
  assert.strictEqual(R.meldScore(nm), 36);
  assert.ok(res.state.table.every(m => R.validMeld(m)));
});

test('reorganització: partir una escala per aprofitar-ne un número ([1..7] → [1,2,3],[5,6,7],[4,4,4],[4,4,4])', () => {
  const r4 = { id: 'r4', v: 4, c: 2 };
  const st = {
    table: [[
      { id: 'r1', v: 1, c: 2 }, { id: 'r2', v: 2, c: 2 }, { id: 'r3', v: 3, c: 2 },
      r4,
      { id: 'r5', v: 5, c: 2 }, { id: 'r6', v: 6, c: 2 }, { id: 'r7', v: 7, c: 2 },
    ]],
    initial: [true],
  };
  const hand = [
    { id: 'h0', v: 4, c: 0 }, { id: 'h1', v: 4, c: 1 }, { id: 'h2', v: 4, c: 3 },
    { id: 'h3', v: 4, c: 0 }, { id: 'h4', v: 4, c: 1 },
  ];
  const res = R.resolvePlay(st, 0, hand, null, [{ from: 0, id: 'r4' }]);
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.state.table.length, 4);
  // dues escales curtes 1..3 i 5..7
  const scores = res.state.table.map(m => R.meldScore(m)).sort((a, b) => a - b);
  assert.deepStrictEqual(scores, [6, 12, 12, 18]);
  // dues escales i dos grups de 4s, tot vàlid
  assert.strictEqual(res.state.table.filter(m => R.validRun(m)).length, 2);
  assert.strictEqual(res.state.table.filter(m => R.validGroup(m)).length, 2);
  assert.ok(res.state.table.every(m => R.validMeld(m)));
  // el 4 de l'escala ja no hi és
  assert.ok(res.state.table.every(m => !m.includes(r4)));
});

test('reorganització: es refusa quan és impossible deixar el tauler vàlid', () => {
  // grup complet de 3s: treure'n un i jugar-lo amb una fitxa solta qualsevol (5)
  // no es pot repartir sense deixar el grup malmès ni cap combinació nova
  const st = {
    table: [[
      { id: 'a', v: 3, c: 2 }, { id: 'b', v: 3, c: 0 }, { id: 'c', v: 3, c: 1 }, { id: 'd', v: 3, c: 3 },
    ]],
    initial: [true],
  };
  const res = R.resolvePlay(st, 0, [{ id: 'h', v: 5, c: 0 }], null, [{ from: 0, id: 'd' }]);
  assert.strictEqual(res.ok, false);
  assert.ok((res.reason || '').includes('mal estat'));
});

test('el bot decideix una jugada sobre un estat sincronitzat (ús real a l\'app)', () => {
  const bot = require('../bot.js');
  const engine = R.createGame({ players: 4, seed: 7 });
  // mà de l'amfitrió amb un grup de 13 ≥ 30 → el bot ha de proposar-lo
  const hands = [
    [{ id: 'a', v: 13, c: 0 }, { id: 'b', v: 13, c: 1 }, { id: 'c', v: 13, c: 2 }, { id: 'x', v: 1, c: 0 }],
    [{ id: 'd', v: 5, c: 1 }, { id: 'e', v: 6, c: 1 }, { id: 'f', v: 7, c: 1 }, { id: 'y', v: 9, c: 0 }],
    [],
    [],
  ];
  engine.sync({ players: 4, hands, table: [], pile: [{ id: 'p', v: 2, c: 3 }], turn: 0,
                initial: [false, false, false, false], gameOver: false, winner: null });
  const move = bot.chooseMove(0, engine, bot.DEFAULT_WEIGHTS);
  assert.strictEqual(move.type, 'play');          // obertura de 39
  assert.ok((move.tiles || []).length === 3);
  // sobre un tauler obert: el bot sap jugar fitxes de la mà (respostes vàlides)
  const table = [[{ id: 'r1', v: 5, c: 1 }, { id: 'r2', v: 6, c: 1 }, { id: 'r3', v: 7, c: 1 }]];
  engine.sync({ players: 4, hands, table, pile: [], turn: 1,
                initial: [true, true, false, false], gameOver: false, winner: null });
  const m2 = bot.chooseMove(1, engine, bot.DEFAULT_WEIGHTS);
  assert.ok(['play', 'draw', 'pass'].includes(m2.type));
});

test('paritat navegador↔Node: el joc de la pàgina coincideix amb l\'enginy', () => {
  const b = browserContext();
  // mateixes regles disponibles
  const node = { makeDeck: R.makeDeck, meldScore: R.meldScore, validRun: R.validRun,
                 validGroup: R.validGroup, bestPartition: R.bestPartition, resolvePlay: R.resolvePlay };
  vm.runInContext('' +
    'globalThis.__same = ' +
    '  (Rummy.makeDeck(1).length === 106) &&' +
    '  (meldScore([{id:"a",v:13,c:0},{id:"b",v:13,c:1},{id:"J",joker:true}]) === 39) &&' +
    '  (meldScore([{id:"a",v:5,c:0},{id:"b",v:6,c:0},{id:"J",joker:true}]) === 18) &&' +
    '  (meldScore([{id:"a",v:6,c:0},{id:"b",v:7,c:0},{id:"c",v:8,c:0},{id:"J",joker:true},{id:"d",v:9,c:0},{id:"e",v:10,c:0}]) === 51) &&' +
    '  (validRun([{id:"a",v:1,c:0},{id:"b",v:2,c:0},{id:"c",v:3,c:0}])) &&' +
    '  (bestPartition([]).length === 0);',
  b);
  const same = vm.runInContext('globalThis.__same', b);
  assert.ok(same, 'les regles del navegador han de coincidir amb les de Node');
});

test('paritat: tryPlay de la pàgina delega a Rummy.resolvePlay', () => {
  const b = browserContext();
  vm.runInContext(`
    role='host'; me=0; plCount=2;
    G.table=[]; G.turn=0; G.pileCount=78; G.initial=[false,false]; G.gameOver=false; G.winner=null; G.plCount=2;
    rack=[{id:'k1',v:13,c:0},{id:'k2',v:13,c:1},{id:'k3',v:13,c:2},{id:'x',v:1,c:0}];
  `, b);
  vm.runInContext(`sel.clear();['k1','k2','k3'].forEach(i=>sel.add(i));selMeld=null;clickPlay();`, b);
  const tableLen = vm.runInContext('G.table.length', b);
  const initial = vm.runInContext('G.initial[0]', b);
  const handLen = vm.runInContext('rack.length', b);
  // 3 fitxes jugades → 1 meld al tauler, initial feta, 1 fitxa a la mà
  assert.strictEqual(tableLen, 1);
  assert.strictEqual(initial, true);
  assert.strictEqual(handLen, 1);
});
