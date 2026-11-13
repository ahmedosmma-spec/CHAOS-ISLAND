// Main menu, world creation, multiplayer (LAN prototype), other worlds, settings.
import { t, setLanguage, getLanguage } from '../core/i18n.js';
import { showScreen, onEnter } from '../core/screens.js';
import { profile } from '../core/profile.js';
import { worldStore } from '../world/worldStore.js';
import { generateWorld, renderThumbnail } from '../world/worldgen.js';
import { randomSeed } from '../core/random.js';
import { lanDiscovery } from '../net/lan.js';
import { getQualityLevel, setQualityLevel } from '../core/quality.js';

// Form state for the world creation screen.
const draft = { type: 'forest', difficulty: 'normal', multiplayer: false };

/**
 * @param {object} handlers
 * @param {(record: object) => void} handlers.onPlay  called with a saved world record
 */
export function initMenu({ onPlay }) {
  setPlayHandler(onPlay);
  renderProfileChip();

  document.getElementById('btn-profile').addEventListener('click', () => showScreen('profile'));

  onEnter('menu', renderProfileChip);
  onEnter('create', resetCreateForm);
  onEnter('multiplayer', renderLanList);
  onEnter('otherWorlds', renderSavedList);
  onEnter('settings', syncSettings);

  wireCreateForm(onPlay);
  wireSettings();
}

// ---------- Profile chip ----------

export function renderProfileChip() {
  const p = profile.get();
  document.getElementById('profile-name').textContent = p.name;
  const icon = document.getElementById('profile-skin');
  // Icon tint reflects the equipped body item, so the skin shows at a glance.
  const bodyId = p.skin && p.skin.body;
  icon.style.borderColor = bodyId ? '#8ff0a4' : '';
}

// ---------- World creation ----------

function resetCreateForm() {
  document.getElementById('world-name').value = '';
  draft.type = 'forest';
  draft.difficulty = 'normal';
  draft.multiplayer = false;
  paintCreateForm();
}

function paintCreateForm() {
  document.querySelectorAll('#world-island .island-card').forEach((el) => {
    el.classList.toggle('selected', el.dataset.value === draft.type);
  });
  document.querySelectorAll('#world-difficulty button').forEach((el) => {
    el.classList.toggle('selected', el.dataset.value === draft.difficulty);
  });
  const toggle = document.getElementById('world-multiplayer');
  toggle.setAttribute('aria-pressed', String(draft.multiplayer));
  toggle.textContent = draft.multiplayer ? t('on') : t('off');
}

function wireCreateForm(onPlay) {
  document.querySelectorAll('#world-island .island-card').forEach((el) => {
    el.addEventListener('click', () => { draft.type = el.dataset.value; paintCreateForm(); });
  });
  document.querySelectorAll('#world-difficulty button').forEach((el) => {
    el.addEventListener('click', () => { draft.difficulty = el.dataset.value; paintCreateForm(); });
  });
  document.getElementById('world-multiplayer').addEventListener('click', () => {
    draft.multiplayer = !draft.multiplayer;
    paintCreateForm();
  });

  document.getElementById('btn-world-play').addEventListener('click', () => {
    const name = document.getElementById('world-name').value.trim();
    // Every new world gets its own random seed, so no two worlds share a layout.
    // The thumbnail is rendered from the same generator output the game will use.
    const seed = randomSeed();
    const preview = generateWorld({ seed, type: draft.type, difficulty: draft.difficulty });
    const record = worldStore.create({
      name: name || t(draft.type),
      type: draft.type,
      difficulty: draft.difficulty,
      multiplayer: draft.multiplayer,
      seed,
      thumb: renderThumbnail(preview, 96)
    });
    onPlay(record);
  });
}

// ---------- Multiplayer (LAN prototype) ----------

async function renderLanList() {
  const list = document.getElementById('lan-list');
  list.innerHTML = '';
  const hosts = await lanDiscovery.scan();
  if (!hosts.length) {
    list.appendChild(emptyNote(t('noLanWorlds')));
    return;
  }
  hosts.forEach((h) => {
    const card = document.createElement('div');
    card.className = 'world-card';
    card.innerHTML = `
      <img class="world-thumb" alt="" />
      <div class="world-info">
        <h3></h3>
        <p></p>
      </div>`;
    card.querySelector('img').src = h.thumb || '';
    card.querySelector('h3').textContent = h.name;
    card.querySelector('p').textContent = `${h.playerCount} ${t('players')} · ${h.host} (${h.source})`;
    list.appendChild(card);
  });
}

// ---------- Other worlds (saved locally) ----------

function renderSavedList() {
  const list = document.getElementById('saved-list');
  list.innerHTML = '';
  const worlds = worldStore.list();
  if (!worlds.length) {
    list.appendChild(emptyNote(t('noWorlds')));
    return;
  }
  worlds.forEach((w) => {
    const card = document.createElement('div');
    card.className = 'world-card';
    card.innerHTML = `
      <img class="world-thumb" alt="" />
      <div class="world-info">
        <h3></h3>
        <p></p>
      </div>
      <div class="world-actions">
        <button class="menu-btn" data-act="load"></button>
        <button class="ghost-btn" data-act="delete"></button>
      </div>`;
    card.querySelector('img').src = w.thumb || '';
    card.querySelector('h3').textContent = w.name;
    card.querySelector('p').textContent = `${t(w.type)} · ${t(w.difficulty)}${w.multiplayer ? ' · ' + t('multiplayerToggle') : ''}`;
    card.querySelector('[data-act="load"]').textContent = t('load');
    card.querySelector('[data-act="delete"]').textContent = t('delete');
    card.querySelector('[data-act="load"]').addEventListener('click', () => {
      loadWorldAndPlay(w.id);
    });
    card.querySelector('[data-act="delete"]').addEventListener('click', () => {
      if (window.confirm(t('confirmDelete'))) {
        worldStore.remove(w.id);
        renderSavedList();
      }
    });
    list.appendChild(card);
  });
}

let playHandler = null;
function loadWorldAndPlay(id) {
  const record = worldStore.get(id);
  if (record && playHandler) playHandler(record);
}

function emptyNote(text) {
  const p = document.createElement('p');
  p.className = 'empty';
  p.textContent = text;
  return p;
}

// ---------- Settings ----------

function syncSettings() {
  paintSegment('set-language', getLanguage());
  paintSegment('set-quality', getQualityLevel());
}

function paintSegment(id, value) {
  document.querySelectorAll(`#${id} button`).forEach((el) => {
    el.classList.toggle('selected', el.dataset.value === value);
  });
}

function wireSettings() {
  document.querySelectorAll('#set-quality button').forEach((el) => {
    el.addEventListener('click', () => {
      setQualityLevel(el.dataset.value);
      paintSegment('set-quality', el.dataset.value);
    });
  });
  document.querySelectorAll('#set-language button').forEach((el) => {
    el.addEventListener('click', () => {
      setLanguage(el.dataset.value);
      paintSegment('set-language', el.dataset.value);
      // Re-render any text that is built in JavaScript.
      paintCreateForm();
      renderProfileChip();
    });
  });
}

// Lets main.js hand the game-start callback to the menu's Other Worlds list.
function setPlayHandler(fn) {
  playHandler = fn;
}
