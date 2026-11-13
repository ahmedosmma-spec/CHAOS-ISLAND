// Saves world records locally. Terrain is not stored: each world is regenerated
// from its seed, so saves stay small. Only settings, identity and player progress are kept.
import { storage } from '../core/storage.js';
import { randomSeed } from '../core/random.js';

const INDEX_KEY = 'worlds:index';
const worldKey = (id) => `worlds:${id}`;

function readIndex() {
  return storage.get(INDEX_KEY, []);
}

function writeIndex(ids) {
  storage.set(INDEX_KEY, ids);
}

function newId() {
  return `w${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;
}

export const worldStore = {
  list() {
    return readIndex()
      .map((id) => storage.get(worldKey(id)))
      .filter(Boolean)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },

  get(id) {
    return storage.get(worldKey(id));
  },

  /** Creates a new world record. `thumb` is an optional data URL preview. */
  create({ name, type, difficulty, multiplayer, seed, thumb }) {
    const now = Date.now();
    const record = {
      id: newId(),
      name: (name || '').trim() || 'Untitled Island',
      type,
      difficulty,
      multiplayer: !!multiplayer,
      seed: seed === '' || seed === undefined || seed === null ? randomSeed() : seed,
      thumb: thumb || null,
      createdAt: now,
      updatedAt: now,
      progress: null // filled in by the game when the player saves
    };
    storage.set(worldKey(record.id), record);
    writeIndex([...readIndex(), record.id]);
    return record;
  },

  saveProgress(id, progress) {
    const record = this.get(id);
    if (!record) return false;
    record.progress = progress;
    record.updatedAt = Date.now();
    return storage.set(worldKey(id), record);
  },

  remove(id) {
    storage.remove(worldKey(id));
    writeIndex(readIndex().filter((x) => x !== id));
  }
};
