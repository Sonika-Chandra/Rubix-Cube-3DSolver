# Trix

Trix is a 3D Rubik's cube in the browser that you can turn by hand, and that can solve itself three different ways while a timer runs.

- **Play:** drag stickers to turn layers, middle layers included (the layer follows your finger, then snaps). Shift+drag turns the whole cube, and dragging the background looks around. Keyboard: U R F D L B, M E S for middle slices (Shift = anticlockwise), X Y Z, Ctrl+Z.
- **Colours:** switch between Classic and Pastel stickers (remembered in your browser).
- **Race it:** press Scramble. Your timer starts on your first turn and stops when the cube is solved. Then **compare**: Trix shows how many moves each method needs for *your* scramble, and **Watch** replays your scramble so you can race each method on equal terms.
- **Stuck?** 💡 **Hint** names the next step and its moves, ▶ **Show me** plays just that step, 🏁 **Finish it** solves the rest. Your timer keeps running, and the result is marked "with help".
- **Watch it solve**, timed from the first turn to the last:

| Method | What it is | Typical moves |
|---|---|---|
| Shortest | Kociemba's two-phase search algorithm | 18–22 |
| CFOP | The speedcubing method: Cross, F2L pairs, 2-look OLL, 2-look PLL | 55–75 |
| Beginner | Layer by layer, the way most people learn | 130–190 |

Plain HTML, CSS and JavaScript. No build step; the libraries are included in `vendor/`.

## Run it

```
cd Trix
python -m http.server 8000
```

Open <http://localhost:8000>. A local server is needed because the page uses JavaScript modules and a Web Worker, which browsers block on `file://`.

## Tests

```
node --test tests/model.test.js tests/solvers.test.js
```

They check the cube model against cubejs on hundreds of random move sequences, and that every solver solves every test scramble.

## How the code is organised

```
index.html, css/style.css
js/cube/        the cube as numbers (no page, no 3D)
  cubie.js      pieces, moves, "is it solved?", sticker string
  notation.js   R U R' U' parsing, inverting, simplifying, scrambles
js/solvers/     the three methods (pure logic, testable in Node)
  pieces.js     follow a few pieces + distance tables
  search.js     IDA* search and algorithm search
  cfop.js       CFOP
  beginner.js   layer by layer
  kociemba.js   talks to kociemba.worker.js (runs cubejs in the background)
js/view/
  cube3d.js     the 3D cube (three.js): drawing and smooth turning
  controls.js   mouse, touch and keyboard
js/ui/panel.js  timer, solution list, results table
js/main.js      connects everything
vendor/         three.js and cubejs (both MIT licence)
tests/
```

See **GUIDE.md** for how each part works.

## Credits

- Trix's look and feel is inspired by Google's 2014 Rubik's Cube doodle (playable at [elgooG](https://elgoog.im/rubiks-cube/)). No code or assets were copied; everything here is written from scratch.
- [cubejs](https://github.com/ldez/cubejs) by Ludovic Fernandez et al. (MIT), an implementation of Herbert Kociemba's two-phase algorithm, powers the Shortest solver.
- [three.js](https://threejs.org) (MIT) draws the 3D cube.
