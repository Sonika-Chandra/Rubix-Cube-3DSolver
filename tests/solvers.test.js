// Solver tests: every method must actually solve many random cubes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { solved, applyMoves, isSolved, toFacelets } from '../js/cube/cubie.js';
import { randomScramble, parseAlg } from '../js/cube/notation.js';
import { solveCFOP, LAST_LAYER_ALGS } from '../js/solvers/cfop.js';
import { solveBeginner } from '../js/solvers/beginner.js';

const require = createRequire(import.meta.url);
const Cube = require('../vendor/cubejs/cube.js');
require('../vendor/cubejs/solve.js');

// A fixed "random" sequence so test runs are repeatable
function seeded(seed) {
  return () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
}

function checkSolver(solve, count, seed) {
  const random = seeded(seed);
  for (let i = 0; i < count; i++) {
    const start = applyMoves(solved(), randomScramble(25, random));
    const result = solve(start);
    assert.ok(isSolved(applyMoves(start, result.moves)), `scramble ${i}`);
  }
}

test('last-layer algorithms never disturb the first two layers', () => {
  const f2l = (s) => [4, 5, 6, 7].every((i) => s.cp[i] === i && s.co[i] === 0)
    && [4, 5, 6, 7, 8, 9, 10, 11].every((i) => s.ep[i] === i && s.eo[i] === 0);
  for (const list of Object.values(LAST_LAYER_ALGS)) {
    for (const alg of list) assert.ok(f2l(applyMoves(solved(), alg.moves)), alg.name);
  }
});

test('CFOP solves 30 random cubes', () => checkSolver(solveCFOP, 30, 7));
test('Beginner solves 100 random cubes', () => checkSolver(solveBeginner, 100, 11));

test('Kociemba (cubejs) solves 20 random cubes in at most 22 moves', () => {
  Cube.initSolver();
  checkSolver((start) => {
    const moves = parseAlg(Cube.fromString(toFacelets(start)).solve());
    assert.ok(moves.length <= 22);
    return { moves };
  }, 20, 13);
});

test('an already-solved cube needs no moves', () => {
  assert.equal(solveCFOP(solved()).moves.length, 0);
  assert.equal(solveBeginner(solved()).moves.length, 0);
});
