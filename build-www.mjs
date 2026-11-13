// Assembles the web bundle Capacitor packages into the APK: ./www
// Requires the local Three.js copy (run `npm run setup` first) so the app works offline.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'www');

if (!fs.existsSync(path.join(root, 'js', 'vendor', 'three.module.js'))) {
  console.error('Missing js/vendor/three.module.js. Run `npm run setup` before building.');
  process.exit(1);
}
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
for (const item of ['index.html', 'css', 'js', 'assets']) {
  if (fs.existsSync(path.join(root, item))) fs.cpSync(path.join(root, item), path.join(out, item), { recursive: true });
}
console.log('Built ./www (ready for `npx cap sync android`).');
