// Trix: wires the cube model, the 3D view and the panel together.
//
// The cube exists twice:
//   state  - the numbers (js/cube/cubie.js), used to check "solved?" and by the solvers
//   view   - the 3D picture (js/view/cube3d.js)
// Every move is applied to both, so they always agree.

import { solved, applyMove, applyMoves, isSolved } from './cube/cubie.js';
import { randomScramble, invertMove, expandMove } from './cube/notation.js';
import { solveCFOP, prepareCFOP } from './solvers/cfop.js';
import { solveBeginner } from './solvers/beginner.js';
import { createKociemba } from './solvers/kociemba.js';
import { createCubeView, PALETTES } from './view/cube3d.js';
import { attachControls } from './view/controls.js';
import { createTimer, showSolution, clearSolution, addResult, formatTime } from './ui/panel.js';

const $ = (id) => document.getElementById(id);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));

const view = createCubeView($('cube'));
const timer = createTimer();
const kociemba = createKociemba();

const LABELS = { shortest: 'Shortest', cfop: 'CFOP', beginner: 'Beginner' };

let state = solved();
let history = [];     // your own moves, for Undo
let mode = 'idle';    // idle | scrambling | thinking | playing
let method = 'shortest';
let scramble = null;  // the last scramble's moves, so it can be replayed
let you = null;       // your solve in progress: { hints, helpedBy }
let auto = null;      // the computer's solve in progress: { method, moves, thinkMs }
let compareRows = {}; // Compare card rows by method, so Watch can fill in the time

// ---------- status of the shortest solver ----------
kociemba.ready.then(({ ms }) => {
  $('solver-status').classList.add('ready');
  $('solver-status').innerHTML = `<i class="dot"></i>Solvers ready · tables built in ${(ms / 1000).toFixed(1)} s`;
}).catch(() => {
  $('solver-status').innerHTML = '<i class="dot"></i>Shortest solver failed to load';
});
setTimeout(prepareCFOP, 300); // build CFOP's small tables early too

// ---------- buttons on/off ----------
function refreshButtons() {
  const busy = mode !== 'idle';
  $('scramble-btn').disabled = busy;
  $('solve-btn').disabled = busy;
  $('reset-btn').disabled = mode === 'thinking';
  $('undo-btn').disabled = busy || history.length === 0;
  $('stop-btn').disabled = mode !== 'playing' && mode !== 'scrambling';
  document.querySelectorAll('.method').forEach((b) => { b.disabled = busy; });
  ['hint-btn', 'show-btn', 'finish-btn'].forEach((id) => { $(id).disabled = busy; });
  document.querySelectorAll('.watch').forEach((b) => { b.disabled = busy; });
  $('assist').hidden = !you;
}

function setLabel(text) {
  $('timer-label').textContent = text;
}

// ---------- the solvers ----------
async function solveWith(which, from) {
  if (which === 'shortest') return kociemba.solve(from);
  await nextFrame(); // let the page show "Thinking…" first
  return which === 'cfop' ? solveCFOP(from) : solveBeginner(from);
}

// ---------- playing a list of moves (computer solves and help) ----------
function playMoves(moves, list, onDone) {
  mode = 'playing';
  refreshButtons();
  if (!moves.length) { mode = 'idle'; refreshButtons(); onDone(); return; }
  list?.highlight(0);
  moves.forEach((m, i) => view.turn(m, () => {
    state = applyMove(state, m);
    timer.addMove();
    list?.highlight(i + 1);
    if (i === moves.length - 1) {
      mode = 'idle';
      onDone();
      refreshButtons();
    }
  }));
}

// ---------- your own turns (drag, keyboard or pad) ----------
function userMove(move, { animated = false, record = true } = {}) {
  if (mode !== 'idle') return;
  const after = () => {
    // a middle-slice move (M, E, S) counts as its two outer-face turns
    state = applyMoves(state, expandMove(move));
    if (record) history.push(move);
    if (you) {
      if (!timer.isRunning()) { timer.start(); setLabel('Your solve'); }
      timer.addMove();
      if (isSolved(state)) finishYou();
    }
    refreshButtons();
  };
  if (animated) after(); // a drag has already turned the 3D cube
  else view.turn(move, after);
}

attachControls(view, {
  onMove: (move, opts) => userMove(move, opts),
  canTurn: () => mode === 'idle' && !view.isBusy(),
});

// ---------- scramble: then it's your turn ----------
$('scramble-btn').addEventListener('click', () => {
  if (mode !== 'idle') return;
  mode = 'scrambling';
  you = null;
  auto = null;
  timer.reset();
  $('compare').hidden = true;
  clearSolution('Scrambling…');
  setLabel('Scrambling…');
  refreshButtons();
  const moves = randomScramble(25);
  const fast = Math.min(view.getTurnMs(), 70);
  moves.forEach((m, i) => view.turn(m, () => {
    state = applyMove(state, m);
    if (i === moves.length - 1) {
      mode = 'idle';
      history = [];
      scramble = moves;
      you = { hints: 0, helpedBy: null };
      clearSolution(`Scramble: ${moves.join(' ')}`);
      $('hint-text').textContent = 'Stuck? Help uses the method selected above.';
      setLabel('Your timer starts on your first turn');
      refreshButtons();
    }
  }, fast));
});

// When your solve ends (by you, or with help)
function finishYou() {
  const ms = timer.stop(true);
  const moves = timer.getMoves();
  let who = 'You';
  if (you.helpedBy) who = `You + ${LABELS[you.helpedBy]} help`;
  else if (you.hints) who = `You (${you.hints} hint${you.hints > 1 ? 's' : ''})`;
  setLabel(you.helpedBy || you.hints ? `Solved with help · ${who}` : 'Solved by you!');
  addResult({ who, moves, ms, thinkMs: null, speed: you.helpedBy ? 'mixed' : 'by hand' });
  const unaided = !you.helpedBy;
  you = null;
  history = [];
  refreshButtons();
  showCompare({ who, moves, ms, unaided });
}

// ---------- help while you're stuck ----------
async function getHelp() {
  if (!you || mode !== 'idle') return null;
  if (isSolved(state)) return null;
  if (!timer.isRunning()) { timer.start(); setLabel('Your solve'); }
  mode = 'thinking';
  refreshButtons();
  $('hint-text').textContent = `Thinking (${LABELS[method]})…`;
  try {
    return await solveWith(method, state);
  } catch (err) {
    $('hint-text').textContent = `Couldn't work it out: ${err.message}`;
    return null;
  } finally {
    mode = 'idle';
    refreshButtons();
  }
}

// The next chunk of a solution: the first step (Shortest has one long "step", so take 4 moves)
function nextChunk(result) {
  const step = result.steps[0];
  if (result.method === 'Shortest') {
    return { name: `Next moves (${result.moves.length} left with Shortest)`, moves: step.moves.slice(0, 4) };
  }
  return step;
}

$('hint-btn').addEventListener('click', async () => {
  const result = await getHelp();
  if (!result) return;
  you.hints += 1;
  const chunk = nextChunk(result);
  $('hint-text').innerHTML = '';
  const strong = document.createElement('strong');
  strong.textContent = chunk.name;
  const code = document.createElement('code');
  code.textContent = chunk.moves.join(' ');
  $('hint-text').append(strong, document.createElement('br'), code);
});

$('show-btn').addEventListener('click', async () => {
  const result = await getHelp();
  if (!result) return;
  you.helpedBy = method;
  const chunk = nextChunk(result);
  $('hint-text').textContent = `Showing: ${chunk.name}`;
  const list = showSolution([chunk]);
  playMoves(chunk.moves, list, () => {
    $('hint-text').textContent = 'Your turn again.';
    if (isSolved(state)) finishYou();
  });
});

$('finish-btn').addEventListener('click', async () => {
  const result = await getHelp();
  if (!result) return;
  you.helpedBy = method;
  $('hint-text').textContent = `Finishing with ${LABELS[method]}…`;
  const list = showSolution(result.steps);
  playMoves(result.moves, list, () => { if (isSolved(state)) finishYou(); });
});

// ---------- the computer solves ----------
async function computerSolve(label = null) {
  if (isSolved(state)) { setLabel('Already solved: press Scramble first'); return; }
  you = null;
  timer.reset();
  mode = 'thinking';
  refreshButtons();
  setLabel(`Thinking (${LABELS[method]})…`);
  $('stat-think').textContent = '…';

  const t0 = performance.now();
  let result;
  try {
    result = await solveWith(method, state);
  } catch (err) {
    console.error(err);
    setLabel(`Couldn't solve: ${err.message}`);
    mode = 'idle';
    refreshButtons();
    return;
  }
  const thinkMs = performance.now() - t0;
  $('stat-think').textContent = thinkMs < 1000 ? `${Math.round(thinkMs)}ms` : `${(thinkMs / 1000).toFixed(1)}s`;

  auto = { method, moves: result.moves, thinkMs, label };
  const list = showSolution(result.steps);
  setLabel(`Solving · ${LABELS[method]}`);
  timer.start();
  playMoves(result.moves, list, finishAuto);
}

function finishAuto() {
  if (!auto) return;
  const ok = isSolved(state);
  const ms = timer.stop(ok);
  setLabel(ok ? `Solved · ${LABELS[auto.method]}` : 'Stopped');
  // Watching your scramble? Put the time next to yours in the Compare card
  if (ok && auto.label && compareRows[auto.method]) compareRows[auto.method].cells[2].textContent = formatTime(ms);
  if (ok) {
    addResult({
      who: auto.label ?? LABELS[auto.method],
      moves: auto.moves.length,
      ms,
      thinkMs: auto.thinkMs,
      speed: `${view.getTurnMs()} ms/turn`,
    });
  }
  auto = null;
  history = [];
}

$('solve-btn').addEventListener('click', () => {
  if (mode === 'idle') computerSolve();
});

// ---------- compare: your scramble, solved by each method ----------
async function showCompare(yourResult) {
  if (!scramble) return;
  const start = applyMoves(solved(), scramble);
  const body = $('compare-body');
  body.innerHTML = '';
  compareRows = {};
  $('compare').hidden = false;

  const row = (cells, cls) => {
    const tr = document.createElement('tr');
    if (cls) tr.className = cls;
    cells.forEach((c) => {
      const td = document.createElement('td');
      if (c instanceof Node) td.appendChild(c); else td.textContent = c;
      tr.appendChild(td);
    });
    body.appendChild(tr);
    return tr;
  };
  row([yourResult.who, String(yourResult.moves), formatTime(yourResult.ms), ''], 'you');

  for (const which of ['shortest', 'cfop', 'beginner']) {
    const btn = document.createElement('button');
    btn.className = 'watch';
    btn.textContent = 'Watch';
    btn.title = `Reset to your scramble and watch ${LABELS[which]} solve it`;
    btn.addEventListener('click', () => watch(which));
    const tr = row([LABELS[which], '…', '–', btn]);
    compareRows[which] = tr;
    solveWith(which, start)
      .then((r) => { tr.cells[1].textContent = String(r.moves.length); })
      .catch(() => { tr.cells[1].textContent = '?'; });
  }
  refreshButtons();
}

// Put the cube back to your scramble and let a method race it
function watch(which) {
  if (mode !== 'idle' || !scramble) return;
  method = which;
  document.querySelectorAll('.method').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.method === which)));
  view.jumpTo(scramble);
  state = applyMoves(solved(), scramble);
  computerSolve(`${LABELS[which]} (your scramble)`);
}

// ---------- stop / undo / reset ----------
$('stop-btn').addEventListener('click', () => {
  view.clearQueue();
  // the turn already in progress still finishes, then we stop
  const waitForIdle = () => {
    if (view.isBusy()) return requestAnimationFrame(waitForIdle);
    if (auto) finishAuto();
    else if (you) $('hint-text').textContent = 'Stopped. Your turn again.';
    if (mode === 'scrambling') {
      scramble = null;
      setLabel('Scramble stopped early');
    }
    mode = 'idle';
    refreshButtons();
  };
  waitForIdle();
});

function undo() {
  if (mode !== 'idle' || !history.length || view.isBusy()) return;
  const move = history.pop();
  userMove(invertMove(move), { record: false });
}
$('undo-btn').addEventListener('click', undo);
window.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    undo();
  }
});

$('reset-btn').addEventListener('click', () => {
  view.reset();
  state = solved();
  history = [];
  you = null;
  auto = null;
  mode = 'idle';
  timer.reset();
  $('compare').hidden = true;
  $('stat-think').textContent = '–';
  setLabel('Scramble the cube, then solve it');
  clearSolution();
  refreshButtons();
});

// ---------- method choice, speed, move pad, help ----------
document.querySelectorAll('.method').forEach((btn) => {
  btn.addEventListener('click', () => {
    method = btn.dataset.method;
    document.querySelectorAll('.method').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
  });
});

$('speed').addEventListener('input', (e) => {
  view.setTurnMs(Number(e.target.value));
  $('speed-value').textContent = `${e.target.value} ms`;
});

const pad = $('move-pad');
for (const face of ['U', 'R', 'F', 'D', 'L', 'B', 'M', 'E', 'S']) {
  for (const suffix of ['', "'", '2']) {
    const b = document.createElement('button');
    b.innerHTML = `<i data-face="${face}"></i>${face}${suffix}`;
    b.title = 'MES'.includes(face)
      ? `Middle slice ${face}${suffix} (M turns like L, E like D, S like F)`
      : `Turn the face with this centre colour: ${face}${suffix}`;
    b.addEventListener('click', () => { if (!view.isBusy()) userMove(face + suffix); });
    pad.appendChild(b);
  }
}

// ---------- colour palette (Classic / Pastel), remembered in this browser ----------
function setPalette(name) {
  if (!PALETTES[name]) name = 'classic';
  view.setPalette(name);
  pad.querySelectorAll('i[data-face]').forEach((dot) => {
    const face = dot.dataset.face;
    // slices show a split dot: the two faces they sit between
    const pair = { M: ['R', 'L'], E: ['U', 'D'], S: ['F', 'B'] }[face];
    dot.style.background = pair
      ? `linear-gradient(90deg, ${PALETTES[name][pair[0]]} 50%, ${PALETTES[name][pair[1]]} 50%)`
      : PALETTES[name][face];
  });
  document.querySelectorAll('.palette button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.palette === name)));
  try { localStorage.setItem('trix-palette', name); } catch { /* storage blocked */ }
}
document.querySelectorAll('.palette button').forEach((b) => b.addEventListener('click', () => setPalette(b.dataset.palette)));
let savedPalette = 'classic';
try { savedPalette = localStorage.getItem('trix-palette') || 'classic'; } catch { /* storage blocked */ }
setPalette(savedPalette);

$('help-btn').addEventListener('click', () => $('help-dialog').showModal());

refreshButtons();

// For automated tests and curious people: the cube from the browser console
window.cubeDebug = { get state() { return state; }, view };
