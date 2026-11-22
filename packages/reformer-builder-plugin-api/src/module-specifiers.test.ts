/**
 * Относительные импорты внутри пакета обязаны нести расширение `.js`.
 *
 * Это не стиль, а условие работоспособности типов у потребителя. `vite-plugin-dts`
 * переносит спецификаторы в `dist/*.d.ts` как есть, и потребитель с
 * `moduleResolution: NodeNext` (умолчание для пакета с `"type": "module"`) такой импорт
 * не резолвит. Отказа при этом НЕ происходит: тип молча становится `any` — так и нашлось,
 * когда в CLI `manifest.provides` оказался `any` вместо `CapabilityDeclaration[]`.
 * Молчаливая потеря типов в пакете, который существует ради типов, — худший вид поломки:
 * автор плагина узнаёт о ней в рантайме.
 *
 * Проверка стоит на ИСХОДНИКАХ, а не на `dist`: она обязана работать без сборки, и чинить
 * надо причину. `.js` в TypeScript-исходнике — это не ложь про расширение: так работает
 * NodeNext, а сборщик (vite, vitest, tsc с `bundler`) сам находит рядом `.ts`.
 *
 * @module module-specifiers.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('.', import.meta.url));

function sourceFiles(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...sourceFiles(path));
    // Тесты в `dist` не уезжают (сборка их исключает), а их примеры и образцы выглядят
    // как нарушения — проверять надо ровно то, что попадёт к потребителю.
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(path);
  }
  return found;
}

/** `from './x'`, `export … from '../y'` и динамический `import('./z')`. */
const RELATIVE = /(?:from\s+'|import\s*\(\s*')(\.\.?\/[^']*)'/g;

describe('спецификаторы модулей', () => {
  it('каждый относительный импорт несёт расширение', () => {
    const offenders: string[] = [];
    for (const file of sourceFiles(SRC)) {
      const text = readFileSync(file, 'utf8');
      for (const [, specifier] of text.matchAll(RELATIVE)) {
        // `.json` и `.css` резолвятся по своим правилам и расширение уже несут.
        if (specifier !== undefined && !/\.[a-z]+$/.test(specifier)) {
          offenders.push(`${file.slice(SRC.length)} → ${specifier}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('проверка ловит нарушение, а не просто проходит', () => {
    // Регулярка — единственное, на чём держится проверка выше; при нуле нарушений
    // сломанное выражение молчало бы вечно (decisions-log, t0-2).
    const sample = `import { a } from '../primitives/capability';\nimport b from './x.js';`;
    const found = [...sample.matchAll(RELATIVE)].map(([, specifier]) => specifier);

    expect(found).toEqual(['../primitives/capability', './x.js']);
  });
});
