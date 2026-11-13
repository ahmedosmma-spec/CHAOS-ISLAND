// Entry point: studio splash -> main menu -> world creation / game.
import { applyDocumentLanguage, translateDom, t } from './core/i18n.js';
import { showScreen, wireNavigation, toast } from './core/screens.js';
import { initMenu } from './ui/menu.js';
import { initControlSettings } from './ui/controls.js';
import { initProfileScreen } from './ui/profileScreen.js';

const SPLASH_MS = 2600;

// Surface unexpected errors on screen: invaluable on a phone with no dev console.
function showError(message) {
  const box = document.getElementById('error-overlay');
  if (!box) return;
  box.hidden = false;
  box.textContent = String(message).slice(0, 600);
  box.onclick = () => { box.hidden = true; };
}
window.addEventListener('error', (e) => showError(`${e.message}\n${e.filename || ''}:${e.lineno || ''}`));
window.addEventListener('unhandledrejection', (e) => showError(e.reason && e.reason.stack ? e.reason.stack : e.reason));

applyDocumentLanguage();
translateDom();
wireNavigation();

initMenu({ onPlay: startGame });
initControlSettings();
initProfileScreen();

// The splash plays once, then the menu. Tapping it skips ahead.
let splashDone = false;
function finishSplash() {
  if (splashDone) return;
  splashDone = true;
  showScreen('menu');
}
document.getElementById('screen-splash').addEventListener('click', finishSplash);
setTimeout(finishSplash, SPLASH_MS);

/**
 * Starts a saved world. The game module (and Three.js) load on demand so the menu stays
 * light on low-end phones.
 */
async function startGame(record) {
  try {
    const { runGame } = await import('./game/game.js');
    await runGame(record, { onExit: () => showScreen('menu') });
  } catch (err) {
    console.error(err);
    showScreen('menu');
    toast(t('worldLoadError'), 4000);
    showError(err && err.stack ? err.stack : err);
  }
}

// Re-translate dynamic text whenever the language changes.
document.addEventListener('visibilitychange', () => {
  window.dispatchEvent(new CustomEvent('app-visibility', { detail: { hidden: document.hidden } }));
});
