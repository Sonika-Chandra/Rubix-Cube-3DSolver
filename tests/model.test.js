// Model tests: run with  npm test  (no browser needed)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { solved, applyMoves, isSolved, toFacelets, MOVE_NAMES } from '../js/cube/cubie.js';
import { parseAlg, invertAlg, simplify, randomScramble, remap, expandMove } from '../js/cube/notation.js';

const require = createRequire(import.meta.url);
const Cube = require('../vendor/cubejs/cube.js'); // independent implementation to compare with

test('every move done 4 times does nothing', () => {
  for (const m of MOVE_NAMES) assert.ok(isSolved(applyMoves(solved(), [m, m, m, m])), m);
});

test('an algorithm followed by its inverse does nothing', () => {
  const alg = randomScramble(30);
  assert.ok(isSolved(applyMoves(solved(), [...alg, ...invertAlg(alg)])));
});

test('stickers match cubejs for 200 random sequences', () => {
  for (let i = 0; i < 200; i++) {
    const alg = randomScramble(25);
    const theirs = new Cube();
    theirs.move(alg.join(' '));
    assert.equal(toFacelets(applyMoves(solved(), alg)), theirs.asString(), alg.join(' '));
  }
});

test('notation: parse, simplify, remap', () => {
  assert.deepEqual(parseAlg("R U2 (R' F)"), ['R', 'U2', "R'", 'F']);
  assert.deepEqual(simplify(['R', 'R', 'U', "U'", 'F']), ['R2', 'F']);
  assert.deepEqual(remap(['R', "F'", 'U'], { R: 'B', F: 'R' }), ['B', "R'", 'U']);
});

test('middle slices M E S equal their outer-face pairs (checked against cubejs)', () => {
  // cubejs knows slice moves; after a slice its centres move, so compare the
  // pieces relative to the centres: do the slice, then turn the whole cube back.
  const undoRotation = { M: 'x', E: 'y', S: "z'" };
  for (const slice of ['M', 'E', 'S']) {
    for (const suffix of ['', "'", '2']) {
      const move = slice + suffix;
      const theirs = new Cube();
      const rot = suffix === '2' ? undoRotation[slice][0] + '2' : suffix === "'" ? invertAlg([undoRotation[slice]])[0] : undoRotation[slice];
      theirs.move(`${move} ${rot}`);
      assert.equal(toFacelets(applyMoves(solved(), expandMove(move))), theirs.asString(), move);
    }
  }
});
