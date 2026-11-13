// Local persistence wrapper. All keys are namespaced so they never clash.
// Works with localStorage; falls back to memory if storage is blocked
// (private mode, some WebViews). Capacitor can swap this for native storage later.
const PREFIX = 'chaos-island:';
const memory = new Map();

function available() {
  try {
    const probe = '__probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

const hasLocal = available();

export const storage = {
  get(key, fallback = null) {
    const full = PREFIX + key;
    try {
      const raw = hasLocal ? window.localStorage.getItem(full) : memory.get(full);
      if (raw === null || raw === undefined) return fallback;
      return JSON.parse(raw);
    } catch {
      return fallback;
    }
  },

  set(key, value) {
    const full = PREFIX + key;
    const raw = JSON.stringify(value);
    try {
      if (hasLocal) window.localStorage.setItem(full, raw);
      else memory.set(full, raw);
      return true;
    } catch {
      memory.set(full, raw);
      return false;
    }
  },

  remove(key) {
    const full = PREFIX + key;
    if (hasLocal) window.localStorage.removeItem(full);
    memory.delete(full);
  },

  // Returns every key (without prefix) that starts with the given prefix.
  keys(startsWith = '') {
    const out = [];
    if (hasLocal) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(PREFIX + startsWith)) out.push(k.slice(PREFIX.length));
      }
    } else {
      for (const k of memory.keys()) {
        if (k.startsWith(PREFIX + startsWith)) out.push(k.slice(PREFIX.length));
      }
    }
    return out;
  }
};
