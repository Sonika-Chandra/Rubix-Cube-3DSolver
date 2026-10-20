// The beginner's layer-by-layer method. Pure logic.
// Uses only the moves and short algorithms a beginner learns, so the
// solution is long (100+ moves) but every step is easy to follow:
//   1 White cross          one bottom edge at a time
//   2 White corners        "R U R' U'" repeated until each corner drops in
//   3 Middle layer         left/right insert algorithms
//   4 Yellow cross         F R U R' U' F'
//   5 Yellow edges         R U R' U R U2 R' U
//   6 Yellow corners       U R U' L' U R' U' L  (put them in place)
//   7 Twist corners        R' D' R D            (turn them the right way)

import { MOVE_NAMES, applyMoves, isSolved } from '../cube/cubie.js';
import { parseAlg, remap, simplify } from '../cube/notation.js';
import { buildDistanceTable, edgeCoord } from './pieces.js';
import { idaStar, macroSearch, AUF } from './search.js';

// The same algorithm "seen from" each side: for each slot, which real face
// plays the part of R (right), F (front), L and B.
const FRAMES = [
  { slot: 'front-right', map: { R: 'R', F: 'F', L: 'L', B: 'B' }, corner: 4, top: 0, edge: 8 },
  { slot: 'back-right', map: { R: 'B', F: 'R', L: 'F', B: 'L' }, corner: 7, top: 3, edge: 11 },
  { slot: 'back-left', map: { R: 'L', F: 'B', L: 'R', B: 'F' }, corner: 6, top: 2, edge: 10 },
  { slot: 'front-left', map: { R: 'F', F: 'L', L: 'B', B: 'R' }, corner: 5, top: 1, edge: 9 },
];
const inFrame = (alg, frame) => remap(parseAlg(alg), frame.map);

const CROSS = [5, 4, 6, 7]; // DF, DR, DL, DB
let edgeTables = null;
function getEdgeTables() {
  if (!edgeTables) {
    edgeTables = {};
    for (const e of CROSS) edgeTables[e] = buildDistanceTable([{ kind: 'e', piece: e }], MOVE_NAMES);
  }
  return edgeTables;
}

const cornerSolved = (s, c) => s.cp[c] === c && s.co[c] === 0;
const edgeSolved = (s, e) => s.ep[e] === e && s.eo[e] === 0;

export function solveBeginner(start) {
  const steps = [];
  let state = start;
  const add = (name, moves) => {
    const clean = simplify(moves);
    if (clean.length) steps.push({ name, moves: clean });
    state = applyMoves(state, clean);
  };

  // 1. White cross: place one edge at a time, without disturbing placed ones
  const tables = getEdgeTables();
  const placed = [];
  for (const e of CROSS) {
    const group = [...placed, e];
    const coords = group.map((p) => edgeCoord(state, p));
    const moves = idaStar(coords, group.map(() => 'e'),
      group.map((p, i) => ({ table: tables[p], idx: [i] })), MOVE_NAMES, { maxDepth: 10 });
    if (!moves) throw new Error('cross failed');
    placed.push(e);
    add(`White cross: edge ${placed.length}`, moves);
  }

  // 2. White corners: lift out if stuck, turn U until it's above its slot,
  //    then repeat R U R' U' (from that slot's side) until it drops in.
  for (const frame of FRAMES) {
    const c = frame.corner;
    if (cornerSolved(state, c)) continue;
    const moves = [];
    const run = (m) => { moves.push(...m); state = applyMoves(state, m); };

    const slotOf = () => state.cp.indexOf(c);
    if (slotOf() >= 4) {
      // stuck in the bottom layer: pop it up with that slot's trigger
      const stuck = FRAMES.find((f) => f.corner === slotOf());
      run(inFrame("R U R' U'", stuck));
    }
    for (let i = 0; i < 4 && slotOf() !== frame.top; i++) run(['U']);
    for (let i = 0; i < 6 && !cornerSolved(state, c); i++) run(inFrame("R U R' U'", frame));
    state = applyMoves(state, invertAll(moves)); // rewind, then record properly
    add(`White corner (${frame.slot})`, moves);
  }

  // 3. Middle layer: for each edge, the fewest U turns + insert algorithms
  const bottomDone = (s) => [4, 5, 6, 7].every((i) => cornerSolved(s, i) && edgeSolved(s, i));
  const inserts = FRAMES.flatMap((f) => [
    { name: 'right insert', moves: inFrame("U R U' R' U' F' U F", f) },
    { name: 'left insert', moves: inFrame("U' L' U L U F U' F'", f) },
  ]);
  const middleDone = [];
  for (const frame of FRAMES) {
    const e = frame.edge;
    const goal = (s) => bottomDone(s) && edgeSolved(s, e) && middleDone.every((m) => edgeSolved(s, m));
    const path = macroSearch(state, [...AUF, ...inserts], goal, { maxDepth: 5 });
    if (!path) throw new Error('middle layer failed');
    middleDone.push(e);
    add(`Middle edge (${frame.slot})`, path.flatMap((m) => m.moves));
  }

  // 4. Yellow cross on top
  const edgesUp = (s) => [0, 1, 2, 3].every((i) => s.eo[i] === 0);
  const cross = macroSearch(state, [...AUF, { name: 'FRURUF', moves: parseAlg("F R U R' U' F'") }], edgesUp, { maxDepth: 7 });
  add('Yellow cross', cross.flatMap((m) => m.moves));

  // 5. Yellow edges matched to their side centres
  const edgesPlaced = (s) => [0, 1, 2, 3].every((i) => s.ep[i] === i);
  const swap = { name: 'edge swap', moves: parseAlg("R U R' U R U2 R' U") };
  const edges = macroSearch(state, [...AUF, swap], edgesPlaced, { maxDepth: 7 });
  add('Yellow edges', edges.flatMap((m) => m.moves));

  // 6. Yellow corners into the right places (twist comes next)
  const cornersPlaced = (s) => [0, 1, 2, 3].every((i) => s.cp[i] === i);
  const cycles = FRAMES.map((f) => ({ name: 'corner cycle', moves: inFrame("U R U' L' U R' U' L", f) }));
  const corners = macroSearch(state, cycles, cornersPlaced, { maxDepth: 4 });
  if (!corners) throw new Error('corner placement failed');
  add('Yellow corners in place', corners.flatMap((m) => m.moves));

  // 7. Twist each top corner with R' D' R D (the bottom looks scrambled
  //    in the middle of this step, then fixes itself)
  const twist = [];
  for (let turn = 0; turn < 4; turn++) {
    // Always in PAIRS: one R' D' R D swaps the corner with a bottom piece,
    // so only after an even number is the same corner back in the slot.
    for (let i = 0; i < 3 && state.co[0] !== 0; i++) {
      const m = parseAlg("R' D' R D R' D' R D");
      twist.push(...m);
      state = applyMoves(state, m);
    }
    twist.push('U');
    state = applyMoves(state, ['U']);
  }
  state = applyMoves(state, invertAll(twist));
  add('Twist yellow corners', twist);

  // Last U turn if the top layer is one step off
  for (const m of [[], ['U'], ['U2'], ["U'"]]) {
    if (isSolved(applyMoves(state, m))) { add('Finish', m); break; }
  }
  if (!isSolved(state)) throw new Error('beginner solve did not finish');

  return { method: 'Beginner', steps, moves: steps.flatMap((s) => s.moves) };
}

function invertAll(moves) {
  return [...moves].reverse().map((m) => (m.endsWith('2') ? m : m.endsWith("'") ? m[0] : m + "'"));
}
