/**
 * Временный храповик шва: модули, которые уедут в общий плагин ассистента (`forms/ai`), не знают
 * стека ReFormer. Пока хозяин и стек живут в одном плагине, границу доменов линтер не видит —
 * её держит этот тест. Снимается вместе с физическим расколом: там её возьмёт правило границ
 * доменов (`eslint.config.js`).
 *
 * Корень композиции (`plugin.ts`, `index.ts`, `main.ts`) и двойники (`testing.ts`) пока собирают
 * обе стороны и в проверку не входят — они делятся при расколе.
 *
 * @module plugins/reformer/ai/host-purity.test
 */

import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = dirname(fileURLToPath(import.meta.url));

/** Модули хозяина: файлы и папки целиком (без тестов). */
const HOST = [
  'contract.ts',
  'messages.ts',
  'host.ts',
  'workspace.ts',
  'budgets.ts',
  'providers/',
  'ui/',
  'session/bridge.ts',
  'session/session.ts',
  'session/history.ts',
  'session/config.ts',
  'session/resources.ts',
  'session/contributions.ts',
  'session/turn-writes.ts',
  'session/stacks.ts',
  'session/apply.ts',
  'loop/drive.ts',
  'loop/run-turn.ts',
  'tools/ask-user.ts',
  'tools/generate-code.ts',
  'tools/create-form.ts',
  'tools/read-resource.ts',
  'tools/command-tools.ts',
  'tools/contributed-tools.ts',
];

/** Чего хозяин импортировать не вправе: ядро и библиотеки ReFormer, стек и его модули. */
const FORBIDDEN: readonly RegExp[] = [
  /\/core\//,
  /^@reformer\/(?:renderer-json|mcp|core)(?:\/|$)/,
  /(?:^|\/)stack(?:\/|$)/,
  /(?:^|\/)model\//,
  /(?:^|\/)knowledge(?:\/|$)/,
  /files\/(?:scope|tree|compose|gate|turn)$/,
  /(?:^|\/)rules-file$/,
  /tools\/(?:registry|index|files)(?:\/|$)/,
  /(?:^|\.\.\/)tools$/,
  /loop\/(?:loop|file-loop|prompt|file-prompt|gate|introduced)$/,
];

const isSource = (name: string): boolean =>
  /\.tsx?$/.test(name) && !/\.(?:test|browser\.test)\.tsx?$/.test(name);

function hostFiles(): string[] {
  return HOST.flatMap((entry) =>
    entry.endsWith('/')
      ? readdirSync(join(SRC, entry))
          .filter(isSource)
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

describe('хозяин ассистента не знает стека ReFormer', () => {
  it.each(hostFiles())('%s', (file) => {
    const foreign = importsOf(file).filter((spec) => FORBIDDEN.some((re) => re.test(spec)));
    expect(foreign).toEqual([]);
  });
});
