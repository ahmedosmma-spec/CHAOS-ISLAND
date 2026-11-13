// Basic enemies: each island has one creature type. They wander near their spawn,
// chase the player when close, lunge to attack on a cooldown, and drop loot when defeated.
// Bodies are merged vertex-colored meshes (one draw call for the body, one for the glow).
import * as THREE from 'three';
import { bake, merge } from './props.js';
import { ENEMY_DEFS } from '../data/enemyDefs.js';

export { ENEMY_DEFS };

const opt = (o) => ({ noise: 0.22, ...o });
const ico = (r, d = 1) => new THREE.IcosahedronGeometry(r, d);
const cone = (r, h, s = 5) => new THREE.ConeGeometry(r, h, s);
const cyl = (a, b, h, s = 6) => new THREE.CylinderGeometry(a, b, h, s);

function solid(parts, material) {
  const m = new THREE.Mesh(merge(parts), material);
  m.castShadow = true;
  return m;
}

/** Returns { root, legs: Object3D[], head: Object3D|null } for the given enemy kind. */
function buildBody(kind, def) {
  const root = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, metalness: 0 });
  const glowMat = new THREE.MeshBasicMaterial({ color: def.glow });
  const legs = [];
  const glow = [];

  if (kind === 'ember_crawler') {
    // Armoured lava beetle with glowing cracks and eyes.
    root.add(solid([
      bake(ico(0.55, 1), opt({ at: [0, 0.6, 0], scale: [1, 0.65, 1.45], jitter: 0.05, bottom: 0x120c0a, top: 0x3a2a26 })),
      bake(ico(0.34, 1), opt({ at: [0, 0.64, 0.95], scale: [1, 0.8, 1.1], jitter: 0.03, bottom: 0x160d0a, top: 0x3a2622 })),
      ...[-1, 1].flatMap((s) => [bake(cone(0.07, 0.4, 4), opt({ at: [s * 0.18, 0.82, 1.16], rot: [Math.PI / 2 - 0.3, 0, s * 0.5], bottom: 0x2a1a14, top: 0x5a3a2a }))]),
      ...[0, 1, 2].map((i) => bake(cone(0.1, 0.34, 4), opt({ at: [0, 1.0, -0.35 + i * 0.35], bottom: 0x2a1a14, top: 0x5a3a2a })))
    ], bodyMat));
    for (const s of [-1, 1]) {
      glow.push(bake(ico(0.045, 0), { at: [s * 0.14, 0.74, 1.24], bottom: 0xffd070, top: 0xffd070, noise: 0 }));
    }
    for (let i = 0; i < 4; i++) glow.push(bake(new THREE.BoxGeometry(0.05, 0.02, 0.5), { at: [(i % 2 ? 1 : -1) * 0.12, 0.95 - (i % 2) * 0.02, -0.2 + i * 0.28], rot: [0, (i % 2 ? 1 : -1) * 0.3, 0], bottom: 0xff7a20, top: 0xffb040, noise: 0 }));
    for (let i = 0; i < 6; i++) {
      const g = new THREE.Group();
      g.position.set(i % 2 ? 0.42 : -0.42, 0.42, -0.6 + Math.floor(i / 2) * 0.6);
      g.add(solid([bake(cyl(0.04, 0.025, 0.55, 5), opt({ at: [0, -0.27, 0], rot: [0, 0, (i % 2 ? -1 : 1) * 0.45], bottom: 0x1a100d, top: 0x3a2a26 }))], bodyMat));
      root.add(g);
      legs.push(g);
    }
  } else if (kind === 'sand_wraith') {
    // Tattered floating robe with a hollow hood and glowing eyes.
    root.add(solid([
      bake(new THREE.CylinderGeometry(0.2, 0.55, 1.5, 10, 1, true), opt({ at: [0, 0.95, 0], jitter: 0.04, bottom: 0x6a5a42, top: 0xc8b48a })),
      bake(ico(0.22, 1), opt({ at: [0, 1.82, 0.02], scale: [1, 1.1, 1], bottom: 0xb8a47a, top: 0xdcc9a0 })),
      bake(new THREE.SphereGeometry(0.26, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.65), opt({ at: [0, 1.84, -0.04], scale: [1, 1.1, 1.1], bottom: 0x7a6a4e, top: 0xb8a47a })),
      ...[-1, 1].map((s) => bake(cone(0.07, 0.8, 4), opt({ at: [s * 0.4, 1.1, 0.25], rot: [0.9, 0, s * 0.35], bottom: 0x6a5a42, top: 0xc8b48a })))
    ], new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
    for (const s of [-1, 1]) glow.push(bake(ico(0.04, 0), { at: [s * 0.08, 1.84, 0.17], bottom: 0xffffff, top: 0xffffff, noise: 0 }));
  } else {
    // Thorn wolf: lean quadruped with spiked spine.
    root.add(solid([
      bake(ico(0.34, 1), opt({ at: [0, 0.72, 0], scale: [0.85, 0.9, 1.7], bottom: 0x2e231a, top: 0x5a4632 })),
      bake(ico(0.24, 1), opt({ at: [0, 0.9, 0.62], scale: [0.9, 0.85, 1.1], bottom: 0x2e231a, top: 0x5a4632 })),
      bake(cone(0.14, 0.34, 5), opt({ at: [0, 0.84, 0.95], rot: [Math.PI / 2, 0, 0], bottom: 0x2e231a, top: 0x4a3a2a })),
      ...[-1, 1].map((s) => bake(cone(0.06, 0.18, 4), opt({ at: [s * 0.12, 1.12, 0.52], rot: [0, 0, -s * 0.2], bottom: 0x2e231a, top: 0x5a4632 }))),
      bake(cone(0.07, 0.6, 4), opt({ at: [0, 0.8, -0.95], rot: [-Math.PI / 2 - 0.5, 0, 0], bottom: 0x2e231a, top: 0x4a3a2a }))
    ], bodyMat));
    for (let i = 0; i < 7; i++) glow.push(bake(cone(0.035, 0.2, 4), { at: [0, 1.06 + Math.sin(i / 6 * Math.PI) * 0.06, -0.55 + i * 0.16], bottom: 0x4a9a3a, top: 0x9aff6a, noise: 0 }));
    for (const s of [-1, 1]) glow.push(bake(ico(0.03, 0), { at: [s * 0.08, 0.96, 0.78], bottom: 0xd8ff90, top: 0xd8ff90, noise: 0 }));
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      g.position.set(i % 2 ? 0.18 : -0.18, 0.5, i < 2 ? 0.45 : -0.45);
      g.add(solid([bake(cyl(0.055, 0.035, 0.52, 5), opt({ at: [0, -0.26, 0], bottom: 0x241a12, top: 0x4a3826 }))], bodyMat));
      root.add(g);
      legs.push(g);
    }
  }

  if (glow.length) root.add(new THREE.Mesh(merge(glow), glowMat));
  return { root, legs };
}

/**
 * Enemy manager for a world.
 * @param {object} world
 * @param {THREE.Scene} scene
 * @param {(itemId: string, qty: number) => void} onLoot  called for each dropped item
 */
export function createEnemies(world, scene, onLoot) {
  const list = [];
  const mul = world.difficultyMul || { damageMul: 1 };

  for (const spawn of world.enemySpawns) {
    const def = ENEMY_DEFS[spawn.kind];
    if (!def) continue;
    const { root, legs } = buildBody(spawn.kind, def);
    root.position.set(spawn.x, world.heightAt(spawn.x, spawn.z), spawn.z);
    root.rotation.y = Math.random() * Math.PI * 2;
    scene.add(root);
    list.push({
      id: spawn.id, kind: spawn.kind, def, root, legs,
      home: new THREE.Vector3(spawn.x, 0, spawn.z),
      hp: def.hp, maxHp: def.hp, cooldown: 0, lunge: 0, dead: false,
      wander: Math.random() * Math.PI * 2, wanderT: 0, hitFlash: 0, walkPhase: Math.random() * 6
    });
  }

  function kill(e) {
    e.dead = true;
    scene.remove(e.root);
    e.root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) o.material.dispose();
    });
  }

  return {
    list,
    count() { return list.reduce((n, e) => n + (e.dead ? 0 : 1), 0); },
    deadIds() { return list.filter((e) => e.dead).map((e) => e.id); },
    /** Removes enemies that were defeated in a previous session. */
    restoreDead(ids) { const set = new Set(ids || []); list.forEach((e) => { if (set.has(e.id) && !e.dead) kill(e); }); },

    /** Advances AI. Returns { damage } dealt to the player this frame. */
    update(dt, player, world) {
      let damage = 0;
      for (const e of list) {
        if (e.dead) continue;
        e.cooldown = Math.max(0, e.cooldown - dt);
        e.lunge = Math.max(0, e.lunge - dt);
        e.hitFlash = Math.max(0, e.hitFlash - dt);

        const dx = player.pos.x - e.root.position.x;
        const dz = player.pos.z - e.root.position.z;
        const dist = Math.hypot(dx, dz);
        let moveX = 0, moveZ = 0;
        const chasing = player.alive && dist < e.def.sight;

        if (chasing) {
          if (dist > e.def.reach * 0.9) { moveX = dx / dist; moveZ = dz / dist; }
          if (dist <= e.def.reach && e.cooldown <= 0) {
            e.cooldown = 1.2;
            e.lunge = 0.25;
            damage += e.def.damage * mul.damageMul;
          }
        } else {
          e.wanderT -= dt;
          if (e.wanderT <= 0) { e.wander = Math.random() * Math.PI * 2; e.wanderT = 2 + Math.random() * 3; }
          const hx = e.root.position.x - e.home.x;
          const hz = e.root.position.z - e.home.z;
          const fromHome = Math.hypot(hx, hz);
          if (fromHome < 8) { moveX = Math.sin(e.wander) * 0.4; moveZ = Math.cos(e.wander) * 0.4; }
          else { moveX = -hx / fromHome; moveZ = -hz / fromHome; }
        }

        const moving = moveX !== 0 || moveZ !== 0;
        if (moving) {
          const step = e.def.speed * dt * (chasing ? 1 : 0.5);
          const nx = e.root.position.x + moveX * step;
          const nz = e.root.position.z + moveZ * step;
          if (world.heightAt(nx, nz) > -0.2) {
            e.root.position.x = nx;
            e.root.position.z = nz;
            if (world.colliders) {
              const p = { x: e.root.position.x, z: e.root.position.z };
              world.colliders.resolve(p, 0.5);
              e.root.position.x = p.x; e.root.position.z = p.z;
            }
          }
          const target = Math.atan2(moveX, moveZ);
          let d = (target - e.root.rotation.y) % (Math.PI * 2);
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          e.root.rotation.y += d * Math.min(1, dt * 10);
          e.walkPhase += dt * e.def.speed * 2.6;
        }

        // Pose: leg scuttle, body bob, hit squash and attack lunge forward.
        e.legs.forEach((leg, i) => { leg.rotation.x = moving ? Math.sin(e.walkPhase + (i % 2 ? Math.PI : 0) + i * 0.7) * 0.6 : 0; });
        const squash = 1 - e.hitFlash * 0.6;
        e.root.scale.set(1 / squash, squash, 1 / squash);
        const lungeK = e.lunge > 0 ? Math.sin((e.lunge / 0.25) * Math.PI) * 0.35 : 0;
        e.root.position.y = world.heightAt(e.root.position.x, e.root.position.z) + (moving ? Math.abs(Math.sin(e.walkPhase * 2)) * 0.05 : 0);
        e.root.rotation.x = -lungeK;
      }
      return { damage };
    },

    /**
     * Hits the nearest living enemy in front of the player. `facing` is the player's yaw;
     * enemies outside a 150-degree arc are ignored. Returns { killed, name } or null.
     */
    strikeNearest(player, damage, facing = null, reach = 2.7) {
      let best = null;
      let bestD = reach;
      for (const e of list) {
        if (e.dead) continue;
        const dx = e.root.position.x - player.pos.x;
        const dz = e.root.position.z - player.pos.z;
        const d = Math.hypot(dx, dz);
        if (d >= bestD) continue;
        if (facing !== null && d > 0.8) {
          let diff = Math.atan2(dx, dz) - facing;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          if (Math.abs(diff) > Math.PI * 0.42) continue;
        }
        bestD = d; best = e;
      }
      if (!best) return null;
      best.hp -= damage;
      best.hitFlash = 0.2;
      const dx = best.root.position.x - player.pos.x;
      const dz = best.root.position.z - player.pos.z;
      const len = Math.hypot(dx, dz) || 1;
      best.root.position.x += (dx / len) * 0.5;
      best.root.position.z += (dz / len) * 0.5;
      if (best.hp <= 0) {
        const name = best.def.name;
        for (const [id, qty, chance] of best.def.drops) if (Math.random() < chance) onLoot(id, qty);
        kill(best);
        return { killed: true, name };
      }
      return { killed: false, name: best.def.name };
    },

    dispose() { list.forEach((e) => { if (!e.dead) kill(e); }); }
  };
}
