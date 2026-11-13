// In-game HUD: health/stamina bars, messages, interaction prompt, minimap,
// and the inventory, crafting and pause panels. All DOM; no game logic lives here.
import { t, getLanguage } from '../core/i18n.js';
import { ITEMS, itemName } from '../data/items.js';
import { RECIPES } from '../data/recipes.js';

const $ = (id) => document.getElementById(id);
const SLOTS = ['head', 'body', 'legs', 'accessory', 'weapon'];

/**
 * @param {object} ctx
 * @param {object} ctx.inventory
 * @param {(recipe: object) => void} ctx.onCraft
 * @param {(index: number) => void} ctx.onUseSlot      eat or equip the item in a bag slot
 * @param {(slot: string) => void} ctx.onUnequip
 * @param {{resume: Function, save: Function, quit: Function}} ctx.pause
 * @param {(open: boolean) => void} ctx.onPanelChange
 * @param {string} ctx.minimapUrl                        data URL of the island thumbnail
 * @param {object} ctx.world
 */
export function createHud(ctx) {
  const { inventory, world } = ctx;
  let openName = null;
  let selected = -1;
  let msgTimer = 0;
  const listeners = [];

  const on = (el, type, fn) => { el.addEventListener(type, fn); listeners.push(() => el.removeEventListener(type, fn)); };

  // ----- Static buttons -----
  on($('btn-pause'), 'click', () => togglePanel('pause'));
  on($('btn-inv'), 'click', () => togglePanel('inventory'));
  on($('btn-craft'), 'click', () => togglePanel('crafting'));

  // ----- Minimap -----
  const mapCanvas = $('minimap');
  const mapCtx = mapCanvas.getContext('2d');
  const mapImg = new Image();
  mapImg.src = ctx.minimapUrl;

  function drawMinimap(pos, yaw, enemies) {
    const W = mapCanvas.width;
    const k = W / (world.size * world.cell);
    mapCtx.clearRect(0, 0, W, W);
    mapCtx.save();
    mapCtx.beginPath();
    mapCtx.arc(W / 2, W / 2, W / 2 - 1, 0, Math.PI * 2);
    mapCtx.clip();
    if (mapImg.complete && mapImg.naturalWidth) mapCtx.drawImage(mapImg, 0, 0, W, W);
    else { mapCtx.fillStyle = '#101418'; mapCtx.fillRect(0, 0, W, W); }
    // Landmarks
    mapCtx.fillStyle = '#e9dcc4';
    for (const lm of world.landmarks) mapCtx.fillRect((lm.x + world.half) * k - 1.5, (lm.z + world.half) * k - 1.5, 3, 3);
    // Nearby enemies
    mapCtx.fillStyle = '#ff4a3a';
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.root.position.x - pos.x, dz = e.root.position.z - pos.z;
      if (dx * dx + dz * dz > 40 * 40) continue;
      mapCtx.beginPath();
      mapCtx.arc((e.root.position.x + world.half) * k, (e.root.position.z + world.half) * k, 2, 0, Math.PI * 2);
      mapCtx.fill();
    }
    // Player arrow
    const px = (pos.x + world.half) * k, pz = (pos.z + world.half) * k;
    mapCtx.translate(px, pz);
    mapCtx.rotate(-yaw + Math.PI);
    mapCtx.fillStyle = '#7dff9a';
    mapCtx.beginPath();
    mapCtx.moveTo(0, -6); mapCtx.lineTo(4.5, 5); mapCtx.lineTo(0, 2.5); mapCtx.lineTo(-4.5, 5);
    mapCtx.closePath();
    mapCtx.fill();
    mapCtx.restore();
  }

  // ----- Basic readouts -----
  function setBars(health, healthMax, stamina, staminaMax) {
    $('bar-health').style.width = `${Math.max(0, (health / healthMax) * 100)}%`;
    $('bar-stamina').style.width = `${Math.max(0, (stamina / staminaMax) * 100)}%`;
  }

  function message(text, ms = 1900) {
    const el = $('hud-msg');
    el.textContent = text;
    el.classList.add('show');
    clearTimeout(msgTimer);
    msgTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function setPrompt(text) {
    const el = $('hud-prompt');
    if (text) { el.textContent = text; el.classList.add('show'); }
    else el.classList.remove('show');
  }

  function flashHurt() {
    const el = $('hud-hurt');
    el.classList.remove('flash');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('flash');
  }

  // ----- Panels -----
  function togglePanel(name) {
    if (openName === name) closePanels();
    else openPanel(name);
  }

  function openPanel(name) {
    closePanels(true);
    openName = name;
    selected = -1;
    refresh();
    $(`panel-${name}`).classList.remove('hidden');
    ctx.onPanelChange(true);
  }

  function closePanels(silent = false) {
    ['inventory', 'crafting', 'pause'].forEach((n) => $(`panel-${n}`).classList.add('hidden'));
    const was = openName !== null;
    openName = null;
    if (!silent && was) ctx.onPanelChange(false);
  }

  function header(title) {
    const wrap = document.createElement('div');
    wrap.className = 'panel-head';
    const h = document.createElement('h2');
    h.textContent = title;
    const close = document.createElement('button');
    close.className = 'ghost-btn';
    close.textContent = t('close');
    close.addEventListener('click', () => closePanels());
    wrap.append(h, close);
    return wrap;
  }

  function refresh() {
    if (openName === 'inventory') renderInventory();
    else if (openName === 'crafting') renderCrafting();
    else if (openName === 'pause') renderPause();
  }

  function slotButton(label, sub, count, isSelected, onClick) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'slot' + (isSelected ? ' selected' : '');
    const a = document.createElement('span'); a.textContent = label;
    const c = document.createElement('span'); c.className = 'count'; c.textContent = count || '';
    b.append(a, c);
    if (sub) { const s = document.createElement('small'); s.textContent = sub; b.appendChild(s); }
    if (onClick) b.addEventListener('click', onClick);
    return b;
  }

  function renderInventory() {
    const p = $('panel-inventory');
    p.replaceChildren(header(t('inventory')));
    const lang = getLanguage();

    const eqTitle = document.createElement('h3'); eqTitle.className = 'section-label';
    eqTitle.textContent = `${t('equipment')} - ${t('armorValue')} ${inventory.armor()}`;
    p.appendChild(eqTitle);
    const eq = document.createElement('div'); eq.className = 'slots';
    SLOTS.forEach((slot) => {
      const id = inventory.equipped[slot];
      eq.appendChild(slotButton(id ? itemName(id, lang) : t('empty'), t(slot), '', false, id ? () => { ctx.onUnequip(slot); refresh(); } : null));
    });
    p.appendChild(eq);

    const bagTitle = document.createElement('h3'); bagTitle.className = 'section-label'; bagTitle.textContent = t('bag');
    p.appendChild(bagTitle);
    const grid = document.createElement('div'); grid.className = 'slots';
    inventory.bag.forEach((s, i) => {
      grid.appendChild(slotButton(s ? itemName(s.id, lang) : '', '', s && s.qty > 1 ? `x${s.qty}` : '', i === selected, s ? () => { selected = i; refresh(); } : null));
    });
    p.appendChild(grid);

    // Action row for the selected item
    const stack = selected >= 0 ? inventory.bag[selected] : null;
    if (stack) {
      const def = ITEMS[stack.id];
      const row = document.createElement('div'); row.className = 'row-buttons'; row.style.marginTop = '12px';
      const label = document.createElement('span'); label.textContent = itemName(stack.id, lang);
      row.appendChild(label);
      const canEat = def.kind === 'food';
      const canEquip = def.kind === 'weapon' || def.kind === 'armor';
      if (canEat || canEquip) {
        const act = document.createElement('button'); act.className = 'menu-btn';
        act.textContent = canEat ? t('eat') : t('equip');
        act.addEventListener('click', () => { ctx.onUseSlot(selected); if (!inventory.bag[selected]) selected = -1; refresh(); });
        row.appendChild(act);
      }
      p.appendChild(row);
    }
  }

  function renderCrafting() {
    const p = $('panel-crafting');
    p.replaceChildren(header(t('crafting')));
    const lang = getLanguage();
    RECIPES.forEach((r) => {
      const ok = inventory.hasAll(r.needs);
      const row = document.createElement('div');
      row.className = 'recipe' + (ok ? '' : ' locked');
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = `${itemName(r.out, lang)}${r.count > 1 ? ` x${r.count}` : ''}`;
      const needs = document.createElement('div');
      needs.style.fontSize = '12px';
      needs.textContent = `${t('needs')}: ` + Object.entries(r.needs).map(([id, n]) => `${itemName(id, lang)} ${Math.min(inventory.count(id), n)}/${n}`).join(' · ');
      info.append(name, needs);
      const btn = document.createElement('button');
      btn.className = 'menu-btn'; btn.style.width = 'auto'; btn.textContent = t('craftBtn');
      btn.disabled = !ok;
      btn.addEventListener('click', () => { ctx.onCraft(r); refresh(); });
      row.append(info, btn);
      p.appendChild(row);
    });
  }

  function renderPause() {
    const p = $('panel-pause');
    p.replaceChildren(header(t('pause')));
    const col = document.createElement('div');
    col.className = 'settings-list';
    [[t('resume'), () => closePanels()], [t('saveGame'), () => ctx.pause.save()], [t('quitToMenu'), () => ctx.pause.quit()]].forEach(([label, fn]) => {
      const b = document.createElement('button'); b.className = 'menu-btn'; b.textContent = label;
      b.addEventListener('click', fn);
      col.appendChild(b);
    });
    p.appendChild(col);
  }

  return {
    setBars, message, setPrompt, flashHurt, drawMinimap, openPanel, closePanels, togglePanel, refresh,
    isPanelOpen: () => openName !== null,
    dispose() {
      listeners.forEach((off) => off());
      closePanels(true);
      clearTimeout(msgTimer);
      $('hud-msg').classList.remove('show');
      setPrompt(null);
    }
  };
}
