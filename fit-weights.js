/* ═══════════════════════════════════════════════════════════════
   fit-weights.js — Entrena els pesos del bot (el "model d'AI") per auto-joc.

   El model és un vector de pesos (weights.json). Aquí els optimitzem fent
   jugar el candidat contra una base fixa (mateixes llavors, rols canviats)
   i buscant els pesos que maximitzen el percentatge de victòries amb un
   ascens per coordenades (barrer sobre cada pes, sense gradients ni ML).

   Avaluació PARAL·LELA amb un pool persistent de workers.

   Ús:
     node fit-weights.js                     # ~2-4 min → escriu weights.json
     node fit-weights.js --games 80 --iters 12 --workers 8 --out weights.json
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const os = require('os');
const { Worker } = require('worker_threads');
const { DEFAULT_WEIGHTS } = require('./bot.js');

const TUNABLE = ['perTile', 'perMoved', 'openBonus', 'jokerPenalty', 'newMeldBonus', 'winSoon', 'finishBonus'];

const args = process.argv.slice(2);
function opt(name, dflt) {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
}
const GAMES = parseInt(opt('--games', '60'), 10);
const ITERS = parseInt(opt('--iters', '12'), 10);
const OUT = opt('--out', 'weights.json');
const SEED = parseInt(opt('--seed', '' + (Date.now() % 100000)), 10);
const WORKERS = parseInt(opt('--workers', '' + Math.max(2, Math.min(8, os.cpus().length))), 10);
const VERBOSE = !args.includes('--quiet');

const WORKER_SRC = `
  const { parentPort } = require('worker_threads');
  const { playGame } = require('./bot.js');
  const { DEFAULT_WEIGHTS } = require('./bot.js');
  parentPort.on('message', (m) => {
    let wins = 0, n = 0;
    for (const seed of m.seeds) {
      const r1 = playGame({ players: 2, seed, maxTurns: 2500, weightsFn: (w) => (w === 0 ? m.cand : DEFAULT_WEIGHTS) });
      if (r1.gameOver) { n++; if (r1.winner === 0) wins++; }
      const r2 = playGame({ players: 2, seed: seed + 1, maxTurns: 2500, weightsFn: (w) => (w === 1 ? m.cand : DEFAULT_WEIGHTS) });
      if (r2.gameOver) { n++; if (r2.winner === 1) wins++; }
    }
    parentPort.postMessage({ wins, n });
  });
`;

/* Pool persistent de workers: cada worker rep un lot de llavors i torna
   el nombre de victòries del candidat en aquelles partides. */
class EvalPool {
  constructor() {
    this.workers = [];
    this.busy = new Set();
    this.queue = [];
    for (let i = 0; i < WORKERS; i++) {
      const w = new Worker(WORKER_SRC, { eval: true });
      w.on('message', (m) => this._free(w, m));
      w.on('error', (e) => this._free(w, { wins: 0, n: 0, err: String(e) }));
      this.workers.push(w);
    }
  }
  _free(w, m) {
    this.busy.delete(w);
    if (m.err && VERBOSE) console.log('  avís worker:', m.err);
    w._job.resolve(m); w._job = null;
    const next = this.queue.shift();
    if (next) this._run({ ...next, w });
  }
  _run(job) {
    this.busy.add(job.w);
    job.w._job = job;
    job.w.postMessage({ seeds: job.seeds, cand: job.cand });
  }
  _submit(cand, seeds) {
    return new Promise((resolve) => {
      const job = { cand, seeds, resolve };
      const free = this.workers.find((w) => !this.busy.has(w));
      if (free) this._run({ ...job, w: free });
      else this.queue.push(job);
    });
  }
  evaluate(cand, games) {
    const seeds = [];
    for (let s = 0; s < games; s++) seeds.push(SEED * 100000 + s);
    const per = Math.ceil(seeds.length / this.workers.length);
    const jobs = [];
    for (let i = 0; i < this.workers.length; i++) {
      const part = seeds.slice(i * per, (i + 1) * per);
      if (!part.length) break;
      jobs.push(this._submit(cand, part));
    }
    return Promise.all(jobs).then((res) => {
      let wins = 0, n = 0;
      for (const r of res) { wins += r.wins; n += r.n; }
      return { winrate: n ? wins / n : 0.5, wins, n };
    });
  }
  close() { for (const w of this.workers) w.terminate(); }
}

const clone = (w) => ({ ...w });
const START = Date.now();
const fmt = (s) => ((s / 1000).toFixed(1) + 's');

(async () => {
  const pool = new EvalPool();
  let best = clone(DEFAULT_WEIGHTS);
  let bestEval = await pool.evaluate(best, GAMES);
  console.log(`fit-weights: ${2 * GAMES} partides per avaluació, ${ITERS} passades, ${WORKERS} workers`);
  console.log(`  punt de partida (pesos per defecte): ${(bestEval.winrate * 100).toFixed(1)}%  [${fmt(Date.now() - START)}]`);

  for (let it = 0; it < ITERS; it++) {
    const keys = [...TUNABLE].sort(() => ((SEED + it * 7 + Math.floor(Math.random() * 100)) % 2 ? 1 : -1));
    let improved = false;
    for (const k of keys) {
      for (const factor of [1.35, 0.75, 1.7, 0.6]) {
        const cand = clone(best);
        cand[k] = Math.max(0, Math.round(cand[k] * factor * 100) / 100);
        const ev = await pool.evaluate(cand, GAMES);
        if (ev.winrate > bestEval.winrate) {
          best = cand; bestEval = ev; improved = true;
          if (VERBOSE) console.log(`    ${k}×${factor} → ${(ev.winrate * 100).toFixed(1)}% ✓`);
        }
      }
    }
    console.log(`  passada ${it + 1}/${ITERS} → winrate ${(bestEval.winrate * 100).toFixed(1)}% (${bestEval.wins}/${bestEval.n}) ${improved ? '✓' : '·'}  [${fmt(Date.now() - START)}]`);
    if (!improved) break;
  }

  // avaluació final més gran per a un percentatge fiable
  const finalEval = await pool.evaluate(best, Math.max(GAMES, 200));
  const out = {
    weights: best,
    winrate: Math.round(finalEval.winrate * 1000) / 1000,
    games_evaluated: finalEval.n,
    note: 'Pesos del bot heurístic entrenats per auto-partides (fit-weights.js). Pesos no usats pel bot actual (drawPenalty, passPenalty, tinyHandPass, ownJokerKept) es conserven per compatibilitat.',
    date: new Date().toISOString(),
  };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 2));
  console.log(`\nEscrit ${OUT}`);
  console.log(`Pesos entrenats:\n${JSON.stringify(best, null, 2)}`);
  console.log(`Winrate final vs base: ${(finalEval.winrate * 100).toFixed(1)}% (${finalEval.wins}/${finalEval.n}) en ${fmt(Date.now() - START)}`);
  pool.close();
  process.exit(0);
})();
