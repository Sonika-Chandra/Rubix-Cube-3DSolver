// The 3D cube (three.js). Draws 26 small cubes ("cubies") with rounded,
// glossy stickers and animates layer turns smoothly.
//
// Two coordinate frames:
//   world frame - fixed to the screen (y is up)
//   cube frame  - fixed to the cube's centres (U is +y, R is +x, F is +z)
// Turning the WHOLE cube (dragging a middle row) only changes `holder`'s
// rotation, so moves are always stored in the cube frame, like the solver uses.

import * as THREE from 'three';
import { RoundedBoxGeometry } from '../../vendor/three/RoundedBoxGeometry.js';

export const PALETTES = {
  classic: {
    U: '#ffd500', // yellow
    D: '#ffffff', // white
    F: '#00a651', // green
    B: '#1f5fd6', // blue
    R: '#ff6a00', // orange
    L: '#d0102a', // red
  },
  // Soft colours, still chosen so yellow/white and red/orange stay easy to tell apart
  pastel: {
    U: '#ffe680', // butter yellow
    D: '#fbfaf6', // cream white
    F: '#8fdcaa', // mint
    B: '#93bbff', // sky blue
    R: '#ffb47a', // peach
    L: '#ff7f96', // rose
  },
};
export const COLORS = PALETTES.classic;

// Each face: which axis it sits on and which way it points
export const FACE_NORMALS = {
  U: new THREE.Vector3(0, 1, 0), D: new THREE.Vector3(0, -1, 0),
  R: new THREE.Vector3(1, 0, 0), L: new THREE.Vector3(-1, 0, 0),
  F: new THREE.Vector3(0, 0, 1), B: new THREE.Vector3(0, 0, -1),
};

const QUARTER = Math.PI / 2;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2); // easeInOutCubic

// "R2" -> 2, "R'" -> 3 (= -1), "R" -> 1 clockwise quarter turns
export function quarterTurns(move) {
  return move.endsWith('2') ? 2 : move.endsWith("'") ? -1 : 1;
}

// A rounded square, for stickers
function roundedSquare(size, radius) {
  const s = size / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-s + radius, -s);
  shape.lineTo(s - radius, -s);
  shape.quadraticCurveTo(s, -s, s, -s + radius);
  shape.lineTo(s, s - radius);
  shape.quadraticCurveTo(s, s, s - radius, s);
  shape.lineTo(-s + radius, s);
  shape.quadraticCurveTo(-s, s, -s, s - radius);
  shape.lineTo(-s, -s + radius);
  shape.quadraticCurveTo(-s, -s, -s + radius, -s);
  return shape;
}

// Soft round shadow under the cube (a blurred circle drawn on a 2D canvas)
function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 10, 128, 128, 128);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

export function createCubeView(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  // Neutral tone mapping keeps sticker colours true (ACES fades bright yellow towards white)
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  // Lights: soft sky light + a key light + a white back light for the edges.
  // (Coloured lights would tint the stickers, so the green glow is in the CSS background.)
  scene.add(new THREE.HemisphereLight(0xffffff, 0x333333, 0.8));
  const key = new THREE.DirectionalLight(0xffffff, 1.7);
  key.position.set(5, 5, 8);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.6);
  rim.position.set(-6, -1, -6);
  scene.add(rim);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(5, 5),
    new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = -2.3;
  scene.add(shadow);

  // holder = whole-cube orientation (world), cube = the cubies (cube frame)
  const holder = new THREE.Group();
  const cube = new THREE.Group();
  holder.add(cube);
  scene.add(holder);

  const bodyGeo = new RoundedBoxGeometry(0.98, 0.98, 0.98, 4, 0.12);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.55, metalness: 0.1 });
  const stickerGeo = new THREE.ShapeGeometry(roundedSquare(0.84, 0.14), 6);
  const stickerMats = Object.fromEntries(Object.entries(COLORS).map(([face, color]) => [
    face,
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
  ]));

  let cubies = [];
  const stickers = []; // meshes the mouse can grab

  function build() {
    cubies.forEach((c) => cube.remove(c));
    cubies = [];
    stickers.length = 0;
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        for (let z = -1; z <= 1; z++) {
          if (!x && !y && !z) continue;
          const cubie = new THREE.Group();
          cubie.position.set(x, y, z);
          cubie.add(new THREE.Mesh(bodyGeo, bodyMat));
          for (const [face, n] of Object.entries(FACE_NORMALS)) {
            // a sticker only on the outside faces
            if ((n.x && n.x !== x) || (n.y && n.y !== y) || (n.z && n.z !== z)) continue;
            const s = new THREE.Mesh(stickerGeo, stickerMats[face]);
            s.position.copy(n).multiplyScalar(0.495);
            s.lookAt(n.clone().multiplyScalar(2));
            s.userData = { face, cubie };
            cubie.add(s);
            stickers.push(s);
          }
          cube.add(cubie);
          cubies.push(cubie);
        }
      }
    }
  }
  build();

  // ---------- camera ----------
  const view = { theta: Math.PI / 4, phi: 1.0, dist: 11.5 }; // around, down from top, distance
  const spin = { theta: 0, phi: 0 };                           // leftover drag speed (smooth stop)

  function placeCamera() {
    view.phi = Math.min(Math.max(view.phi, 0.25), Math.PI - 0.25);
    view.dist = Math.min(Math.max(view.dist, 7), 20);
    camera.position.set(
      view.dist * Math.sin(view.phi) * Math.sin(view.theta),
      view.dist * Math.cos(view.phi),
      view.dist * Math.sin(view.phi) * Math.cos(view.theta),
    );
    camera.lookAt(0, -0.15, 0);
  }

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the whole cube in view in tall, narrow panels
    camera.fov = w / h < 0.9 ? 30 / Math.max(w / h, 0.55) : 30;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- turning layers ----------
  const pivot = new THREE.Group();
  cube.add(pivot);
  const queue = [];
  let active = null; // the turn being animated
  let turnMs = 160;

  function layerCubies(axis, layer) {
    return cubies.filter((c) => Math.round(c.position.dot(axis)) === layer);
  }

  // Snap positions to whole numbers and rotations to exact right angles,
  // so tiny rounding errors never build up over thousands of turns
  function snap(obj) {
    obj.position.set(Math.round(obj.position.x), Math.round(obj.position.y), Math.round(obj.position.z));
    const e = new THREE.Euler().setFromQuaternion(obj.quaternion);
    e.set(Math.round(e.x / QUARTER) * QUARTER, Math.round(e.y / QUARTER) * QUARTER, Math.round(e.z / QUARTER) * QUARTER);
    obj.quaternion.setFromEuler(e);
  }

  // Start rotating one layer (cube frame axis + layer -1/0/1); returns controls
  function grabLayer(axis, layer) {
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();
    const group = layerCubies(axis, layer);
    group.forEach((c) => pivot.attach(c));
    return {
      set(angle) { pivot.setRotationFromAxisAngle(axis, angle); },
      finish() {
        pivot.updateMatrixWorld();
        if (layer === 0) { finishSlice(axis, group); return; }
        group.forEach((c) => { cube.attach(c); snap(c); });
        pivot.rotation.set(0, 0, 0);
      },
    };
  }

  // A middle-layer turn moves the centres, but the solvers need the centres
  // to stay put. So after the middle layer has turned on screen, swap it for
  // something that LOOKS identical: put the middle back, turn both outer
  // layers the other way, and turn the whole cube (holder) forwards.
  //   M  =  R L'  + whole cube turned (x')   (same idea for E and S)
  function finishSlice(axis, middle) {
    const q = pivot.quaternion.clone();
    pivot.quaternion.identity();               // 1. middle layer back where it was
    pivot.updateMatrixWorld();
    middle.forEach((c) => { cube.attach(c); snap(c); });

    const outer = cubies.filter((c) => Math.round(c.position.dot(axis)) !== 0);
    outer.forEach((c) => pivot.attach(c));      // 2. outer layers turned backwards
    pivot.quaternion.copy(q).invert();
    pivot.updateMatrixWorld();
    outer.forEach((c) => { cube.attach(c); snap(c); });
    pivot.quaternion.identity();

    holder.quaternion.multiply(q);              // 3. the whole cube turned forwards
    snap(holder);
  }

  // Animate from angle `from` to angle `to`, then call done()
  function animate(handle, from, to, ms, done) {
    active = { handle, from, to, ms: Math.max(ms, 1), start: performance.now(), done };
  }

  function stepAnimation(now) {
    if (!active) {
      const next = queue.shift();
      if (!next) return;
      next.begin(now);
      return;
    }
    const t = Math.min(1, (now - active.start) / active.ms);
    active.handle.set(active.from + (active.to - active.from) * ease(t));
    if (t >= 1) {
      active.handle.finish();
      const { done } = active;
      active = null;
      done?.();
    }
  }

  // Which layer a move turns, and by how much
  function turnParams(move) {
    // Middle slices: M turns like L, E like D, S like F
    const SLICE = {
      M: [new THREE.Vector3(1, 0, 0), 1], E: [new THREE.Vector3(0, 1, 0), 1], S: [new THREE.Vector3(0, 0, 1), -1],
    }[move[0]];
    if (SLICE) return { axis: SLICE[0].clone(), layer: 0, angle: QUARTER * quarterTurns(move) * SLICE[1] };

    const n = FACE_NORMALS[move[0]];
    const axis = n.clone().set(Math.abs(n.x), Math.abs(n.y), Math.abs(n.z));
    const layer = Math.round(n.dot(axis));
    // clockwise looking at the face = negative rotation about its outward normal
    const angle = -QUARTER * quarterTurns(move) * layer;
    return { axis, layer, angle };
  }

  // Queue a face turn like "R'" (cube frame). onDone runs when it finishes.
  function turn(move, onDone, ms = turnMs) {
    queue.push({
      begin: () => {
        const { axis, layer, angle } = turnParams(move);
        const time = Math.abs(quarterTurns(move)) === 2 ? ms * 1.5 : ms;
        animate(grabLayer(axis, layer), 0, angle, time, onDone);
      },
    });
  }

  // Turn instantly, with no animation (used to jump to a saved scramble)
  function turnInstant(move) {
    const { axis, layer, angle } = turnParams(move);
    const handle = grabLayer(axis, layer);
    handle.set(angle);
    handle.finish();
  }

  // ---------- whole-cube rotation (holder) ----------
  function grabWhole(worldAxis) {
    const start = holder.quaternion.clone();
    return {
      set(angle) {
        holder.quaternion.copy(new THREE.Quaternion().setFromAxisAngle(worldAxis, angle).multiply(start));
      },
      finish() { snap(holder); },
    };
  }

  // Which cube face is currently pointing along a world direction?
  function cubeFaceTowards(worldDir) {
    const local = worldDir.clone().applyQuaternion(holder.quaternion.clone().invert());
    let best = null;
    let bestDot = -2;
    for (const [face, n] of Object.entries(FACE_NORMALS)) {
      const d = n.dot(local);
      if (d > bestDot) { bestDot = d; best = face; }
    }
    return best;
  }

  // World direction -> cube-frame direction (and back), rounded to an axis
  function toCubeFrame(v) {
    const local = v.clone().applyQuaternion(holder.quaternion.clone().invert());
    return local.set(Math.round(local.x), Math.round(local.y), Math.round(local.z));
  }

  // ---------- render loop ----------
  function frame(now) {
    if (Math.abs(spin.theta) > 1e-4 || Math.abs(spin.phi) > 1e-4) {
      view.theta += spin.theta;
      view.phi += spin.phi;
      spin.theta *= 0.9;
      spin.phi *= 0.9;
    }
    placeCamera();
    stepAnimation(now);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  return {
    canvas,
    camera,
    stickers,
    holder,
    view,
    spin,
    turn,
    grabLayer,
    grabWhole,
    animate: (handle, from, to, ms, done) => queue.push({ begin: () => animate(handle, from, to, ms, done) }),
    cubeFaceTowards,
    toCubeFrame,
    isBusy: () => Boolean(active) || queue.length > 0,
    clearQueue() { queue.length = 0; },
    setTurnMs(ms) { turnMs = ms; },
    getTurnMs: () => turnMs,
    setPalette(name) {
      const palette = PALETTES[name] ?? PALETTES.classic;
      for (const [face, mat] of Object.entries(stickerMats)) {
        mat.color.set(palette[face]);
        // pastel stickers glow faintly in their own colour so they read as light and soft
        mat.emissive.set(palette[face]);
        mat.emissiveIntensity = name === 'pastel' ? 0.28 : 0;
      }
    },
    reset() {
      queue.length = 0;
      active = null;
      pivot.rotation.set(0, 0, 0);
      holder.quaternion.identity();
      build();
    },
    // Jump to "solved, then these moves" with no animation
    jumpTo(moves) {
      this.reset();
      moves.forEach(turnInstant);
    },
    // Read a sticker colour back from the 3D cube (used by tests)
    stickerAt(face, row, col) {
      const n = FACE_NORMALS[face];
      for (const s of stickers) {
        const wp = new THREE.Vector3();
        s.getWorldPosition(wp);
        const local = cube.worldToLocal(wp.clone());
        if (local.dot(n) > 1.4) {
          const c = s.parent.position;
          const coords = { U: [c.z + 1, c.x + 1], D: [1 - c.z, c.x + 1], F: [1 - c.y, c.x + 1],
            B: [1 - c.y, 1 - c.x], R: [1 - c.y, 1 - c.z], L: [1 - c.y, c.z + 1] }[face];
          if (coords[0] === row && coords[1] === col) return s.userData.face;
        }
      }
      return null;
    },
  };
}
