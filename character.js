// Humanoid player character: a jointed skeleton of smooth lathe-shaped limbs, a modelled
// head with face and hair, tattered base clothing (cosmetic only, zero armor), and a
// procedural animation rig (idle, walk, run, jump, land, attack, hurt, death).
//
// Draw-call budget: every bone's static parts are merged into ONE vertex-colored mesh,
// so the whole body is about 12 meshes sharing a single material.
//
// Proportions (meters, character faces +z, feet at y = 0):
//   hip joint 0.92 | knee 0.47 | shoulder 1.48 | head center 1.69 | top of head ~1.81
import * as THREE from 'three';
import { bake, merge } from './props.js';

const SKIN = 0xc99a74;
const SKIN_SHADE = 0xb0825f;
const HAIR_DARK = 0x16100c;
const HAIR_LIGHT = 0x2e2016;
const LINEN = 0x6b5c47;
const LINEN_DARK = 0x4e4333;
const LEATHER = 0x2b2019;

const lathe = (pts, seg = 14) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
const sphere = (r, w = 12, h = 9) => new THREE.SphereGeometry(r, w, h);

// Bake options shared by body parts (smooth analytic normals, light color noise).
const body = (o) => ({ noise: 0.07, keepNormals: true, ...o });

function mesh(parts, material) {
  const m = new THREE.Mesh(merge(parts), material);
  m.castShadow = true;
  return m;
}

// ---------- Static body parts, built once per character ----------

function buildTorso() {
  const sc = [1.15, 1, 0.75];
  const parts = [
    // Bare body (visible at the shoulders and neck)
    bake(lathe([[0.001, -0.1], [0.15, -0.08], [0.18, 0.02], [0.155, 0.2], [0.17, 0.34], [0.19, 0.46], [0.16, 0.56], [0.07, 0.62], [0.001, 0.645]], 18),
      body({ scale: sc, bottom: SKIN_SHADE, top: SKIN })),
    // Neck
    bake(new THREE.CylinderGeometry(0.047, 0.055, 0.12, 10), body({ at: [0, 0.65, 0], bottom: SKIN_SHADE, top: SKIN, keepNormals: false })),
    // Torn linen tunic
    bake(lathe([[0.176, 0.04], [0.164, 0.2], [0.182, 0.34], [0.205, 0.46], [0.178, 0.575]], 18),
      body({ scale: sc, bottom: LINEN_DARK, top: LINEN, noise: 0.2 })),
    // Rope belt and buckle
    bake(new THREE.TorusGeometry(0.17, 0.016, 6, 18), body({ at: [0, 0.14, 0], rot: [Math.PI / 2, 0, 0], scale: [1.15, 0.75, 1], bottom: LEATHER, top: LEATHER, keepNormals: false })),
    bake(new THREE.BoxGeometry(0.04, 0.04, 0.012), body({ at: [0, 0.14, 0.133], bottom: 0x6a5a38, top: 0x8a7848, keepNormals: false }))
  ];
  // Frayed hem tatters
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2;
    parts.push(bake(new THREE.ConeGeometry(0.035, 0.12 + (i % 3) * 0.03, 3), body({
      at: [Math.sin(a) * 0.178 * 1.15, 0.0 + 0.04, Math.cos(a) * 0.178 * 0.75], rot: [Math.PI, a, 0],
      bottom: LINEN_DARK, top: LINEN, keepNormals: false, noise: 0.25
    })));
  }
  return parts;
}

function buildHead() {
  const eyeWhite = 0xe6dfd2;
  const parts = [
    bake(sphere(1, 22, 16), body({ scale: [0.092, 0.115, 0.1], bottom: SKIN_SHADE, top: SKIN, keepNormals: false })),
    bake(sphere(1, 14, 10), body({ at: [0, -0.078, 0.022], scale: [0.068, 0.058, 0.074], bottom: SKIN_SHADE, top: SKIN, keepNormals: false })),      // jaw
    bake(sphere(1, 10, 8), body({ at: [0, -0.108, 0.058], scale: [0.03, 0.026, 0.03], bottom: SKIN_SHADE, top: SKIN, keepNormals: false })),         // chin
    bake(new THREE.ConeGeometry(0.017, 0.052, 5), body({ at: [0, -0.014, 0.1], rot: [Math.PI / 2, 0, 0], bottom: SKIN_SHADE, top: SKIN, keepNormals: false })), // nose
    bake(new THREE.BoxGeometry(0.03, 0.006, 0.008), body({ at: [0, -0.066, 0.092], bottom: 0x6a3a30, top: 0x6a3a30, keepNormals: false, noise: 0 })),    // mouth
    bake(sphere(1, 8, 6), body({ at: [0, 0.052, 0.085], scale: [0.07, 0.012, 0.02], bottom: SKIN_SHADE, top: SKIN, keepNormals: false }))            // brow ridge
  ];
  for (const s of [-1, 1]) {
    parts.push(
      bake(sphere(1, 8, 6), body({ at: [s * 0.035, 0.016, 0.089], scale: [0.016, 0.011, 0.01], bottom: eyeWhite, top: eyeWhite, keepNormals: false, noise: 0 })),
      bake(sphere(1, 8, 6), body({ at: [s * 0.035, 0.016, 0.097], scale: [0.0085, 0.0085, 0.006], bottom: 0x1c130d, top: 0x1c130d, keepNormals: false, noise: 0 })),
      bake(new THREE.BoxGeometry(0.04, 0.008, 0.01), body({ at: [s * 0.036, 0.04, 0.094], rot: [0, 0, -s * 0.18], bottom: HAIR_DARK, top: HAIR_DARK, keepNormals: false, noise: 0 })),
      bake(sphere(1, 8, 6), body({ at: [s * 0.092, 0, -0.004], scale: [0.011, 0.026, 0.02], bottom: SKIN_SHADE, top: SKIN, keepNormals: false }))
    );
  }
  return parts;
}

function buildHair() {
  const parts = [
    bake(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.62), body({ at: [0, 0.01, -0.008], scale: [0.102, 0.122, 0.112], bottom: HAIR_DARK, top: HAIR_LIGHT, noise: 0.3, keepNormals: false })),
    // Hair falling behind the head and neck
    bake(new THREE.ConeGeometry(0.082, 0.2, 7), body({ at: [0, -0.07, -0.062], rot: [Math.PI, 0, 0], bottom: HAIR_LIGHT, top: HAIR_DARK, noise: 0.3, keepNormals: false }))
  ];
  // Fringe over the brow
  for (let i = 0; i < 6; i++) {
    const x = (i - 2.5) * 0.026;
    parts.push(bake(new THREE.ConeGeometry(0.014, 0.05 + (i % 2) * 0.02, 4), body({
      at: [x, 0.075, 0.088 - Math.abs(x) * 0.6], rot: [Math.PI - 0.25, 0, 0], bottom: HAIR_LIGHT, top: HAIR_DARK, noise: 0.2, keepNormals: false
    })));
  }
  return parts;
}

function buildPonytail() {
  return [bake(lathe([[0.001, -0.3], [0.006, -0.26], [0.016, -0.18], [0.03, -0.07], [0.028, 0.0]], 8), body({ bottom: HAIR_LIGHT, top: HAIR_DARK, noise: 0.25 })),
    bake(new THREE.TorusGeometry(0.03, 0.007, 5, 10), body({ at: [0, -0.01, 0], rot: [Math.PI / 2, 0, 0], bottom: LEATHER, top: LEATHER, keepNormals: false, noise: 0 }))];
}

function buildUpperArm() {
  return [
    bake(sphere(1, 12, 9), body({ scale: [0.058, 0.058, 0.058], bottom: SKIN, top: SKIN, keepNormals: false })),
    bake(lathe([[0.04, -0.3], [0.047, -0.2], [0.057, -0.08], [0.052, 0.0]], 12), body({ bottom: SKIN_SHADE, top: SKIN }))
  ];
}

function buildForearm(side) {
  const parts = [
    bake(sphere(1, 10, 8), body({ scale: [0.046, 0.046, 0.046], bottom: SKIN, top: SKIN, keepNormals: false })),
    bake(lathe([[0.032, -0.27], [0.04, -0.18], [0.049, -0.05], [0.045, 0.0]], 12), body({ bottom: SKIN_SHADE, top: SKIN })),
    // Cloth wrist wrap
    bake(new THREE.CylinderGeometry(0.047, 0.043, 0.09, 10), body({ at: [0, -0.2, 0], bottom: LINEN_DARK, top: LINEN, keepNormals: false, noise: 0.22 })),
    // Hand and thumb
    bake(sphere(1, 10, 8), body({ at: [0, -0.31, 0.004], scale: [0.036, 0.052, 0.026], bottom: SKIN_SHADE, top: SKIN, keepNormals: false })),
    bake(sphere(1, 8, 6), body({ at: [-side * 0.03, -0.285, 0.016], rot: [0, 0, side * 0.5], scale: [0.012, 0.026, 0.012], bottom: SKIN, top: SKIN, keepNormals: false }))
  ];
  return parts;
}

function buildThigh() {
  const parts = [
    bake(lathe([[0.062, -0.45], [0.078, -0.28], [0.1, -0.08], [0.095, 0.0]], 12), body({ bottom: SKIN_SHADE, top: SKIN })),
    // Ragged shorts
    bake(lathe([[0.114, -0.27], [0.11, -0.1], [0.104, 0.02]], 12), body({ bottom: LINEN_DARK, top: LINEN, noise: 0.22 }))
  ];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    parts.push(bake(new THREE.ConeGeometry(0.026, 0.07 + (i % 2) * 0.03, 3), body({
      at: [Math.sin(a) * 0.114, -0.27, Math.cos(a) * 0.114], rot: [Math.PI, a, 0], bottom: LINEN_DARK, top: LINEN, keepNormals: false, noise: 0.25
    })));
  }
  return parts;
}

function buildShin() {
  return [
    bake(sphere(1, 10, 8), body({ scale: [0.06, 0.06, 0.06], bottom: SKIN, top: SKIN, keepNormals: false })),
    bake(lathe([[0.038, -0.42], [0.05, -0.3], [0.067, -0.1], [0.058, 0.0]], 12), body({ bottom: SKIN_SHADE, top: SKIN })),
    // Ankle wrap and bare foot
    bake(new THREE.CylinderGeometry(0.05, 0.046, 0.08, 10), body({ at: [0, -0.36, 0], bottom: LINEN_DARK, top: LINEN, keepNormals: false, noise: 0.22 })),
    bake(sphere(1, 12, 8), body({ at: [0, -0.425, 0.05], scale: [0.052, 0.04, 0.115], bottom: SKIN_SHADE, top: SKIN, keepNormals: false }))
  ];
}

// ---------- Equipment (cosmetic skin pieces; stats live in the inventory) ----------

function gearMaterial(metal = 0, rough = 0.75) {
  return new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal, side: THREE.DoubleSide });
}
const gear = (o) => ({ noise: 0.14, keepNormals: false, ...o });

function buildHeadGear(id) {
  if (id === 'helm_iron') {
    const parts = [
      bake(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.56), gear({ at: [0, 0.012, 0], scale: [0.118, 0.122, 0.124], bottom: 0x6c7078, top: 0xa4a8b0 })),
      bake(new THREE.TorusGeometry(0.114, 0.012, 6, 20), gear({ at: [0, 0.0, 0], rot: [Math.PI / 2, 0, 0], bottom: 0x5a5e66, top: 0x7a7e86 })),
      bake(new THREE.BoxGeometry(0.014, 0.075, 0.012), gear({ at: [0, 0.0, 0.122], bottom: 0x6c7078, top: 0x8a8e96 })),
      bake(new THREE.BoxGeometry(0.012, 0.04, 0.22), gear({ at: [0, 0.128, 0], bottom: 0x6c7078, top: 0x9a9ea6 }))
    ];
    for (const s of [-1, 1]) parts.push(bake(new THREE.BoxGeometry(0.014, 0.07, 0.07), gear({ at: [s * 0.108, -0.04, 0.02], bottom: 0x6c7078, top: 0x8a8e96 })));
    return { mesh: mesh(parts, gearMaterial(0.35, 0.45)), parent: 'head' };
  }
  // Hooded cowl: covers the back and sides of the head, face left open.
  const parts = [
    bake(new THREE.SphereGeometry(1, 20, 14, Math.PI * 0.62, Math.PI * 1.76, 0, Math.PI * 0.74), gear({ at: [0, 0.004, -0.012], scale: [0.124, 0.142, 0.136], bottom: 0x3a3640, top: 0x5a5562, noise: 0.2 })),
    bake(lathe([[0.075, -0.2], [0.115, -0.1], [0.132, 0.0]], 14), gear({ at: [0, -0.06, -0.02], bottom: 0x35313b, top: 0x4e4a56, noise: 0.22 }))
  ];
  return { mesh: mesh(parts, gearMaterial(0, 0.9)), parent: 'head' };
}

function buildBodyGear(id) {
  if (id === 'cloak_ember') {
    const cape = bake(new THREE.CylinderGeometry(0.2, 0.37, 1.05, 14, 1, true, Math.PI * 0.52, Math.PI * 0.96), gear({
      at: [0, -0.48, -0.02], bottom: 0xc45a22, top: 0x6e2810, jitter: 0.012, noise: 0.28
    }));
    const mantle = bake(new THREE.TorusGeometry(0.2, 0.035, 6, 18, Math.PI * 1.2), gear({ at: [0, 0.0, 0], rot: [Math.PI / 2, 0, Math.PI * 0.9], scale: [1.1, 1, 0.8], bottom: 0x2e1a12, top: 0x4a2a1a }));
    return { mesh: mesh([cape, mantle], gearMaterial(0, 0.85)), parent: 'spine', flutter: true };
  }
  // Leaf vest over the torso
  const sc = [1.2, 1, 0.78];
  const parts = [bake(lathe([[0.192, 0.1], [0.182, 0.22], [0.198, 0.36], [0.218, 0.47], [0.182, 0.56]], 16), gear({ scale: sc, bottom: 0x1f4a24, top: 0x4f8a3e, noise: 0.25 }))];
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    parts.push(bake(new THREE.ConeGeometry(0.045, 0.15, 4), gear({
      at: [Math.sin(a) * 0.195 * sc[0], 0.1, Math.cos(a) * 0.195 * sc[2]], rot: [Math.PI, a, 0], bottom: 0x1f4a24, top: 0x5fa04a, noise: 0.3
    })));
  }
  return { mesh: mesh(parts, gearMaterial(0, 0.8)), parent: 'torso' };
}

function buildLegGear() {
  return [0, 1].map(() => mesh([
    bake(lathe([[0.058, -0.34], [0.074, -0.2], [0.079, -0.07]], 12), gear({ bottom: 0x8a6a3a, top: 0xc4a266, noise: 0.2 })),
    bake(sphere(1, 10, 8), gear({ at: [0, 0.0, 0.035], scale: [0.066, 0.058, 0.06], bottom: 0xa88650, top: 0xc4a266 })),
    bake(new THREE.TorusGeometry(0.07, 0.008, 5, 12), gear({ at: [0, -0.18, 0], rot: [Math.PI / 2, 0, 0], bottom: LEATHER, top: LEATHER, noise: 0 }))
  ], gearMaterial(0, 0.7)));
}

function buildCharm() {
  const bone = 0xd8ccb5;
  return mesh([
    bake(new THREE.TorusGeometry(0.075, 0.006, 5, 16), gear({ at: [0, 0.03, 0.01], rot: [Math.PI / 2.4, 0, 0], bottom: LEATHER, top: LEATHER, noise: 0 })),
    bake(new THREE.ConeGeometry(0.014, 0.065, 5), gear({ at: [0, -0.04, 0.088], rot: [Math.PI, 0, 0], bottom: bone, top: 0xf0e8d6 })),
    bake(sphere(1, 8, 6), gear({ at: [0, -0.002, 0.086], scale: [0.016, 0.016, 0.016], bottom: bone, top: bone }))
  ], gearMaterial(0, 0.6));
}

// ---------- Held items ----------

function buildHeld(id, withLight) {
  const g = new THREE.Group();
  const add = (parts, mat) => { const m = mesh(parts, mat); g.add(m); return m; };
  const std = (metal = 0, rough = 0.8) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough, metalness: metal });
  let update = null;

  if (id === 'stone_axe') {
    add([
      bake(new THREE.CylinderGeometry(0.018, 0.024, 0.6, 7), gear({ at: [0, 0.14, 0], bottom: 0x3a2a1c, top: 0x6a4e34 })),
      bake(new THREE.BoxGeometry(0.13, 0.15, 0.04), gear({ at: [0.06, 0.4, 0], rot: [0, 0, -0.2], bottom: 0x5e5c58, top: 0x8c8a84, jitter: 0.008 })),
      bake(new THREE.TorusGeometry(0.026, 0.007, 4, 8), gear({ at: [0.01, 0.37, 0], rot: [Math.PI / 2, 0, 0], bottom: LINEN, top: LINEN, noise: 0 }))
    ], std(0, 0.85));
  } else if (id === 'obsidian_blade') {
    add([
      bake(new THREE.CylinderGeometry(0.02, 0.02, 0.17, 7), gear({ at: [0, 0.02, 0], bottom: LEATHER, top: 0x4a3a2c })),
      bake(new THREE.BoxGeometry(0.13, 0.022, 0.032), gear({ at: [0, 0.115, 0], bottom: 0x1a1426, top: 0x2e2442 })),
      bake(new THREE.ConeGeometry(0.034, 0.58, 4), gear({ at: [0, 0.42, 0], rot: [0, Math.PI / 4, 0], scale: [1, 1, 0.3], bottom: 0x0c0814, top: 0x3a2a58, noise: 0.1 }))
    ], std(0.55, 0.18));
  } else if (id === 'bone_spear') {
    add([
      bake(new THREE.CylinderGeometry(0.016, 0.018, 1.3, 6), gear({ at: [0, 0.4, 0], bottom: 0x4a3a28, top: 0x7a6244 })),
      bake(new THREE.ConeGeometry(0.03, 0.2, 4), gear({ at: [0, 1.15, 0], bottom: 0xcfc3a8, top: 0xf0e8d6 })),
      bake(new THREE.TorusGeometry(0.02, 0.006, 4, 8), gear({ at: [0, 1.04, 0], rot: [Math.PI / 2, 0, 0], bottom: LINEN, top: LINEN, noise: 0 }))
    ], std(0, 0.8));
  } else if (id === 'torch') {
    add([bake(new THREE.CylinderGeometry(0.02, 0.026, 0.5, 6), gear({ at: [0, 0.1, 0], bottom: 0x3a2a1c, top: 0x6a4e34 }))], std(0, 0.9));
    const flame = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 1), new THREE.MeshBasicMaterial({ color: 0xffa23a }));
    flame.position.y = 0.4;
    flame.scale.set(1, 1.6, 1);
    g.add(flame);
    let light = null;
    if (withLight) { light = new THREE.PointLight(0xff9a40, 2.2, 16, 2); light.position.y = 0.45; g.add(light); }
    update = (t) => {
      const f = 1 + Math.sin(t * 17) * 0.12 + Math.sin(t * 29) * 0.07;
      flame.scale.set(1 / Math.sqrt(f), 1.6 * f, 1 / Math.sqrt(f));
      if (light) light.intensity = 2 + (f - 1) * 3;
    };
  }
  g.rotation.x = 1.1;      // tool points forward and up from the fist
  g.position.set(0, -0.3, 0.02);
  g.userData.update = update;
  return g;
}

// ---------- The character ----------

/**
 * @param {{ torchLight?: boolean }} opts
 * @returns {{ root, update(dt, motion), setEquipment(eq), setHeld(id), flash(), attack(), setDead(bool) }}
 *   motion: { speed 0..1, sprint, grounded, vy, wading }
 */
export function createHumanoid(opts = {}) {
  const root = new THREE.Group();
  const rig = new THREE.Group();           // tilts when the player collapses
  root.add(rig);

  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78, metalness: 0 });
  const bones = {};

  const pelvis = new THREE.Group(); pelvis.position.y = 0.96; rig.add(pelvis);
  const torso = mesh(buildTorso(), bodyMat); pelvis.add(torso);

  const spine = new THREE.Group(); spine.position.y = 0.52; pelvis.add(spine);
  const headGroup = new THREE.Group(); headGroup.position.y = 0.21; spine.add(headGroup);
  headGroup.add(mesh(buildHead(), bodyMat));
  headGroup.add(mesh(buildHair(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 })));
  const ponytail = new THREE.Group(); ponytail.position.set(0, 0.04, -0.1); headGroup.add(ponytail);
  ponytail.add(mesh(buildPonytail(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 })));
  // The head sits on the neck, which lives in the torso mesh (pelvis space). Offset spine so they meet.
  torso.position.y = 0;

  // Arms. Side +1 is the character's left (+x), -1 its right (-x, the weapon hand).
  function makeArm(side) {
    const shoulder = new THREE.Group(); shoulder.position.set(side * 0.225, -0.01, 0); spine.add(shoulder);
    shoulder.add(mesh(buildUpperArm(), bodyMat));
    const elbow = new THREE.Group(); elbow.position.y = -0.3; shoulder.add(elbow);
    elbow.add(mesh(buildForearm(side), bodyMat));
    return { shoulder, elbow };
  }
  const armL = makeArm(1);
  const armR = makeArm(-1);

  // Legs
  function makeLeg(side) {
    const hip = new THREE.Group(); hip.position.set(side * 0.095, -0.04, 0); pelvis.add(hip);
    hip.add(mesh(buildThigh(), bodyMat));
    const knee = new THREE.Group(); knee.position.y = -0.45; hip.add(knee);
    knee.add(mesh(buildShin(), bodyMat));
    return { hip, knee };
  }
  const legL = makeLeg(1);
  const legR = makeLeg(-1);

  Object.assign(bones, { pelvis, spine, torso, headGroup });

  // Held item sits in the right hand.
  let held = null;
  function setHeld(id) {
    if (held) { armR.elbow.remove(held); held = null; }
    if (!id) return;
    held = buildHeld(id, !!opts.torchLight);
    if (held.children.length) armR.elbow.add(held);
    else held = null;
  }

  // Equipment
  const worn = { head: null, body: null, legs: null, accessory: null };
  let flutterMesh = null;
  function clearWorn(slot) {
    const w = worn[slot];
    if (!w) return;
    (Array.isArray(w) ? w : [w]).forEach((m) => m.parent && m.parent.remove(m));
    worn[slot] = null;
    if (slot === 'body') flutterMesh = null;
  }
  function setEquipment(eq = {}) {
    ['head', 'body', 'legs', 'accessory'].forEach(clearWorn);
    if (eq.head) { const g = buildHeadGear(eq.head); headGroup.add(g.mesh); worn.head = g.mesh; }
    if (eq.body) {
      const g = buildBodyGear(eq.body);
      (g.parent === 'spine' ? spine : torso).add(g.mesh);
      worn.body = g.mesh;
      flutterMesh = g.flutter ? g.mesh : null;
    }
    if (eq.legs) {
      const [a, b] = buildLegGear();
      legL.knee.add(a); legR.knee.add(b);
      worn.legs = [a, b];
    }
    if (eq.accessory) { const m = buildCharm(); spine.add(m); worn.accessory = m; }
  }

  // ---------- Animation ----------
  let phase = 0;
  let clock = 0;
  let flashT = 0;
  let attackT = 0;          // counts down from ATTACK_TIME
  let landT = 0;
  let wasGrounded = true;
  let dead = false;
  let tilt = 0;
  let walkBlend = 0;
  const ATTACK_TIME = 0.42;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const ease = (t) => t * t * (3 - 2 * t);

  function update(dt, motion = {}) {
    clock += dt;
    const speed = clamp(motion.speed || 0, 0, 1);
    const grounded = motion.grounded !== false;
    const sprint = !!motion.sprint;
    const vy = motion.vy || 0;

    // Landing impact
    if (grounded && !wasGrounded && vy < -4) landT = 0.2;
    wasGrounded = grounded;
    landT = Math.max(0, landT - dt);
    const land = landT / 0.2;

    // Walk cycle
    phase += dt * (3 + speed * 6.5);
    walkBlend += (clamp(speed * 3, 0, 1) - walkBlend) * Math.min(1, dt * 12);
    const w = walkBlend;
    const amp = (0.22 + speed * 0.7) * w;
    const swing = Math.sin(phase) * amp;
    const idle = 1 - w;
    const breathe = Math.sin(clock * 1.7);

    if (grounded) {
      legL.hip.rotation.x = swing + land * -0.15;
      legR.hip.rotation.x = -swing + land * -0.15;
      legL.knee.rotation.x = Math.max(0, -Math.cos(phase)) * (0.25 + speed * 1.15) * w + land * 0.5;
      legR.knee.rotation.x = Math.max(0, Math.cos(phase)) * (0.25 + speed * 1.15) * w + land * 0.5;
    } else {
      // Airborne stride pose; legs tuck more when rising.
      const rise = clamp(vy / 9, -1, 1);
      legL.hip.rotation.x = lerp(legL.hip.rotation.x, -0.55 + rise * 0.15, 0.25);
      legR.hip.rotation.x = lerp(legR.hip.rotation.x, 0.3, 0.25);
      legL.knee.rotation.x = lerp(legL.knee.rotation.x, 1.0, 0.25);
      legR.knee.rotation.x = lerp(legR.knee.rotation.x, 0.5, 0.25);
    }
    legL.hip.rotation.z = 0.02; legR.hip.rotation.z = -0.02;

    // Torso: bob, twist against the stride, forward lean
    pelvis.position.y = 0.96 - land * 0.1 + Math.cos(phase * 2) * 0.016 * w * (0.4 + speed) - 0.018 * w + breathe * 0.003 * idle;
    pelvis.position.x = Math.sin(phase) * 0.012 * w;
    pelvis.rotation.y = Math.sin(phase) * 0.12 * w;
    spine.rotation.y = -Math.sin(phase) * 0.16 * w;
    spine.rotation.x = (0.04 + speed * (sprint ? 0.3 : 0.12)) * (grounded ? 1 : 0.5) + land * 0.15;
    headGroup.rotation.x = -spine.rotation.x * 0.7;
    headGroup.rotation.y = Math.sin(clock * 0.5) * 0.18 * idle - spine.rotation.y * 0.8;
    torso.scale.set(1 + breathe * 0.006 * idle, 1 + breathe * 0.01 * idle, 1);

    // Arms swing opposite to the same-side leg
    const armSwing = swing * 0.85;
    const elbowBase = 0.12 + speed * 0.95 * w;
    if (grounded) {
      armL.shoulder.rotation.x = -armSwing + breathe * 0.02 * idle;
      armR.shoulder.rotation.x = armSwing + breathe * 0.02 * idle;
    } else {
      armL.shoulder.rotation.x = lerp(armL.shoulder.rotation.x, -1.25, 0.25);
      armR.shoulder.rotation.x = lerp(armR.shoulder.rotation.x, -1.0, 0.25);
    }
    armL.shoulder.rotation.z = 0.07 + (grounded ? 0 : 0.35);
    armR.shoulder.rotation.z = -0.07 - (grounded ? 0 : 0.35);
    armL.elbow.rotation.x = -(elbowBase + Math.max(0, armSwing) * 0.3);
    armR.elbow.rotation.x = -(elbowBase + Math.max(0, -armSwing) * 0.3);

    // Attack / gather swing (right arm)
    if (attackT > 0) {
      attackT = Math.max(0, attackT - dt);
      const k = 1 - attackT / ATTACK_TIME;
      const raise = k < 0.38 ? ease(k / 0.38) : 1 - ease((k - 0.38) / 0.62);
      const strike = k < 0.38 ? 0 : ease((k - 0.38) / 0.62);
      armR.shoulder.rotation.x = lerp(-0.2, -2.5, raise) + strike * 1.1;
      armR.shoulder.rotation.z = -0.1;
      armR.elbow.rotation.x = -0.35 - raise * 0.4;
      spine.rotation.y += lerp(0.0, -0.4, raise) + strike * 0.7;
      spine.rotation.x += strike * 0.25;
    }

    // Hair and cloak follow movement
    ponytail.rotation.x = 0.35 + speed * 0.55 + Math.sin(phase * 2) * 0.12 * w + Math.sin(clock * 1.3) * 0.04;
    ponytail.rotation.z = Math.sin(phase) * 0.12 * w;
    if (flutterMesh) flutterMesh.rotation.x = 0.04 + speed * 0.4 + Math.sin(clock * 2.2) * 0.03 + Math.sin(phase * 2) * 0.05 * w;

    // Collapse
    tilt += ((dead ? -1.5 : 0) - tilt) * Math.min(1, dt * 6);
    rig.rotation.x = tilt;
    rig.position.y = dead ? 0.12 : 0;

    // Hurt flash via emissive tint (does not disturb vertex colors)
    if (flashT > 0) {
      flashT = Math.max(0, flashT - dt);
      bodyMat.emissive.setRGB((flashT / 0.25) * 0.75, 0, 0);
    } else if (bodyMat.emissive.r !== 0) {
      bodyMat.emissive.setRGB(0, 0, 0);
    }

    if (held && held.userData.update) held.userData.update(clock);
  }

  return {
    root,
    update,
    setEquipment,
    setHeld,
    flash() { flashT = 0.25; },
    attack() { if (attackT <= 0) attackT = ATTACK_TIME; },
    isAttacking: () => attackT > 0,
    setDead(v) { dead = !!v; }
  };
}
