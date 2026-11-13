// Prop geometry kit: trees, rocks, plants and other scenery.
// Every prop is built ONCE as a single merged BufferGeometry with baked vertex colors
// (dark at the base, lighter at the tips, with per-vertex noise). One prop type = one draw call
// per spatial chunk, which keeps the scene cheap on low-end phones.
import * as THREE from 'three';

// ---------- Low-level helpers ----------

function hash3(x, y, z) {
  let h = Math.imul(Math.round(x * 128), 73856093) ^ Math.imul(Math.round(y * 128), 19349663) ^ Math.imul(Math.round(z * 128), 83492791);
  h = Math.imul(h ^ (h >>> 15), 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967295;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

/**
 * Jitters, transforms and colors one geometry part.
 * o: { at:[x,y,z], rot:[x,y,z], scale:[x,y,z]|n, jitter, bottom, top, noise }
 */
function bake(geo, o = {}) {
  const pos = geo.attributes.position;

  if (o.jitter) {
    // Hash-based displacement: vertices at the same position move together, so no cracks.
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      pos.setXYZ(
        i,
        x + (hash3(x, y, z) - 0.5) * 2 * o.jitter,
        y + (hash3(y, z, x + 7) - 0.5) * 2 * o.jitter,
        z + (hash3(z, x + 3, y) - 0.5) * 2 * o.jitter
      );
    }
  }

  const sc = o.scale === undefined ? [1, 1, 1] : typeof o.scale === 'number' ? [o.scale, o.scale, o.scale] : o.scale;
  const at = o.at || [0, 0, 0];
  const rot = o.rot || [0, 0, 0];
  _e.set(rot[0], rot[1], rot[2], 'YXZ');
  _q.setFromEuler(_e);
  _m.compose(_p.set(at[0], at[1], at[2]), _q, _s.set(sc[0], sc[1], sc[2]));
  geo.applyMatrix4(_m);
  if (!o.keepNormals) geo.computeVertexNormals();

  // Vertical color gradient across this part, plus noise for natural variation.
  geo.computeBoundingBox();
  const minY = geo.boundingBox.min.y;
  const span = Math.max(1e-4, geo.boundingBox.max.y - minY);
  _c1.set(o.bottom !== undefined ? o.bottom : 0x808080);
  _c2.set(o.top !== undefined ? o.top : o.bottom !== undefined ? o.bottom : 0x808080);
  const noise = o.noise === undefined ? 0.18 : o.noise;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const t = (y - minY) / span;
    c.copy(_c1).lerp(_c2, t);
    const n = 1 + (hash3(x * 3.1, y * 3.1, z * 3.1) - 0.5) * noise;
    colors[i * 3] = c.r * n;
    colors[i * 3 + 1] = c.g * n;
    colors[i * 3 + 2] = c.b * n;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  if (!geo.attributes.uv) geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2));
  return geo;
}

/** Concatenates baked geometries into one. */
function merge(list) {
  let vCount = 0;
  let iCount = 0;
  for (const g of list) {
    vCount += g.attributes.position.count;
    iCount += g.index ? g.index.count : g.attributes.position.count;
  }
  const position = new Float32Array(vCount * 3);
  const normal = new Float32Array(vCount * 3);
  const uv = new Float32Array(vCount * 2);
  const color = new Float32Array(vCount * 3);
  const index = new Uint32Array(iCount);
  let vo = 0;
  let io = 0;
  for (const g of list) {
    const n = g.attributes.position.count;
    position.set(g.attributes.position.array, vo * 3);
    normal.set(g.attributes.normal.array, vo * 3);
    uv.set(g.attributes.uv.array, vo * 2);
    color.set(g.attributes.color.array, vo * 3);
    if (g.index) {
      for (let i = 0; i < g.index.count; i++) index[io++] = g.index.array[i] + vo;
    } else {
      for (let i = 0; i < n; i++) index[io++] = vo + i;
    }
    vo += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(position, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(normal, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  out.setAttribute('color', new THREE.BufferAttribute(color, 3));
  out.setIndex(new THREE.BufferAttribute(index, 1));
  out.computeBoundingSphere();
  return out;
}

const cyl = (rt, rb, h, seg) => new THREE.CylinderGeometry(rt, rb, h, seg, 1);
const cone = (r, h, seg) => new THREE.ConeGeometry(r, h, seg, 1);
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);

// Geometry whose origin is its base, so tilting it pivots from the ground.
function based(geo, h) { geo.translate(0, h / 2, 0); return geo; }

// ---------- Grass blades ----------

function bladeTuft(count, h0, h1, bottom, top, seed) {
  const parts = [];
  const pos = [], nor = [], col = [], uvs = [];
  const cb = new THREE.Color(bottom);
  const ct = new THREE.Color(top);
  for (let b = 0; b < count; b++) {
    const a = hash3(seed, b, 1) * Math.PI * 2;
    const r = hash3(seed, b, 2) * 0.16;
    const bx = Math.cos(a) * r, bz = Math.sin(a) * r;
    const h = h0 + hash3(seed, b, 3) * (h1 - h0);
    const lean = 0.12 + hash3(seed, b, 4) * 0.28;
    const la = a + (hash3(seed, b, 5) - 0.5);
    const tx = bx + Math.cos(la) * lean, tz = bz + Math.sin(la) * lean;
    const w = 0.045 + hash3(seed, b, 6) * 0.03;
    const px = -Math.sin(la) * w, pz = Math.cos(la) * w;
    const verts = [[bx - px, 0, bz - pz, cb], [bx + px, 0, bz + pz, cb], [tx, h, tz, ct]];
    for (const [x, y, z, c] of verts) {
      pos.push(x, y, z);
      nor.push(0, 1, 0);
      col.push(c.r, c.g, c.b);
      uvs.push(0, 0);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  parts.push(g);
  return merge(parts);
}

// ---------- Prop builders ----------
// Each returns an array of baked parts. `seg` = radial segments from the quality preset.

const PALETTE = {
  rock: {
    forest:   { bottom: 0x2e2f2b, top: 0x6c7062 },
    volcanic: { bottom: 0x141012, top: 0x3d3236 },
    desert:   { bottom: 0x7a6040, top: 0xc2a574 }
  },
  deadtree: {
    volcanic: { bottom: 0x151011, top: 0x3a2f2c },
    desert:   { bottom: 0x4a3c2c, top: 0x9a8668 },
    forest:   { bottom: 0x2a231e, top: 0x5a4f44 }
  }
};

function pine(seg) {
  const parts = [bake(cyl(0.14, 0.26, 2.6, seg), { at: [0, 1.3, 0], bottom: 0x20150e, top: 0x4a3326, jitter: 0.015 })];
  for (let i = 0; i < 5; i++) {
    const r = 1.65 - i * 0.3;
    const h = 1.6 - i * 0.12;
    parts.push(bake(cone(r, h, seg + 2), {
      at: [0, 1.7 + i * 0.95 + h / 2, 0], rot: [0, i * 0.7, 0], jitter: 0.12,
      bottom: 0x0f2a1c, top: 0x2f5f3b, noise: 0.25
    }));
  }
  return parts;
}

function oak(seg) {
  const parts = [bake(cyl(0.2, 0.36, 2.4, seg), { at: [0, 1.2, 0], bottom: 0x1f140d, top: 0x4a3626, jitter: 0.02 })];
  for (const [x, z, a] of [[0.35, 0.1, 0.8], [-0.3, -0.2, -0.7]]) {
    parts.push(bake(based(cyl(0.06, 0.12, 1.4, 5), 1.4), { at: [x * 0.4, 1.9, z * 0.4], rot: [a * 0.5, a * 3, 0.6 * Math.sign(x)], bottom: 0x3a2a1d, top: 0x4a3626 }));
  }
  const blobs = [[0, 3.7, 0, 1.55, 0.85], [1.1, 3.2, 0.5, 1.15, 0.8], [-1.0, 3.3, -0.5, 1.25, 0.8], [0.2, 4.5, -0.2, 1.0, 0.8], [-0.4, 3.0, 1.0, 1.0, 0.8]];
  blobs.forEach(([x, y, z, r, sy], i) => {
    parts.push(bake(ico(r, 1), { at: [x, y, z], scale: [1, sy, 1], jitter: 0.16, bottom: 0x16361d, top: 0x5a8c3e, noise: 0.28, rot: [0, i, 0] }));
  });
  return parts;
}

function bush() {
  return [[0, 0.4, 0, 0.6], [0.45, 0.32, 0.2, 0.45], [-0.4, 0.3, -0.25, 0.48]].map(([x, y, z, r], i) =>
    bake(ico(r, 1), { at: [x, y, z], scale: [1, 0.8, 1], jitter: 0.09, bottom: 0x14301a, top: 0x4a7a36, noise: 0.3, rot: [0, i, 0] }));
}

function fern() {
  const parts = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i / 8) * Math.PI * 2 + hash3(i, 1, 1) * 0.4;
    const tilt = 0.95 + hash3(i, 2, 1) * 0.35;
    parts.push(bake(based(cone(0.11, 1.1, 3), 1.1), { rot: [tilt, yaw, 0], scale: [1, 1, 0.3], bottom: 0x14301a, top: 0x5f9a4a, noise: 0.2 }));
  }
  return parts;
}

function rock(type, big) {
  const pal = PALETTE.rock[type] || PALETTE.rock.forest;
  const s = big ? 1.35 : 1;
  const parts = [bake(ico(0.9 * s, 1), { at: [0, 0.35 * s, 0], scale: [1, 0.72, 0.88], jitter: 0.22 * s, bottom: pal.bottom, top: pal.top, noise: 0.3 })];
  parts.push(bake(ico(0.4 * s, 0), { at: [0.85 * s, 0.14, 0.3], scale: [1, 0.7, 1], jitter: 0.1, bottom: pal.bottom, top: pal.top, noise: 0.3 }));
  if (type === 'forest') {
    // Moss cap
    parts.push(bake(ico(0.62 * s, 1), { at: [0, 0.62 * s, 0], scale: [1, 0.35, 0.9], jitter: 0.1, bottom: 0x2f5a2c, top: 0x5f8a3c, noise: 0.3 }));
  }
  return parts;
}

function deadtree(type) {
  const pal = PALETTE.deadtree[type] || PALETTE.deadtree.forest;
  const parts = [bake(cyl(0.1, 0.3, 3.0, 5), { at: [0, 1.5, 0], rot: [0.08, 0, 0.05], bottom: pal.bottom, top: pal.top, jitter: 0.03, noise: 0.25 })];
  [[1.5, 0.9, 0.9], [2.0, -1.8, 0.7], [2.5, 2.6, 0.8], [1.1, -0.4, 1.0]].forEach(([y, yaw, tilt], i) => {
    parts.push(bake(based(cyl(0.03, 0.09, 1.25, 4), 1.25), { at: [0, y, 0], rot: [tilt, yaw, 0], bottom: pal.bottom, top: pal.top, jitter: 0.02 }));
    parts.push(bake(based(cyl(0.015, 0.04, 0.6, 3), 0.6), {
      at: [Math.sin(yaw) * tilt * 0.9, y + 0.8, Math.cos(yaw) * tilt * 0.9], rot: [tilt + 0.5, yaw + 0.9, 0], bottom: pal.bottom, top: pal.top
    }));
  });
  return parts;
}

function spire() {
  return [
    bake(cone(0.95, 4.6, 5), { at: [0, 2.3, 0], jitter: 0.22, bottom: 0x3a1a10, top: 0x1c1719, noise: 0.35 }),
    bake(cone(0.5, 2.6, 5), { at: [0.9, 1.3, 0.3], rot: [0, 1, 0.12], jitter: 0.14, bottom: 0x2e1912, top: 0x211b1d, noise: 0.35 })
  ];
}

function crystal() {
  const parts = [];
  [[0, 0, 0, 1.0, 0.0], [0.3, 0, 0.1, 0.7, 0.35], [-0.28, 0, -0.1, 0.55, -0.4]].forEach(([x, , z, h, tilt], i) => {
    parts.push(bake(ico(0.28, 0), { at: [x, 0.5 * h, z], rot: [tilt, i, tilt * 0.6], scale: [1, 1.9 * h + 0.4, 1], bottom: 0x7a1c0c, top: 0xffa040, noise: 0.15 }));
  });
  return parts;
}

function cactus() {
  const g = 0x2e5a30, t = 0x58944a;
  return [
    bake(cyl(0.22, 0.26, 1.8, 8), { at: [0, 0.9, 0], bottom: g, top: t, jitter: 0.01, noise: 0.12 }),
    bake(ico(0.23, 1), { at: [0, 1.82, 0], bottom: t, top: t, noise: 0.1 }),
    bake(cyl(0.11, 0.12, 0.6, 7), { at: [0.38, 1.0, 0], rot: [0, 0, Math.PI / 2], bottom: g, top: t, noise: 0.1 }),
    bake(cyl(0.11, 0.11, 0.7, 7), { at: [0.66, 1.3, 0], bottom: g, top: t, noise: 0.1 }),
    bake(ico(0.12, 1), { at: [0.66, 1.66, 0], bottom: t, top: t, noise: 0.1 })
  ];
}

function shrub() {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const yaw = (i / 7) * Math.PI * 2;
    parts.push(bake(based(cone(0.05, 0.9, 3), 0.9), { rot: [0.5 + hash3(i, 4, 4) * 0.5, yaw, 0], bottom: 0x4a3a24, top: 0x9a8350, noise: 0.25 }));
  }
  parts.push(bake(ico(0.25, 0), { at: [0, 0.35, 0], scale: [1, 0.7, 1], jitter: 0.05, bottom: 0x6a5a34, top: 0x8a7448 }));
  return parts;
}

function bones() {
  const c = 0xcbbfa3, d = 0x8a7f68;
  const parts = [bake(cyl(0.05, 0.05, 1.6, 5), { at: [0, 0.08, 0], rot: [Math.PI / 2, 0, 0], bottom: d, top: c })];
  for (let i = 0; i < 4; i++) {
    parts.push(bake(new THREE.TorusGeometry(0.42 - Math.abs(i - 1.5) * 0.06, 0.035, 4, 8, Math.PI), { at: [0, 0.07, -0.55 + i * 0.35], rot: [0, 0, 0], bottom: d, top: c, noise: 0.1 }));
  }
  parts.push(bake(ico(0.2, 1), { at: [0, 0.2, 0.95], scale: [1, 0.9, 1.15], bottom: d, top: c, jitter: 0.02 }));
  return parts;
}

function pillar() {
  const b = 0x8a7653, t = 0xc4b08a;
  return [
    bake(new THREE.BoxGeometry(1.5, 0.3, 1.5), { at: [0, 0.15, 0], bottom: b, top: t, jitter: 0.03 }),
    bake(cyl(0.5, 0.58, 2.6, 8), { at: [0, 1.6, 0], bottom: b, top: t, jitter: 0.04, noise: 0.25 }),
    bake(cyl(0.5, 0.5, 0.5, 6), { at: [0.2, 3.1, 0], rot: [0.25, 0, 0.3], bottom: b, top: t, jitter: 0.1, noise: 0.25 })
  ];
}

function mushroom() {
  return [
    bake(cyl(0.05, 0.07, 0.35, 6), { at: [0, 0.17, 0], bottom: 0xb8c0aa, top: 0xe8efe0 }),
    bake(new THREE.SphereGeometry(0.26, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), { at: [0, 0.35, 0], bottom: 0x2a9a8e, top: 0x9ff0e0, noise: 0.15 })
  ];
}

function log() {
  return [
    bake(cyl(0.28, 0.3, 2.4, 8), { at: [0, 0.28, 0], rot: [0, 0, Math.PI / 2], bottom: 0x2a1c12, top: 0x4a3626, jitter: 0.02 }),
    bake(ico(0.34, 1), { at: [0.4, 0.5, 0], scale: [1.5, 0.3, 0.9], bottom: 0x2f5a2c, top: 0x5f8a3c, jitter: 0.05 })
  ];
}

function herb() {
  const parts = [];
  for (let i = 0; i < 6; i++) {
    const yaw = (i / 6) * Math.PI * 2;
    parts.push(bake(based(cone(0.14, 0.7, 3), 0.7), { rot: [0.9, yaw, 0], scale: [1, 1, 0.35], bottom: 0x1d4a2a, top: 0x6ac06a }));
  }
  for (let i = 0; i < 3; i++) {
    parts.push(bake(ico(0.07, 0), { at: [Math.cos(i * 2.1) * 0.12, 0.5 + i * 0.05, Math.sin(i * 2.1) * 0.12], bottom: 0x7af0ff, top: 0xd8ffff }));
  }
  return parts;
}

function berries() {
  const parts = bush();
  for (let i = 0; i < 9; i++) {
    const a = i * 2.4;
    parts.push(bake(ico(0.065, 0), { at: [Math.cos(a) * 0.55, 0.3 + (i % 3) * 0.14, Math.sin(a) * 0.55], bottom: 0xa8142e, top: 0xe03a5a }));
  }
  return parts;
}

function clay() {
  return [bake(ico(0.85, 1), { at: [0, 0.1, 0], scale: [1, 0.35, 0.85], jitter: 0.1, bottom: 0x5e3724, top: 0x9a6648, noise: 0.25 })];
}

function relic() {
  return [
    bake(new THREE.BoxGeometry(0.7, 0.3, 0.5), { at: [0, 0.15, 0], bottom: 0x5a4a30, top: 0x7a6844, jitter: 0.02 }),
    bake(new THREE.BoxGeometry(0.46, 1.7, 0.3), { at: [0, 1.1, 0], bottom: 0x7a6844, top: 0xe0c070, jitter: 0.015 }),
    bake(cone(0.3, 0.4, 4), { at: [0, 2.15, 0], rot: [0, Math.PI / 4, 0], bottom: 0xe0c070, top: 0xffe9a0 })
  ];
}

function sulfur() {
  return [
    bake(cone(0.55, 0.8, 7), { at: [0, 0.4, 0], jitter: 0.06, bottom: 0x8a7a1c, top: 0xf0e060, noise: 0.25 }),
    bake(ico(0.2, 0), { at: [0.5, 0.15, 0.2], bottom: 0xb8a428, top: 0xf0e060 })
  ];
}

function obsidian() {
  return [[0, 0, 0, 1], [0.35, 0, 0.15, 0.65], [-0.3, 0, -0.1, 0.5]].map(([x, , z, h], i) =>
    bake(ico(0.32, 0), { at: [x, 0.45 * h, z], rot: [0.2 * i, i, 0.25 * i], scale: [1, 1.8 * h + 0.3, 1], bottom: 0x0b0814, top: 0x3a2a58, noise: 0.2 }));
}

// ---------- Registry ----------

// material: 'standard' (lit, grain), 'unlit' (glow), 'gloss' (shiny), 'blade' (double-sided, no grain)
// sway: moves in wind. shadow: casts shadows (small props never do).
export function buildProp(kind, type, quality) {
  const seg = quality.treeSegments;
  switch (kind) {
    case 'pine': case 'tree': return mk(pine(seg), 'standard', true, true);
    case 'oak': return mk(oak(seg), 'standard', true, true);
    case 'bush': return mk(bush(), 'standard', true, false);
    case 'fern': return mk(fern(), 'blade', true, false);
    case 'rock': return mk(rock(type, false), 'standard', false, true);
    case 'stone': return mk(rock(type, true), 'standard', false, true);
    case 'grass': return mkRaw(bladeTuft(6, 0.45, 0.9, 0x1c3a1a, 0x7aa84a, 1), 'blade', true, false);
    case 'ashweed':
      return type === 'desert'
        ? mkRaw(bladeTuft(4, 0.35, 0.7, 0x5a4a30, 0xc4a870, 2), 'blade', true, false)
        : mkRaw(bladeTuft(4, 0.35, 0.75, 0x241c1a, 0x6a5848, 3), 'blade', true, false);
    case 'deadtree': case 'deadwood': return mk(deadtree(type), 'standard', false, true);
    case 'spire': return mk(spire(), 'standard', false, true);
    case 'crystal': return mk(crystal(), 'unlit', false, false);
    case 'cactus': return mk(cactus(), 'standard', false, true);
    case 'shrub': return mk(shrub(), 'blade', true, false);
    case 'bones': return mk(bones(), 'standard', false, false);
    case 'pillar': return mk(pillar(), 'standard', false, true);
    case 'mushroom': return mk(mushroom(), 'unlit', false, false);
    case 'log': return mk(log(), 'standard', false, true);
    case 'herb': return mk(herb(), 'blade', true, false);
    case 'berries': return mk(berries(), 'standard', false, false);
    case 'clay': return mk(clay(), 'standard', false, false);
    case 'relic': return mk(relic(), 'standard', false, true);
    case 'sulfur': return mk(sulfur(), 'unlit', false, false);
    case 'obsidian': return mk(obsidian(), 'gloss', false, true);
    default: return mk([bake(ico(0.4, 0), { at: [0, 0.4, 0], bottom: 0x777777, top: 0x999999 })], 'standard', false, false);
  }
}

function mk(parts, material, sway, shadow) {
  return mkRaw(merge(parts), material, sway, shadow);
}

function mkRaw(geometry, material, sway, shadow) {
  return { geometry, material, sway, shadow };
}

// Shared with character.js
export { bake, merge };
