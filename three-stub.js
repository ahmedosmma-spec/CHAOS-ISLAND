// TEST-ONLY stand-in for Three.js r160. It implements the subset of the API this project uses with
// real math (vectors, matrices, geometry attributes, normals, bounds) but draws nothing.
// Purpose: run the real game code end to end in a headless browser to catch logic errors.
// It cannot validate visuals or shaders. Real Three.js must be used for actual play.

export const SRGBColorSpace = 'srgb';
export const DoubleSide = 2, FrontSide = 0, BackSide = 1;
export const AdditiveBlending = 2, RepeatWrapping = 1000;
export const PCFShadowMap = 1, PCFSoftShadowMap = 2, ACESFilmicToneMapping = 4;

export class Vector2 { constructor(x = 0, y = 0) { this.x = x; this.y = y; } }

export class Vector3 {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s) { return this.set(s, s, s); }
  copy(v) { return this.set(v.x, v.y, v.z); }
  clone() { return new Vector3(this.x, this.y, this.z); }
  add(v) { return this.set(this.x + v.x, this.y + v.y, this.z + v.z); }
  sub(v) { return this.set(this.x - v.x, this.y - v.y, this.z - v.z); }
  addScaledVector(v, s) { return this.set(this.x + v.x * s, this.y + v.y * s, this.z + v.z * s); }
  multiplyScalar(s) { return this.set(this.x * s, this.y * s, this.z * s); }
  length() { return Math.hypot(this.x, this.y, this.z); }
  normalize() { const l = this.length() || 1; return this.multiplyScalar(1 / l); }
  lerp(v, t) { return this.set(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t, this.z + (v.z - this.z) * t); }
}

export class Euler {
  constructor(x = 0, y = 0, z = 0, order = 'XYZ') { this.x = x; this.y = y; this.z = z; this.order = order; }
  set(x, y, z, order) { this.x = x; this.y = y; this.z = z; if (order) this.order = order; return this; }
}

export class Quaternion {
  constructor() { this.x = 0; this.y = 0; this.z = 0; this.w = 1; }
  setFromEuler(e) {
    const c1 = Math.cos(e.x / 2), c2 = Math.cos(e.y / 2), c3 = Math.cos(e.z / 2);
    const s1 = Math.sin(e.x / 2), s2 = Math.sin(e.y / 2), s3 = Math.sin(e.z / 2);
    // YXZ order, as used by the project.
    this.x = s1 * c2 * c3 + c1 * s2 * s3;
    this.y = c1 * s2 * c3 - s1 * c2 * s3;
    this.z = c1 * c2 * s3 - s1 * s2 * c3;
    this.w = c1 * c2 * c3 + s1 * s2 * s3;
    return this;
  }
}

export class Matrix4 {
  constructor() { this.elements = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]; }
  compose(p, q, s) {
    const { x, y, z, w } = q;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const e = this.elements;
    e[0] = (1 - (yy + zz)) * s.x; e[1] = (xy + wz) * s.x; e[2] = (xz - wy) * s.x; e[3] = 0;
    e[4] = (xy - wz) * s.y; e[5] = (1 - (xx + zz)) * s.y; e[6] = (yz + wx) * s.y; e[7] = 0;
    e[8] = (xz + wy) * s.z; e[9] = (yz - wx) * s.z; e[10] = (1 - (xx + yy)) * s.z; e[11] = 0;
    e[12] = p.x; e[13] = p.y; e[14] = p.z; e[15] = 1;
    return this;
  }
  makeScale(x, y, z) { this.elements = [x, 0, 0, 0, 0, y, 0, 0, 0, 0, z, 0, 0, 0, 0, 1]; return this; }
}

export class Color {
  constructor(v) { this.r = 1; this.g = 1; this.b = 1; if (v !== undefined) this.set(v); }
  set(v) {
    if (v instanceof Color) return this.copy(v);
    this.r = ((v >> 16) & 255) / 255; this.g = ((v >> 8) & 255) / 255; this.b = (v & 255) / 255;
    return this;
  }
  setRGB(r, g, b) { this.r = r; this.g = g; this.b = b; return this; }
  copy(c) { return this.setRGB(c.r, c.g, c.b); }
  clone() { return new Color().copy(this); }
  lerp(c, t) { return this.setRGB(this.r + (c.r - this.r) * t, this.g + (c.g - this.g) * t, this.b + (c.b - this.b) * t); }
  multiplyScalar(s) { return this.setRGB(this.r * s, this.g * s, this.b * s); }
}

// ---------- Geometry ----------

export class BufferAttribute {
  constructor(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array.length / itemSize; this.needsUpdate = false; }
  getX(i) { return this.array[i * this.itemSize]; }
  getY(i) { return this.array[i * this.itemSize + 1]; }
  getZ(i) { return this.array[i * this.itemSize + 2]; }
  setX(i, v) { this.array[i * this.itemSize] = v; return this; }
  setY(i, v) { this.array[i * this.itemSize + 1] = v; return this; }
  setZ(i, v) { this.array[i * this.itemSize + 2] = v; return this; }
  setXYZ(i, x, y, z) { const o = i * this.itemSize; this.array[o] = x; this.array[o + 1] = y; this.array[o + 2] = z; return this; }
}
export class Float32BufferAttribute extends BufferAttribute { constructor(a, n) { super(new Float32Array(a), n); } }

export class BufferGeometry {
  constructor() { this.attributes = {}; this.index = null; this.boundingBox = null; this.boundingSphere = null; }
  setAttribute(n, a) { this.attributes[n] = a; return this; }
  getAttribute(n) { return this.attributes[n]; }
  setIndex(i) { this.index = Array.isArray(i) ? new BufferAttribute(new Uint32Array(i), 1) : i; return this; }
  dispose() {}
  translate(x, y, z) {
    const p = this.attributes.position;
    for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i) + x, p.getY(i) + y, p.getZ(i) + z);
    return this;
  }
  rotateX(a) {
    const p = this.attributes.position, n = this.attributes.normal, c = Math.cos(a), s = Math.sin(a);
    for (const at of [p, n]) if (at) for (let i = 0; i < at.count; i++) { const y = at.getY(i), z = at.getZ(i); at.setXYZ(i, at.getX(i), y * c - z * s, y * s + z * c); }
    return this;
  }
  applyMatrix4(m) {
    const e = m.elements, p = this.attributes.position, n = this.attributes.normal;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      p.setXYZ(i, e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]);
    }
    if (n) for (let i = 0; i < n.count; i++) {
      const x = n.getX(i), y = n.getY(i), z = n.getZ(i);
      const nx = e[0] * x + e[4] * y + e[8] * z, ny = e[1] * x + e[5] * y + e[9] * z, nz = e[2] * x + e[6] * y + e[10] * z;
      const l = Math.hypot(nx, ny, nz) || 1; n.setXYZ(i, nx / l, ny / l, nz / l);
    }
    return this;
  }
  computeVertexNormals() {
    const p = this.attributes.position;
    const normals = new Float32Array(p.count * 3);
    const tri = (a, b, c) => {
      const ax = p.getX(a), ay = p.getY(a), az = p.getZ(a);
      const ux = p.getX(b) - ax, uy = p.getY(b) - ay, uz = p.getZ(b) - az;
      const vx = p.getX(c) - ax, vy = p.getY(c) - ay, vz = p.getZ(c) - az;
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      for (const i of [a, b, c]) { normals[i * 3] += nx; normals[i * 3 + 1] += ny; normals[i * 3 + 2] += nz; }
    };
    if (this.index) for (let i = 0; i < this.index.count; i += 3) tri(this.index.array[i], this.index.array[i + 1], this.index.array[i + 2]);
    else for (let i = 0; i < p.count; i += 3) tri(i, i + 1, i + 2);
    for (let i = 0; i < p.count; i++) {
      const l = Math.hypot(normals[i * 3], normals[i * 3 + 1], normals[i * 3 + 2]) || 1;
      normals[i * 3] /= l; normals[i * 3 + 1] /= l; normals[i * 3 + 2] /= l;
    }
    this.attributes.normal = new BufferAttribute(normals, 3);
  }
  computeBoundingBox() {
    const p = this.attributes.position;
    const min = new Vector3(Infinity, Infinity, Infinity), max = new Vector3(-Infinity, -Infinity, -Infinity);
    for (let i = 0; i < p.count; i++) {
      min.set(Math.min(min.x, p.getX(i)), Math.min(min.y, p.getY(i)), Math.min(min.z, p.getZ(i)));
      max.set(Math.max(max.x, p.getX(i)), Math.max(max.y, p.getY(i)), Math.max(max.z, p.getZ(i)));
    }
    this.boundingBox = { min, max };
  }
  computeBoundingSphere() { this.boundingSphere = { radius: 1 }; }
}

// Parametric builder: a (u x v) grid mapped through fn(u, v) -> [x, y, z]. Indexed, with uv and normals.
function grid(fn, us, vs) {
  const g = new BufferGeometry();
  const pos = [], uv = [], idx = [];
  for (let j = 0; j <= vs; j++) for (let i = 0; i <= us; i++) { const [x, y, z] = fn(i / us, j / vs); pos.push(x, y, z); uv.push(i / us, j / vs); }
  for (let j = 0; j < vs; j++) for (let i = 0; i < us; i++) {
    const a = j * (us + 1) + i, b = a + 1, c = a + us + 1, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
const TAU = Math.PI * 2;

export class CylinderGeometry extends BufferGeometry {
  constructor(rt = 1, rb = 1, h = 1, seg = 8) {
    super();
    const g = grid((u, v) => { const r = rb + (rt - rb) * (1 - v); return [Math.sin(u * TAU) * r, (0.5 - v) * h, Math.cos(u * TAU) * r]; }, seg, 1);
    Object.assign(this, g);
  }
}
export class ConeGeometry extends CylinderGeometry { constructor(r = 1, h = 1, seg = 8) { super(0.0001, r, h, seg); } }
export class SphereGeometry extends BufferGeometry {
  constructor(r = 1, w = 8, h = 6, ps = 0, pl = TAU, ts = 0, tl = Math.PI) {
    super();
    Object.assign(this, grid((u, v) => { const phi = ps + u * pl, th = ts + v * tl; return [-r * Math.cos(phi) * Math.sin(th), r * Math.cos(th), r * Math.sin(phi) * Math.sin(th)]; }, w, h));
  }
}
export class TorusGeometry extends BufferGeometry {
  constructor(R = 1, r = 0.4, rs = 6, ts = 12, arc = TAU) {
    super();
    Object.assign(this, grid((u, v) => { const a = u * arc, b = v * TAU; return [(R + r * Math.cos(b)) * Math.cos(a), (R + r * Math.cos(b)) * Math.sin(a), r * Math.sin(b)]; }, ts, rs));
  }
}
export class LatheGeometry extends BufferGeometry {
  constructor(points, seg = 12) {
    super();
    Object.assign(this, grid((u, v) => { const p = points[Math.min(points.length - 1, Math.round(v * (points.length - 1)))]; return [Math.sin(u * TAU) * p.x, p.y, Math.cos(u * TAU) * p.x]; }, seg, points.length - 1));
  }
}
export class CircleGeometry extends BufferGeometry {
  constructor(r = 1, seg = 8) { super(); Object.assign(this, grid((u, v) => [Math.cos(u * TAU) * r * v, 0, Math.sin(u * TAU) * r * v], seg, 1)); }
}
export class PlaneGeometry extends BufferGeometry {
  constructor(w = 1, h = 1, ws = 1, hs = 1) { super(); Object.assign(this, grid((u, v) => [(u - 0.5) * w, (0.5 - v) * h, 0], ws, hs)); }
}
export class BoxGeometry extends BufferGeometry {
  constructor(w = 1, h = 1, d = 1) { super(); Object.assign(this, grid((u, v) => [(u - 0.5) * w, (v - 0.5) * h, d / 2], 1, 1)); }
}
export class IcosahedronGeometry extends BufferGeometry {
  // Non-indexed, like the real PolyhedronGeometry.
  constructor(r = 1, detail = 0) {
    super();
    const faces = 20 * (detail + 1) * (detail + 1);
    const pos = [], uv = [];
    for (let f = 0; f < faces; f++) for (let k = 0; k < 3; k++) {
      const a = (f * 3 + k) * 2.399963; const y = Math.cos(a * 0.37); const s = Math.sqrt(1 - y * y);
      pos.push(Math.cos(a) * s * r, y * r, Math.sin(a) * s * r); uv.push(k / 2, f / faces);
    }
    this.setAttribute('position', new Float32BufferAttribute(pos, 3));
    this.setAttribute('uv', new Float32BufferAttribute(uv, 2));
    this.computeVertexNormals();
  }
}

// ---------- Scene graph ----------

export class Object3D {
  constructor() {
    this.position = new Vector3(); this.rotation = new Euler(); this.scale = new Vector3(1, 1, 1);
    this.matrix = new Matrix4(); this.children = []; this.parent = null; this.visible = true;
    this.castShadow = false; this.receiveShadow = false; this.userData = {}; this.renderOrder = 0; this.frustumCulled = true;
    this.quaternion = new Quaternion();
  }
  add(...o) { o.forEach((c) => { if (c.parent) c.parent.remove(c); c.parent = this; this.children.push(c); }); return this; }
  remove(...o) { o.forEach((c) => { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parent = null; } }); return this; }
  replaceWith() {}
  traverse(fn) { fn(this); this.children.forEach((c) => c.traverse(fn)); }
  updateMatrix() { this.matrix.compose(this.position, new Quaternion().setFromEuler(new Euler(this.rotation.x, this.rotation.y, this.rotation.z)), this.scale); }
  lookAt() {}
}
export class Group extends Object3D {}
export class Scene extends Object3D { constructor() { super(); this.background = null; this.fog = null; } }
export class Mesh extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class InstancedMesh extends Mesh {
  constructor(g, m, count) { super(g, m); this.count = count; this.instanceMatrix = { needsUpdate: false }; this.matrices = new Array(count).fill(null); }
  setMatrixAt(i, m) {
    if (i < 0 || i >= this.count) throw new Error(`InstancedMesh index ${i} out of range ${this.count}`);
    this.matrices[i] = m.elements.slice();
    for (const v of m.elements) if (!Number.isFinite(v)) throw new Error('InstancedMesh matrix has NaN');
  }
  computeBoundingSphere() {}
}
export class Points extends Object3D { constructor(g, m) { super(); this.geometry = g; this.material = m; } }
export class Sprite extends Object3D { constructor(m) { super(); this.material = m; } }
export class PerspectiveCamera extends Object3D {
  constructor(fov = 50, aspect = 1, near = 0.1, far = 2000) { super(); Object.assign(this, { fov, aspect, near, far }); }
  updateProjectionMatrix() {}
}
class Light extends Object3D {
  constructor(a, b, c) { super(); this.color = a; this.intensity = typeof b === 'number' ? b : c; this.target = new Object3D(); this.shadow = { mapSize: { set() {} }, camera: { updateProjectionMatrix() {} }, bias: 0, normalBias: 0 }; }
}
export class HemisphereLight extends Light { constructor(sky, ground, i) { super(sky, i, i); this.intensity = i; } }
export class DirectionalLight extends Light { constructor(c, i) { super(c, i, i); this.intensity = i; } }
export class PointLight extends Light { constructor(c, i) { super(c, i, i); this.intensity = i; } }
export class Fog { constructor(color, near, far) { this.color = color; this.near = near; this.far = far; } }

// ---------- Materials / textures ----------

class Material { constructor(o = {}) { Object.assign(this, o); this.emissive = new Color(0); this.disposed = false; } dispose() { this.disposed = true; } }
export class MeshStandardMaterial extends Material {}
export class MeshLambertMaterial extends Material {}
export class MeshBasicMaterial extends Material {}
export class PointsMaterial extends Material {}
export class SpriteMaterial extends Material {}

export class CanvasTexture {
  constructor(canvas) { this.image = canvas; this.repeat = { x: 1, y: 1, set(x, y) { this.x = x; this.y = y; } }; this.offset = { x: 0, y: 0 }; }
  clone() { const t = new CanvasTexture(this.image); return t; }
  dispose() {}
}

// ---------- Renderer ----------

export class WebGLRenderer {
  constructor({ canvas } = {}) {
    this.domElement = canvas;
    this.shadowMap = { enabled: false, type: 0 };
    this.capabilities = { getMaxAnisotropy: () => 8 };
    this.info = { render: { calls: 0, triangles: 0 } };
    this.frames = 0;
    (globalThis.__stubRenderers = globalThis.__stubRenderers || []).push(this);
  }
  setPixelRatio() {} setSize() {} dispose() { this.disposed = true; } forceContextLoss() {}
  render(scene, camera) {
    // Validate: every object and the camera must have finite transforms.
    scene.traverse((o) => {
      for (const v of [o.position.x, o.position.y, o.position.z]) if (!Number.isFinite(v)) throw new Error(`Non-finite position on ${o.constructor.name}`);
    });
    for (const v of [camera.position.x, camera.position.y, camera.position.z]) if (!Number.isFinite(v)) throw new Error('Non-finite camera position');
    let calls = 0;
    scene.traverse((o) => { if ((o instanceof Mesh || o instanceof Points || o instanceof Sprite) && o.visible) calls++; });
    this.info.render.calls = calls;
    this.frames++;
  }
}
