// Checks that each island can supply the basic recipes, so a new player is never stuck.
import { generateWorld } from '../js/world/worldgen.js';
import { GATHER } from '../js/data/items.js';
import { RECIPES } from '../js/data/recipes.js';
import { ENEMY_DEFS } from '../js/data/enemyDefs.js';

const extras = { herb: ['fiber'], tree: ['fiber'], cactus: ['fiber'], deadwood: ['fiber'], berries: ['fiber'] };
const enemyOf = { volcanic: 'ember_crawler', desert: 'sand_wraith', forest: 'thorn_wolf' };
let problems = 0;
for (const type of ['volcanic', 'desert', 'forest']) {
  const w = generateWorld({ seed: 11, type });
  const obtainable = new Set();
  for (const r of w.resources) { obtainable.add(GATHER[r.kind].yields); (extras[r.kind] || []).forEach((x) => obtainable.add(x)); }
  ENEMY_DEFS[enemyOf[type]].drops.forEach(([id]) => obtainable.add(id));
  const craftable = [], blocked = [];
  for (const r of RECIPES) {
    const missing = Object.keys(r.needs).filter((id) => !obtainable.has(id));
    (missing.length ? blocked : craftable).push(missing.length ? `${r.id} (needs ${missing.join(', ')})` : r.id);
  }
  const must = ['stone_axe', 'torch'];
  const ok = must.every((m) => craftable.includes(m)) && craftable.some((c) => /helm|vest|hood|cloak|greaves|charm/.test(c)) && craftable.some((c) => /spear|blade/.test(c));
  if (!ok) problems++;
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${type}: craftable ${craftable.length}/${RECIPES.length}`);
  console.log(`      craftable: ${craftable.join(', ')}`);
  console.log(`      island-specific (needs materials from other islands): ${blocked.join('; ') || 'none'}`);
}
process.exit(problems ? 1 : 0);
