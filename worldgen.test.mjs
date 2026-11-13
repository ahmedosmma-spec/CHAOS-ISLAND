import { generateWorld, BIOME, SEA_LEVEL } from '../js/world/worldgen.js';
let bad = 0;
for (const type of ['volcanic', 'desert', 'forest']) {
  for (const seed of [1, 2, 3, 42, 999, 'abc', 123456]) {
    const w = generateWorld({ seed, type, difficulty: 'normal' });
    let land = 0, lava = 0, water = 0;
    for (let i = 0; i < w.heights.length; i++) {
      if (w.heights[i] > SEA_LEVEL) land++; else water++;
      if (w.biomes[i] === BIOME.LAVA) lava++;
    }
    const sp = w.playerSpawn;
    const spBiome = w.biomeAt(sp.x, sp.z);
    const spH = w.heightAt(sp.x, sp.z);
    const landPct = (100 * land / w.heights.length).toFixed(0);
    const ok = spBiome !== BIOME.LAVA && spBiome !== BIOME.WATER && spH > 0.5;
    if (!ok) bad++;
    console.log(`${type.padEnd(8)} seed=${String(seed).padEnd(7)} land=${landPct}% lava=${lava} res=${w.resources.length} enemies=${w.enemySpawns.length} spawn=(${sp.x.toFixed(0)},${sp.z.toFixed(0)}) h=${spH.toFixed(1)} biome=${spBiome} ${ok ? '' : '<-- BAD SPAWN'}`);
  }
}
// Determinism and variation
const a = generateWorld({ seed: 7, type: 'forest' }), b = generateWorld({ seed: 7, type: 'forest' }), c = generateWorld({ seed: 8, type: 'forest' });
console.log('same seed identical:', a.heights.every((v, i) => v === b.heights[i]));
console.log('different seed differs:', !a.heights.every((v, i) => v === c.heights[i]));
console.log(bad ? `${bad} bad spawns` : 'all spawns valid');
