// "Shortest" solver: talks to the Kociemba worker.
// Kociemba's two-phase algorithm is a search (a classic AI technique):
//   phase 1 gets the cube into a special subgroup where only some moves are needed,
//   phase 2 finishes using just those moves.
// It isn't guaranteed to be THE shortest (that's up to 20 moves and much slower
// to prove), but it's usually 18-22 moves and very fast.

import { toFacelets } from '../cube/cubie.js';
import { parseAlg } from '../cube/notation.js';

export function createKociemba() {
  const worker = new Worker(new URL('./kociemba.worker.js', import.meta.url));
  const waiting = new Map();
  let nextId = 1;

  worker.onmessage = ({ data }) => {
    const job = waiting.get(data.id);
    if (!job) return;
    waiting.delete(data.id);
    if (data.ok) job.resolve(data);
    else job.reject(new Error(data.error));
  };

  function ask(message) {
    const id = nextId++;
    return new Promise((resolve, reject) => {
      waiting.set(id, { resolve, reject });
      worker.postMessage({ id, ...message });
    });
  }

  // Start building tables straight away, in the background
  const ready = ask({ type: 'init' });

  return {
    ready,
    async solve(state) {
      await ready;
      const { solution } = await ask({ type: 'solve', facelets: toFacelets(state) });
      const moves = solution.trim() ? parseAlg(solution) : [];
      return {
        method: 'Shortest',
        steps: [{ name: 'Two-phase search (Kociemba)', moves }],
        moves,
      };
    },
  };
}
