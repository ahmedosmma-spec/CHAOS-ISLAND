// Builds the 3D scene for a generated island and animates its atmosphere.
//
// Performance design (low-end friendly):
//  - Terrain is ONE mesh; props are InstancedMesh split into 48-unit chunks so the GPU
//    frustum-culls whole groups, and chunks beyond the fog distance are hidden outright.
//  - Every prop kind is one merged geometry => one draw call per chunk per kind.
//  - Quality presets scale shadow resolution, view distance, prop density, particles and lights.
import * as THREE from 'three';
import { BIOME } from '../world/worldgen.js';
import { buildProp } from './props.js';
import {
  makeGroundTexture, makeGrainTexture, makeWaterTexture, makeLavaTexture, makeSpriteTexture
} from './textures.js';

const CHUNK = 48;

// Per-island art direction: sky gradient, fog, light colors. Dark fantasy = low sun, heavy haze.
const ENV = {
  forest: {
    zenith: 0x0b1820, horizon: 0x40635a, fog: 0x2c4640, fogNear: 0.06, fogMul: 0.8,
    sun: 0xe2e8c0, sunPower: 1.7, sunDir: [-0.55, 0.62, 0.4], hemiSky: 0x6a8a98, hemiGround: 0x1a2a1a, hemi: 0.95,
    exposure: 1.0, stars: true
  },
  volcanic: {
    zenith: 0x0c0708, horizon: 0x7a2c14, fog: 0x3c1a12, fogNear: 0.04, fogMul: 0.7,
    sun: 0xff9a5a, sunPower: 1.5, sunDir: [0.5, 0.45, -0.6], hemiSky: 0x8a5040, hemiGround: 0x20100a, hemi: 0.9,
    exposure: 1.05, stars: false
  },
  desert: {
    zenith: 0x2c2a44, horizon: 0xd8935a, fog: 0xa07a58, fogNear: 0.1, fogMul: 0.95,
    sun: 0xffc382, sunPower: 2.2, sunDir: [0.8, 0.42, 0.35], hemiSky: 0xc8a078, hemiGround: 0x503a28, hemi: 0.95,
    exposure: 1.0, stars: true
  }
};

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * @param {object} world  output of generateWorld()
 * @param {THREE.Scene} scene
 * @param {{quality: object, anisotropy: number}} opts
 */
export function buildWorldScene(world, scene, { quality, anisotropy = 4 }) {
  const env = ENV[world.type] || ENV.forest;
  const lowEnd = quality.level === 'low';
  const disposables = [];
  const track = (o) => { disposables.push(o); return o; };

  // ---------- Fog and background ----------
  const fogFar = quality.fogFar * env.fogMul;
  const fogColor = new THREE.Color(env.fog);
  scene.background = fogColor.clone();
  scene.fog = new THREE.Fog(fogColor, fogFar * env.fogNear, fogFar);

  // ---------- Lights ----------
  const hemi = new THREE.HemisphereLight(env.hemiSky, env.hemiGround, env.hemi);
  scene.add(hemi);

  const sunDir = new THREE.Vector3(...env.sunDir).normalize();
  const sun = new THREE.DirectionalLight(env.sun, env.sunPower);
  sun.position.copy(sunDir).multiplyScalar(120);
  if (quality.shadowMapSize > 0) {
    sun.castShadow = true;
    sun.shadow.mapSize.set(quality.shadowMapSize, quality.shadowMapSize);
    const r = quality.level === 'high' ? 62 : 46;
    Object.assign(sun.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 10, far: 320 });
    sun.shadow.camera.updateProjectionMatrix();
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.06;
  }
  scene.add(sun);
  scene.add(sun.target);

  const group = new THREE.Group();
  scene.add(group);

  // ---------- Sky dome ----------
  const sky = buildSky(env, sunDir, track);
  scene.add(sky.group);

  // ---------- Textures ----------
  const groundTex = track(makeGroundTexture(world.type, anisotropy));
  const extent = world.size * world.cell;
  groundTex.repeat.set(extent / 10, extent / 10);
  const grainTex = track(makeGrainTexture(anisotropy));
  const waterTex = track(makeWaterTexture(world.type, anisotropy));
  waterTex.repeat.set(extent / 14, extent / 14);
  const lavaTex = track(makeLavaTexture(anisotropy));

  // ---------- Terrain ----------
  const terrain = buildTerrain(world, groundTex, lowEnd);
  group.add(terrain);

  // ---------- Water ----------
  const waterMaterial = lowEnd
    ? new THREE.MeshBasicMaterial({ map: waterTex, color: 0xbfd8d8, fog: true })
    : new THREE.MeshStandardMaterial({ map: waterTex, roughness: 0.22, metalness: 0.15, transparent: true, opacity: 0.9 });
  const water = new THREE.Mesh(new THREE.CircleGeometry(extent * 1.8, 40), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.y = -0.05;
  water.receiveShadow = !lowEnd;
  group.add(water);

  // Second, counter-scrolling layer gives crossing ripples (medium and high only).
  let water2 = null;
  let water2Tex = null;
  if (quality.waterDetail) {
    water2Tex = track(waterTex.clone());
    water2Tex.needsUpdate = true;
    water2Tex.repeat.set(extent / 9, extent / 9);
    const m2 = new THREE.MeshBasicMaterial({ map: water2Tex, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    water2 = new THREE.Mesh(new THREE.CircleGeometry(extent * 1.8, 40), m2);
    water2.rotation.x = -Math.PI / 2;
    water2.position.y = -0.03;
    group.add(water2);
  }

  // ---------- Lava ----------
  const lava = buildLava(world, lavaTex);
  if (lava) group.add(lava);

  // Cave mouths: dark discs set into the dunes.
  for (const lm of world.landmarks.filter((l) => l.kind === 'cave')) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(3.6, 20), new THREE.MeshBasicMaterial({ color: 0x050405 }));
    hole.rotation.x = -Math.PI / 2;
    hole.position.set(lm.x, world.heightAt(lm.x, lm.z) + 0.08, lm.z);
    group.add(hole);
  }

  // Heat lights at volcano craters.
  const heatLights = [];
  if (quality.pointLights > 0) {
    world.landmarks.filter((l) => l.kind === 'volcano').slice(0, quality.pointLights).forEach((l) => {
      const light = new THREE.PointLight(0xff6a20, 4, 70, 2);
      light.position.set(l.x, Math.max(0.5, world.heightAt(l.x, l.z)) + 3, l.z);
      scene.add(light);
      heatLights.push({ light, seed: Math.random() * 10 });
    });
  }

  // ---------- Props (decor + harvestable resources) ----------
  const entries = collectEntries(world, quality);
  const props = buildPropChunks(world, entries, quality, grainTex, group, track);

  // ---------- Particles ----------
  const particles = buildParticles(world.type, quality.particles, track);
  if (particles) scene.add(particles.points);

  // ---------- Update loop ----------
  const tmp = new THREE.Vector3();
  function update(dt, time, playerPos) {
    // Scroll water and lava textures.
    waterTex.offset.x = (time * 0.012) % 1;
    waterTex.offset.y = (time * 0.007) % 1;
    if (water2Tex) {
      water2Tex.offset.x = (-time * 0.009) % 1;
      water2Tex.offset.y = (time * 0.011) % 1;
    }
    if (lava) {
      lavaTex.offset.x = (time * 0.01) % 1;
      lavaTex.offset.y = (time * 0.006) % 1;
      lava.material.emissiveIntensity = 1.25 + Math.sin(time * 1.7) * 0.18;
    }
    for (const h of heatLights) h.light.intensity = 3.6 + Math.sin(time * 5 + h.seed) * 0.7 + Math.sin(time * 11 + h.seed) * 0.3;

    // Wind uniform shared by all swaying materials.
    props.timeUniform.value = time;

    // Sky and sun follow the player so they never get closer.
    sky.group.position.copy(playerPos);
    sun.position.copy(playerPos).addScaledVector(sunDir, 120);
    sun.target.position.copy(playerPos);

    // Hide whole prop chunks beyond the view distance.
    const limit = fogFar + CHUNK * 0.75;
    for (const c of props.chunks) {
      tmp.set(c.x - playerPos.x, 0, c.z - playerPos.z);
      c.mesh.visible = tmp.length() < limit;
    }

    if (particles) particles.update(dt, time, playerPos);
  }

  function removeNode(id) {
    const node = world.nodeIndex.get(id);
    if (!node || node.removed || !node.chunkMesh) return;
    node.removed = true;
    node.chunkMesh.setMatrixAt(node.instanceIndex, props.zeroMatrix);
    node.chunkMesh.instanceMatrix.needsUpdate = true;
  }

  return {
    group,
    update,
    removeNode,
    fogFar,
    exposure: env.exposure,
    dispose() {
      scene.remove(group, hemi, sun, sun.target, sky.group);
      if (particles) scene.remove(particles.points);
      heatLights.forEach((h) => scene.remove(h.light));
      group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
      });
      sky.group.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        if (o.material) o.material.dispose();
      });
      props.dispose();
      disposables.forEach((d) => d.dispose && d.dispose());
    }
  };
}

// ---------- Sky ----------

function buildSky(env, sunDir, track) {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 24, 14);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const top = new THREE.Color(env.zenith);
  const hor = new THREE.Color(env.horizon);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const t = Math.pow(Math.min(1, Math.max(0, y)), 0.55);
    c.copy(hor).lerp(top, t);
    if (y < 0) c.copy(hor).multiplyScalar(0.55 + y * 0.3);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const dome = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false }));
  dome.scale.setScalar(600);
  dome.renderOrder = -10;
  dome.frustumCulled = false;
  group.add(dome);

  const sprite = track(makeSpriteTexture());
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: env.sun, blending: THREE.AdditiveBlending, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
  glow.position.copy(sunDir).multiplyScalar(480);
  glow.scale.setScalar(220);
  glow.renderOrder = -9;
  group.add(glow);

  if (env.stars) {
    const n = 260;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const y = 0.15 + Math.random() * 0.85;
      const r = Math.sqrt(1 - y * y);
      arr.set([Math.cos(a) * r * 560, y * 560, Math.sin(a) * r * 560], i * 3);
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(arr, 3));
    const stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xd6deff, size: 2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.65, depthWrite: false }));
    stars.frustumCulled = false;
    stars.renderOrder = -9;
    group.add(stars);
  }
  return { group };
}

// ---------- Terrain ----------

const ROCK_COLOR = { forest: [0.3, 0.3, 0.28], volcanic: [0.16, 0.13, 0.14], desert: [0.5, 0.4, 0.28] };

function blendedBiomeColor(world, x, z, out) {
  // Bilinear blend of the four surrounding cells' biome colors => soft biome transitions.
  const fi = (x + world.half) / world.cell - 0.5;
  const fj = (z + world.half) / world.cell - 0.5;
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  const tx = fi - i0, tz = fj - j0;
  out[0] = out[1] = out[2] = 0;
  for (let dj = 0; dj <= 1; dj++) {
    for (let di = 0; di <= 1; di++) {
      const ci = Math.min(world.size - 1, Math.max(0, i0 + di));
      const cj = Math.min(world.size - 1, Math.max(0, j0 + dj));
      const w = (di ? tx : 1 - tx) * (dj ? tz : 1 - tz);
      const col = world.colorOf(world.biomes[cj * world.size + ci]);
      out[0] += col[0] * w; out[1] += col[1] * w; out[2] += col[2] * w;
    }
  }
  return out;
}

function buildTerrain(world, groundTex, lowEnd) {
  const size = world.size;
  const extent = size * world.cell;
  const geo = new THREE.PlaneGeometry(extent, extent, size - 1, size - 1);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const rgb = [0, 0, 0];
  const rock = ROCK_COLOR[world.type] || ROCK_COLOR.forest;
  const col = new THREE.Color();
  const deep = new THREE.Color().setRGB(0.04, 0.1, 0.14, THREE.SRGBColorSpace);
  const d = 2;

  for (let k = 0; k < pos.count; k++) {
    const x = pos.getX(k);
    const z = pos.getZ(k);
    const h = world.heightAt(x, z);
    pos.setY(k, h);

    const hE = world.heightAt(x + d, z), hW = world.heightAt(x - d, z);
    const hN = world.heightAt(x, z + d), hS = world.heightAt(x, z - d);
    const slope = Math.hypot(hE - hW, hN - hS) / (2 * d);
    const occlusion = 0.5 + (h - (hE + hW + hN + hS) / 4) * 0.6; // darker in hollows

    blendedBiomeColor(world, x, z, rgb);
    // Steep ground turns to bare rock (except lava, which keeps its own glow).
    const lavaWeight = world.biomeAt(x, z) === BIOME.LAVA ? 1 : 0;
    const rockMix = smoothstep(0.5, 1.15, slope) * (1 - lavaWeight);
    const r = rgb[0] + (rock[0] - rgb[0]) * rockMix;
    const g = rgb[1] + (rock[1] - rgb[1]) * rockMix;
    const b = rgb[2] + (rock[2] - rgb[2]) * rockMix;
    col.setRGB(r, g, b, THREE.SRGBColorSpace);

    // Wet shoreline darkening, then seabed tint by depth.
    if (h < 0.55 && h > 0) col.multiplyScalar(0.72 + h * 0.5);
    if (h <= 0) col.lerp(deep, Math.min(0.88, 0.35 - h * 0.35));

    // Fine per-vertex variation + ambient occlusion.
    const grain = 0.94 + (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453 % 1 + 1) % 1 * 0.1;
    const shade = Math.min(1.12, Math.max(0.62, occlusion)) * grain * 1.1;
    colors[k * 3] = col.r * shade;
    colors[k * 3 + 1] = col.g * shade;
    colors[k * 3 + 2] = col.b * shade;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const material = lowEnd
    ? new THREE.MeshLambertMaterial({ vertexColors: true, map: groundTex })
    : new THREE.MeshStandardMaterial({ vertexColors: true, map: groundTex, roughness: 0.96, metalness: 0 });
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

// ---------- Lava ----------

function buildLava(world, lavaTex) {
  const { size, cell, half } = world;
  const verts = [];
  const uvs = [];
  const idx = [];
  const level = (x, z) => Math.max(world.heightAt(x, z) + 0.16, 0.1);
  let n = 0;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      if (world.biomes[j * size + i] !== BIOME.LAVA) continue;
      const x0 = i * cell - half, x1 = x0 + cell;
      const z0 = j * cell - half, z1 = z0 + cell;
      for (const [x, z] of [[x0, z0], [x1, z0], [x1, z1], [x0, z1]]) {
        verts.push(x, level(x, z), z);
        uvs.push(x / 8, z / 8);
      }
      idx.push(n, n + 2, n + 1, n, n + 3, n + 2);
      n += 4;
    }
  }
  if (!n) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    map: lavaTex, emissiveMap: lavaTex, emissive: 0xffffff, emissiveIntensity: 1.3, roughness: 0.55, metalness: 0
  });
  return new THREE.Mesh(geo, mat);
}

// ---------- Props ----------

// Combines world decor, harvestable resources and landmark dressing into one list.
function collectEntries(world, quality) {
  const out = [];
  for (const d of world.decor) {
    const isGrass = d.k === 'grass' || d.k === 'ashweed';
    const keep = isGrass ? quality.grassDensity : quality.decorDensity;
    if (d.q >= keep) continue;
    out.push({ kind: d.k, x: d.x, y: d.y, z: d.z, s: d.s, r: d.r, solid: d.solid });
  }
  world.nodeIndex = new Map();
  for (const r of world.resources) {
    const entry = { kind: r.kind, x: r.x, y: r.y, z: r.z, s: 1 + ((Math.sin(r.x * 7.3 + r.z) + 1) * 0.12), r: (Math.sin(r.x * 3.1 + r.z) + 1) * Math.PI, node: r };
    out.push(entry);
    world.nodeIndex.set(r.id, r);
  }
  // Landmark dressing: ruin pillar rings, cave mouths, glade standing stones.
  for (const lm of world.landmarks) {
    const ring = (kind, count, radius, scaleMin, scaleMax, solid) => {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + lm.x;
        const x = lm.x + Math.cos(a) * radius;
        const z = lm.z + Math.sin(a) * radius;
        const s = scaleMin + ((Math.sin(i * 12.9 + lm.x) + 1) / 2) * (scaleMax - scaleMin);
        out.push({ kind, x, y: world.heightAt(x, z), z, s, r: a, solid });
      }
    };
    if (lm.kind === 'ruin') { ring('pillar', 8, 7, 0.9, 1.3, 0.5); ring('rock', 4, 4, 0.6, 1.1, 0.7); }
    else if (lm.kind === 'cave') { ring('spire', 5, 5.5, 1.1, 1.8, 0.6); ring('rock', 4, 4, 0.9, 1.4, 0.7); }
    else if (lm.kind === 'hidden') { ring('rock', 6, 8, 1.4, 2.0, 0.7); ring('mushroom', 10, 4, 1, 1.5, 0); ring('herb', 4, 2.5, 1, 1.2, 0); }
  }
  return out;
}

function buildPropChunks(world, entries, quality, grainTex, group, track) {
  const timeUniform = { value: 0 };
  const lowEnd = quality.level === 'low';
  const materials = new Map();

  function materialFor(kindMaterial, sway) {
    const key = `${kindMaterial}|${sway && quality.foliageSway}`;
    if (materials.has(key)) return materials.get(key);
    let m;
    if (kindMaterial === 'unlit') {
      m = new THREE.MeshBasicMaterial({ vertexColors: true });
    } else if (lowEnd) {
      m = new THREE.MeshLambertMaterial({ vertexColors: true, map: kindMaterial === 'blade' ? null : grainTex, side: kindMaterial === 'blade' ? THREE.DoubleSide : THREE.FrontSide });
    } else if (kindMaterial === 'gloss') {
      m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.45 });
    } else {
      m = new THREE.MeshStandardMaterial({
        vertexColors: true, map: kindMaterial === 'blade' ? null : grainTex, roughness: 0.88, metalness: 0,
        side: kindMaterial === 'blade' ? THREE.DoubleSide : THREE.FrontSide
      });
    }
    if (sway && quality.foliageSway) applySway(m, timeUniform);
    materials.set(key, m);
    return m;
  }

  // Group entries by kind and spatial chunk.
  const buckets = new Map();
  for (const e of entries) {
    const key = `${e.kind}|${Math.floor(e.x / CHUNK)}|${Math.floor(e.z / CHUNK)}`;
    let b = buckets.get(key);
    if (!b) { b = { kind: e.kind, cx: Math.floor(e.x / CHUNK), cz: Math.floor(e.z / CHUNK), list: [] }; buckets.set(key, b); }
    b.list.push(e);
  }

  const geometries = new Map();
  const dummy = new THREE.Object3D();
  const chunks = [];
  const castShadows = quality.shadowMapSize > 0;

  for (const b of buckets.values()) {
    let prop = geometries.get(b.kind);
    if (!prop) { prop = buildProp(b.kind, world.type, quality); geometries.set(b.kind, prop); }

    const mesh = new THREE.InstancedMesh(prop.geometry, materialFor(prop.material, prop.sway), b.list.length);
    b.list.forEach((e, i) => {
      dummy.position.set(e.x, e.y - 0.06 * e.s, e.z);
      dummy.rotation.set(0, e.r, 0);
      dummy.scale.setScalar(e.s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      if (e.node) { e.node.chunkMesh = mesh; e.node.instanceIndex = i; }
      if (e.solid) world.colliders.add(e.x, e.z, e.solid * e.s, null);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (typeof mesh.computeBoundingSphere === 'function') mesh.computeBoundingSphere();
    mesh.castShadow = castShadows && prop.shadow;
    mesh.receiveShadow = castShadows && prop.material !== 'unlit' && prop.material !== 'blade';
    group.add(mesh);
    chunks.push({ mesh, x: (b.cx + 0.5) * CHUNK, z: (b.cz + 0.5) * CHUNK });
  }

  return {
    chunks,
    timeUniform,
    zeroMatrix: new THREE.Matrix4().makeScale(0, 0, 0),
    dispose() {
      geometries.forEach((p) => p.geometry.dispose());
      materials.forEach((m) => m.dispose());
    }
  };
}

// Wind sway: bends vertices sideways in proportion to their height. Cheap and GPU-only.
function applySway(material, timeUniform) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = timeUniform;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec3 swayOrigin = instanceMatrix[3].xyz;
        #else
          vec3 swayOrigin = vec3(0.0);
        #endif
        float swayAmount = max(0.0, position.y) * 0.035;
        float swayPhase = uTime * 1.4 + swayOrigin.x * 0.45 + swayOrigin.z * 0.37;
        transformed.x += sin(swayPhase) * swayAmount;
        transformed.z += cos(swayPhase * 0.8) * swayAmount * 0.6;`);
  };
}

// ---------- Particles ----------

const PARTICLE_STYLE = {
  volcanic: { color: 0xff7a30, size: 0.42, rise: 1.4, drift: 0.5, opacity: 0.9 },
  desert:   { color: 0xe8c890, size: 0.3, rise: 0.05, drift: 3.2, opacity: 0.45 },
  forest:   { color: 0xc8ff7a, size: 0.3, rise: 0.12, drift: 0.35, opacity: 0.85 }
};
const BOX = { x: 70, y: 22, z: 70 };

function buildParticles(type, count, track) {
  if (!count) return null;
  const style = PARTICLE_STYLE[type] || PARTICLE_STYLE.forest;
  const base = new Float32Array(count * 3);
  const phase = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    base[i * 3] = (Math.random() - 0.5) * BOX.x;
    base[i * 3 + 1] = Math.random() * BOX.y;
    base[i * 3 + 2] = (Math.random() - 0.5) * BOX.z;
    phase[i] = Math.random() * Math.PI * 2;
  }
  const positions = new Float32Array(base);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const tex = track(makeSpriteTexture());
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    map: tex, color: style.color, size: style.size, transparent: true, opacity: style.opacity,
    depthWrite: false, blending: THREE.AdditiveBlending
  }));
  points.frustumCulled = false;

  return {
    points,
    update(dt, time, playerPos) {
      for (let i = 0; i < count; i++) {
        // Each particle drifts in a local box that wraps around the player.
        base[i * 3] += style.drift * dt * (0.6 + Math.sin(phase[i]));
        base[i * 3 + 1] += style.rise * dt * (0.5 + 0.5 * Math.sin(phase[i] * 2));
        if (base[i * 3 + 1] > BOX.y) base[i * 3 + 1] -= BOX.y;
        if (base[i * 3] > BOX.x / 2) base[i * 3] -= BOX.x;
        const wobble = type === 'forest' ? Math.sin(time * 0.8 + phase[i]) * 0.8 : 0;
        positions[i * 3] = playerPos.x + wrap(base[i * 3] - playerPos.x, BOX.x) + wobble;
        positions[i * 3 + 1] = playerPos.y - 2 + base[i * 3 + 1];
        positions[i * 3 + 2] = playerPos.z + wrap(base[i * 3 + 2] - playerPos.z, BOX.z) + (type === 'forest' ? Math.cos(time * 0.6 + phase[i]) * 0.8 : 0);
      }
      geo.attributes.position.needsUpdate = true;
    }
  };
}

// Wraps a value into [-size/2, size/2).
function wrap(v, size) {
  return ((((v + size / 2) % size) + size) % size) - size / 2;
}

