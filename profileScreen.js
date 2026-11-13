// Profile screen: player name and skin customization. Items unlock by crafting armor.
import { t, getLanguage } from '../core/i18n.js';
import { onEnter, toast } from '../core/screens.js';
import { profile, randomUsername } from '../core/profile.js';
import { SKIN_ITEMS } from '../data/skins.js';
import { renderProfileChip } from './menu.js';

let preview = null; // { dispose, refresh } once the 3D preview is created

export function initProfileScreen() {
  const input = document.getElementById('profile-input');

  onEnter('profile', () => {
    input.value = profile.get().name;
    renderItems();
    showPreview();
  });

  document.getElementById('profile-random').addEventListener('click', () => {
    input.value = randomUsername();
  });

  document.getElementById('profile-save').addEventListener('click', () => {
    profile.setName(input.value);
    renderProfileChip();
    toast(t('save') + ' ✓');
  });
}

function slotLabel(slot) {
  return { head: '⛑', body: '🧥', legs: '👖', accessory: '📿' }[slot] || '';
}

function renderItems() {
  const wrap = document.getElementById('skin-items');
  wrap.innerHTML = '';
  const p = profile.get();
  const unlocked = new Set(p.unlocked || []);
  const lang = getLanguage();

  SKIN_ITEMS.forEach((item) => {
    const isUnlocked = unlocked.has(item.id);
    const isEquipped = p.skin && p.skin[item.slot] === item.id;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'skin-item' + (isEquipped ? ' equipped' : '');
    el.disabled = !isUnlocked;
    el.style.opacity = isUnlocked ? '1' : '0.4';
    el.innerHTML = '<span class="swatch"></span><span class="label"></span><span class="state"></span>';
    el.querySelector('.swatch').style.background = item.color;
    el.querySelector('.label').textContent = `${slotLabel(item.slot)} ${item.name[lang] || item.name.en}`;
    el.querySelector('.state').textContent = isEquipped ? t('equipped') : isUnlocked ? t('equip') : '🔒';
    el.addEventListener('click', () => {
      profile.equip(item.id);
      renderItems();
      renderProfileChip();
      if (preview) preview.refresh();
    });
    wrap.appendChild(el);
  });
}

// Small turntable preview of the humanoid wearing the equipped skin.
async function showPreview() {
  const host = document.getElementById('skin-preview');
  if (preview) { preview.refresh(); return; }
  try {
    const THREE = await import('three');
    const { createHumanoid } = await import('../game/character.js');

    const canvas = document.createElement('canvas');
    canvas.width = 280; canvas.height = 280;
    canvas.style.cssText = 'width:100%;height:100%;display:block';
    host.innerHTML = '';
    host.appendChild(canvas);

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(1);
    renderer.setSize(280, 280, false);
    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffe0c0, 0x201018, 1.6));
    const key = new THREE.DirectionalLight(0xffffff, 1.2);
    key.position.set(2, 3, 4);
    scene.add(key);

    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
    cam.position.set(0, 1.1, 4.4);
    cam.lookAt(0, 0.95, 0);

    const hero = createHumanoid();
    scene.add(hero.root);
    const refresh = () => hero.setEquipment(profile.skin());
    refresh();

    let raf = 0;
    const loop = () => {
      // Stop drawing while the profile screen is hidden.
      if (document.getElementById('screen-profile').classList.contains('active')) {
        hero.root.rotation.y += 0.01;
        hero.update(0.016, { speed: 0 });
        renderer.render(scene, cam);
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    preview = { refresh, dispose: () => { cancelAnimationFrame(raf); renderer.dispose(); } };
  } catch (err) {
    console.warn('Skin preview unavailable', err);
    host.textContent = '';
  }
}
