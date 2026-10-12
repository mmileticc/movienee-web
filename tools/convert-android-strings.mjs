// Converts the Android app's string resources into Transloco JSON files, so the web app uses the
// same texts and translations.
//
//   node tools/convert-android-strings.mjs <android res dir> [output dir]
//   node tools/convert-android-strings.mjs ../MovieLens/app/src/main/res public/i18n
//
// values/strings.xml -> sr.json, values-en/strings.xml -> en.json. Keys keep the Android names.
// Web-only texts live in i18n-web/<lang>.json and are merged on top, so re-running keeps them.
// Placeholders: %1$s / %2$d / %1$.0f -> {{p1}} / {{p2}} (Transloco interpolation), %% -> %.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const [resDir, outDir = 'public/i18n'] = process.argv.slice(2);
if (!resDir) {
  console.error('Usage: node tools/convert-android-strings.mjs <android res dir> [output dir]');
  process.exit(1);
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };

function convertValue(raw) {
  let text = raw.trim();
  // A value fully wrapped in double quotes keeps its whitespace in Android; drop the quotes.
  if (text.startsWith('"') && text.endsWith('"') && text.length > 1) text = text.slice(1, -1);
  text = text.replace(/&(amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m]);
  text = text.replace(/\\n/g, '\n').replace(/\\t/g, '\t').replace(/\\(['"@?\\])/g, '$1');
  text = text.replace(/%(\d+)\$[-#+ 0,(]*\d*(?:\.\d+)?[sdf]/g, (_, n) => `{{p${n}}}`);
  text = text.replace(/%%/g, '%');
  return text;
}

function convertFile(path) {
  const xml = readFileSync(path, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  const result = {};
  for (const match of xml.matchAll(/<string\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/string>/g)) {
    result[match[1]] = convertValue(match[2]);
  }
  return result;
}

mkdirSync(outDir, { recursive: true });
for (const [folder, lang] of [['values', 'sr'], ['values-en', 'en']]) {
  const webOnlyPath = join('i18n-web', `${lang}.json`);
  const webOnly = existsSync(webOnlyPath) ? JSON.parse(readFileSync(webOnlyPath, 'utf8')) : {};
  const strings = { ...convertFile(join(resDir, folder, 'strings.xml')), ...webOnly };
  const sorted = Object.fromEntries(Object.entries(strings).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(join(outDir, `${lang}.json`), JSON.stringify(sorted, null, 2) + '\n');
  console.log(`${lang}.json: ${Object.keys(sorted).length} strings`);
}
