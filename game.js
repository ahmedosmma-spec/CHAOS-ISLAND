// Game session: builds the world, runs the loop, wires input, HUD, saving and cleanup.
// Loaded on demand by main.js so the menu stays light on low-end phones.
import * as THREE from 'three';
import { t, getLanguage } from '../core/i18n.js';
import { showScreen, toast } from '../core/screens.js';
import { getQuality } from '../core/quality.js';
import { profile } from '../core/profile.js';
import { ITEMS, GATHER, itemName } from '../data/items.js';
import { generateWorld, renderThumbnail, BIOME } from '../world/worldgen.js';
import { worldStore } from '../world/worldStore.js';
import { createInput } from './input.js';
import { createControlsLayer } from '../ui/controls.js';
import { createInventory } from './inventory.js';
import { createPlayer } from './player.js';
import { createGatherer } from './gather.js';
import { createEnemies } from './enemies.js';
import { createHumanoid } from './character.js';
import { buildWorldScene } from './world-render.js';
import { createHud } from './hud.js';

const $ = (id) => document.getElementById(id);
const AUTOSAVE_SECONDS = 30;
const ACTION_COOLDOWN = 0.45;
const ATTACK_STAMINA = 6;
const LAVA_DPS = 14;
const FALL_SAFE_SPEED = 14;
const DEBUG = new URLSearchParams(location.search).has('debug');

let session = null;
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));

/** Starts (or restarts) a game for a saved world record. */
export async function runGame(record, { onExit }) {
  if (session) session.stop();
  const overlay = $('game-loading');
  overlay.textContent = t('loading');
  overlay.classList.add('show');
  showScreen('game');
  // Two frames so the loading text paints before the (blocking) world generation.
  await nextFrame();
  await nextFrame();
  try {
    session = startSession(record, onExit);
  } catch (err) {
    console.error(err);
    overlay.classList.remove('show');
    showScreen('menu');
    toast(err && err.message === 'webgl' ? t('webglError') : t('worldLoadError'), 4000);
    return;
  }
  overlay.classList.remove('show');
}

function startSession(record, onExit) {
  const quality = getQuality();
  const lang = () => getLanguage();

  // ---------- Renderer ----------
  const oldCanvas = $('game-canvas');
  const canvas = oldCanvas.cloneNode(false);
  oldCanvas.replaceWith(canvas);
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: quality.antialias, powerPreference: 'high-performance' });
  } catch {
    throw new Error('webgl');
  }
  let resolutionScale = 1;
  const applySize = () => {
    renderer.setPixelRatio(quality.pixelRatio * resolutionScale);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.fov = camera.aspect < 1 ? 72 : 60;
    camera.updateProjectionMatrix();
  };
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  if (quality.shadowMapSize > 0) {
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = quality.level === 'high' ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 800);
  applySize();

  // ---------- World ----------
  const world = generateWorld({ seed: record.seed, type: record.type, difficulty: record.difficulty });
  const sceneRenderer = buildWorldScene(world, scene, {
    quality,
    anisotropy: Math.min(renderer.capabilities.getMaxAnisotropy(), quality.level === 'high' ? 8 : quality.level === 'medium' ? 4 : 1)
  });
  renderer.toneMappingExposure = sceneRenderer.exposure;

  // ---------- State restored from the save (or a fresh, empty start) ----------
  const saved = record.progress || null;
  const inventory = createInventory(saved ? saved.inventory : null);
  const spawn = saved && saved.player
    ? { x: saved.player.x, y: world.heightAt(saved.player.x, saved.player.z), z: saved.player.z }
    : world.playerSpawn;
  const player = createPlayer(world.playerSpawn, saved ? saved.player : null);
  player.state.pos.set(spawn.x, spawn.y, spawn.z);

  const gatherer = createGatherer(world, sceneRenderer, saved ? saved.harvested : []);
  if (saved && saved.harvested) saved.harvested.forEach((id) => { sceneRenderer.removeNode(id); world.colliders.remove(id); });

  // Loot goes straight into the bag.
  const onLoot = (id, qty) => {
    const left = inventory.add(id, qty);
    if (qty - left > 0) hud.message(`${itemName(id, lang())} x${qty - left}`);
    if (left > 0) hud.message(t('msgFull'));
    hud.refresh();
  };
  const enemies = createEnemies(world, scene, onLoot);
  if (saved) enemies.restoreDead(saved.deadEnemies);

  // ---------- Character ----------
  const character = createHumanoid({ torchLight: quality.pointLights > 0 });
  scene.add(character.root);
  function refreshAppearance() {
    const skin = { ...profile.skin() };
    for (const slot of ['head', 'body', 'legs', 'accessory']) {
      const id = inventory.equipped[slot];
      if (id && ITEMS[id] && ITEMS[id].skin) skin[slot] = ITEMS[id].skin;
    }
    character.setEquipment(skin);
    const held = inventory.equipped.weapon || (inventory.count('stone_axe') ? 'stone_axe' : inventory.count('torch') ? 'torch' : null);
    character.setHeld(held);
  }
  refreshAppearance();

  // ---------- Input and controls ----------
  const input = createInput();
  const controls = createControlsLayer($('controls-layer'), input);

  // Camera orbit: yaw is the camera's angle around the player (see player.js movement convention).
  const cam = { yaw: saved && saved.camYaw !== undefined ? saved.camYaw : Math.PI, pitch: 0.38, dist: 6.2, pos: new THREE.Vector3(), ready: false };
  const look = { id: null, x: 0, y: 0 };
  const onPointerDown = (e) => {
    if (hud.isPanelOpen() || look.id !== null) return;
    look.id = e.pointerId; look.x = e.clientX; look.y = e.clientY;
    canvas.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (e.pointerId !== look.id) return;
    cam.yaw += (e.clientX - look.x) * 0.0055;
    cam.pitch = Math.min(1.25, Math.max(0.06, cam.pitch - (e.clientY - look.y) * 0.004));
    look.x = e.clientX; look.y = e.clientY;
  };
  const onPointerUp = (e) => { if (e.pointerId === look.id) look.id = null; };
  const onWheel = (e) => { cam.dist = Math.min(11, Math.max(3.2, cam.dist + e.deltaY * 0.005)); };
  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', onPointerUp);
  canvas.addEventListener('wheel', onWheel, { passive: true });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // ---------- HUD ----------
  let paused = false;
  const hud = createHud({
    inventory,
    world,
    minimapUrl: record.thumb || renderThumbnail(world, 96),
    onCraft: craft,
    onUseSlot: useSlot,
    onUnequip: (slot) => { if (inventory.unequip(slot)) refreshAppearance(); else hud.message(t('msgFull')); },
    onPanelChange: (open) => { paused = open; if (open) { controls.hide(); } else controls.show(); },
    pause: { resume: () => hud.closePanels(), save: () => save(true), quit: () => stop(true) }
  });

  // ---------- Actions ----------
  let actionCooldown = 0;
  let pendingHit = -1;

  function describeGain(res) {
    const parts = (res.gained || []).map((g) => `${itemName(g.id, lang())} x${g.qty}`);
    return `${t('msgGathered')} ${parts.join(', ')}`;
  }

  function tryGather() {
    const node = gatherer.nearest(player.state.pos);
    if (!node) return false;
    const res = gatherer.swing(node, inventory);
    const label = GATHER[res.kind].label[lang()] || GATHER[res.kind].label.en;
    if (res.done) {
      world.colliders.remove(node.id);
      hud.message(describeGain(res) + (res.full ? ` (${t('msgFull')})` : ''));
      hud.refresh();
      refreshAppearance();
    } else {
      hud.message(`${t('msgGathering')} ${label} ${Math.round(res.progress * 100)}%`, 900);
    }
    return true;
  }

  function startAttack() {
    if (!player.state.alive || actionCooldown > 0) return;
    if (player.state.stamina < ATTACK_STAMINA) { hud.message(t('msgNotEnough'), 900); actionCooldown = 0.3; return; }
    player.state.stamina -= ATTACK_STAMINA;
    actionCooldown = ACTION_COOLDOWN;
    character.attack();
    pendingHit = 0.17; // the blow lands mid-swing
  }

  function resolveHit() {
    const hit = enemies.strikeNearest(player.state, inventory.weaponDamage(), player.state.yaw);
    if (hit) {
      if (hit.killed) hud.message(`${t('msgDefeated')} ${hit.name[lang()] || hit.name.en}`);
      return;
    }
    tryGather();
  }

  function interact() {
    if (!player.state.alive || actionCooldown > 0) return;
    actionCooldown = ACTION_COOLDOWN;
    if (gatherer.nearest(player.state.pos)) { character.attack(); tryGather(); return; }
    const food = inventory.bag.find((s) => s && ITEMS[s.id].kind === 'food');
    if (!food) { hud.message(t('msgNothingToEat')); return; }
    eat(food.id);
  }

  function eat(id) {
    inventory.remove(id, 1);
    player.heal(ITEMS[id].heal || 5);
    hud.message(`${t('msgAte')} ${itemName(id, lang())}`);
    hud.refresh();
  }

  function useSlot(index) {
    const stack = inventory.bag[index];
    if (!stack) return;
    const def = ITEMS[stack.id];
    if (def.kind === 'food') { eat(stack.id); return; }
    if (def.kind === 'weapon' || def.kind === 'armor') {
      const id = stack.id;
      if (inventory.equip(index)) {
        if (def.skin) profile.unlock(def.skin);
        refreshAppearance();
        hud.message(`${t('msgEquipped')}: ${itemName(id, lang())}`);
      }
    }
  }

  function craft(recipe) {
    if (!inventory.hasAll(recipe.needs)) { hud.message(t('msgNeedMats')); return; }
    inventory.consumeAll(recipe.needs);
    const left = inventory.add(recipe.out, recipe.count);
    if (left > 0) {
      // Roll back: give the ingredients back and refuse.
      inventory.remove(recipe.out, recipe.count - left);
      Object.entries(recipe.needs).forEach(([id, n]) => inventory.add(id, n));
      hud.message(t('msgNoSpace'));
      return;
    }
    const def = ITEMS[recipe.out];
    let text = `${t('msgCrafted')}: ${itemName(recipe.out, lang())}`;
    if (def.skin) { profile.unlock(def.skin); text += ` - ${t('msgUnlocked')}`; }
    hud.message(text, 2600);
    refreshAppearance();
  }

  // ---------- Saving ----------
  let playTime = saved && saved.playTime ? saved.playTime : 0;
  let sinceSave = 0;
  function save(announce = false) {
    const s = player.state;
    const ok = worldStore.saveProgress(record.id, {
      player: { x: s.pos.x, y: s.pos.y, z: s.pos.z, health: s.health, stamina: s.stamina },
      inventory: inventory.serialize(),
      harvested: gatherer.harvested(),
      deadEnemies: enemies.deadIds(),
      playTime,
      camYaw: cam.yaw
    });
    sinceSave = 0;
    if (announce) hud.message(ok ? t('msgSaved') : t('cannotStore'));
  }

  // ---------- Frame loop ----------
  const clock = { last: performance.now(), time: 0 };
  const motion = { speed: 0, sprint: false, grounded: true, vy: 0, wading: false };
  let frameCount = 0;
  let deathTimer = 0;
  let dying = false;
  let lavaWarned = false;
  let prevVy = 0;
  const perf = { acc: 0, frames: 0, slowFor: 0, fastFor: 0 };
  const camTarget = new THREE.Vector3();
  const camWant = new THREE.Vector3();
  let raf = 0;
  let stopped = false;

  function update(dt) {
    const s = player.state;
    actionCooldown = Math.max(0, actionCooldown - dt);

    if (s.alive) {
      Object.assign(motion, player.update(dt, input, cam.yaw, world));

      // Fall damage: only very long drops hurt.
      if (motion.grounded && prevVy < -FALL_SAFE_SPEED) {
        const dmg = (-prevVy - FALL_SAFE_SPEED) * 3;
        if (!player.hurt(dmg, 0)) { character.flash(); hud.flashHurt(); }
      }
      prevVy = s.vel.y;

      if (input.isHeld('attack')) startAttack();
      if (input.wasPressed('interact')) interact();
      if (pendingHit >= 0) { pendingHit -= dt; if (pendingHit < 0) resolveHit(); }

      // Lava burns anyone standing in it.
      const onLava = motion.grounded && world.biomeAt(s.pos.x, s.pos.z) === BIOME.LAVA;
      if (onLava) {
        s.health -= LAVA_DPS * dt; s.sinceHurt = 0;
        if (!lavaWarned) { hud.message(t('msgLava'), 1500); lavaWarned = true; hud.flashHurt(); }
        if (s.health <= 0) { s.health = 0; s.alive = false; }
      } else lavaWarned = false;

      const hit = enemies.update(dt, { pos: s.pos, alive: true }, world);
      if (hit.damage > 0) {
        character.flash(); hud.flashHurt();
        player.hurt(hit.damage, inventory.armor());
      }
    }

    // Death is handled in one place, whatever dealt the final blow (enemy, lava, fall).
    if (!s.alive) {
      if (!dying) {
        dying = true; deathTimer = 2.6;
        hud.message(t('msgDied'), 2400); character.setDead(true); input.held.clear();
        motion.speed = 0; motion.sprint = false;
      } else {
        enemies.update(dt, { pos: s.pos, alive: false }, world);
        deathTimer -= dt;
        if (deathTimer <= 0) { player.respawn(); character.setDead(false); dying = false; }
      }
    }

    character.root.position.copy(s.pos);
    character.root.rotation.y = s.yaw;
    character.update(dt, motion);

    playTime += dt;
    sinceSave += dt;
    if (sinceSave > AUTOSAVE_SECONDS) save(false);
  }

  function updateCamera(dt) {
    const s = player.state;
    camTarget.set(s.pos.x, s.pos.y + 1.45, s.pos.z);
    const cp = Math.cos(cam.pitch);
    camWant.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp).multiplyScalar(cam.dist).add(camTarget);
    // Keep the camera above the terrain and the water.
    const floor = Math.max(world.heightAt(camWant.x, camWant.z), 0) + 0.5;
    if (camWant.y < floor) camWant.y = floor;
    if (!cam.ready) { cam.pos.copy(camWant); cam.ready = true; }
    else cam.pos.lerp(camWant, 1 - Math.exp(-14 * dt));
    camera.position.copy(cam.pos);
    camera.lookAt(camTarget);
  }

  function updateHud() {
    const s = player.state;
    hud.setBars(s.health, s.healthMax, s.stamina, s.staminaMax);
    hud.drawMinimap(s.pos, s.yaw, enemies.list);
    const node = s.alive ? gatherer.nearest(s.pos) : null;
    hud.setPrompt(node ? `${t('gather')}: ${GATHER[node.kind].label[lang()] || GATHER[node.kind].label.en}` : null);
  }

  // Lowers the render resolution when the device cannot keep up, and recovers when it can.
  function adaptResolution(dt) {
    perf.acc += dt; perf.frames++;
    if (perf.acc < 2) return;
    const fps = perf.frames / perf.acc;
    perf.acc = 0; perf.frames = 0;
    if (fps < 28) { perf.slowFor++; perf.fastFor = 0; } else if (fps > 54) { perf.fastFor++; perf.slowFor = 0; } else { perf.slowFor = 0; perf.fastFor = 0; }
    if (perf.slowFor >= 2 && resolutionScale > 0.6) { resolutionScale = Math.max(0.6, resolutionScale - 0.15); applySize(); perf.slowFor = 0; }
    else if (perf.fastFor >= 4 && resolutionScale < 1) { resolutionScale = Math.min(1, resolutionScale + 0.1); applySize(); perf.fastFor = 0; }
    if (DEBUG) $('hud-debug').textContent = `${fps.toFixed(0)} fps | calls ${renderer.info.render.calls} | tris ${renderer.info.render.triangles} | scale ${resolutionScale.toFixed(2)} | ${quality.level}`;
  }

  function frame(now) {
    if (stopped) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - clock.last) / 1000);
    clock.last = now;
    if (document.hidden) return;
    clock.time += dt;

    if (!paused) update(dt);
    updateCamera(dt);
    sceneRenderer.update(paused ? 0 : dt, clock.time, player.state.pos);
    renderer.render(scene, camera);
    input.endFrame();

    if ((frameCount++ % 6) === 0) updateHud();
    adaptResolution(dt);
  }

  // ---------- Lifecycle ----------
  const onResize = () => applySize();
  const onVisibility = () => { if (document.hidden) save(false); else clock.last = performance.now(); };
  const onUnload = () => save(false);
  const onKey = (e) => {
    if (e.code === 'KeyI') hud.togglePanel('inventory');
    else if (e.code === 'KeyC') hud.togglePanel('crafting');
    else if (e.code === 'Escape') hud.togglePanel('pause');
  };
  window.addEventListener('resize', onResize);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('beforeunload', onUnload);
  window.addEventListener('keydown', onKey);

  function stop(exit = false) {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(raf);
    save(false);
    window.removeEventListener('resize', onResize);
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('beforeunload', onUnload);
    window.removeEventListener('keydown', onKey);
    hud.dispose();
    input.destroy();
    controls.destroy();
    enemies.dispose();
    sceneRenderer.dispose();
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    renderer.dispose();
    if (renderer.forceContextLoss) renderer.forceContextLoss();
    session = null;
    if (exit && onExit) onExit();
  }

  if (DEBUG) {
    $('hud-debug').classList.add('show');
    window.__chaos = { world, player, inventory, enemies, gatherer, scene, camera, renderer, input, hud, character, cam, save };
  }

  if (!saved) hud.message(t('startHint'), 6000);
  if (record.multiplayer) toast(t('mpNote'), 4500);
  updateHud();
  raf = requestAnimationFrame((now) => { clock.last = now; frame(now); });

  return { stop };
}
