// Two search engines the solvers share. Pure logic.
//
// 1. idaStar: find a SHORT sequence of single moves that reaches a goal.
//    "Iterative deepening A*": try all paths of length 1, then 2, then 3...
//    but skip any path a distance table proves can't finish in time.
//
// 2. macroSearch: find the fewest ALGORITHMS (known move sequences) that reach
//    a goal. Breadth-first: try 1 algorithm, then every pair, then triples...

import { CORNER_MOVE, EDGE_MOVE, lookup, allowedAfter } from './pieces.js';
import { applyMoves, stateKey } from '../cube/cubie.js';

// coords: tracked piece coordinates; kinds: 'c' or 'e' for each
// tables: [{ table, idx: [which coords it looks at] }] (all must reach 0)
export function idaStar(coords, kinds, tables, moves, { maxDepth = 14, nodeLimit = 3e6 } = {}) {
  const h = (cs) => {
    let best = 0;
    for (const t of tables) {
      const d = lookup(t.table, t.idx.map((i) => cs[i]));
      if (d > best) best = d;
    }
    return best;
  };

  let nodes = 0;
  const path = [];

  function dfs(cs, depth, last) {
    const est = h(cs);
    if (est === 0) return true;
    if (est > depth) return false;
    if (++nodes > nodeLimit) throw new Error('search too long');
    for (const mv of moves) {
      if (!allowedAfter(last, mv)) continue;
      const next = cs.map((v, i) => (kinds[i] === 'c' ? CORNER_MOVE : EDGE_MOVE)[mv][v]);
      path.push(mv);
      if (dfs(next, depth - 1, mv)) return true;
      path.pop();
    }
    return false;
  }

  for (let depth = h(coords); depth <= maxDepth; depth++) {
    if (dfs(coords, depth, null)) return [...path];
  }
  return null;
}

// macros: [{ name, moves }]; goal(state) -> true when done
export function macroSearch(state, macros, goal, { maxDepth = 6, stateLimit = 300000 } = {}) {
  if (goal(state)) return [];
  const seen = new Set([stateKey(state)]);
  let frontier = [{ state, path: [] }];
  for (let depth = 1; depth <= maxDepth; depth++) {
    const next = [];
    for (const { state: s, path } of frontier) {
      for (const macro of macros) {
        // Turning U twice in a row is never useful (U then U2 = U')
        const prev = path[path.length - 1];
        if (prev?.auf && macro.auf) continue;
        const moved = applyMoves(s, macro.moves);
        const key = stateKey(moved);
        if (seen.has(key)) continue;
        seen.add(key);
        const newPath = [...path, macro];
        if (goal(moved)) return newPath;
        next.push({ state: moved, path: newPath });
      }
    }
    if (seen.size > stateLimit) break;
    frontier = next;
  }
  return null;
}

export const AUF = [
  { name: 'U', moves: ['U'], auf: true },
  { name: 'U2', moves: ['U2'], auf: true },
  { name: "U'", moves: ["U'"], auf: true },
];
