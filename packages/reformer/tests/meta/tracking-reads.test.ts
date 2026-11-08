/**
 * Отслеживающие чтения сигналов переживают минификацию потребителя.
 *
 * Внутри `effect` / `computed` сигнал иногда читают только ради подписки, отбрасывая значение.
 * Форма `x?.value;` для этого непригодна: Terser с `pure_getters: "strict"` — умолчание webpack
 * и Docusaurus — считает чтение через `?.` чистым (оно не может бросить) и выбрасывает выражение
 * целиком. В исходниках и тестах ядра всё работает, ломается только production-сборка потребителя:
 * подписка пустая, интерфейс не обновляется (ReFormer-34j — `useSignalSubscription`).
 *
 * Чтение ради подписки пишется вызовом — `signal?.valueOf()` — либо без `?.` (`void signal.value`:
 * обращение к свойству возможного `null` Terser сохраняет).
 */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../src', import.meta.url));

/** Выражение-инструкция, целиком состоящее из чтения `?.value`: `x?.value;`, `void a.b?.value;`. */
const DROPPABLE_READ = /^\s*(?:void\s+)?[\w$.[\]?]*\?\.value\s*;/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.includes('.type-test.') ? [path] : [];
  });
}

describe('отслеживающие чтения сигналов', () => {
  it('нет чтений `?.value;`, которые минификатор потребителя выбросит', () => {
    const found: string[] = [];
    for (const file of sourceFiles(SRC)) {
      readFileSync(file, 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (DROPPABLE_READ.test(line))
            found.push(`${relative(SRC, file)}:${index + 1}: ${line.trim()}`);
        });
    }
    expect(found, `замените на вызов \`?.valueOf()\`:\n${found.join('\n')}`).toEqual([]);
  });
});
