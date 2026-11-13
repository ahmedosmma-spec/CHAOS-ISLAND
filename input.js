// Unified input state. Touch controls and the keyboard both write into this object,
// so gameplay code never needs to know which device is in use.
export function createInput() {
  const state = {
    move: { x: 0, z: 0 },          // -1..1 on each axis (camera-relative later)
    held: new Set(),               // 'jump' | 'sprint' | 'attack' | 'interact' | 'up' | 'down' | 'left' | 'right'
    pressed: new Set(),            // edge-triggered this frame, cleared by endFrame()
    setHeld(name, on) {
      if (on) {
        if (!this.held.has(name)) this.pressed.add(name);
        this.held.add(name);
      } else {
        this.held.delete(name);
      }
    },
    isHeld(name) { return this.held.has(name); },
    wasPressed(name) { return this.pressed.has(name); },
    endFrame() { this.pressed.clear(); },
    setStick(x, z) { this.move.x = x; this.move.z = z; },
    // Combines d-pad buttons and stick into one movement vector.
    axes() {
      let x = this.move.x;
      let z = this.move.z;
      if (this.held.has('left')) x -= 1;
      if (this.held.has('right')) x += 1;
      if (this.held.has('up')) z -= 1;
      if (this.held.has('down')) z += 1;
      const len = Math.hypot(x, z);
      if (len > 1) { x /= len; z /= len; }
      return { x, z };
    }
  };

  state.destroy = attachKeyboard(state);
  return state;
}

const KEY_MAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  Space: 'jump',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
  KeyJ: 'attack', KeyF: 'interact', KeyE: 'interact'
};

// Desktop keyboard support. Ignored while typing in form fields.
function attachKeyboard(state) {
  const onKey = (down) => (e) => {
    const name = KEY_MAP[e.code];
    if (!name) return;
    if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;
    e.preventDefault();
    state.setHeld(name, down);
  };
  const down = onKey(true);
  const up = onKey(false);
  const blur = () => state.held.clear(); // release everything if focus leaves, so keys don't stick
  window.addEventListener('keydown', down);
  window.addEventListener('keyup', up);
  window.addEventListener('blur', blur);
  return () => {
    window.removeEventListener('keydown', down);
    window.removeEventListener('keyup', up);
    window.removeEventListener('blur', blur);
  };
}
