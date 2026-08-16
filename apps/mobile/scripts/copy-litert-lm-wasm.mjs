import { copyFile, mkdir, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(appRoot, 'node_modules/@litert-lm/core/wasm');
const outputRoot = resolve(appRoot, 'public/litert-lm/wasm');
const files = [
  'litertlm_wasm_compat_asyncify_internal.js',
  'litertlm_wasm_compat_asyncify_internal.wasm',
];

await mkdir(outputRoot, { recursive: true });

for (const file of files) {
  const source = resolve(sourceRoot, file);
  const destination = resolve(outputRoot, file);
  const sourceStat = await stat(source);
  await copyFile(source, destination);
  const destinationStat = await stat(destination);
  if (destinationStat.size !== sourceStat.size) {
    throw new Error(`LiteRT-LM runtime copy failed for ${file}`);
  }
}

console.log(`LiteRT-LM web runtime ready (${files.length} files).`);
