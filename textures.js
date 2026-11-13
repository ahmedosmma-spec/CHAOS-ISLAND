// Procedural, tileable textures drawn on canvas at startup. No image files are needed,
// which keeps the APK small and the first load fast. Sizes are kept modest for low-end GPUs.
import * as THREE from 'three';

function hash2(x, y, seed) {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(seed, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

// Value noise that wraps every `period` cells, so the texture tiles without seams.
function periodic(x, y, period, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const w = (v) => ((v % period) + period) % period;
  const a = hash2(w(xi), w(yi), seed);
  const b = hash2(w(xi + 1), w(yi), seed);
  const c = hash2(w(xi), w(yi + 1), seed);
  const d = hash2(w(xi + 1), w(yi + 1), seed);
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal noise over unit coordinates (u, v in 0..1) that tiles.
function fbm(u, v, base, octaves, seed) {
  let sum = 0;
  let amp = 0.5;
  let norm = 0;
  let p = base;
  for (let o = 0; o < octaves; o++) {
    sum += amp * periodic(u * p, v * p, p, seed + o * 17);
    norm += amp;
    amp *= 0.5;
    p *= 2;
  }
  return sum / norm;
}

function paint(size, pixel, { srgb = true, anisotropy = 4, repeat = true } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [r, g, b, a = 1] = pixel(x / size, y / size);
      const p = (y * size + x) * 4;
      img.data[p] = Math.max(0, Math.min(255, r * 255));
      img.data[p + 1] = Math.max(0, Math.min(255, g * 255));
      img.data[p + 2] = Math.max(0, Math.min(255, b * 255));
      img.data[p + 3] = Math.max(0, Math.min(255, a * 255));
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; }
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = anisotropy;
  return tex;
}

/** Ground detail map. It multiplies the terrain's vertex colors, adding grain and variation. */
export function makeGroundTexture(type, anisotropy) {
  return paint(256, (u, v) => {
    const big = fbm(u, v, 4, 3, 11);
    const fine = fbm(u, v, 32, 2, 29);
    let k;
    if (type === 'desert') {
      // Wind ripples: warped parallel streaks.
      const warp = fbm(u, v, 6, 2, 5) * 6;
      const ripple = 0.5 + 0.5 * Math.sin((v * 40 + warp * 3) * Math.PI);
      k = 0.78 + big * 0.12 + ripple * 0.08 + fine * 0.06;
    } else if (type === 'volcanic') {
      // Cracked basalt: dark veins where two noise fields cross.
      const c1 = Math.abs(fbm(u, v, 8, 3, 41) - 0.5);
      const vein = c1 < 0.035 ? 0.55 + c1 * 8 : 1;
      k = (0.7 + big * 0.18 + fine * 0.1) * vein;
    } else {
      // Mottled soil, moss and fine blade-like speckle.
      const speck = periodic(u * 128, v * 128, 128, 77) > 0.82 ? 0.9 : 1;
      k = (0.7 + big * 0.2 + fine * 0.14) * speck;
    }
    return [k, k, k];
  }, { anisotropy });
}

/** Grain map shared by all props (trees, rocks); multiplies their vertex colors. */
export function makeGrainTexture(anisotropy) {
  return paint(128, (u, v) => {
    const n = fbm(u, v, 8, 3, 3);
    const streak = fbm(u * 0.25, v, 4, 2, 19);
    const k = 0.68 + n * 0.22 + streak * 0.14;
    return [k, k, k];
  }, { anisotropy });
}

/** Animated water: soft caustic-like lines over deep teal. Tinted by the island type. */
export function makeWaterTexture(type, anisotropy) {
  const tint = type === 'volcanic' ? [0.16, 0.08, 0.06] : type === 'desert' ? [0.1, 0.28, 0.3] : [0.06, 0.2, 0.22];
  return paint(256, (u, v) => {
    const a = fbm(u, v, 6, 3, 101);
    const b = fbm(u + 0.37, v + 0.21, 9, 2, 131);
    const line = 1 - Math.abs(a - b) * 5;
    const glint = Math.max(0, line) ** 4;
    return [tint[0] + glint * 0.25, tint[1] + glint * 0.32, tint[2] + glint * 0.34 + a * 0.05];
  }, { anisotropy });
}

/** Lava: glowing orange cracks over a dark crust. Used as both color and emissive map. */
export function makeLavaTexture(anisotropy) {
  return paint(256, (u, v) => {
    const a = fbm(u, v, 5, 4, 211);
    const crack = Math.abs(a - 0.5);
    const heat = Math.max(0, 1 - crack * 6);
    const glow = heat * heat;
    const crust = 0.08 + fbm(u, v, 16, 2, 233) * 0.1;
    return [crust + glow * 1.0, crust * 0.6 + glow * 0.42, crust * 0.4 + glow * 0.06];
  }, { anisotropy });
}

/** Round soft sprite for embers, dust and fireflies. */
export function makeSpriteTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
