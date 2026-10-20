// The cube as numbers ("cubie model"). Pure logic: no page, no 3D.
//
// A 3x3 cube has 8 corners and 12 edges that move (centres never move).
// For every SLOT we store which piece is there and how it is twisted:
//   cp[slot] = corner piece in that corner slot     co[slot] = twist 0,1,2
//   ep[slot] = edge piece in that edge slot         eo[slot] = flip  0,1
// Solved: every piece in its own slot, no twist, no flip.
//
// Slot / piece order (the standard used by Kociemba's algorithm and cubejs):
//   corners: URF UFL ULB UBR DFR DLF DBL DRB
//   edges:   UR UF UL UB DR DF DL DB FR FL BL BR

export const FACES = ['U', 'R', 'F', 'D', 'L', 'B'];
export const CORNERS = ['URF', 'UFL', 'ULB', 'UBR', 'DFR', 'DLF', 'DBL', 'DRB'];
export const EDGES = ['UR', 'UF', 'UL', 'UB', 'DR', 'DF', 'DL', 'DB', 'FR', 'FL', 'BL', 'BR'];

// The six quarter turns (clockwise, looking at that face), as "where each
// slot's new piece comes from" plus the twist/flip it picks up on the way.
const BASE = {
  U: { cp: [3, 0, 1, 2, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0],
       ep: [3, 0, 1, 2, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  R: { cp: [4, 1, 2, 0, 7, 5, 6, 3], co: [2, 0, 0, 1, 1, 0, 0, 2],
       ep: [8, 1, 2, 3, 11, 5, 6, 7, 4, 9, 10, 0], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  F: { cp: [1, 5, 2, 3, 0, 4, 6, 7], co: [1, 2, 0, 0, 2, 1, 0, 0],
       ep: [0, 9, 2, 3, 4, 8, 6, 7, 1, 5, 10, 11], eo: [0, 1, 0, 0, 0, 1, 0, 0, 1, 1, 0, 0] },
  D: { cp: [0, 1, 2, 3, 5, 6, 7, 4], co: [0, 0, 0, 0, 0, 0, 0, 0],
       ep: [0, 1, 2, 3, 5, 6, 7, 4, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  L: { cp: [0, 2, 6, 3, 4, 1, 5, 7], co: [0, 1, 2, 0, 0, 2, 1, 0],
       ep: [0, 1, 10, 3, 4, 5, 9, 7, 8, 2, 6, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  B: { cp: [0, 1, 3, 7, 4, 5, 2, 6], co: [0, 0, 1, 2, 0, 0, 2, 1],
       ep: [0, 1, 2, 11, 4, 5, 6, 10, 8, 9, 3, 7], eo: [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 1] },
};

export function solved() {
  return {
    cp: [0, 1, 2, 3, 4, 5, 6, 7], co: [0, 0, 0, 0, 0, 0, 0, 0],
    ep: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], eo: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  };
}

export function clone(s) {
  return { cp: [...s.cp], co: [...s.co], ep: [...s.ep], eo: [...s.eo] };
}

// Do b after a. (New slot i takes whatever a had in the slot b pulls from.)
export function multiply(a, b) {
  return {
    cp: b.cp.map((from) => a.cp[from]),
    co: b.cp.map((from, i) => (a.co[from] + b.co[i]) % 3),
    ep: b.ep.map((from) => a.ep[from]),
    eo: b.ep.map((from, i) => (a.eo[from] + b.eo[i]) % 2),
  };
}

// All 18 moves: U U2 U' R R2 R' ...
export const MOVE_NAMES = [];
export const MOVES = {};
for (const f of FACES) {
  let m = BASE[f];
  for (const suffix of ['', '2', "'"]) {
    MOVE_NAMES.push(f + suffix);
    MOVES[f + suffix] = m;
    m = multiply(m, BASE[f]);
  }
}

export function applyMove(state, move) {
  const m = MOVES[move];
  if (!m) throw new Error(`Unknown move "${move}"`);
  return multiply(state, m);
}

export function applyMoves(state, moves) {
  return moves.reduce(applyMove, state);
}

export function isSolved(s) {
  for (let i = 0; i < 8; i++) if (s.cp[i] !== i || s.co[i] !== 0) return false;
  for (let i = 0; i < 12; i++) if (s.ep[i] !== i || s.eo[i] !== 0) return false;
  return true;
}

export function stateKey(s) {
  return s.cp.join('') + s.co.join('') + s.ep.map((e) => e.toString(16)).join('') + s.eo.join('');
}

// ---------- stickers ("facelets") ----------
// 54 stickers in the order U1..U9 R1..R9 F1..F9 D1..D9 L1..L9 B1..B9,
// each face read row by row as you look at it (the standard net layout).
const f = (face, n) => FACES.indexOf(face) * 9 + n - 1;
export const CORNER_FACELETS = [
  [f('U', 9), f('R', 1), f('F', 3)], [f('U', 7), f('F', 1), f('L', 3)],
  [f('U', 1), f('L', 1), f('B', 3)], [f('U', 3), f('B', 1), f('R', 3)],
  [f('D', 3), f('F', 9), f('R', 7)], [f('D', 1), f('L', 9), f('F', 7)],
  [f('D', 7), f('B', 9), f('L', 7)], [f('D', 9), f('R', 9), f('B', 7)],
];
export const EDGE_FACELETS = [
  [f('U', 6), f('R', 2)], [f('U', 8), f('F', 2)], [f('U', 4), f('L', 2)], [f('U', 2), f('B', 2)],
  [f('D', 6), f('R', 8)], [f('D', 2), f('F', 8)], [f('D', 4), f('L', 8)], [f('D', 8), f('B', 8)],
  [f('F', 6), f('R', 4)], [f('F', 4), f('L', 6)], [f('B', 6), f('L', 4)], [f('B', 4), f('R', 6)],
];
const CORNER_COLORS = CORNERS.map((name) => [...name]);
const EDGE_COLORS = EDGES.map((name) => [...name]);

// The cube as a 54-letter string like "UUUUUUUUURRR..." (letter = which face's colour)
export function toFacelets(s) {
  const out = Array(54);
  FACES.forEach((face, i) => { out[i * 9 + 4] = face; });
  for (let i = 0; i < 8; i++) {
    for (let n = 0; n < 3; n++) {
      out[CORNER_FACELETS[i][(n + s.co[i]) % 3]] = CORNER_COLORS[s.cp[i]][n];
    }
  }
  for (let i = 0; i < 12; i++) {
    for (let n = 0; n < 2; n++) {
      out[EDGE_FACELETS[i][(n + s.eo[i]) % 2]] = EDGE_COLORS[s.ep[i]][n];
    }
  }
  return out.join('');
}
