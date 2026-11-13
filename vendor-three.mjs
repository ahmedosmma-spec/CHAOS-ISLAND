// Copies Three.js (installed by `npm install`) into js/vendor/ so the game runs fully offline
// and can be packaged into an Android APK. index.html prefers this local copy over the CDN.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = path.join(root, 'node_modules', 'three', 'build', 'three.module.js');
const dest = path.join(root, 'js', 'vendor', 'three.module.js');

if (!fs.existsSync(src)) {
  console.error('three is not installed. Run `npm install` first.');
  process.exit(1);
}
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log(`Copied Three.js to ${path.relative(root, dest)}`);
