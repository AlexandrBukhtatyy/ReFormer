/**
 * Временный храповик шва: модули, которые уедут в общий плагин генерации (`forms/codegen`), не
 * знают стека ReFormer. Пока хозяин и стек живут в одном плагине, границу доменов линтер не
 * видит — её держит этот тест. Снимается вместе с физическим расколом: там её возьмёт правило
 * границ доменов (`eslint.config.js`).
 *
 * Корень композиции (`plugin.ts` активирует стек до раскола, `index.ts`, `main.ts`) в проверку
 * не входит — он делится при расколе. Тесты хозяина входят: в общем плагине им стек не дадут.
 *
 * @module plugins/reformer/codegen/host-purity.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

/** Модули хозяина: файлы и папки целиком, вместе с их тестами. */
const HOST = [
  'contract.ts',
  'messages.ts',
  'host.ts',
  'workspace.ts',
  'workspace.test.ts',
  'stacks.ts',
  'testing.ts',
  'plugin.test.ts',
  'commands/',
  'pipeline/',
  'ui/',
];

/** Чего хозяин импортировать не вправе: ядро и библиотеки ReFormer, стек и обвязку обеих сторон. */
const FORBIDDEN: readonly RegExp[] = [
  /\/core\//,
  /^@reformer\/(?:renderer-json|mcp|core)(?:\/|$)/,
  /(?:^|\/)stack(?:\/|$)/,
  /(?:^|\/)cross(?:\/|$)/,
];

const isModule = (name: string): boolean => /\.tsx?$/.test(name);

function hostFiles(): string[] {
  return HOST.flatMap((entry) =>
    entry.endsWith('/')
      ? readdirSync(join(SRC, entry))
          .filter(isModule)
          .map((name) => `${entry}${name}`)
      : [entry]
  );
}

function importsOf(file: string): string[] {
  const text = readFileSync(join(SRC, file), 'utf8');
  return [...text.matchAll(/(?:^|\n)\s*(?:import|export)[^'"]*?from\s+'([^']+)'/g)].map(
    (match) => match[1]
  );
}

describe('хозяин генерации не знает стека ReFormer', () => {
  it.each(hostFiles())('%s', (file) => {
    const foreign = importsOf(file).filter((spec) => FORBIDDEN.some((re) => re.test(spec)));
    expect(foreign).toEqual([]);
  });
});
