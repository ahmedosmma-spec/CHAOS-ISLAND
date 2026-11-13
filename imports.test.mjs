// Verifies every relative import resolves to a file and every named import is exported there.
import fs from 'node:fs';
import path from 'node:path';

const root = new URL('../js/', import.meta.url).pathname;
const files = [];
(function walk(d) { for (const f of fs.readdirSync(d, { withFileTypes: true })) f.isDirectory() ? walk(path.join(d, f.name)) : f.name.endsWith('.js') && files.push(path.join(d, f.name)); })(root);

function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/export\s+(?:async\s+)?(?:function\*?|const|let|class)\s+([A-Za-z0-9_$]+)/g)) names.add(m[1]);
  for (const m of src.matchAll(/export\s*\{([^}]+)\}/g)) m[1].split(',').forEach((n) => names.add(n.trim().split(/\s+as\s+/).pop()));
  return names;
}

let bad = 0;
for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  for (const m of src.matchAll(/import\s+(?:\*\s+as\s+\w+|\{([^}]*)\}|\w+)\s+from\s+'([^']+)'/g)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue;
    const target = path.resolve(path.dirname(file), spec);
    if (!fs.existsSync(target)) { console.log(`MISSING FILE  ${path.relative(root, file)} -> ${spec}`); bad++; continue; }
    if (m[1]) {
      const have = exportsOf(fs.readFileSync(target, 'utf8'));
      for (const n of m[1].split(',').map((x) => x.trim().split(/\s+as\s+/)[0]).filter(Boolean)) {
        if (!have.has(n)) { console.log(`MISSING EXPORT ${path.relative(root, file)} imports { ${n} } from ${spec}`); bad++; }
      }
    }
  }
  for (const m of src.matchAll(/import\('([^']+)'\)/g)) {
    if (m[1].startsWith('.') && !fs.existsSync(path.resolve(path.dirname(file), m[1]))) { console.log(`MISSING DYNAMIC ${path.relative(root, file)} -> ${m[1]}`); bad++; }
  }
}
console.log(`${files.length} modules checked, ${bad} problem(s)`);
process.exit(bad ? 1 : 0);
