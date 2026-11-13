// Screen navigation. Each <section id="screen-NAME"> is one screen.
const listeners = new Map();
let current = null;

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  const el = document.getElementById(`screen-${name}`);
  if (!el) {
    console.warn(`Unknown screen: ${name}`);
    return;
  }
  el.classList.add('active');
  current = name;
  const fn = listeners.get(name);
  if (fn) fn();
}

export function currentScreen() {
  return current;
}

// Runs `fn` each time the named screen is shown.
export function onEnter(name, fn) {
  listeners.set(name, fn);
}

// Wires every [data-go] button to navigate to the screen it names.
export function wireNavigation(root = document) {
  root.querySelectorAll('[data-go]').forEach((btn) => {
    btn.addEventListener('click', () => showScreen(btn.dataset.go));
  });
}

// Lightweight toast used across screens.
export function toast(message, ms = 2200) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'hud-msg';
    el.style.zIndex = '999';
    el.style.top = 'auto';
    el.style.bottom = '90px';
    document.getElementById('app').appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), ms);
}
