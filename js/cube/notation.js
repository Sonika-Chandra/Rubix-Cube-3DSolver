// Move notation helpers. Pure logic.
// A move is a face letter plus an optional suffix: R (clockwise), R' (anti), R2 (half).

const FACE_RE = /^[URFDLB]$/;

export function parseAlg(text) {
  return String(text)
    .replace(/[()]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const face = tok[0];
      const rest = tok.slice(1).replace('’', "'");
      if (!FACE_RE.test(face) || !['', '2', "'", "2'"].includes(rest)) {
        throw new Error(`Bad move "${tok}"`);
      }
      return face + (rest === "2'" ? '2' : rest);
    });
}

export function invertMove(m) {
  if (m.endsWith('2')) return m;
  if (m.endsWith("'")) return m[0];
  return m + "'";
}

export function invertAlg(moves) {
  return [...moves].reverse().map(invertMove);
}

// How many quarter turns clockwise a move is: R=1, R2=2, R'=3
const amount = (m) => (m.endsWith('2') ? 2 : m.endsWith("'") ? 3 : 1);
const fromAmount = (face, n) => [null, face, face + '2', face + "'"][n % 4];

// Merge neighbours on the same face: R R -> R2, R R' -> nothing
export function simplify(moves) {
  const out = [];
  for (const m of moves) {
    const last = out[out.length - 1];
    if (last && last[0] === m[0]) {
      out.pop();
      const merged = fromAmount(m[0], amount(last) + amount(m));
      if (merged) out.push(merged);
    } else {
      out.push(m);
    }
  }
  return out;
}

// Rename faces: used to replay an algorithm "from another side" of the cube.
// map = { R: 'B', F: 'R', L: 'F', B: 'L' } etc. U and D stay the same.
export function remap(moves, map) {
  return moves.map((m) => (map[m[0]] ?? m[0]) + m.slice(1));
}

// Middle-layer moves, as the face turns the solvers understand.
// (On screen the middle layer turns; logically it's the two outer layers
//  turning the other way, plus the whole cube turning, which changes nothing.)
//   M (like L) = R L'     E (like D) = U D'     S (like F) = F' B
const SLICES = { M: ['R', "L'"], E: ['U', "D'"], S: ["F'", 'B'] };

export function isSlice(move) {
  return move[0] in SLICES;
}

export function expandMove(move) {
  const pair = SLICES[move[0]];
  if (!pair) return [move];
  const suffix = move.slice(1);
  if (suffix === '2') return pair.map((m) => m[0] + '2');
  if (suffix === "'") return pair.map(invertMove);
  return pair;
}

export function randomScramble(length = 25, random = Math.random) {
  const faces = ['U', 'R', 'F', 'D', 'L', 'B'];
  const opposite = { U: 'D', D: 'U', R: 'L', L: 'R', F: 'B', B: 'F' };
  const moves = [];
  while (moves.length < length) {
    const face = faces[Math.floor(random() * 6)];
    const prev = moves[moves.length - 1]?.[0];
    const prev2 = moves[moves.length - 2]?.[0];
    // no "R R", and no "R L R" (same as R2 L)
    if (face === prev || (face === prev2 && opposite[face] === prev)) continue;
    moves.push(face + ['', '2', "'"][Math.floor(random() * 3)]);
  }
  return moves;
}
