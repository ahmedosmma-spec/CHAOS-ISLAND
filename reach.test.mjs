import { generateWorld } from '../js/world/worldgen.js';
for (const type of ['volcanic', 'desert', 'forest']) {
  for (const seed of [1, 5, 77, 2024]) {
    const w = generateWorld({ seed, type });
    const { size, cell, half } = w;
    // Flood fill over walkable cells (not deeper than the wade limit -0.9) from the spawn.
    const ok = (i, j) => i >= 0 && j >= 0 && i < size && j < size && w.heights[j * size + i] > -0.9;
    const si = Math.floor((w.playerSpawn.x + half) / cell), sj = Math.floor((w.playerSpawn.z + half) / cell);
    const seen = new Uint8Array(size * size); const stack = [[si, sj]]; seen[sj * size + si] = 1; let reach = 0;
    while (stack.length) { const [i, j] = stack.pop(); reach++;
      for (const [di, dj] of [[1,0],[-1,0],[0,1],[0,-1]]) { const a = i+di, b = j+dj;
        if (ok(a, b) && !seen[b*size+a]) { seen[b*size+a] = 1; stack.push([a, b]); } } }
    let land = 0; for (let i = 0; i < w.heights.length; i++) if (w.heights[i] > 0) land++;
    // landmarks reachable?
    const lm = w.landmarks.map(l => { const i = Math.floor((l.x+half)/cell), j = Math.floor((l.z+half)/cell); return seen[j*size+i] ? 1 : 0; });
    const kinds = {}; for (const d of w.decor) kinds[d.k] = (kinds[d.k]||0)+1;
    console.log(type.padEnd(8), 'seed', String(seed).padEnd(5), 'res', String(w.resources.length).padEnd(4), 'decor', String(w.decor.length).padEnd(6), 'reach', (100*reach/Math.max(1,land)).toFixed(0)+'%', 'landmarks reachable', lm.reduce((a,b)=>a+b,0)+'/'+lm.length);
    if (seed === 1) console.log('   ', JSON.stringify(kinds));
  }
}
