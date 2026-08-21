/* ═══════════════════════════════════════════════════════════════
   selfplay.js — Juga moltes partides bot-vs-bot i en mostra l'estadística.
   Fa servir un pool de workers (un per nucli) per aprofitar la CPU.

   Ús:
     node selfplay.js --games 1000                # 1000 partides a 2 jugadors
     node selfplay.js --games 200 --players 4     # prova amb 4 jugadors
     node selfplay.js --weights weights.json      # usant els pesos entrenats
     node selfplay.js --all                       # prova a 2,3,4,5 jugadors
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');
const { DEFAULT_WEIGHTS } = require('./bot.js');

const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
}
const GAMES = parseInt(opt('--games', '300'), 10);
const PLAYERS = parseInt(opt('--players', '2'), 10);
const WEIGHTS = opt('--weights', null);
const SEED = parseInt(opt('--seed', '12345'), 10);
const WORKERS = parseInt(opt('--workers', '' + Math.max(2, Math.min(8, os.cpus().length))), 10);
const ALL = args.includes('--all');

function loadWeights() {
  if (!WEIGHTS) return DEFAULT_WEIGHTS;
  const data = JSON.parse(fs.readFileSync(WEIGHTS, 'utf8'));
  return data.weights || data;   // weights.json té {weights,...}
}
const APPLY = loadWeights();

const WORKER_SRC = `
  const { parentPort, workerData } = require('worker_threads');
  const { playGame } = require('./bot.js');
  const out = [], start = Date.now();
  for (const seed of workerData.seeds) {
    let r;
    try {
      r = playGame({ players: workerData.players, seed, maxTurns: 2500, weightsFn: () => workerData.weights });
      out.push(r.gameOver ? { ok: true, winner: r.winner, winType: r.winType, turns: r.turns }
                          : { ok: false, turns: r.turns });
    } catch (e) { out.push({ err: String(e && e.stack || e) }); }
  }
  parentPort.postMessage({ results: out, ms: Date.now() - start });
`;

function playRange(seeds) {
  return new Promise((res, rej) => {
    const worker = new Worker(WORKER_SRC, {
      eval: true,
      workerData: { seeds, players: PLAYERS, weights: APPLY },
    });
    worker.on('message', res);
    worker.on('error', rej);
  });
}

function distribute(count, workers) {   // partitions 0..count-1 elections by seed
  const per = Math.ceil(count / workers);
  const parts = [];
  for (let w = 0; w < workers; w++) {
    const from = w * per, to = Math.min(count, from + per);
    if (from < to) parts.push(Array.from({ length: to - from }, (_, k) => SEED * 1000 + from + k));
  }
  return parts;
}

async function batch(label, players) {
  const parts = distribute(GAMES, WORKERS);
  const t0 = Date.now();
  const results = (await Promise.all(parts.map(playRange))).flatMap((x) => x.results);
  const dt = (Date.now() - t0) / 1000;
  const finished = results.filter((r) => r && r.ok);
  const winners = new Array(players).fill(0);
  let byHand = 0, byRound = 0, turns = 0;
  for (const r of finished) {
    winners[r.winner]++;
    if (r.winType === 'hand') byHand++; else byRound++;
    turns += r.turns;
  }
  console.log(`\n=== ${label} · ${players} jugadors · ${results.length} partides (${dt.toFixed(1)}s, ${(results.length / dt).toFixed(0)} jocs/s · ${workersUsed()} workers) ===`);
  for (let p = 0; p < players; p++)
    console.log(`  jugador ${p}: ${winners[p]} victòries (${(100 * winners[p] / Math.max(1, finished.length)).toFixed(1)}%)`);
  console.log(`  acabades: ${finished.length}/${results.length} · per mà buida: ${byHand} · per final de ronda: ${byRound} · torns mitjà: ${Math.round(turns / Math.max(1, finished.length))}`);
}
function workersUsed() { return WORKERS; }

(async () => {
  if (ALL) {
    for (const p of [2, 3, 4, 5]) await batch('selfplay', p);
  } else {
    await batch('selfplay', PLAYERS);
  }
  process.exit(0);
})();
