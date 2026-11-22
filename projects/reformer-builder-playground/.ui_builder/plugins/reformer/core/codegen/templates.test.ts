/**
 * Утверждения о встроенных ШАБЛОНАХ, которые нельзя выразить снимком.
 *
 * Снимок (`plugins/reformer/codegen/golden.test.ts`) печатает модуль встроенными целями, поэтому состав
 * файлов в нём всегда наш. А README обязан перечислять ФАКТИЧЕСКИЙ состав — включая файл чужой
 * цели, о которой мы ничего не знаем. Такой вход снимком не получить: комбинация задаётся
 * схемой и китом, а не подставленным списком файлов.
 *
 * Отсюда и граница: сюда попадает то, что требует синтетического входа; всё остальное про
 * шаблоны удерживают снимки.
 *
 * @module plugins/reformer/core/codegen/templates.test
 */

import { describe, expect, it } from 'vitest';
import { builtinKit, foreignKit, plainSchema, wizardRulesSchema } from './__fixtures__/kit';
import { prepare, type CodegenInput, type EmittedFileRef } from './context';
import { renderTemplate } from '@reformer/builder-toolkit';
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
    // Отказ, который это удерживает: в v1 состав README был литералом, и необязательный файл
    // дописывался туда отдельной веткой условия. Любая чужая цель осталась бы незаписанной —
    // человек получил бы файл, о котором README молчит.
    const code = readmeOf([
      { path: 'types/zayavka-na-kredit.ts', cls: 'derived' },
      { path: 'api/index.ts', cls: 'user' },
      { path: 'мой-файл.ts', cls: 'derived' },
    ]);
    expect(code).toContain('`types/zayavka-na-kredit.ts`, `мой-файл.ts`');
    expect(code).toContain('`api/index.ts`');
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

describe('README описывает раскладку «папки по ролям»', () => {
  it('дерево называет папки ролей и файлы формы в них', () => {
    const code = readmeOf([]);
    for (const line of [
      '├── ZayavkaNaKreditForm.tsx',
      '├── application/',
      '│   ├── create.ts',
      '│   ├── submit.ts',
      '│   └── entry.ts',
      '├── schema/',
      '│   ├── form.schema.json',
      '│   └── registry.ts',
      '├── validation/',
      '├── behavior/',
      '├── types/',
      '│   └── zayavka-na-kredit.ts',
      '└── constants/',
    ]) {
      expect(code).toContain(line);
    }
    // Потока шагов у простой формы нет — и в дереве его нет.
    expect(code).not.toContain('├── flow/');
  });

  it('у визарда — поток шагов и по файлу правил на шаг', () => {
    const code = readmeOf([], { schema: wizardRulesSchema() });
    expect(code).toContain('├── flow/');
    expect(code).toContain('│   └── zayavka-na-kredit-flow.ts');
    expect(code).toContain('│   ├── dannye.ts   правила шага «Данные»');
    expect(code).toContain('│   └── kontakty.ts   правила шага «Контакты»');
  });

  it('методы для реализации названы в новых путях, прежних имён нет', () => {
    const code = readmeOf([]);
    expect(code).toContain('- `api/index.ts` → `submitForm(values)`');
    expect(code).toContain('- `application/submit.ts` →');
    expect(code).toContain('- `behavior/index.ts` →');
    for (const stale of ['form.render.ts', 'data-sources.ts', 'index.tsx', 'defineJsonSchemaV1']) {
      expect(code).not.toContain(stale);
    }
  });
});
