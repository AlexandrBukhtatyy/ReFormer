/**
 * Утверждения о встроенных ШАБЛОНАХ, которые нельзя выразить снимком.
 *
 * Снимок (`plugins/codegen/golden.test.ts`) печатает модуль встроенными целями, поэтому состав
 * файлов в нём всегда наш. А README обязан перечислять ФАКТИЧЕСКИЙ состав — включая файл чужой
 * цели, о которой мы ничего не знаем. Такой вход снимком не получить: комбинация задаётся
 * схемой и китом, а не подставленным списком файлов.
 *
 * Отсюда и граница: сюда попадает то, что требует синтетического входа; всё остальное про
 * шаблоны удерживают снимки.
 *
 * @module reformer-builder/lib/codegen/templates.test
 */

import { describe, expect, it } from 'vitest';
import { builtinKit, foreignKit, plainSchema } from './__fixtures__/kit';
import { prepare, type CodegenInput, type EmittedFileRef } from './context';
import { renderTemplate } from './render';
import { readmeTemplate } from './templates';
import { buildView, withViewFiles } from './view';

function readmeOf(files: readonly EmittedFileRef[], over: Partial<CodegenInput> = {}): string {
  const ctx = prepare({
    schema: over.schema ?? plainSchema(),
    formName: over.formName ?? 'Заявка на кредит',
    kit: over.kit ?? builtinKit(),
  });
  return renderTemplate('test.readme', readmeTemplate, withViewFiles(buildView(ctx), files));
}

describe('README перечисляет фактический состав модуля', () => {
  it('файл чужой цели попадает в список наравне с нашими', () => {
    // Отказ, который это удерживает: в v1 состав README был литералом, и `renderer.wizard.tsx`
    // дописывался туда отдельной веткой условия. Любая чужая цель осталась бы незаписанной —
    // человек получил бы файл, о котором README молчит.
    const code = readmeOf([
      { path: 'types.ts', cls: 'derived' },
      { path: 'api.ts', cls: 'user' },
      { path: 'мой-файл.ts', cls: 'derived' },
    ]);
    expect(code).toContain('`types.ts`, `мой-файл.ts`');
    expect(code).toContain('`api.ts`');
  });

  it('пустой состав не роняет печать и не оставляет мусора', () => {
    const code = readmeOf([]);
    expect(code).toContain('## Файлы');
    expect(code).not.toContain('undefined');
  });

  it('называет кит, под который сгенерирован модуль', () => {
    expect(readmeOf([], { kit: foreignKit() })).toContain('@hexa/ui');
  });
});
