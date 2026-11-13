// Resource gathering. Hands work on everything; a stone axe halves the hits on trees.
// Harvested node ids are tracked so they stay gone after a save and reload.
import * as THREE from 'three';
import { GATHER } from '../data/items.js';

const REACH = 2.6;
// Bonus drops so fiber (needed by most recipes) exists on every island.
const EXTRA_DROPS = {
  herb: { fiber: 0.6 }, tree: { fiber: 0.2 }, cactus: { fiber: 0.5 }, deadwood: { fiber: 0.35 }, berries: { fiber: 0.2 }
};

export function createGatherer(world, sceneRenderer, harvestedIds = []) {
  const harvested = new Set(harvestedIds);
  const progress = new Map(); // nodeId -> hits so far
  const tmp = new THREE.Vector3();

  /** Returns the nearest unharvested node within reach, or null. */
  function nearest(pos) {
    let best = null;
    let bestD = REACH;
    for (const r of world.resources) {
      if (harvested.has(r.id)) continue;
      tmp.set(r.x - pos.x, 0, r.z - pos.z);
      const d = tmp.length();
      if (d < bestD) { bestD = d; best = r; }
    }
    return best;
  }

  /**
   * Applies one gathering swing to a node.
   * @returns {{ done: boolean, progress: number, kind: string, gained?: {id: string, qty: number}[], full?: boolean }}
   */
  function swing(node, inv) {
    const def = GATHER[node.kind];
    // Axes are carried in the bag (tools), not equipped; they speed up woodcutting.
    const hasAxe = (node.kind === 'tree' || node.kind === 'deadwood') && inv.count('stone_axe') > 0;
    const needHits = hasAxe ? Math.max(1, Math.ceil(node.amount / 2)) : node.amount + 1;

    const hits = (progress.get(node.id) || 0) + 1;
    progress.set(node.id, hits);
    if (hits < needHits) return { done: false, progress: hits / needHits, kind: node.kind };

    harvested.add(node.id);
    progress.delete(node.id);
    const gained = [];
    const leftover = inv.add(def.yields, node.amount);
    if (node.amount - leftover > 0) gained.push({ id: def.yields, qty: node.amount - leftover });

    const extra = EXTRA_DROPS[node.kind];
    if (extra) {
      for (const [id, chance] of Object.entries(extra)) {
        if (Math.random() < chance && inv.add(id, 1) === 0) gained.push({ id, qty: 1 });
      }
    }
    sceneRenderer.removeNode(node.id);
    return { done: true, progress: 1, kind: node.kind, gained, full: leftover > 0 };
  }

  return {
    nearest,
    swing,
    harvested: () => [...harvested],
    isHarvested: (id) => harvested.has(id)
  };
}
