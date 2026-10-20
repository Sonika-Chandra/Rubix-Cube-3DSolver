// Runs in a background thread ("Web Worker") so the page never freezes.
// Uses cubejs (MIT licence), an implementation of Herbert Kociemba's
// two-phase algorithm. It builds lookup tables once (~1-2 s), then finds a
// ~20-move solution for any cube in a fraction of a second.

importScripts('../../vendor/cubejs/cube.js', '../../vendor/cubejs/solve.js');

let ready = false;

function init() {
  if (!ready) {
    Cube.initSolver();
    ready = true;
  }
}

self.onmessage = (event) => {
  const { id, type, facelets } = event.data;
  try {
    if (type === 'init') {
      const t0 = performance.now();
      init();
      self.postMessage({ id, ok: true, ms: performance.now() - t0 });
      return;
    }
    init();
    const t0 = performance.now();
    const solution = Cube.fromString(facelets).solve();
    self.postMessage({ id, ok: true, solution, ms: performance.now() - t0 });
  } catch (err) {
    self.postMessage({ id, ok: false, error: String(err?.message ?? err) });
  }
};
