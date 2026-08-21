/* ═══════════════════════════════════════════════════════════════
   bot.js — Bot heurístic per al Rummikub.
   Usa el motor headless de game.js (createGame) i la seva enumeració
   de jugades legals (legalPlays). Puntua cada moviment amb uns pesos
   ajustables; els pesos es poden optimitzar amb fit-weights.js.

   Funciona a Node (require) i al navegador (exposa global RummyBot),
   on l'amfitrió l'usa per decidir les jugades dels llocs "màquina".

   Ús (Node):
     const { createGame } = require('./game.js');
     const { chooseMove, playGame } = require('./bot.js');
   Ús (navegador): es carrega després de game.js → window.RummyBot
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  const api = factory(root ? root.Rummy : null);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.RummyBot = api;
})(typeof window !== 'undefined' ? window : null, function (R) {
  if (!R && typeof require === 'function') R = require('./game.js');

const DEFAULT_WEIGHTS = {
  perTile: 6,          // guany per cada fitxa de la mà que poses al tauler
  perMoved: 4,         // guany per cada fitxa que mous (del tauler a un meld)
  openBonus: 18,       // extra per completar la primera jugada (30 punts)
  jokerPenalty: 9,     // penalització per gastar un comodí abandonant-lo a un meld
  ownJokerKept: 0,     // (reservat) no gastar comodins propis innecessàriament
  newMeldBonus: 1,     // petita preferència per fer combinacions noves
  drawPenalty: 1,      // cost relatiu de no poder jugar (agafar passa)
  winSoon: 2,          // més valor quan et queden poques fitxes (ràbia final)
  passPenalty: 0,
  finishBonus: 15,     // extra si la jugada buida la mà del tot
  tinyHandPass: 0,     // reservat (sense ús de moment)
};

/* Puntua una jugada 'move' (de legalPlays) per al jugador 'who'. */
function scoreMove(who, g, move, w, v) {
  const tiles = move.tiles || [];
  const take = move.take || [];
  const handSize = v.hands[who].length;
  let s = 0;

  if (tiles.length) {
    s += tiles.length * w.perTile;
    // preferència per deixar la mà petita
    if (handSize - tiles.length <= 2) s += w.winSoon;
    // si aquesta jugada buida la mà del tot, premi final
    if (handSize - tiles.length === 0) s += w.finishBonus;
  }
  if (take.length) s += take.length * w.perMoved;

  // comodins que surten de la teva mà o que mous
  const usedJokers = tiles.filter(t => t.joker).length +
    take.filter(tk => {
      const src = v.table[tk.from];
      if (!src) return false;
      const t = src.find(x => x.id === tk.id);
      return t ? !!t.joker : false;
    }).length;
  s -= usedJokers * w.jokerPenalty;

  // completar l'obertura és molt valuós
  if (!v.initial[who]) s += w.openBonus;

  // combinacions noves lleugerament preferides a allargar melds
  if (move.target === null && tiles.length) s += w.newMeldBonus;

  return s;
}

/* Tria el moviment de la mà del bot per al jugador 'who'. */
function chooseMove(who, g, w) {
  w = w || DEFAULT_WEIGHTS;
  const v = g.view(who);
  const { plays } = g.legalPlays(who);
  let best = null, bestScore = -Infinity;
  for (const p of plays) {
    // Desestimem els moviments només de tauler (tiles buit): el bot prioritza
    // progressar la mà; si no pot, dibuixa. Moure fitxes entre combinacions
    // es deixa per a una versió més avançada (evita "xurro" sense final).
    if (!p.tiles || !p.tiles.length) continue;
    const sc = scoreMove(who, g, p, w, v);
    if (sc > bestScore) { bestScore = sc; best = p; }
  }
  if (best && bestScore >= 0) {
    best._score = bestScore;
    return { type: 'play', ...best };
  }
  // no podem jugar: a Rummikub s'ha d'agafar si queden fitxes a la pila
  if (g.pileCount() > 0) return { type: 'draw' };
  return { type: 'pass' };
}

/* Juga una partida sencera amb bots. weightsFn(who) → pesos de cada bot.
   Retorna {winner, gameOver, turns, stack (nen?) , ended}. */
function playGame(opts) {
  opts = opts || {};
  const players = opts.players || 2;
  const g = R.createGame({ players, seed: opts.seed, sets: opts.sets, endWhenStuck: opts.endWhenStuck !== false });
  const weightsFn = opts.weightsFn || (() => DEFAULT_WEIGHTS);
  const maxTurns = opts.maxTurns || 3000;
  let turns = 0;
  while (!g.state().gameOver && turns < maxTurns) {
    const who = g.who();
    const w = weightsFn(who);
    const move = chooseMove(who, g, w);
    let r;
    if (move.type === 'play') r = g.play(who, move);
    else if (move.type === 'draw') r = g.draw(who);
    else r = g.pass(who);
    if (!r.ok) g.pass(who);   // per si el bot proposa una jugada invàlida
    turns++;
  }
  const st = g.state();
  let winType = 'round';
  if (st.gameOver && st.winner !== null && g.hand(st.winner).length === 0) winType = 'hand';
  return { winner: st.winner, gameOver: st.gameOver && turns < maxTurns, turns, melds: st.table.length, winType };
}

  return { DEFAULT_WEIGHTS, scoreMove, chooseMove, playGame };
});
