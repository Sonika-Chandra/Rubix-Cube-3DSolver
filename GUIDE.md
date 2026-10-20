# How Trix works

## 1. The cube exists twice

- **As numbers**, in `js/cube/cubie.js`. Centres never move, so a cube is just: which corner piece sits in each of the 8 corner slots and how it's twisted (`cp`, `co`), and which edge piece is in each of the 12 edge slots and whether it's flipped (`ep`, `eo`). A move is a rule like "slot 0 gets the piece from slot 3". The solvers and the "solved?" check only use this.
- **As a picture**, in `js/view/cube3d.js`: 26 little three.js cubes with stickers.

Every move is applied to both, so they always agree. The browser test reads all 54 sticker colours back from the 3D cube and compares them with the numbers.

Why not just use the picture? Asking "is it solved?" of 3D meshes is slow and fiddly. Asking it of 40 numbers is instant, and searches need to try millions of cubes per second.

## 2. Smooth turning (`cube3d.js`)

To turn a layer:
1. Find the 9 cubies in it (their position along the turn's axis is −1, 0 or 1).
2. Attach them to an invisible `pivot` object.
3. Rotate the pivot a little every frame, with easing (slow, fast, slow).
4. At the end, put the cubies back and **snap** their positions to whole numbers and their angles to exact right angles. Without snapping, tiny rounding errors would build up over thousands of turns and the cube would slowly warp.

Turns wait in a queue, so a 150-move solution plays one turn after another.

There are two frames to keep track of. The **cube frame** belongs to the cube: U is always the yellow centre. The **world frame** belongs to the screen. Turning the whole cube only rotates `holder`, so all moves stay in the cube frame, which is what the solvers speak.

## 3. Controls (`controls.js`)

When you grab a sticker, the code knows:
- the sticker's **normal** (which way that face points), and
- the **two directions** you could slide along that face.

When you start dragging, each direction is projected onto the screen, and the one that best matches your drag wins. The turn axis is then `normal × direction` (a cross product). For example, sliding right on the front face turns around the vertical axis. The layer is the grabbed cubie's position along that axis; the middle layer (0) turns the whole cube instead. While you drag, the angle follows your finger, and when you let go it glides to the nearest quarter turn.

Keyboard letters mean "the face pointing up/right/front **as you look at it**", so `cubeFaceTowards()` finds which real face is currently pointing that way.

### Middle slices (M, E, S)
A middle-layer turn moves the centres, but everything else assumes the centres never move (that's what keeps the yellow centre as U). So `finishSlice()` in `cube3d.js` uses a trick. After the middle layer has turned on screen, it instantly swaps that for something that **looks identical**:
1. put the middle layer back,
2. turn both outer layers the other way,
3. turn the whole cube (`holder`) forwards.

On screen nothing changes, and in the numbers, M becomes simply R L′ (`expandMove()` in `notation.js`; E = U D′, S = F′ B). A Node test checks this against cubejs, which understands slice moves itself.

### Palette
`PALETTES` in `cube3d.js` holds Classic and Pastel. `setPalette()` just recolours the six shared sticker materials, so switching is instant even mid-solve. Pastel stickers also glow faintly in their own colour, because under the same lights soft colours otherwise look muddy.

## 4. The three solvers

### Shortest: Kociemba (`kociemba.js`, `kociemba.worker.js`)
Kociemba's two-phase algorithm:
- **Phase 1** searches for moves that put the cube into a special group, where every edge and corner is "oriented" and the middle-layer edges are in the middle layer.
- **Phase 2** solves from there using only the moves that keep that property.

Each phase searches with big precomputed distance tables, built once in about 1–2 seconds. It runs in a **Web Worker** (a background thread), so the page never freezes. The solutions are usually 18–22 moves. They're not *guaranteed* shortest (the proven worst case is 20 moves, and finding the true optimum for every cube is much slower), but they're very close.

### CFOP (`cfop.js`)
- **Cross**: an IDA* search with a table of exact distances for the 4 white edges, so it's optimal and instant.
- **F2L**: for each of the 4 corner+edge pairs, an IDA* search for the shortest moves that solve the pair *without breaking the cross or earlier pairs*. It tries every remaining pair and keeps the one with the shortest solution, like a speedcuber choosing their next pair.
- **OLL / PLL**: a breadth-first search over a small set of real algorithms (Sune, T-perm…) plus U turns. This is "2-look": 1–2 algorithms for each.

### Beginner (`beginner.js`)
Same steps a person learns, using only beginner algorithms: white cross one edge at a time, corners with repeated `R U R' U'`, middle edges with the insert algorithms, yellow cross `F R U R' U' F'`, edges, corners, then twisting corners with `R' D' R D`.

**Bug story:** at first, 93 of 100 Beginner solves failed. Printing the cube after each step showed it broke in the last step. One `R' D' R D` swaps the top corner with a bottom one, so after an odd number of repeats a *different* piece sits in the slot. The loop checked that piece and stopped too early. Doing the algorithm in pairs fixed it.

## 5. You vs the computer, and help (`main.js`)
- **Your solve:** after a scramble, `you` is set. Your first turn starts the timer, and every turn checks `isSolved`.
- **Compare:** the scramble's moves are saved. After you solve, each method solves the same starting position (just computing, no animation) to fill in the move counts. **Watch** calls `view.jumpTo(scramble)`, which rebuilds the cube and applies the scramble *instantly*, then runs the normal computer solve.
- **Help:** 💡 Hint, ▶ Show me and 🏁 Finish it all ask the selected method to solve the cube *from where it is now*:
  - Hint shows the first step without turning anything.
  - Show me plays just that step through the same `playMoves()` the computer solves use, so the timer counts those moves too.
  - Finish it plays all the moves.

  Using help changes your result's name ("You + CFOP help"), so the results table stays honest.

## 6. IDA*: the search behind cross and F2L (`search.js`)
"Iterative deepening A*":
1. Try every sequence of 1 move, then 2, then 3, and so on.
2. A **distance table** tells you the fewest moves certain pieces need. If even that minimum doesn't fit in the moves left, skip the whole branch.
3. Also skip pointless sequences such as `R R'` or `R L R`.

The tables come from a breadth-first search outward from "solved" (`buildDistanceTable` in `pieces.js`).

## 7. Things to try changing
- **Colours:** `PALETTES` in `cube3d.js` (add a third palette and a button in `index.html`). The sticker shape is `roundedSquare(0.84, 0.14)` (size, corner roundness).
- **Turn feel:** the easing function `ease` and `turnMs`. Drag sensitivity: `QUARTER / 1.6` in `controls.js`.
- **New last-layer algorithms:** add one to `OLL` or `PLL` in `cfop.js`. The test "last-layer algorithms never disturb the first two layers" checks it's valid.
- **Scramble length:** `randomScramble(25)` in `main.js`.
