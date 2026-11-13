// Circle colliders in a spatial hash, so pushing the player out of trees and rocks
// costs a handful of checks per frame regardless of how many props exist.
const BUCKET = 8;

export function createColliders(half) {
  const buckets = new Map();
  const byId = new Map();
  const offset = Math.ceil(half / BUCKET) + 2;
  const key = (bi, bj) => (bi + offset) * 1024 + (bj + offset);

  function add(x, z, r, id) {
    const item = { x, z, r, id, active: true };
    const k = key(Math.floor(x / BUCKET), Math.floor(z / BUCKET));
    let list = buckets.get(k);
    if (!list) { list = []; buckets.set(k, list); }
    list.push(item);
    if (id) byId.set(id, item);
  }

  return {
    add,
    /** Disables the collider of a harvested resource node. */
    remove(id) {
      const item = byId.get(id);
      if (item) item.active = false;
    },
    /** Pushes (pos.x, pos.z) out of any circle it overlaps. `radius` is the mover's size. */
    resolve(pos, radius) {
      const bi = Math.floor(pos.x / BUCKET);
      const bj = Math.floor(pos.z / BUCKET);
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          const list = buckets.get(key(bi + di, bj + dj));
          if (!list) continue;
          for (const c of list) {
            if (!c.active) continue;
            const dx = pos.x - c.x;
            const dz = pos.z - c.z;
            const min = c.r + radius;
            const d2 = dx * dx + dz * dz;
            if (d2 < min * min && d2 > 1e-6) {
              const d = Math.sqrt(d2);
              pos.x = c.x + (dx / d) * min;
              pos.z = c.z + (dz / d) * min;
            }
          }
        }
      }
    }
  };
}
