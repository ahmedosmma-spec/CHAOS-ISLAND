// Procedural island generation. Every world is built from a seed, so the same
// seed always reproduces the same layout. Each island type adds its own features.
import { mulberry32, hashSeed, makeNoise } from '../core/random.js';
import { createColliders } from './colliders.js';

export const ISLAND_TYPES = ['volcanic', 'desert', 'forest'];

// Biome codes stored per cell.
export const BIOME = {
  WATER: 0, SAND: 1, GRASS: 2, FOREST_FLOOR: 3, ROCK: 4,
  ASH: 5, LAVA: 6, DUNE: 7, RUIN: 8, CLAY: 9, DARK_GRASS: 10
};

const BIOME_COLORS = {
  [BIOME.WATER]: [0.10, 0.22, 0.30],
  [BIOME.SAND]: [0.62, 0.52, 0.34],
  [BIOME.GRASS]: [0.25, 0.42, 0.20],
  [BIOME.FOREST_FLOOR]: [0.16, 0.30, 0.15],
  [BIOME.ROCK]: [0.36, 0.33, 0.33],
  [BIOME.ASH]: [0.18, 0.16, 0.16],
  [BIOME.LAVA]: [1.00, 0.40, 0.10],
  [BIOME.DUNE]: [0.78, 0.64, 0.40],
  [BIOME.RUIN]: [0.50, 0.46, 0.42],
  [BIOME.CLAY]: [0.55, 0.36, 0.26],
  [BIOME.DARK_GRASS]: [0.20, 0.28, 0.16]
};

export const SEA_LEVEL = 0;

const DIFFICULTY = {
  easy:   { enemyMul: 0.6, damageMul: 0.7 },
  normal: { enemyMul: 1.0, damageMul: 1.0 },
  hard:   { enemyMul: 1.6, damageMul: 1.4 }
};

// Resource node definitions per island type. weight = relative spawn chance.
const RESOURCE_TABLE = {
  volcanic: [
    { kind: 'obsidian', biomes: [BIOME.ASH, BIOME.ROCK], weight: 5, amount: 3 },
    { kind: 'stone', biomes: [BIOME.ROCK, BIOME.ASH], weight: 4, amount: 3 },
    { kind: 'sulfur', biomes: [BIOME.ASH], weight: 2, amount: 2, nearLava: true },
    { kind: 'deadwood', biomes: [BIOME.ASH, BIOME.ROCK], weight: 2, amount: 2 }
  ],
  desert: [
    { kind: 'stone', biomes: [BIOME.ROCK, BIOME.RUIN], weight: 3, amount: 3 },
    { kind: 'cactus', biomes: [BIOME.SAND, BIOME.DUNE], weight: 4, amount: 2 },
    { kind: 'clay', biomes: [BIOME.CLAY, BIOME.SAND], weight: 3, amount: 2 },
    { kind: 'deadwood', biomes: [BIOME.DUNE, BIOME.SAND, BIOME.CLAY], weight: 3, amount: 2 },
    { kind: 'relic', biomes: [BIOME.RUIN], weight: 1, amount: 1 }
  ],
  forest: [
    { kind: 'tree', biomes: [BIOME.FOREST_FLOOR, BIOME.DARK_GRASS, BIOME.GRASS], weight: 8, amount: 4 },
    { kind: 'stone', biomes: [BIOME.ROCK, BIOME.GRASS, BIOME.FOREST_FLOOR, BIOME.DARK_GRASS], weight: 2, amount: 3 },
    { kind: 'herb', biomes: [BIOME.GRASS, BIOME.DARK_GRASS], weight: 3, amount: 1 },
    { kind: 'berries', biomes: [BIOME.GRASS], weight: 2, amount: 2 }
  ]
};

// Enemy types per island and where they appear.
const ENEMY_TABLE = {
  volcanic: { kind: 'ember_crawler', zone: 'lava' },
  desert: { kind: 'sand_wraith', zone: 'ruins' },
  forest: { kind: 'thorn_wolf', zone: 'dense' }
};

/**
 * Generates a complete island.
 * @param {object} opts
 * @param {number|string} opts.seed  numeric or text seed (empty seed = random)
 * @param {string} opts.type         'volcanic' | 'desert' | 'forest'
 * @param {string} opts.difficulty   'easy' | 'normal' | 'hard'
 * @param {number} [opts.size=128]   grid cells per side
 * @param {number} [opts.cell=3]     world units per cell
 */
export function generateWorld({ seed, type = 'forest', difficulty = 'normal', size = 128, cell = 3 }) {
  const numericSeed = typeof seed === 'number' ? seed >>> 0 : hashSeed(String(seed));
  const rand = mulberry32(numericSeed);
  const noise = makeNoise(rand);
  const half = (size * cell) / 2;

  const heights = new Float32Array(size * size);
  const biomes = new Uint8Array(size * size);

  // Cell index → world coordinates (island centered on origin).
  const worldX = (i) => (i + 0.5) * cell - half;
  const worldZ = (j) => (j + 0.5) * cell - half;

  // ----- Island-specific feature setup -----
  const features = buildFeatures(type, rand, noise, half);

  // ----- Heightmap and base biomes -----
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = worldX(i);
      const z = worldZ(j);
      const idx = j * size + i;

      const nx = x / half;
      const nz = z / half;
      const dist = Math.sqrt(nx * nx + nz * nz);
      // Domain-warped radius gives an irregular coastline with bays and headlands.
      const warp = noise.fbm(x * 0.009 + 50.3, z * 0.009 + 90.1, 3);
      const radial = dist * 1.28 * (1 + (warp - 0.5) * 0.7);
      const mask = Math.max(0, 1 - Math.pow(radial, 2.6));

      const n = noise.fbm(x * 0.02 + 13.1, z * 0.02 + 7.7, 5);
      // Inland relief plus a seabed that deepens away from the coast.
      let h = mask * (2.0 + (n - 0.35) * 14) - 0.8 - Math.max(0, radial - 0.95) * 5;

      // Feature contributions
      h += features.heightAt(x, z, n);
      h = features.carve(x, z, h);

      heights[idx] = h;
      biomes[idx] = features.biomeAt(x, z, h, n);
    }
  }

  // Shoreline sand: land that touches water becomes sand unless it is special terrain.
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const idx = j * size + i;
      if (heights[idx] <= SEA_LEVEL) { biomes[idx] = BIOME.WATER; continue; }
      if (heights[idx] < 0.6 && biomes[idx] !== BIOME.LAVA && biomes[idx] !== BIOME.RUIN) {
        biomes[idx] = type === 'desert' ? BIOME.DUNE : BIOME.SAND;
      }
    }
  }

  const grid = { size, cell, half, heights, biomes };
  const landmarks = features.landmarks;
  const resources = scatterResources(type, grid, rand, features);
  const enemySpawns = scatterEnemies(type, grid, rand, features, DIFFICULTY[difficulty] || DIFFICULTY.normal);
  const playerSpawn = findSpawn(grid, rand);
  ensureStarterResources(type, grid, rand, resources, playerSpawn);
  const decor = scatterDecor(type, grid, rand, noise, playerSpawn);
  const colliders = createColliders(half);
  for (const r of resources) {
    const def = SOLID_RESOURCES[r.kind];
    if (def) colliders.add(r.x, r.z, def, r.id);
  }
  // Decor colliders are added by the renderer, only for props that are actually drawn
  // (low quality drops some props, and invisible walls would be confusing).

  return {
    seed: numericSeed,
    type,
    difficulty,
    size,
    cell,
    half,
    heights,
    biomes,
    landmarks,
    resources,
    enemySpawns,
    playerSpawn,
    decor,
    colliders,
    difficultyMul: DIFFICULTY[difficulty] || DIFFICULTY.normal,
    colorOf: (biome) => BIOME_COLORS[biome] || BIOME_COLORS[BIOME.ROCK],
    heightAt: (x, z) => sampleHeight(grid, x, z),
    biomeAt: (x, z) => sampleBiome(grid, x, z),
    isLand: (x, z) => sampleHeight(grid, x, z) > SEA_LEVEL + 0.05
  };
}

// ---------- Feature builders (one per island type) ----------

function buildFeatures(type, rand, noise, half) {
  if (type === 'volcanic') return volcanicFeatures(rand, noise, half);
  if (type === 'desert') return desertFeatures(rand, noise, half);
  return forestFeatures(rand, noise, half);
}

function volcanicFeatures(rand, noise, half) {
  const volcanoes = [];
  const count = 2 + Math.floor(rand() * 2);
  for (let k = 0; k < count; k++) {
    const ang = rand() * Math.PI * 2;
    const r = half * (0.15 + rand() * 0.35);
    volcanoes.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r, radius: half * (0.18 + rand() * 0.08), peak: 14 + rand() * 6 });
  }
  const landmarks = volcanoes.map((v, i) => ({ kind: 'volcano', name: `Volcano ${i + 1}`, x: v.x, z: v.z }));

  return {
    landmarks,
    heightAt(x, z) {
      let add = 0;
      for (const v of volcanoes) {
        const d = Math.hypot(x - v.x, z - v.z);
        if (d < v.radius) add += v.peak * Math.pow(1 - d / v.radius, 1.6);
      }
      return add;
    },
    carve(x, z, h) {
      // Crater pools: deep basins at the top of each volcano.
      for (const v of volcanoes) {
        const d = Math.hypot(x - v.x, z - v.z);
        if (d < v.radius * 0.18) return Math.min(h, -0.2);
      }
      return h;
    },
    biomeAt(x, z, h, n) {
      for (const v of volcanoes) {
        const d = Math.hypot(x - v.x, z - v.z);
        if (d < v.radius * 0.18) return BIOME.LAVA;
        if (d < v.radius * 0.5 && n > 0.45) return BIOME.LAVA;
      }
      if (h > 7) return BIOME.ROCK;
      if (h > 3) return BIOME.ASH;
      return n > 0.55 ? BIOME.ROCK : BIOME.ASH;
    },
    zones: { lava: volcanoes }
  };
}

function desertFeatures(rand, noise, half) {
  const ruins = [];
  const count = 3 + Math.floor(rand() * 3);
  for (let k = 0; k < count; k++) {
    const ang = rand() * Math.PI * 2;
    const r = half * (0.1 + rand() * 0.4);
    ruins.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r, size: 10 + rand() * 8 });
  }
  const caves = [];
  for (let k = 0; k < 3; k++) {
    const ang = rand() * Math.PI * 2;
    const r = half * (0.35 + rand() * 0.25);
    caves.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r, radius: 5 });
  }
  const landmarks = [
    ...ruins.map((r, i) => ({ kind: 'ruin', name: `Ruin ${i + 1}`, x: r.x, z: r.z })),
    ...caves.map((c, i) => ({ kind: 'cave', name: `Cave ${i + 1}`, x: c.x, z: c.z }))
  ];

  return {
    landmarks,
    heightAt(x, z, n) {
      // Dunes: rolling ridges, stronger on land.
      return Math.sin(x * 0.09 + n * 4) * 0.9 + Math.cos(z * 0.07 - n * 3) * 0.7;
    },
    carve(x, z, h) {
      for (const c of caves) {
        if (Math.hypot(x - c.x, z - c.z) < c.radius * 0.6) return Math.min(h, 1.5);
      }
      return h;
    },
    biomeAt(x, z, h, n) {
      for (const r of ruins) {
        if (Math.abs(x - r.x) < r.size / 2 && Math.abs(z - r.z) < r.size / 2) return BIOME.RUIN;
      }
      if (h > 6) return BIOME.ROCK;
      if (n > 0.6) return BIOME.CLAY;
      return BIOME.DUNE;
    },
    zones: { ruins }
  };
}

function forestFeatures(rand, noise, half) {
  // Rivers: thin noise ridges that carve below sea level.
  const riverSeedX = rand() * 100;
  const riverSeedZ = rand() * 100;
  const clearings = [];
  for (let k = 0; k < 3; k++) {
    const ang = rand() * Math.PI * 2;
    const r = half * (0.2 + rand() * 0.45);
    clearings.push({ x: Math.cos(ang) * r, z: Math.sin(ang) * r, radius: 9 });
  }
  const landmarks = clearings.map((c, i) => ({ kind: 'hidden', name: `Hidden Glade ${i + 1}`, x: c.x, z: c.z }));

  return {
    landmarks,
    heightAt(x, z, n) {
      return (n - 0.5) * 2.2;
    },
    carve(x, z, h) {
      // Smooth-banked channel, shallow enough to wade across (see player.js WADE_LIMIT).
      const d = Math.abs(noise.noise2(x * 0.018 + riverSeedX, z * 0.018 + riverSeedZ) - 0.5);
      const width = 0.05;
      if (d >= width || h < -0.5) return h;
      const k = Math.min(1, (1 - d / width) * 1.7);
      const bank = k * k * (3 - 2 * k);
      return h * (1 - bank) + -0.55 * bank;
    },
    biomeAt(x, z, h, n) {
      for (const c of clearings) {
        if (Math.hypot(x - c.x, z - c.z) < c.radius) return BIOME.GRASS;
      }
      if (h > 6) return BIOME.ROCK;
      if (n > 0.6) return BIOME.DARK_GRASS;
      return BIOME.FOREST_FLOOR;
    },
    zones: { clearings }
  };
}

// ---------- Scattering ----------

function scatterResources(type, grid, rand, features) {
  const table = RESOURCE_TABLE[type];
  const total = table.reduce((s, r) => s + r.weight, 0);
  const out = [];
  const attempts = Math.floor(grid.size * grid.size * 0.1);
  for (let a = 0; a < attempts; a++) {
    const i = Math.floor(rand() * grid.size);
    const j = Math.floor(rand() * grid.size);
    const idx = j * grid.size + i;
    const biome = grid.biomes[idx];
    const h = grid.heights[idx];
    if (h <= SEA_LEVEL + 0.2) continue;

    // Pick a resource type weighted, then check it fits this biome.
    let roll = rand() * total;
    let pick = table[0];
    for (const r of table) { roll -= r.weight; if (roll <= 0) { pick = r; break; } }
    if (!pick.biomes.includes(biome)) continue;

    const x = (i + 0.5) * grid.cell - grid.half + (rand() - 0.5) * grid.cell;
    const z = (j + 0.5) * grid.cell - grid.half + (rand() - 0.5) * grid.cell;

    if (pick.nearLava && !nearZone(x, z, features, 'lava', 25)) continue;

    out.push({ id: `r${out.length}`, kind: pick.kind, x, z, y: h, amount: pick.amount });
  }
  return out;
}

function scatterEnemies(type, grid, rand, features, diff) {
  const spec = ENEMY_TABLE[type];
  const base = type === 'forest' ? 12 : 9;
  const want = Math.round(base * diff.enemyMul);
  const out = [];
  let guard = 0;
  while (out.length < want && guard++ < 4000) {
    const i = Math.floor(rand() * grid.size);
    const j = Math.floor(rand() * grid.size);
    const idx = j * grid.size + i;
    if (grid.heights[idx] <= SEA_LEVEL + 0.5) continue;
    const x = (i + 0.5) * grid.cell - grid.half;
    const z = (j + 0.5) * grid.cell - grid.half;

    // Enemies favor their zone, but a few roam anywhere.
    const inZone = nearZone(x, z, features, spec.zone, 30);
    if (!inZone && rand() < 0.7) continue;
    // Keep spawns away from the center where the player starts.
    if (Math.hypot(x, z) < 22) continue;

    out.push({ id: `e${out.length}`, kind: spec.kind, x, z, y: grid.heights[idx] });
  }
  return out;
}

function nearZone(x, z, features, zoneName, radius) {
  const list = features.zones && features.zones[zoneName];
  if (!list) return false;
  for (const p of list) {
    const r = p.radius || p.size || radius;
    if (Math.hypot(x - p.x, z - p.z) < Math.max(radius, r)) return true;
  }
  return false;
}

// Picks gentle, dry, non-hazardous ground partway between the center and the coast.
function findSpawn(grid, rand) {
  const { size, cell, half, heights, biomes } = grid;
  const bad = new Set([BIOME.WATER, BIOME.LAVA, BIOME.ROCK, BIOME.RUIN]);
  let best = null;
  let bestScore = Infinity;
  for (let j = 1; j < size - 1; j++) {
    for (let i = 1; i < size - 1; i++) {
      const idx = j * size + i;
      const h = heights[idx];
      if (h < 1.0 || h > 3.4 || bad.has(biomes[idx])) continue;
      const slope = Math.max(
        Math.abs(heights[idx + 1] - h), Math.abs(heights[idx - 1] - h),
        Math.abs(heights[idx + size] - h), Math.abs(heights[idx - size] - h)
      ) / cell;
      if (slope > 0.3) continue;
      const x = (i + 0.5) * cell - half;
      const z = (j + 0.5) * cell - half;
      const score = Math.abs(Math.hypot(x, z) - 0.4 * half) + slope * 40 + rand() * 12;
      if (score < bestScore) { bestScore = score; best = { x, y: h, z }; }
    }
  }
  return best || { x: 0, y: 2, z: 0 };
}

// The player starts with nothing, so every spawn must have the basics within walking distance:
// wood, stone and a fiber source. Random scatter usually provides them; this guarantees it.
const STARTER_KINDS = {
  forest: ['tree', 'stone', 'herb'],
  volcanic: ['deadwood', 'stone', 'obsidian'],
  desert: ['deadwood', 'stone', 'cactus']
};
const STARTER_AMOUNT = { tree: 4, deadwood: 2, stone: 3, obsidian: 3, herb: 1, cactus: 2 };

function ensureStarterResources(type, grid, rand, resources, spawn) {
  const NEAR = 45;
  const blocked = new Set([BIOME.WATER, BIOME.LAVA, BIOME.RUIN]);
  for (const kind of STARTER_KINDS[type]) {
    let have = resources.filter((r) => r.kind === kind && Math.hypot(r.x - spawn.x, r.z - spawn.z) < NEAR).length;
    let guard = 0;
    while (have < 3 && guard++ < 400) {
      const a = rand() * Math.PI * 2;
      const d = 8 + rand() * (NEAR - 12);
      const x = spawn.x + Math.cos(a) * d;
      const z = spawn.z + Math.sin(a) * d;
      const y = sampleHeight(grid, x, z);
      if (y < 0.5 || blocked.has(sampleBiome(grid, x, z))) continue;
      resources.push({ id: `r${resources.length}`, kind, x, z, y, amount: STARTER_AMOUNT[kind] || 2 });
      have++;
    }
  }
}

// Radius (world units) of the blocking circle for harvestable nodes.
const SOLID_RESOURCES = { tree: 0.55, deadwood: 0.4, stone: 0.7, obsidian: 0.6, cactus: 0.4, relic: 0.4 };

// Decorative scenery, never harvested. n = target count, solid = collision radius factor.
// Kinds are drawn by game/props.js. `q` (0..1) lets low-quality settings drop a share of items.
const DECOR_TABLE = {
  forest: [
    { k: 'pine',  biomes: [BIOME.FOREST_FLOOR, BIOME.DARK_GRASS], n: 1500, s: [0.8, 1.6], solid: 0.35, cluster: 0.38, maxSlope: 0.9 },
    { k: 'oak',   biomes: [BIOME.GRASS, BIOME.FOREST_FLOOR], n: 520, s: [0.8, 1.4], solid: 0.4, cluster: 0.45, maxSlope: 0.8 },
    { k: 'bush',  biomes: [BIOME.GRASS, BIOME.FOREST_FLOOR, BIOME.DARK_GRASS], n: 800, s: [0.7, 1.4] },
    { k: 'fern',  biomes: [BIOME.FOREST_FLOOR, BIOME.DARK_GRASS], n: 1000, s: [0.7, 1.3] },
    { k: 'rock',  biomes: [BIOME.ROCK, BIOME.FOREST_FLOOR, BIOME.GRASS], n: 380, s: [0.6, 1.9], solid: 0.7 },
    { k: 'grass', biomes: [BIOME.GRASS, BIOME.DARK_GRASS, BIOME.FOREST_FLOOR], n: 7000, s: [0.8, 1.4] },
    { k: 'mushroom', biomes: [BIOME.DARK_GRASS, BIOME.FOREST_FLOOR], n: 160, s: [0.7, 1.5] },
    { k: 'log',   biomes: [BIOME.FOREST_FLOOR, BIOME.DARK_GRASS], n: 90, s: [0.9, 1.4] }
  ],
  volcanic: [
    { k: 'deadtree', biomes: [BIOME.ASH, BIOME.ROCK], n: 520, s: [0.8, 1.5], solid: 0.3, maxSlope: 0.9 },
    { k: 'spire',    biomes: [BIOME.ROCK, BIOME.ASH], n: 260, s: [1.0, 3.0], solid: 0.5 },
    { k: 'rock',     biomes: [BIOME.ASH, BIOME.ROCK], n: 760, s: [0.6, 2.0], solid: 0.7 },
    { k: 'crystal',  biomes: [BIOME.ASH, BIOME.ROCK], n: 220, s: [0.7, 1.6] },
    { k: 'ashweed',  biomes: [BIOME.ASH], n: 2600, s: [0.7, 1.3] }
  ],
  desert: [
    { k: 'rock',   biomes: [BIOME.DUNE, BIOME.ROCK, BIOME.CLAY], n: 520, s: [0.6, 2.4], solid: 0.7 },
    { k: 'cactus', biomes: [BIOME.DUNE, BIOME.SAND], n: 360, s: [0.8, 1.6], solid: 0.35 },
    { k: 'deadtree', biomes: [BIOME.DUNE, BIOME.CLAY], n: 200, s: [0.8, 1.4], solid: 0.3 },
    { k: 'shrub',  biomes: [BIOME.DUNE, BIOME.CLAY, BIOME.SAND], n: 1500, s: [0.6, 1.3] },
    { k: 'bones',  biomes: [BIOME.DUNE, BIOME.CLAY], n: 110, s: [0.8, 1.4] },
    { k: 'ashweed', biomes: [BIOME.DUNE, BIOME.SAND], n: 2600, s: [0.7, 1.3] },
    { k: 'pillar', biomes: [BIOME.RUIN], n: 70, s: [0.8, 1.5], solid: 0.5 }
  ]
};

function scatterDecor(type, grid, rand, noise, spawn) {
  const out = [];
  const { size, cell, half, heights, biomes } = grid;
  for (const spec of DECOR_TABLE[type]) {
    let placed = 0;
    let guard = 0;
    const maxTries = spec.n * 14;
    while (placed < spec.n && guard++ < maxTries) {
      const i = 1 + Math.floor(rand() * (size - 2));
      const j = 1 + Math.floor(rand() * (size - 2));
      const idx = j * size + i;
      if (!spec.biomes.includes(biomes[idx])) continue;
      const h = heights[idx];
      if (h < 0.35) continue;
      const x = (i + rand()) * cell - half;
      const z = (j + rand()) * cell - half;
      if (spec.cluster !== undefined && noise.fbm(x * 0.035 + 200, z * 0.035 + 300, 2) < spec.cluster) continue;
      if (spec.maxSlope !== undefined) {
        const slope = Math.max(
          Math.abs(heights[idx + 1] - h), Math.abs(heights[idx - 1] - h),
          Math.abs(heights[idx + size] - h), Math.abs(heights[idx - size] - h)
        ) / cell;
        if (slope > spec.maxSlope) continue;
      }
      if (Math.hypot(x - spawn.x, z - spawn.z) < 5) continue;
      const s = spec.s[0] + rand() * (spec.s[1] - spec.s[0]);
      out.push({
        k: spec.k, x, z, y: sampleHeight(grid, x, z), s, r: rand() * Math.PI * 2,
        q: rand(), solid: spec.solid || 0
      });
      placed++;
    }
  }
  return out;
}

// ---------- Sampling helpers ----------

function sampleHeight(grid, x, z) {
  const fi = (x + grid.half) / grid.cell - 0.5;
  const fj = (z + grid.half) / grid.cell - 0.5;
  const i0 = Math.floor(fi), j0 = Math.floor(fj);
  const tx = fi - i0, tz = fj - j0;
  const at = (i, j) => {
    const ci = Math.min(grid.size - 1, Math.max(0, i));
    const cj = Math.min(grid.size - 1, Math.max(0, j));
    return grid.heights[cj * grid.size + ci];
  };
  const a = at(i0, j0), b = at(i0 + 1, j0), c = at(i0, j0 + 1), d = at(i0 + 1, j0 + 1);
  return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
}

function sampleBiome(grid, x, z) {
  const i = Math.round((x + grid.half) / grid.cell - 0.5);
  const j = Math.round((z + grid.half) / grid.cell - 0.5);
  const ci = Math.min(grid.size - 1, Math.max(0, i));
  const cj = Math.min(grid.size - 1, Math.max(0, j));
  return grid.biomes[cj * grid.size + ci];
}

/**
 * Renders a top-down thumbnail to a data URL for world cards and the minimap.
 * It reads the same height and biome grids the 3D renderer uses, so the preview always
 * matches the generated island. Hillshading (light from the north-west) shows relief.
 */
export function renderThumbnail(world, px = 96) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = px;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(px, px);
  const s = world.size;
  const at = (i, j) => world.heights[Math.min(s - 1, Math.max(0, j)) * s + Math.min(s - 1, Math.max(0, i))];
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      const i = Math.floor((x / px) * s);
      const j = Math.floor((y / px) * s);
      const idx = j * s + i;
      const h = world.heights[idx];
      const biome = world.biomes[idx];
      const rgb = world.colorOf(biome);
      let shade;
      if (h <= SEA_LEVEL) {
        shade = Math.max(0.35, 0.85 + h * 0.12);               // deeper water is darker
      } else {
        const slopeLight = (at(i - 1, j - 1) - at(i + 1, j + 1)) * 0.09; // NW light
        shade = Math.min(1.35, Math.max(0.55, 0.92 + slopeLight + Math.min(0.2, h * 0.015)));
      }
      const glow = biome === BIOME.LAVA ? 1.25 : 1;
      const p = (y * px + x) * 4;
      img.data[p] = Math.min(255, rgb[0] * 255 * shade * glow);
      img.data[p + 1] = Math.min(255, rgb[1] * 255 * shade);
      img.data[p + 2] = Math.min(255, rgb[2] * 255 * shade);
      img.data[p + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}
