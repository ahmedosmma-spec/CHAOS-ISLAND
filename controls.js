// On-screen controls: arrow buttons or a virtual joystick, with a layout editor.
// Positions are stored as fractions of the screen so layouts survive rotation.
import { storage } from '../core/storage.js';
import { showScreen, onEnter, toast } from '../core/screens.js';
import { t } from '../core/i18n.js';

const LAYOUT_KEY = 'controls:layout';

// Default placements (fractions of screen width / height, top-left corner).
const DEFAULTS = {
  arrows: {
    up:       { x: 0.10, y: 0.58 },
    left:     { x: 0.03, y: 0.72 },
    right:    { x: 0.17, y: 0.72 },
    down:     { x: 0.10, y: 0.86 },
    jump:     { x: 0.82, y: 0.78 },
    sprint:   { x: 0.70, y: 0.84 },
    attack:   { x: 0.82, y: 0.52 },
    interact: { x: 0.70, y: 0.66 }
  },
  joystick: {
    stick:    { x: 0.06, y: 0.66 },
    jump:     { x: 0.82, y: 0.78 },
    sprint:   { x: 0.70, y: 0.84 },
    attack:   { x: 0.82, y: 0.52 },
    interact: { x: 0.70, y: 0.66 }
  }
};

const LABELS = { up: '▲', down: '▼', left: '◀', right: '▶', jump: '⤒', sprint: '»', attack: '⚔', interact: 'E' };

// Persisted layout: { scheme, globalSize, items: { [scheme]: { [id]: {x, y, scale} } } }
export function loadLayout() {
  const saved = storage.get(LAYOUT_KEY, null);
  if (saved && saved.scheme) return saved;
  return { scheme: 'arrows', globalSize: 1, items: {} };
}

export function saveLayout(layout) {
  storage.set(LAYOUT_KEY, layout);
}

function positionOf(layout, scheme, id) {
  const saved = layout.items[scheme] && layout.items[scheme][id];
  const base = DEFAULTS[scheme][id];
  return saved || { x: base.x, y: base.y, scale: 1 };
}

/**
 * Creates the in-game control overlay bound to an input state object.
 */
export function createControlsLayer(layer, input) {
  let layout = loadLayout();
  let editing = false;
  let elements = [];

  function render() {
    layer.innerHTML = '';
    elements = [];
    const scheme = layout.scheme;
    const ids = Object.keys(DEFAULTS[scheme]);
    ids.forEach((id) => {
      const el = id === 'stick' ? buildStick(id) : buildButton(id);
      el.dataset.ctl = id;
      layer.appendChild(el);
      elements.push({ id, el });
    });
    applyPositions();
    setEditing(editing);
  }

  function applyPositions() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    elements.forEach(({ id, el }) => {
      const p = positionOf(layout, layout.scheme, id);
      const scale = (p.scale || 1) * layout.globalSize;
      el.style.left = `${p.x * W}px`;
      el.style.top = `${p.y * H}px`;
      el.style.transform = `scale(${scale})`;
      el.style.transformOrigin = 'top left';
    });
  }

  function buildButton(id) {
    const el = document.createElement('button');
    el.className = 'ctl ctl-btn';
    el.type = 'button';
    el.textContent = LABELS[id] || id;
    bindHold(el, (on) => input.setHeld(id, on));
    addEditHandlers(el, id);
    return el;
  }

  function buildStick(id) {
    const el = document.createElement('div');
    el.className = 'ctl ctl-joy';
    el.innerHTML = '<div class="knob"></div>';
    const knob = el.querySelector('.knob');
    let activePointer = null;
    const radius = 75;

    const move = (e) => {
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      let dx = e.clientX - cx;
      let dy = e.clientY - cy;
      const len = Math.hypot(dx, dy);
      if (len > radius) { dx = (dx / len) * radius; dy = (dy / len) * radius; }
      knob.style.left = `${47 + dx}px`;
      knob.style.top = `${47 + dy}px`;
      input.setStick(dx / radius, dy / radius);
    };
    const release = () => {
      activePointer = null;
      knob.style.left = '47px';
      knob.style.top = '47px';
      input.setStick(0, 0);
    };

    el.addEventListener('pointerdown', (e) => {
      if (editing) return;
      activePointer = e.pointerId;
      el.setPointerCapture(e.pointerId);
      move(e);
    });
    el.addEventListener('pointermove', (e) => { if (e.pointerId === activePointer) move(e); });
    el.addEventListener('pointerup', (e) => { if (e.pointerId === activePointer) release(); });
    el.addEventListener('pointercancel', release);
    addEditHandlers(el, id);
    return el;
  }

  // Press-and-hold behaviour for action and d-pad buttons.
  function bindHold(el, setOn) {
    el.addEventListener('pointerdown', (e) => {
      if (editing) return;
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      el.classList.add('active');
      setOn(true);
    });
    const end = () => { el.classList.remove('active'); setOn(false); };
    el.addEventListener('pointerup', (e) => { if (!editing) end(); });
    el.addEventListener('pointercancel', end);
    el.addEventListener('lostpointercapture', end);
  }

  // Edit mode: drag to move; the small corner grip resizes the control.
  function addEditHandlers(el, id) {
    let mode = null;
    let start = null;

    const grip = document.createElement('span');
    grip.className = 'ctl-grip';
    grip.style.cssText = 'position:absolute;right:-6px;bottom:-6px;width:18px;height:18px;border-radius:4px;background:var(--ember-hot);display:none;';
    el.appendChild(grip);

    el.addEventListener('pointerdown', (e) => {
      if (!editing) return;
      e.preventDefault();
      mode = e.target === grip ? 'resize' : 'move';
      const p = positionOf(layout, layout.scheme, id);
      start = { x: e.clientX, y: e.clientY, px: p.x, py: p.y, scale: p.scale || 1 };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      if (!editing || !mode) return;
      const W = window.innerWidth;
      const H = window.innerHeight;
      const current = positionOf(layout, layout.scheme, id);
      if (mode === 'move') {
        current.x = clamp(start.px + (e.clientX - start.x) / W, 0, 0.95);
        current.y = clamp(start.py + (e.clientY - start.y) / H, 0, 0.95);
      } else {
        const delta = (e.clientX - start.x + e.clientY - start.y) / 200;
        current.scale = clamp(start.scale + delta, 0.5, 2.2);
      }
      storeItem(id, current);
      applyPositions();
    });
    const endDrag = () => { mode = null; };
    el.addEventListener('pointerup', endDrag);
    el.addEventListener('pointercancel', endDrag);
    el._editGrip = grip;
  }

  // Every edit persists right away, so the settings screen never loads a stale layout.
  function storeItem(id, p) {
    layout.items[layout.scheme] = layout.items[layout.scheme] || {};
    layout.items[layout.scheme][id] = { x: p.x, y: p.y, scale: p.scale || 1 };
    saveLayout(layout);
  }

  function setEditing(on) {
    editing = on;
    elements.forEach(({ el }) => {
      el.classList.toggle('ctl-edit-outline', on);
      if (el._editGrip) el._editGrip.style.display = on ? 'block' : 'none';
      el.style.pointerEvents = on ? 'auto' : '';
    });
    if (on) input.held.clear();
  }

  window.addEventListener('resize', applyPositions);
  render();
  const destroy = () => { window.removeEventListener('resize', applyPositions); layer.innerHTML = ''; };

  return {
    show() { layer.style.display = ''; },
    hide() { layer.style.display = 'none'; input.held.clear(); input.move.x = 0; input.move.z = 0; },
    setEditing,
    destroy,
    rebuild(newLayout) { layout = newLayout || loadLayout(); render(); }
  };
}

function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

/**
 * Binds the Controls settings screen and the full-screen layout editor.
 * Every change is persisted immediately; "Save layout" just confirms it to the player.
 */
export function initControlSettings() {
  let layout = loadLayout();
  const scheme = document.getElementById('ctl-scheme');
  const size = document.getElementById('ctl-size');
  const paint = () => {
    scheme.querySelectorAll('button').forEach((b) => b.classList.toggle('selected', b.dataset.value === layout.scheme));
    size.value = String(layout.globalSize);
  };

  scheme.querySelectorAll('button').forEach((b) => {
    b.addEventListener('click', () => { layout.scheme = b.dataset.value; saveLayout(layout); paint(); });
  });
  size.addEventListener('input', () => { layout.globalSize = parseFloat(size.value); saveLayout(layout); });

  document.getElementById('ctl-edit').addEventListener('click', () => showScreen('controlEditor'));
  document.getElementById('ctl-save').addEventListener('click', () => { saveLayout(layout); toast(t('saveLayout') + ' \u2713'); });
  document.getElementById('ctl-reset').addEventListener('click', () => {
    layout = { scheme: layout.scheme, globalSize: 1, items: {} };
    saveLayout(layout);
    paint();
  });

  onEnter('controls', () => { layout = loadLayout(); paint(); });

  // ----- Full-screen editor -----
  // A dummy input: the editor never feeds the game, it only moves the on-screen controls.
  const dummyInput = { held: new Set(), move: { x: 0, z: 0 }, setHeld() {}, setStick() {} };
  let editor = null;
  onEnter('controlEditor', () => {
    if (editor) editor.destroy();
    editor = createControlsLayer(document.getElementById('editor-layer'), dummyInput);
    editor.setEditing(true);
  });
  document.getElementById('editor-back').addEventListener('click', () => {
    if (editor) { editor.destroy(); editor = null; }
    showScreen('controls');
  });
  document.getElementById('editor-reset').addEventListener('click', () => {
    const current = loadLayout();
    saveLayout({ scheme: current.scheme, globalSize: current.globalSize, items: {} });
    if (editor) { editor.rebuild(); editor.setEditing(true); }
  });

  paint();
}
