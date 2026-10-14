// Fails when the app uses a Material Symbols icon that is missing from the subset font requested in
// src/index.html (`icon_names=`), which would otherwise show the icon's name as plain text.
// Usage: node tools/check-icons.mjs
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync('src/index.html', 'utf8');
const listed = html.match(/icon_names=([a-z0-9_,]+)/)?.[1]?.split(',') ?? [];
if (listed.length === 0) fail('No icon_names= list found in src/index.html.');
const sorted = [...listed].sort();
if (listed.join() !== sorted.join()) fail('icon_names must be in alphabetical order.');

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|html)$/.test(name) && !name.endsWith('.spec.ts')) files.push(path);
  }
})('src/app');

const used = new Map();
const add = (icon, file) => used.set(icon, used.get(icon) ?? file);
for (const file of files) {
  const source = readFileSync(file, 'utf8');
  // <span class="icon ...">name</span> and the string literals of {{ a ? 'x' : 'y' }} in such a span.
  // Only the results of a ternary count, not the values it compares (`mode() === 'grid' ? ...`).
  for (const [, body] of source.matchAll(
    /class="(?:[^"]*\s)?icon(?:\s[^"]*)?"[^>]*>([\s\S]*?)<\/span/g,
  )) {
    const plain = body.trim().match(/^[a-z0-9_]+$/);
    if (plain) add(plain[0], file);
    for (const [, literal] of body.matchAll(/[?:]\s*'([a-z0-9_]+)'/g)) add(literal, file);
  }
  // icon="name" inputs and `icon: 'name'` in code (navigation items, notifications).
  for (const [, icon] of source.matchAll(/\bicon="([a-z0-9_]+)"/g)) add(icon, file);
  for (const [, icon] of source.matchAll(/\bicon:\s*'([a-z0-9_]+)'/g)) add(icon, file);
  // Maps of option -> icon, e.g. { dark: 'dark_mode' }[option] in icon computeds.
  for (const [, map] of source.matchAll(/[iI]con\w*\s*=\s*computed\([\s\S]*?\{([^}]*)\}/g))
    for (const [, literal] of map.matchAll(/'([a-z0-9_]+)'/g)) add(literal, file);
}

const missing = [...used].filter(([icon]) => !listed.includes(icon));
if (missing.length > 0) {
  fail(
    'Icons missing from icon_names in src/index.html:\n' +
      missing.map(([icon, file]) => `  ${icon} (${file})`).join('\n'),
  );
}
console.log(`Icons OK: ${used.size} used, ${listed.length} in the font.`);

function fail(message) {
  console.error(message);
  process.exit(1);
}
