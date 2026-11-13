// Player controller: third-person movement, running, jumping, health and stamina.
import * as THREE from 'three';

const WALK_SPEED = 4.2;
const SPRINT_SPEED = 7.4;
const GRAVITY = 24;
const JUMP_VELOCITY = 8.6;
const STAMINA_MAX = 100;
const STAMINA_DRAIN = 22;     // per second while sprinting
const STAMINA_REGEN = 16;     // per second when not sprinting
const STAMINA_JUMP = 12;
const HEALTH_MAX = 100;
const HEALTH_REGEN_DELAY = 6; // seconds without damage before regen starts
const HEALTH_REGEN = 1.5;     // per second once regen starts
const SEA_LEVEL = 0;
const WADE_LIMIT = -0.9;      // deeper than this is impassable (open sea)
const WADE_SLOW = 0.55;       // speed multiplier while standing in water
const BODY_RADIUS = 0.35;     // collision radius against trees and rocks

export function createPlayer(spawn, saved = null) {
  const state = {
    pos: new THREE.Vector3(spawn.x, spawn.y, spawn.z),
    vel: new THREE.Vector3(),
    yaw: 0,                  // facing direction (radians)
    onGround: true,
    health: saved && saved.health != null ? saved.health : HEALTH_MAX,
    stamina: saved && saved.stamina != null ? saved.stamina : STAMINA_MAX,
    healthMax: HEALTH_MAX,
    staminaMax: STAMINA_MAX,
    sinceHurt: 99,
    alive: true,
    spawn: { ...spawn }
  };

  const dir = new THREE.Vector3();

  /**
   * Advances the player one frame.
   * @param {number} dt
   * @param {object} input       unified input state (see input.js)
   * @param {number} camYaw      camera yaw so movement is relative to the view
   * @param {object} world       generated world (heightAt, isLand)
   * @returns {{ speed: number, sprint: boolean, grounded: boolean, vy: number }} motion for animation
   */
  function update(dt, input, camYaw, world) {
    const axes = input.axes();
    const wantsSprint = input.isHeld('sprint');
    const hasStamina = state.stamina > 1;
    const sprint = wantsSprint && hasStamina && (axes.x !== 0 || axes.z !== 0);

    // Camera-relative movement: forward is -z in camera space.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    dir.set(axes.x * cos + axes.z * sin, 0, -axes.x * sin + axes.z * cos);
    const inputLen = Math.min(1, Math.hypot(axes.x, axes.z));

    const inWater = world.heightAt(state.pos.x, state.pos.z) < SEA_LEVEL - 0.05;
    const speedTarget = (sprint ? SPRINT_SPEED : WALK_SPEED) * inputLen * (inWater ? WADE_SLOW : 1);

    // Horizontal velocity eases toward the target for a weighty feel.
    const accel = state.onGround ? 14 : 4;
    state.vel.x += (dir.x * speedTarget - state.vel.x) * Math.min(1, accel * dt);
    state.vel.z += (dir.z * speedTarget - state.vel.z) * Math.min(1, accel * dt);

    // Jump
    if (input.wasPressed('jump') && state.onGround && state.stamina > STAMINA_JUMP) {
      state.vel.y = JUMP_VELOCITY;
      state.onGround = false;
      state.stamina -= STAMINA_JUMP;
    }

    // Gravity
    state.vel.y -= GRAVITY * dt;

    // Integrate and block walking into deep water.
    const next = state.pos.clone().addScaledVector(state.vel, dt);
    const groundNext = world.heightAt(next.x, next.z);
    if (groundNext < WADE_LIMIT) {
      state.vel.x *= -0.2;
      state.vel.z *= -0.2;
      next.x = state.pos.x;
      next.z = state.pos.z;
    }

    // Solid scenery (trees, rocks, pillars) pushes the player aside.
    if (world.colliders) world.colliders.resolve(next, BODY_RADIUS);

    // Ground contact
    const ground = world.heightAt(next.x, next.z);
    // Snap to the ground when walking downhill so slopes do not trigger the falling pose.
    const wasOnGround = state.onGround;
    if (next.y <= ground || (wasOnGround && state.vel.y <= 0 && next.y - ground < 0.45)) {
      next.y = ground;
      state.vel.y = 0;
      state.onGround = true;
    } else {
      state.onGround = false;
    }
    state.pos.copy(next);

    // Facing follows movement direction
    const speed = Math.hypot(state.vel.x, state.vel.z);
    if (speed > 0.2) {
      const targetYaw = Math.atan2(state.vel.x, state.vel.z);
      state.yaw += shortestAngle(state.yaw, targetYaw) * Math.min(1, 12 * dt);
    }

    // Stamina
    if (sprint && speed > 0.5) state.stamina -= STAMINA_DRAIN * dt;
    else state.stamina += STAMINA_REGEN * dt;
    state.stamina = clamp(state.stamina, 0, STAMINA_MAX);

    // Health regen after a quiet period
    state.sinceHurt += dt;
    if (state.sinceHurt > HEALTH_REGEN_DELAY && state.health < HEALTH_MAX) {
      state.health = Math.min(HEALTH_MAX, state.health + HEALTH_REGEN * dt);
    }

    return { speed: Math.min(1, speed / SPRINT_SPEED), sprint, grounded: state.onGround, vy: state.vel.y, wading: inWater };
  }

  /** Applies damage after armor. Returns true if the player died. */
  function hurt(amount, armor = 0) {
    if (!state.alive) return false;
    const reduced = Math.max(1, amount - armor * 0.6);
    state.health -= reduced;
    state.sinceHurt = 0;
    if (state.health <= 0) {
      state.health = 0;
      state.alive = false;
      return true;
    }
    return false;
  }

  function heal(amount) {
    state.health = Math.min(HEALTH_MAX, state.health + amount);
  }

  function respawn() {
    state.pos.set(state.spawn.x, state.spawn.y, state.spawn.z);
    state.vel.set(0, 0, 0);
    state.health = HEALTH_MAX * 0.6;
    state.stamina = STAMINA_MAX;
    state.alive = true;
    state.sinceHurt = 0;
  }

  return { state, update, hurt, heal, respawn };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

// Smallest signed difference between two angles, in radians.
function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

export const PLAYER_CONSTANTS = { HEALTH_MAX, STAMINA_MAX };
