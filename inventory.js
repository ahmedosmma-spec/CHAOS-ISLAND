// Bag (24 slots) and equipment (head, body, legs, accessory, weapon).
// The player starts with an empty bag and nothing equipped.
import { ITEMS } from '../data/items.js';

export const BAG_SIZE = 24;
const EQUIP_SLOTS = ['head', 'body', 'legs', 'accessory', 'weapon'];

export function createInventory(saved = null) {
  const bag = saved && saved.bag ? saved.bag.slice(0, BAG_SIZE) : new Array(BAG_SIZE).fill(null);
  while (bag.length < BAG_SIZE) bag.push(null);
  const equipped = { head: null, body: null, legs: null, accessory: null, weapon: null };
  if (saved && saved.equipped) Object.assign(equipped, saved.equipped);

  return {
    bag,
    equipped,

    count(id) {
      let n = 0;
      for (const s of bag) if (s && s.id === id) n += s.qty;
      return n;
    },

    /** True if `qty` of an item would fit (existing stacks plus empty slots). */
    canAdd(id, qty = 1) {
      const def = ITEMS[id];
      if (!def) return false;
      let room = 0;
      for (const s of bag) room += s ? (s.id === id ? def.stack - s.qty : 0) : def.stack;
      return room >= qty;
    },

    /** Adds items, stacking where allowed. Returns how many could NOT be added. */
    add(id, qty = 1) {
      const def = ITEMS[id];
      if (!def) return qty;
      let left = qty;
      // Top up existing stacks first.
      for (const s of bag) {
        if (left <= 0) break;
        if (s && s.id === id && s.qty < def.stack) {
          const put = Math.min(def.stack - s.qty, left);
          s.qty += put;
          left -= put;
        }
      }
      // Then fill empty slots.
      for (let i = 0; i < bag.length && left > 0; i++) {
        if (!bag[i]) {
          const put = Math.min(def.stack, left);
          bag[i] = { id, qty: put, durability: def.durability || null };
          left -= put;
        }
      }
      return left;
    },

    /** Removes `qty` of an item from anywhere in the bag. Returns true if removed. */
    remove(id, qty = 1) {
      if (this.count(id) < qty) return false;
      let left = qty;
      for (let i = 0; i < bag.length && left > 0; i++) {
        const s = bag[i];
        if (s && s.id === id) {
          const take = Math.min(s.qty, left);
          s.qty -= take;
          left -= take;
          if (s.qty <= 0) bag[i] = null;
        }
      }
      return true;
    },

    /** Checks and consumes a recipe-style requirement map. */
    hasAll(needs) {
      return Object.entries(needs).every(([id, n]) => this.count(id) >= n);
    },

    consumeAll(needs) {
      if (!this.hasAll(needs)) return false;
      Object.entries(needs).forEach(([id, n]) => this.remove(id, n));
      return true;
    },

    /** Moves a bag item into its equipment slot (armor or weapon). */
    equip(index) {
      const s = bag[index];
      if (!s) return false;
      const def = ITEMS[s.id];
      if (!def) return false;
      const slot = def.kind === 'weapon' ? 'weapon' : def.kind === 'armor' ? def.slot : null;
      if (!slot || !EQUIP_SLOTS.includes(slot)) return false;
      const previous = equipped[slot];
      equipped[slot] = s.id;
      bag[index] = previous ? { id: previous, qty: 1, durability: ITEMS[previous].durability || null } : null;
      return true;
    },

    /** Moves an equipped item back to the bag. */
    unequip(slot) {
      const id = equipped[slot];
      if (!id) return false;
      if (this.add(id, 1) > 0) return false; // bag full
      equipped[slot] = null;
      return true;
    },

    /** Total armor value from equipped pieces. */
    armor() {
      return EQUIP_SLOTS.reduce((sum, slot) => {
        const id = equipped[slot];
        return sum + (id && ITEMS[id] && ITEMS[id].armor ? ITEMS[id].armor : 0);
      }, 0);
    },

    weaponDamage() {
      const id = equipped.weapon;
      return id && ITEMS[id] && ITEMS[id].damage ? ITEMS[id].damage : 3; // bare fists
    },

    serialize() {
      return { bag: bag.map((s) => (s ? { ...s } : null)), equipped: { ...equipped } };
    }
  };
}
