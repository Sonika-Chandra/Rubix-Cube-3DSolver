// Search helpers: follow a FEW pieces instead of the whole cube.
//
// A tracked piece is one number: where it is and how it's turned.
//   corner: slot * 3 + twist   (0..23)
//   edge:   slot * 2 + flip    (0..23)
// For every move we precompute "piece at X goes to Y", so applying a move to
// a tracked piece is a single array lookup. That makes searching fast.

import { MOVES, MOVE_NAMES } from '../cube/cubie.js';

export const CORNER_MOVE = {};
export const EDGE_MOVE = {};

for (const name of MOVE_NAMES) {
  const m = MOVES[name];
  const c = new Array(24);
  const e = new Array(24);
  // After the move, slot i holds what was in slot m.cp[i], twisted by m.co[i]
  for (let i = 0; i < 8; i++) {
    for (let t = 0; t < 3; t++) c[m.cp[i] * 3 + t] = i * 3 + ((t + m.co[i]) % 3);
  }
  for (let i = 0; i < 12; i++) {
    for (let t = 0; t < 2; t++) e[m.ep[i] * 2 + t] = i * 2 + ((t + m.eo[i]) % 2);
  }
  CORNER_MOVE[name] = c;
  EDGE_MOVE[name] = e;
}

// Read a piece's current coordinate out of a full cube state
export function cornerCoord(state, piece) {
  const slot = state.cp.indexOf(piece);
  return slot * 3 + state.co[slot];
}
export function edgeCoord(state, piece) {
  const slot = state.ep.indexOf(piece);
  return slot * 2 + state.eo[slot];
}

// Breadth-first search outward from "solved" to fill a table of
// "how many moves away is this arrangement from solved?"
// pieces: [{ kind: 'c' | 'e', piece }]   moves: allowed move names
export function buildDistanceTable(pieces, moves) {
  const size = 24 ** pieces.length;
  const table = new Int8Array(size).fill(-1);
  const home = pieces.map((p) => (p.kind === 'c' ? p.piece * 3 : p.piece * 2));
  const encode = (coords) => coords.reduce((acc, v) => acc * 24 + v, 0);

  let frontier = [home];
  table[encode(home)] = 0;
  for (let depth = 1; frontier.length; depth++) {
    const next = [];
    for (const coords of frontier) {
      for (const mv of moves) {
        const moved = coords.map((v, i) => (pieces[i].kind === 'c' ? CORNER_MOVE : EDGE_MOVE)[mv][v]);
        const idx = encode(moved);
        if (table[idx] === -1) {
          table[idx] = depth;
          next.push(moved);
        }
      }
    }
    frontier = next;
  }
  return { table, pieces, encode };
}

export function lookup(t, coords) {
  return t.table[t.encode(coords)];
}

// Moves that are pointless right after `last`: the same face again, or the
// opposite face when we'd only be swapping the order (R L = L R).
const AXIS_ORDER = { U: 0, D: 1, R: 2, L: 3, F: 4, B: 5 };
const OPPOSITE = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
export function allowedAfter(last, mv) {
  if (!last) return true;
  if (last[0] === mv[0]) return false;
  if (OPPOSITE[last[0]] === mv[0] && AXIS_ORDER[last[0]] > AXIS_ORDER[mv[0]]) return false;
  return true;
}
