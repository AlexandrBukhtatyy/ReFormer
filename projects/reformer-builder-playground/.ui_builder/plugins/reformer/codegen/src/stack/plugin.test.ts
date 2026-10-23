/**
 * Стек ReFormer в генерации: что он вносит в точки хозяина и что отдаёт наружу.
 *
 * @module plugins/reformer/codegen/stack/plugin.test
 */

import { describe, expect, it } from 'vitest';
import type { CodegenStack, WhenContext } from '@reformer/builder-plugin-api';
import { createFakePluginContext } from '../../../../.shared/codegen-fakes';
import { builtinKit } from '../../../core/testing';
import { activateCodegenStack, CREATE_FIXTURE_COMMAND_ID, stackDocumentActive } from './plugin';
import type { ModulePrinterService } from './printer';
import { BUILTIN_TARGETS, CODEGEN_STACK_ID } from './targets';
import type { CodegenStackWorkspace } from './workspace';

/** Рабочая область стека: кит встроенный, писать некуда — вклады от этого не зависят. */
function workspace(): CodegenStackWorkspace {
  const view = builtinKit();
  return {
    kit: () => view.kit,
    catalog: () => view.catalog,
    onDidChangeKit: () => ({ dispose: () => undefined }),
    documentOf: () => null,
    sourceOf: () => null,
    readText: async () => null,
    writeText: async () => undefined,
    openResource: () => undefined,
    activeResource: () => null,
  };
}

function activate() {
  const fake = createFakePluginContext('reformer.codegen-schema');
  activateCodegenStack(fake.ctx, { workspace: workspace() });
  return fake;
}

function whenContext(activeResourceKind: string | null): WhenContext {
  return {
    focus: 'canvas',
    activeEditorId: null,
    activeResourceKind,
    hasSelection: false,
    previewMode: null,
  };
}

describe('вклады стека', () => {
  it('вносит себя в точку стеков под своим именем', () => {
    const { contributions } = activate();
    const stacks = contributions.filter((item) => item.point === 'codegen.stack');
    expect(stacks.map((item) => item.id)).toEqual([CODEGEN_STACK_ID]);
    expect((stacks[0].value as CodegenStack).kinds).toEqual(['form.schema', 'application/json']);
  });

  it('вносит все встроенные цели вкладами, а не держит их массивом', () => {
    const { contributions } = activate();
    const targets = contributions.filter((item) => item.point === 'codegen.target');
    expect(targets.map((item) => item.id)).toEqual(BUILTIN_TARGETS.map((t) => t.id));
    // Цели помечены стеком: хозяин отдаёт стеку только его цели и общие.
    expect(BUILTIN_TARGETS.every((target) => target.stack === CODEGEN_STACK_ID)).toBe(true);
  });

  it('порядок целей задаётся вкладом, а не позицией в массиве', () => {
    const { contributions } = activate();
    const orders = contributions
      .filter((item) => item.point === 'codegen.target')
      .map((item) => item.order);
    expect(orders).toEqual(BUILTIN_TARGETS.map((t) => t.order));
    // Между любыми двумя нашими целями помещается чужая: соседи отстоят больше чем на единицу.
    const sorted = [...orders].sort((a, b) => (a ?? 0) - (b ?? 0));
    expect(sorted.every((order, i) => i === 0 || (order ?? 0) - (sorted[i - 1] ?? 0) > 1)).toBe(
      true
    );
  });

  it('вносит подраздел «Сгенерировать → ReFormer» и команду фикстуры', () => {
    const { contributions, commands } = activate();
    expect(contributions.filter((item) => item.point === 'menu').map((item) => item.id)).toEqual([
      'codegen.context.submenu',
      'codegen.context.all',
      'codegen.context.targets',
    ]);
    expect(commands).toEqual([CREATE_FIXTURE_COMMAND_ID]);
  });

  it('везёт свой словарь — подписи целей и отказы стека', () => {
    const { locales } = activate();
    expect(locales.sort()).toEqual(['en', 'ru']);
  });

  it('команда фикстуры доступна на документах стека', () => {
    expect(stackDocumentActive(whenContext('form.schema'))).toBe(true);
    expect(stackDocumentActive(whenContext('text/typescript'))).toBe(false);
    expect(stackDocumentActive(whenContext(null))).toBe(false);
  });
});

describe('возможность «напечатать модуль формы»', () => {
  /** Печатник, который стек отдал наружу: его единственная служба. */
  function printer(): ModulePrinterService {
    const { services } = activate();
    expect([...services.keys()]).toEqual(['reformer.codegen.printer']);
    return services.get('reformer.codegen.printer') as ModulePrinterService;
  }

  /** Форма в формате 2. */
  const FORM = {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [{ model: '$model(fullName)', component: '$component(Input)' }],
    },
  };

  /**
   * Она же в ПРЕЖНЕМ формате: без `format`, привязка поля — в `value`. Литерал прежнего формата
   * здесь намеренно: это вход проверки перевода, а не недосмотр переноса.
   */
  const LEGACY_FORM = {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [{ value: '$model(fullName)', component: '$component(Input)' }],
    },
  };

  it('схему прежнего формата печатает так же, как её запись в формате 2', async () => {
    // Посылка: разметка прежнего формата — не та, с которой работает генерация.
    expect(LEGACY_FORM.root).not.toEqual(FORM.root);
    const service = printer();

    const modern = await service.print(FORM, 'Анкета');
    const legacy = await service.print(LEGACY_FORM, 'Анкета');

    expect(legacy).toEqual(modern);
    // Файлы отданы в раскладке «папки по ролям», от корня модуля формы: документ — в `schema/`,
    // страница названа типом формы, реэкспорты — `index.ts`. Плагин шаблонов кладёт их как есть.
    const paths = modern.map((file) => file.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'schema/form.schema.json',
        'AnketaForm.tsx',
        'index.ts',
        'application/create.ts',
        'validation/form.ts',
        'behavior/index.ts',
      ])
    );
    expect(paths.filter((path) => !path.includes('/')).sort()).toEqual([
      'AnketaForm.tsx',
      'README.md',
      'index.ts',
    ]);
    // И это модуль формы с полем, а не пустой: без перевода поле не было бы найдено.
    expect(legacy.find((file) => file.path === 'types/anketa.ts')?.content).toContain(
      'fullName: string;'
    );
  });
});
