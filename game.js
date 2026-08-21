/* ═══════════════════════════════════════════════════════════════
   game.js — Lògica pura i compartida del Rummikub.
   - Funciona al navegador (carregat per index.html) i a Node
     (require('./game.js')).
   - Conté: baralla, validació de combinacions, puntuació amb
     comodins, partició, resolució de jugades (resolvePlay) i un
     motor headless complet per a self-play / AI (createGame).
   ═══════════════════════════════════════════════════════════════ */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) {
    root.Rummy = api;
    // Globals per compatibilitat amb index.html (que crida per nom)
    for (const k in api) if (typeof api[k] === 'function') root[k] = api[k];
  }
})(typeof window !== 'undefined' ? window : null, function () {

  /* ---------- RNG determinista (per a entrenament reproduïble) ---------- */
  function makeRng(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------- Construcció de la baralla ---------- */
  function makeDeck(sets) {
    const d = []; let n = 0;
    for (let s = 0; s < sets; s++)
      for (let c = 0; c < 4; c++)
        for (let v = 1; v <= 13; v++)
          for (let k = 0; k < 2; k++) d.push({ id: 't' + n++, c: c, v: v });
    for (let s = 0; s < sets; s++) { d.push({ id: 'J' + (s * 2), joker: true }); d.push({ id: 'J' + (s * 2 + 1), joker: true }); }
    return d;
  }
  function shuffle(a, rng) {
    const r = rng || Math.random;
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
  }
  const cloneTile = (t) => ({ ...t });

  /* ---------- Validació de combinacions ---------- */
  function validRun(arr) {
    const reals = arr.filter(t => !t.joker);
    if (arr.length < 3 || arr.length > 13 || reals.length === 0) return false;
    if (new Set(reals.map(t => t.c)).size !== 1) return false;
    const vs = reals.map(t => t.v);
    if (new Set(vs).size !== vs.length) return false;
    const minV = Math.min(...vs), maxV = Math.max(...vs);
    if (minV < 1 || maxV > 13) return false;
    return (maxV - minV + 1) <= arr.length;
  }
  function validGroup(arr) {
    if (arr.length < 3 || arr.length > 4) return false;
    const reals = arr.filter(t => !t.joker);
    if (reals.length === 0) return false;
    if (!reals.every(t => t.v === reals[0].v)) return false;
    const cs = new Set(reals.map(t => t.c));
    if (cs.size !== reals.length) return false;
    return reals.length + (arr.length - reals.length) <= 4;
  }
  function validMeld(arr) { return Array.isArray(arr) && arr.length >= 3 && (validGroup(arr) || validRun(arr)); }

  /* Valors efectius d'un meld: el comodí val el número que representa. */
  function meldValues(m) {
    const reals = m.filter(t => !t.joker);
    if (reals.length === 0) return m.map(() => 0);
    if (validGroup(m)) {
      const v = reals[0].v;
      return m.map(t => t.joker ? v : t.v);
    }
    return inferRun(m);
  }

  /* Per a una ESCALA vàlida, assigna a cada comodí el valor que representa.
     - Primer omple els forats interiors (valors que FALTEN entre el mínim i el màxim);
     - els comodins sobrants estenen la fila pels EXTREMS, mai al mig d'un parell
       de números correlatius (que crearia duplicats del tipus 6,7,8,C,9,10).
     Determinista i sempre dins de [1,13]. */
  function inferRun(m) {
    const L = m.length;
    const reals = m.filter(t => !t.joker).map(t => t.v).sort((a, b) => a - b);
    const minV = reals[0], maxV = reals[reals.length - 1];
    const j = L - reals.length;
    const forced = [];
    for (let v = minV + 1; v < maxV; v++) if (!reals.includes(v)) forced.push(v);
    let surplus = j - forced.length;   // comodins que toca posar als extrems
    let low = 0, high = 0;
    if (surplus > 0) {
      if (m[0] && m[0].joker) low = surplus; else high = surplus;
      if (minV - low < 1) { low = Math.max(0, minV - 1); high = surplus - low; }      // ja no cabe cap avall
      if (maxV + high > 13) { high = Math.max(0, 13 - maxV); low = surplus - high; }   // ja no cabe cap amunt
      if (low + high < surplus) { low = Math.min(surplus, Math.max(0, minV - 1)); high = Math.min(surplus, Math.max(0, 13 - maxV)); }
    }
    const start = minV - low;
    const used = new Set(reals);
    const leftovers = [];
    for (let v = start; v < start + L && v <= 13; v++) if (!used.has(v)) leftovers.push(v);
    const out = [];
    let k = 0;
    for (const t of m) out.push(t.joker ? (leftovers[k] !== undefined ? leftovers[k++] : 0) : t.v);
    return out;
  }
  function meldScore(m) { return meldValues(m).reduce((a, b) => a + b, 0); }

  /* Ordre de presentació (visual). */
  function displayOrder(m) {
    try {
      if (validGroup(m)) return [...m].sort((a, b) => (a.joker ? 99 : a.c) - (b.joker ? 99 : b.c));
      if (validRun(m)) {
        const vals = meldValues(m);
        return m.map((t, i) => ({ t, v: vals[i] })).sort((a, b) => a.v - b.v).map(x => x.t);
      }
    } catch (_) { }
    return m;
  }

  /* Partir fitxes en combinacions vàlides (o null). */
  function bestPartition(tiles) {
    if (!tiles.length) return [];
    const n = tiles.length;
    for (let mask = 1; mask < (1 << n); mask++) {
      const sub = []; const rest = [];
      for (let i = 0; i < n; i++) (mask & (1 << i)) ? sub.push(tiles[i]) : rest.push(tiles[i]);
      if (sub.length >= 3 && validMeld(sub)) {
        const r = bestPartition(rest);
        if (r !== null) return [sub, ...r];
      }
    }
    return null;
  }

  /* ────────────────────────────────────────────────────────────────
     resolvePlay(state, who, tiles, target, take)
     Resol una jugada de manera atòmica (mateixes regles que l'app):

       state  → { table: [...], initial: [bool per jugador] }
       tiles  → fitxes de la mà
       take   → [{from, id}] fitxes agafades del tauler
       target → meld on abocar-ho tot, o null = combinacions noves

     Valida el tauler FINAL (cada meld vàlid o buit) i retorna l'estat
     nou sense mutar l'entrada.
     ──────────────────────────────────────────────────────────────── */
  function resolvePlay(state, who, tiles, target, take) {
    tiles = tiles || []; take = take || [];
    if (!tiles.length && take.length === 0)
      return { ok: false, reason: 'Selecciona almenys 1 fitxa.' };
    if (!state.initial[who] && (take.length > 0 || target !== null))
      return { ok: false, reason: 'La primera jugada només es pot fer amb fitxes de la teva mà (30 punts), sense tocar el tauler.' };
    const initial = state.initial.slice();
    const tb = state.table.map(m => m.map(cloneTile));
    const moving = [];
    for (const tk of take) {
      const m = tb[tk.from];
      if (!m) return { ok: false, reason: 'Error intern: combinació no trobada.' };
      const i = m.findIndex(t => t.id === tk.id);
      if (i === -1) return { ok: false, reason: 'Error intern: fitxa no trobada.' };
      moving.push(...m.splice(i, 1));
    }
    const combined = tiles.concat(moving);
    if (target !== null && target >= 0) {
      const dest = tb[target];
      if (!dest) return { ok: false, reason: 'Selecciona un grup vàlid.' };
      tb[target] = dest.concat(combined);
    } else if (combined.length) {
      if (combined.length > 8) return { ok: false, reason: 'Massa fitxes per fer combinacions noves d\'un sol cop (màx. 8).' };
      const parts = bestPartition(combined);
      if (!parts) return { ok: false, reason: 'Aquesta combinació no és vàlida: necessites grups o escales de 3 fitxes com a mínim.' };
      if (!initial[who]) {
        const sum = parts.reduce((s, m) => s + meldScore(m), 0);
        if (sum < 30) return { ok: false, reason: 'La primera jugada ha de sumar 30 punts com a mínim (ara en sumes ' + sum + ').' };
        initial[who] = true;
      }
      tb.push(...parts);
    }
    for (const m of tb) { if (m.length && !validMeld(m)) return { ok: false, reason: 'En moure fitxes, algun grup del tauler queda en mal estat. Desfés la manipulació.' }; }
    return { ok: true, state: { table: tb.filter(m => m.length > 0), initial } };
  }

  /* ────────────────────────────────────────────────────────────────
     createGame({players, sets, seed}) — motor headless complet
     per a self-play / entrenament d'AI. Guarda les mans de TOTS els
     jugadors, la pila i els torns internament (com l'amfitrió real).
     ──────────────────────────────────────────────────────────────── */
  function createGame(opts) {
    opts = opts || {};
    const players = opts.players || 2;
    const sets = opts.sets || (players > 4 ? 2 : 1);
    const endWhenStuck = !!opts.endWhenStuck;   // mode entrenament: acaba la ronda si ningú pot jugar
    const rng = (opts.seed !== undefined) ? makeRng(opts.seed) : Math.random;
    const deck = makeDeck(sets); shuffle(deck, rng);
    const st = {
      players, sets,
      hands: Array.from({ length: players }, () => deck.splice(0, 14)),
      table: [],
      pile: deck,
      turn: 0,
      initial: Array(players).fill(false),
      gameOver: false, winner: null,
      rng, deckSize: 14 * players + deck.length,
    };

    const advance = () => { if (!st.gameOver) st.turn = (st.turn + 1) % st.players; return st.turn; };

    /* Final de ronda per a entrenament: si la pila s'ha esgotat i el jugador
       d'aquest torn no pot fer cap jugada AMB FITXES de la mà (els moviments
       només de tauler no permeten acabar i el bot no els utilitza), la ronda
       acaba i guanya el jugador amb la menor suma de raquis (comodí = 30). */
    function maybeEndRound() {
      if (!endWhenStuck || st.gameOver || st.pile.length > 0) return;
      const canHandPlay = legalPlays(st.turn).plays.some(p => (p.tiles || []).length > 0);
      if (canHandPlay) return;
      st.gameOver = true; st.winner = null;
      let bestSum = Infinity;
      for (let i = 0; i < st.players; i++) {
        const sum = st.hands[i].reduce((a, t) => a + (t.joker ? 30 : t.v), 0);
        if (sum < bestSum) { bestSum = sum; st.winner = i; }
      }
    }

    const api = {};

    /* Vista lògica: la mà pròpia + info pública (tauler, torn, pila). */
    api.view = function (who) {
      return {
        players, sets, turn: st.turn, gameOver: st.gameOver, winner: st.winner,
        pileCount: st.pile.length, initial: st.initial.slice(),
        hands: st.hands.map((h, i) => (i === who || who === null) ? h.map(cloneTile) : null),
        table: st.table.map(m => m.map(cloneTile)),
      };
    };

    api.isMyTurn = (who) => !st.gameOver && st.turn === who;
    api.who = () => st.turn;
    api.state = () => st;
    api.hand = (who) => st.hands[who];
    api.table = () => st.table;
    api.pileCount = () => st.pile.length;
    api.initial = (who) => st.initial[who];

    api.play = function (who, move) {
      if (st.gameOver) return { ok: false, reason: 'La partida ja ha acabat.' };
      if (who !== st.turn) return { ok: false, reason: 'No és el teu torn.' };
      const res = resolvePlay({ table: st.table, initial: st.initial }, who, (move && move.tiles) || [], move ? move.target : null, (move && move.take) || []);
      if (!res.ok) return res;
      st.table = res.state.table; st.initial = res.state.initial;
      const played = ((move && move.tiles) || []).map(t => t.id);
      st.hands[who] = st.hands[who].filter(t => !played.includes(t.id));
      if (played.length > 0 && st.hands[who].length === 0) { st.gameOver = true; st.winner = who; }
      else { advance(); maybeEndRound(); }
      return { ok: true };
    };

    api.draw = function (who) {
      if (st.gameOver) return { ok: false, reason: 'La partida ja ha acabat.' };
      if (who !== st.turn) return { ok: false, reason: 'No és el teu torn.' };
      if (st.pile.length === 0) return { ok: false, reason: 'La pila és buida.' };
      st.hands[who].push(st.pile.pop());
      advance(); maybeEndRound();
      return { ok: true };
    };

    api.pass = function (who) {
      if (st.gameOver) return { ok: false, reason: 'La partida ja ha acabat.' };
      if (who !== st.turn) return { ok: false, reason: 'No és el teu torn.' };
      advance(); maybeEndRound();
      return { ok: true };
    };

    /* Enumera jugades legals (per al bot). No inclou draw/pass: es
       decideixen amb el criteri del bot. Constructiu (O(mà)), fa servir
       les mateixes regles que resolvePlay. */
    function legalPlays(who) {
      if (st.gameOver || who !== st.turn) return { plays: [], openOnly: false };
      const hand = st.hands[who];
      const table = st.table;
      const acts = [];
      const hs = hand.map(cloneTile);
      const jokers = hs.filter(t => t.joker);
      const byValue = {};                       // v -> {c: fitxa}
      for (const t of hs) { if (t.joker) continue; (byValue[t.v] = byValue[t.v] || []).push(t); }

      const pushNew = (tiles) => { if (validMeld(tiles)) acts.push({ type: 'play', tiles: tiles.map(cloneTile), target: null, take: [] }); };

      // 1a) escales de la mà: intervals de valors del mateix color, amb
      //     comodins per cobrir els forats (longitud 3..5)
      for (let L = 3; L <= 5; L++) {
        for (let lo = 1; lo + L - 1 <= 13; lo++) {
          const hi = lo + L - 1;
          const reals = [];
          for (let c = 0; c < 4; c++) {
            const pick = [];
            let have = 0;
            for (let v = lo; v <= hi; v++) {
              const arr = (byValue[v] || []).filter(t => t.c === c);
              if (arr.length) { pick.push(arr[0]); have++; }
            }
            const missing = L - have;
            if (missing <= jokers.length) pushNew(pick.concat(jokers.slice(0, missing)));
          }
        }
      }
      // 1b) grups de la mà: mateix valor, colors diferents, fins a 4 fitxes
      for (const v in byValue) {
        const tiles = byValue[v];
        const colors = [...new Set(tiles.map(t => t.c))];
        for (let r = 1; r <= Math.min(colors.length, 4); r++) {
          for (let jk = 0; jk <= Math.min(jokers.length, 4 - r); jk++) {
            if (r + jk < 3) continue;
            // totes les maneres de triar r reals de colors diferents
            const combos = comb(colors, r);
            for (const cs of combos) {
              const chosen = cs.map(cc => tiles.find(t => t.c === cc));
              pushNew(chosen.concat(jokers.slice(0, jk)));
            }
          }
        }
      }

      // si la mà sencera (fins a 7) es pot partir, ho oferim com a moviment gran
      if (hs.length >= 3 && hs.length <= 7) {
        const parts = bestPartition(hs);
        if (parts !== null) acts.push({ type: 'play', tiles: hs.map(cloneTile), target: null, take: [] });
      }

      const moveScore = (a) => {
        if (!a.tiles || !a.tiles.length) return 0;
        const parts = bestPartition(a.tiles);
        return parts ? parts.reduce((s, m) => s + meldScore(m), 0) : 0;
      };

      if (!st.initial[who]) {
        // Obertura: només noves combinacions pròpies que sumin ≥ 30
        const opener = [];
        for (const a of acts) if (moveScore(a) >= 30) opener.push(a);
        return { plays: dedup(opener), openOnly: true };
      }

      // 2) afegir 1-2 fitxes de la mà a un meld del tauler.
      //    Filtratge exacte per família del meld: als grups només hi caben
      //    fitxes del mateix valor (o comodins); a les escales només del
      //    mateix color (o comodins). Evita provar TOTES les parelles de la mà.
      for (let m = 0; m < table.length; m++) {
        const meld = table[m];
        const reals = meld.filter(t => !t.joker);
        let pool;
        if (reals.length === 0) pool = hs.slice();
        else if (validGroup(meld)) { const gv = reals[0].v; pool = hs.filter(t => t.joker || t.v === gv); }
        else { const gc = reals[0].c; pool = hs.filter(t => t.joker || t.c === gc); }
        for (let i = 0; i < pool.length; i++) {
          if (validMeld(meld.concat(pool[i])))
            acts.push({ type: 'play', tiles: [pool[i]], target: m, take: [] });
          for (let j = i + 1; j < pool.length; j++)
            if (validMeld(meld.concat(pool[i], pool[j])))
              acts.push({ type: 'play', tiles: [pool[i], pool[j]], target: m, take: [] });
        }
      }

      // 3) moure una fitxa d'un meld a un altre (comodins inclosos),
      //    sempre que el meld d'origen quedi vàlid
      for (let s = 0; s < table.length; s++) {
        for (let ti = 0; ti < table[s].length; ti++) {
          const t = table[s][ti];
          const rest = table[s].filter((_, k) => k !== ti);
          if (rest.length === 0) continue;
          if (!validMeld(rest)) continue;
          for (let m2 = 0; m2 < table.length; m2++) {
            if (m2 === s) continue;
            const cand = table[m2].concat(cloneTile(t));
            if (validMeld(cand)) acts.push({ type: 'play', tiles: [], target: m2, take: [{ from: s, id: t.id }] });
          }
        }
      }

      return { plays: dedup(acts), openOnly: false };

      function comb(arr, r) {
        if (r === 0) return [[]];
        const out = [];
        for (let i = 0; i <= arr.length - r; i++)
          for (const rest of comb(arr.slice(i + 1), r - 1)) out.push([arr[i], ...rest]);
        return out;
      }
      function dedup(arr) {
        const seen = new Set(); const out = [];
        for (const a of arr) {
          const key = JSON.stringify([(a.tiles || []).map(t => t.id).sort(), a.target, (a.take || []).map(x => x.id).sort()]);
          if (!seen.has(key)) { seen.add(key); out.push(a); }
        }
        return out;
      }
    }

    api.legalPlays = legalPlays;

    /* Sincronitza l'estat intern del motor amb un estat extern (perquè un bot
       pugui DECIDIR una jugada sobre una partida real en curs a l'app: el host
       li passa el tauler, les mans (mirall), la pila i el torn actuals). */
    api.sync = function (s) {
      st.players = s.players; st.hands = s.hands; st.table = s.table;
      st.pile = s.pile; st.turn = s.turn; st.initial = s.initial;
      st.gameOver = s.gameOver; st.winner = s.winner;
    };

    return api;
  }

  return {
    makeRng, makeDeck, shuffle, cloneTile,
    validRun, validGroup, validMeld,
    meldValues, meldScore, displayOrder, bestPartition,
    resolvePlay, createGame,
  };
});
