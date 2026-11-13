// LAN world discovery — PROTOTYPE.
// A browser cannot scan the local network directly. This module is the seam where a
// real discovery layer (native plugin via Capacitor, or a small LAN beacon service)
// will plug in later. Until then it only lists this device's multiplayer-flagged worlds
// and labels them clearly as prototype data. It never claims remote players exist.
import { worldStore } from '../world/worldStore.js';

export const lanDiscovery = {
  isLive: false,

  async scan() {
    return worldStore
      .list()
      .filter((w) => w.multiplayer)
      .map((w) => ({
        name: w.name,
        thumb: w.thumb,
        playerCount: 1, // only this device; no remote players in the prototype
        host: 'This device',
        source: 'prototype',
        worldId: w.id
      }));
  }
};
