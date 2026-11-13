// Player identity: name and equipped skin. Stored locally.
import { storage } from './storage.js';
import { SKIN_ITEMS, DEFAULT_SKIN } from '../data/skins.js';

const PREFIX_WORDS = ['Ash', 'Ember', 'Grim', 'Hollow', 'Iron', 'Mire', 'Raven', 'Thorn', 'Vale', 'Wraith'];
const SUFFIX_WORDS = ['Walker', 'Shade', 'Wolf', 'Seeker', 'Warden', 'Drifter', 'Reaper', 'Hunter'];

export function randomUsername() {
  const a = PREFIX_WORDS[Math.floor(Math.random() * PREFIX_WORDS.length)];
  const b = SUFFIX_WORDS[Math.floor(Math.random() * SUFFIX_WORDS.length)];
  return `${a}${b}${Math.floor(Math.random() * 900) + 100}`;
}

export const profile = {
  get() {
    const saved = storage.get('profile', null);
    if (saved && saved.name) return saved;
    // First launch: generate a random name, keep it so it stays stable.
    const created = { name: randomUsername(), skin: { ...DEFAULT_SKIN } };
    storage.set('profile', created);
    return created;
  },

  setName(name) {
    const p = this.get();
    const clean = (name || '').trim().slice(0, 16);
    p.name = clean || randomUsername();
    storage.set('profile', p);
    return p;
  },

  // Skin items start locked. They unlock when the player crafts the matching item.
  unlocked() {
    return this.get().unlocked || [];
  },

  unlock(itemId) {
    const p = this.get();
    p.unlocked = p.unlocked || [];
    if (!p.unlocked.includes(itemId)) p.unlocked.push(itemId);
    storage.set('profile', p);
  },

  // Equips or removes a skin item. Only unlocked items can be equipped.
  // `slot` is head | body | legs | accessory.
  equip(itemId) {
    const item = SKIN_ITEMS.find((i) => i.id === itemId);
    const p = this.get();
    if (!item || !(p.unlocked || []).includes(item.id)) return p;
    p.skin = p.skin || { ...DEFAULT_SKIN };
    p.skin[item.slot] = p.skin[item.slot] === item.id ? null : item.id;
    storage.set('profile', p);
    return p;
  },

  skin() {
    return this.get().skin || { ...DEFAULT_SKIN };
  }
};
