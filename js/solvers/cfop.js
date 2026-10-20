// CFOP, the speedcubers' method. Pure logic.
//   C  Cross:  the 4 bottom (white) edges, found by searching for the shortest way
//   F  F2L:    "first two layers", 4 corner+edge pairs, each found by search
//   O  OLL:    make the top face all yellow ("orient last layer")
//   P  PLL:    move the top pieces to their spots ("permute last layer")
// This uses the "2-look" last layer: OLL and PLL each take one or two
// algorithms from a small, learnable set (instead of 57 + 21 algorithms).

import { MOVE_NAMES, applyMoves, isSolved } from '../cube/cubie.js';
import { parseAlg, simplify } from '../cube/notation.js';
import { buildDistanceTable, cornerCoord, edgeCoord } from './pieces.js';
import { idaStar, macroSearch, AUF } from './search.js';

const NO_D = MOVE_NAMES.filter((m) => m[0] !== 'D'); // D turns never help F2L

// Cross edges (pieces DR, DF, DL, DB) and the four F2L pairs (corner, edge)
const CROSS = [4, 5, 6, 7];
export const PAIRS = [
  { name: 'front-right', corner: 4, edge: 8 },  // DFR + FR
  { name: 'front-left', corner: 5, edge: 9 },   // DLF + FL
  { name: 'back-left', corner: 6, edge: 10 },   // DBL + BL
  { name: 'back-right', corner: 7, edge: 11 },  // DRB + BR
];

// Distance tables are built once, the first time a solve needs them (~0.3 s)
let tables = null;
function getTables() {
  if (!tables) {
    tables = {
      cross: buildDistanceTable(CROSS.map((piece) => ({ kind: 'e', piece })), MOVE_NAMES),
      pairs: PAIRS.map((p) => buildDistanceTable([{ kind: 'c', piece: p.corner }, { kind: 'e', piece: p.edge }], NO_D)),
    };
  }
  return tables;
}

// ---------- last-layer algorithms (face turns only) ----------
const OLL = [
  ['OLL line', "F R U R' U' F'"],
  ['OLL L-shape', "F U R U' R' F'"],
  ['Sune', "R U R' U R U2 R'"],
  ['Anti-Sune', "R U2 R' U' R U' R'"],
  ['OLL H', "R U R' U R U' R' U R U2 R'"],
  ['OLL Pi', "R U2 R2 U' R2 U' R2 U2 R"],
  ['OLL Headlights', "R2 D R' U2 R D' R' U2 R'"],
].map(([name, alg]) => ({ name, moves: parseAlg(alg) }));

const PLL = [
  ['Ua perm', "R U' R U R U R U' R' U' R2"],
  ['Ub perm', "R2 U R U R' U' R' U' R' U R'"],
  ['T perm', "R U R' U' R' F R2 U' R' U' R U R' F'"],
  ['Y perm', "F R U' R' U' R U R' F' R U R' U' R' F R F'"],
  ['Aa perm', "R' F R' B2 R F' R' B2 R2"],
  ['Jb perm', "R U R' F' R U R' U' R' F R2 U' R'"],
].map(([name, alg]) => ({ name, moves: parseAlg(alg) }));

export const LAST_LAYER_ALGS = { OLL, PLL };

// Top-layer checks
const U_CORNERS = [0, 1, 2, 3];
const U_EDGES = [0, 1, 2, 3];
export const lastLayerOriented = (s) => U_CORNERS.every((i) => s.co[i] === 0) && U_EDGES.every((i) => s.eo[i] === 0);

// ---------- the solver ----------
export function solveCFOP(start) {
  const t = getTables();
  const steps = [];
  let state = start;
  const add = (name, moves) => {
    const clean = simplify(moves);
    if (clean.length) steps.push({ name, moves: clean });
    state = applyMoves(state, clean);
  };

  // C: cross. The table gives the exact distance, so this search is instant.
  const crossCoords = () => CROSS.map((p) => edgeCoord(state, p));
  const crossMoves = idaStar(crossCoords(), ['e', 'e', 'e', 'e'], [{ table: t.cross, idx: [0, 1, 2, 3] }], MOVE_NAMES);
  add('Cross', crossMoves);

  // F: four pairs. Each search keeps the cross and finished pairs intact.
  const done = [];
  while (done.length < 4) {
    let best = null;
    for (let p = 0; p < 4; p++) {
      if (done.includes(p)) continue;
      const involved = [p, ...done];
      const coords = [
        ...CROSS.map((e) => edgeCoord(state, e)),
        ...involved.flatMap((k) => [cornerCoord(state, PAIRS[k].corner), edgeCoord(state, PAIRS[k].edge)]),
      ];
      const kinds = ['e', 'e', 'e', 'e', ...involved.flatMap(() => ['c', 'e'])];
      const tbls = [
        { table: t.cross, idx: [0, 1, 2, 3] },
        ...involved.map((k, j) => ({ table: t.pairs[k], idx: [4 + j * 2, 5 + j * 2] })),
      ];
      let moves = null;
      try {
        moves = idaStar(coords, kinds, tbls, NO_D, { maxDepth: best ? best.moves.length - 1 : 14, nodeLimit: 2e6 });
      } catch { /* too slow for this pair: try another one */ }
      if (moves && (!best || moves.length < best.moves.length)) best = { p, moves };
    }
    if (!best) throw new Error('F2L search failed');
    done.push(best.p);
    add(`F2L pair ${done.length} (${PAIRS[best.p].name})`, best.moves);
  }

  // O: fewest algorithms (with U turns between) that make the top all one colour
  const oll = macroSearch(state, [...AUF, ...OLL], lastLayerOriented, { maxDepth: 7 });
  if (!oll) throw new Error('OLL failed');
  add(oll.filter((m) => !m.auf).map((m) => m.name).join(' + ') || 'OLL (skip)', oll.flatMap((m) => m.moves));

  // P: fewest algorithms that finish the cube
  const pll = macroSearch(state, [...AUF, ...PLL], isSolved, { maxDepth: 7 });
  if (!pll) throw new Error('PLL failed');
  add(pll.filter((m) => !m.auf).map((m) => m.name).join(' + ') || 'PLL (just turn the top)', pll.flatMap((m) => m.moves));

  return { method: 'CFOP', steps, moves: steps.flatMap((s) => s.moves) };
}

export function prepareCFOP() {
  getTables();
}
