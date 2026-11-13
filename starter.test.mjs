// Across many seeds: the three essentials exist near the spawn on every island.
import { generateWorld } from '../js/world/worldgen.js';
const need = { forest: ['tree', 'stone', 'herb'], volcanic: ['deadwood', 'stone', 'obsidian'], desert: ['deadwood', 'stone', 'cactus'] };
let bad = 0, n = 0;
for (const type of Object.keys(need)) for (let seed = 1; seed <= 40; seed++) {
  const w = generateWorld({ seed, type }); n++;
  for (const k of need[type]) {
    const c = w.resources.filter((r) => r.kind === k && Math.hypot(r.x - w.playerSpawn.x, r.z - w.playerSpawn.z) < 45).length;
    if (c < 3) { bad++; console.log(`FAIL ${type} seed ${seed}: only ${c} ${k} near spawn`); }
  }
}
console.log(`${n} worlds checked, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
