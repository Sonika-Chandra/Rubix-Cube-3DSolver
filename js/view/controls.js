// Mouse / touch / keyboard controls for the 3D cube.
//
//  - Drag a sticker:      that layer follows your finger, then snaps to the
//                         nearest quarter turn when you let go
//  - Drag a middle row:   turns that middle slice (M, E or S)
//  - Shift + drag:        turns the whole cube
//  - Drag the background: look around the cube; it glides to a stop
//  - Scroll / pinch:      zoom
//  - Keys: U R F D L B turn the face that is CURRENTLY up/right/front...
//          M E S turn the middle slices, X Y Z the whole cube,
//          hold Shift for anticlockwise

import * as THREE from 'three';

const QUARTER = Math.PI / 2;
const AXES = [new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1)];
const WORLD_DIRS = {
  U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
};

// The face the camera mostly looks at is "front"; work out R and U from there
function viewFrame(camera) {
  const toCam = camera.position.clone().normalize();
  const front = AXES.map((a) => [a, a.dot(toCam)])
    .filter(([a]) => a.y === 0)
    .reduce((best, [a, d]) => (Math.abs(d) > Math.abs(best[1]) ? [a, d] : best), [null, 0]);
  const F = front[0].clone().multiplyScalar(Math.sign(front[1]));
  const U = new THREE.Vector3(0, 1, 0);
  const R = new THREE.Vector3().crossVectors(U, F);
  return { U, D: U.clone().negate(), F, B: F.clone().negate(), R, L: R.clone().negate() };
}

export function attachControls(view, { onMove, canTurn }) {
  const { canvas, camera } = view;
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let drag = null;

  function toNDC(e) {
    const r = canvas.getBoundingClientRect();
    pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
  }

  // World point -> screen pixels
  function toScreen(p) {
    const v = p.clone().project(camera);
    const r = canvas.getBoundingClientRect();
    return new THREE.Vector2((v.x + 1) / 2 * r.width, (1 - v.y) / 2 * r.height);
  }

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    toNDC(e);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(view.stickers, false)[0];
    if (hit && canTurn()) {
      // world-space normal of the grabbed sticker, rounded to an axis
      const normal = new THREE.Vector3(0, 0, 1).applyQuaternion(hit.object.getWorldQuaternion(new THREE.Quaternion()));
      normal.set(Math.round(normal.x), Math.round(normal.y), Math.round(normal.z));
      const cubiePos = hit.object.parent.getWorldPosition(new THREE.Vector3());
      drag = { kind: 'sticker', whole: e.shiftKey, x: e.clientX, y: e.clientY, point: hit.point, normal, cubiePos, chosen: null };
    } else {
      drag = { kind: 'orbit', x: e.clientX, y: e.clientY, lastX: e.clientX, lastY: e.clientY };
      view.spin.theta = view.spin.phi = 0;
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    if (drag.kind === 'orbit') {
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      view.view.theta -= dx * 0.008;
      view.view.phi -= dy * 0.008;
      view.spin.theta = -dx * 0.008; // keep gliding after release
      view.spin.phi = -dy * 0.008;
      return;
    }

    const move = new THREE.Vector2(e.clientX - drag.x, e.clientY - drag.y);
    if (!drag.chosen) {
      if (move.length() < 8) return; // wait until it's clearly a drag

      // The two directions you could slide along this face; pick the one
      // that best matches the drag on screen
      const start = toScreen(drag.point);
      let best = null;
      for (const dir of AXES) {
        if (Math.abs(dir.dot(drag.normal)) > 0.5) continue;
        const screenDir = toScreen(drag.point.clone().add(dir)).sub(start);
        const score = screenDir.clone().normalize().dot(move.clone().normalize());
        if (!best || Math.abs(score) > Math.abs(best.score)) best = { dir, screenDir, score };
      }
      // Sliding along `dir` on a face with `normal` = rotating about normal x dir
      const worldAxis = new THREE.Vector3().crossVectors(drag.normal, best.dir);
      const layer = Math.round(drag.cubiePos.dot(worldAxis));
      const pxPerUnit = best.screenDir.length();
      let handle;
      if (drag.whole) {
        handle = view.grabWhole(worldAxis);
      } else {
        // same axis, expressed in the cube's own frame
        // same axis in the cube's own frame; grabLayer wants it pointing the
        // positive way, so flip the angle too if we had to flip the axis
        const cubeAxis = view.toCubeFrame(worldAxis);
        const sign = Math.sign(cubeAxis.x + cubeAxis.y + cubeAxis.z);
        const inner = view.grabLayer(cubeAxis.multiplyScalar(sign), layer * sign);
        handle = { set: (a) => inner.set(a * sign), finish: () => inner.finish() };
      }
      drag.chosen = { worldAxis, layer, whole: drag.whole, screenDir: best.screenDir.normalize(), pxPerUnit, handle };
    }

    // follow the finger: 1.6 cube-widths of drag = a quarter turn
    const c = drag.chosen;
    c.angle = (move.dot(c.screenDir) / c.pxPerUnit) * (QUARTER / 1.6);
    c.handle.set(c.angle);
  });

  function release() {
    if (!drag) return;
    const d = drag;
    drag = null;
    if (d.kind !== 'sticker' || !d.chosen) return;
    const c = d.chosen;
    const turns = Math.round((c.angle ?? 0) / QUARTER);
    // glide to the nearest quarter turn
    // (read the cube's frame now: a middle-slice turn changes it when it finishes)
    const axis = view.toCubeFrame(c.worldAxis);
    const sign = Math.sign(axis.x + axis.y + axis.z);
    view.animate(c.handle, c.angle ?? 0, turns * QUARTER, 120, () => {
      if (c.whole || turns % 4 === 0) return; // whole-cube turn: nothing to record
      if (c.layer === 0) {
        onMove(sliceFor(axis.multiplyScalar(sign), turns * sign), { animated: true });
        return;
      }
      // rotation about +axis on layer L -> face move in the cube frame
      const layer = c.layer * sign;          // which side of the cube, in cube frame
      const face = faceFor(axis.multiplyScalar(sign), layer);
      const cw = ((-turns * sign * layer) % 4 + 4) % 4; // clockwise quarter turns
      onMove(face + SUFFIX[cw], { animated: true });
    });
  }
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    view.view.dist *= 1 + Math.sign(e.deltaY) * 0.08;
  }, { passive: false });

  // Keyboard: letters turn faces relative to how you're looking at the cube
  window.addEventListener('keydown', (e) => {
    if (e.target.closest('input, textarea, select') || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toUpperCase();
    const prime = e.shiftKey;
    if ('URFDLB'.includes(key) && key.length === 1) {
      if (!canTurn()) return;
      e.preventDefault();
      const dirs = viewFrame(camera);
      const face = view.cubeFaceTowards(dirs[key]);
      onMove(face + (prime ? "'" : ''), { animated: false });
    } else if ('MES'.includes(key) && key.length === 1) {
      // M turns like L, E like D, S like F (as you look at the cube)
      if (!canTurn()) return;
      e.preventDefault();
      const dirs = viewFrame(camera);
      const [worldAxis, dirSign] = { M: [dirs.R, 1], E: [dirs.U, 1], S: [dirs.F, -1] }[key];
      const axis = view.toCubeFrame(worldAxis);
      const sign = Math.sign(axis.x + axis.y + axis.z);
      onMove(sliceFor(axis.multiplyScalar(sign), (prime ? -1 : 1) * dirSign * sign), { animated: false });
    } else if ('XYZ'.includes(key) && key.length === 1) {
      if (!canTurn()) return;
      e.preventDefault();
      const dirs = viewFrame(camera);
      const axis = { X: dirs.R, Y: dirs.U, Z: dirs.F }[key];
      const handle = view.grabWhole(axis.clone());
      view.animate(handle, 0, (prime ? 1 : -1) * QUARTER, view.getTurnMs(), null);
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault();
      const step = 0.06;
      if (e.key === 'ArrowLeft') view.spin.theta = step;
      if (e.key === 'ArrowRight') view.spin.theta = -step;
      if (e.key === 'ArrowUp') view.spin.phi = step;
      if (e.key === 'ArrowDown') view.spin.phi = -step;
    }
  });
}

const SUFFIX = ['', '', '2', "'"];

// A middle-slice turn of `turns` quarter turns about a positive cube axis -> M / E / S
function sliceFor(axis, turns) {
  const [name, dir] = axis.x ? ['M', 1] : axis.y ? ['E', 1] : ['S', -1];
  const q = ((turns * dir) % 4 + 4) % 4;
  return name + SUFFIX[q];
}

// Cube-frame axis (positive) + layer +-1 -> face letter
function faceFor(axis, layer) {
  if (axis.x) return layer > 0 ? 'R' : 'L';
  if (axis.y) return layer > 0 ? 'U' : 'D';
  return layer > 0 ? 'F' : 'B';
}

export { WORLD_DIRS };
