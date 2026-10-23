/**
 * Модуль на диске против напечатанного: кит модуля, сироты шагов, файлы прежней раскладки.
 *
 * @module plugins/reformer/codegen/stack/disk.test
 */

import { describe, expect, it } from 'vitest';
import { withMarker } from '@reformer/builder-toolkit';
import type { CodegenFile, ResourceId } from '@reformer/builder-plugin-api';
import { createFakeReader } from '../../../../.shared/codegen-fakes';
import { kitMismatchOf, notesOf, registryKitOf } from './disk';

const DIR = 'src/pages/my-form' as ResourceId;
const SCHEMA = 'schema/form.schema.json';

const file = (over: Partial<CodegenFile> & Pick<CodegenFile, 'path'>): CodegenFile => ({
  content: 'тело\n',
  cls: 'derived',
  regenerable: false,
  targetId: `t:${over.path}`,
  origin: 'builtin',
  ...over,
});

/** Реестр модуля, напечатанный китом `kit`: обёртка поля — из его главного входа. */
const registry = (kit: string, wrapper = 'FormField'): string =>
  withMarker(
    [
      `import { Box, ${wrapper}, Input } from '${kit}';`,
      "import { Step } from '@reformer/cdk/form-wizard';",
      "import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';",
      '',
      'export function createRegistry(): ComponentRegistry {',
      '  return defineRegistry((reg) => {',
      `    reg.component(FIELD_WRAPPER, ${wrapper});`,
      "    reg.component('Box', Box);",
      '  });',
      '}',
      '',
    ].join('\n')
  );

const registryFile = (kit: string): CodegenFile =>
  file({ path: 'schema/registry.ts', targetId: 'codegen.registry', content: registry(kit) });

/** Пути заметки с таким `id`; нет заметки — пусто. */
async function noted(
  files: Record<string, string>,
  module: readonly CodegenFile[],
  id: 'orphans' | 'flat',
  schemaPath = SCHEMA
): Promise<readonly string[]> {
  const notes = await notesOf(createFakeReader(files), DIR, module, schemaPath);
  return notes.find((note) => note.id === id)?.paths ?? [];
}

describe('кит модуля', () => {
  it('registryKitOf — пакет, из которого импортирована обёртка поля', () => {
    expect(registryKitOf(registry('@reformer/ui-kit'))).toBe('@reformer/ui-kit');
    // Подпуть кита — тот же пакет; переименованный импорт находится по локальному имени.
    const aliased = [
      "import { HexField as Wrapper } from '@hexa/ui/fields';",
      'reg.component(FIELD_WRAPPER, Wrapper);',
    ].join('\n');
    expect(registryKitOf(aliased)).toBe('@hexa/ui');
    expect(registryKitOf('export const x = 1;\n')).toBeNull();
  });

  it('модуль, напечатанный другим китом, — отказ с именами китов', async () => {
    const reader = createFakeReader({
      [`${DIR}/schema/registry.ts`]: registry('@reformer/kit-hexa-ui'),
    });
    await expect(
      kitMismatchOf(reader, DIR, [
        file({ path: 'types/my-form.ts' }),
        registryFile('@reformer/ui-kit'),
      ])
    ).resolves.toEqual({
      refusal: {
        key: 'error.kit-mismatch',
        params: { module: '@reformer/kit-hexa-ui', active: '@reformer/ui-kit' },
      },
    });
  });

  it('тот же кит, новый модуль и реестр, напечатанный не нами, — отказа нет', async () => {
    const module = [registryFile('@reformer/ui-kit')];
    const sameKit = createFakeReader({
      [`${DIR}/schema/registry.ts`]: registry('@reformer/ui-kit'),
    });
    await expect(kitMismatchOf(sameKit, DIR, module)).resolves.toBeNull();
    await expect(kitMismatchOf(createFakeReader(), DIR, module)).resolves.toBeNull();
    // Свой реестр человека без FIELD_WRAPPER — судить о ките не по чему: отказа нет.
    const handwritten = createFakeReader({
      [`${DIR}/schema/registry.ts`]: "import { X } from 'my-kit';\n",
    });
    await expect(kitMismatchOf(handwritten, DIR, module)).resolves.toBeNull();
  });

  it('без реестра в модуле судить не по чему', async () => {
    const reader = createFakeReader({
      [`${DIR}/schema/registry.ts`]: registry('@reformer/kit-hexa-ui'),
    });
    await expect(kitMismatchOf(reader, DIR, [file({ path: 'types/x.ts' })])).resolves.toBeNull();
  });
});

describe('файлы шагов, которых нет в модуле', () => {
  /** Файл правил шага — как его печатает цель `codegen.step-validation`. */
  const rules = (slug: string): CodegenFile =>
    file({ path: `validation/${slug}.ts`, cls: 'user', regenerable: true });
  /** Файл схемы шага разбитого визарда. */
  const stepSchema = (dir: string, schemaDir = 'schema/'): CodegenFile =>
    file({ path: `${schemaDir}steps/${dir}/form.schema.json`, content: '{}' });

  it('называет файл правил шага на диске, которого нет в модуле', async () => {
    const files = {
      [`${DIR}/validation/dannye.ts`]: withMarker('старое\n'),
      // Шаг «Контакты» переименовали: файл остался, и в нём — правки человека.
      [`${DIR}/validation/kontakty.ts`]: `${withMarker('старое\n')}// моя валидация\n`,
    };
    const module = [
      rules('dannye'),
      rules('adres'),
      file({ path: 'validation/form.ts', cls: 'user', regenerable: true }),
    ];
    expect(await noted(files, module, 'orphans')).toEqual(['validation/kontakty.ts']);
  });

  it('свой файл человека в validation/ шагом не считается: сирота — только напечатанный билдером', async () => {
    const files = {
      // Без маркера: общие правила, которые человек написал сам и импортирует из файлов шагов.
      [`${DIR}/validation/common.ts`]: 'export const PHONE = /\\d+/;\n',
      [`${DIR}/validation/messages.json`]: '{}',
    };
    expect(await noted(files, [rules('dannye')], 'orphans')).toEqual([]);
  });

  it('файл правил формы сиротой не бывает, даже если его нет в модуле', async () => {
    const files = { [`${DIR}/validation/form.ts`]: withMarker('правила формы\n') };
    expect(await noted(files, [file({ path: 'README.md' })], 'orphans')).toEqual([]);
  });

  it('называет папку схемы шага рядом с корневым документом, которой нет в модуле', async () => {
    const files = {
      [`${DIR}/schema/steps/dannye/form.schema.json`]: '{}',
      [`${DIR}/schema/steps/kontakty/form.schema.json`]: '{"моя":1}',
    };
    const module = [stepSchema('dannye'), stepSchema('adres')];
    expect(await noted(files, module, 'orphans')).toEqual(['schema/steps/kontakty']);
  });

  it('документ в корне модуля: папки схем шагов ищутся рядом с ним, а не в schema/', async () => {
    const files = {
      [`${DIR}/steps/dannye/form.schema.json`]: '{}',
      [`${DIR}/steps/kontakty/form.schema.json`]: '{}',
    };
    expect(await noted(files, [stepSchema('dannye', '')], 'orphans', 'form.schema.json')).toEqual([
      'steps/kontakty',
    ]);
  });

  it('простая форма сирот не имеет — и заметок нет вовсе', async () => {
    await expect(
      notesOf(createFakeReader(), DIR, [file({ path: 'types/x.ts' })], SCHEMA)
    ).resolves.toEqual([]);
  });

  it('заметка несёт ключи словаря стека и текст уведомления с подстановками', async () => {
    const files = { [`${DIR}/validation/kontakty.ts`]: withMarker('x\n') };
    const [note] = await notesOf(createFakeReader(files), DIR, [], SCHEMA);
    expect(note).toEqual({
      id: 'orphans',
      paths: ['validation/kontakty.ts'],
      title: { key: 'orphans.title' },
      detail: { key: 'orphans.detail' },
      notify: { key: 'notify.orphans', params: { count: 1, dirs: 'validation/kontakty.ts' } },
    });
  });
});

describe('файлы прежней плоской раскладки', () => {
  it('называет их — код прежнего контракта сборки', async () => {
    // Правленный `form.render.ts`, положенный на место `behavior/index.ts`, не собрался бы —
    // контракт другой. Поэтому стек их только называет.
    const files = {
      [`${DIR}/index.tsx`]: withMarker('прежняя страница\n'),
      [`${DIR}/form.render.ts`]: 'мои правила рендера\n',
      [`${DIR}/wizard.tsx`]: withMarker('шим\n'),
      [`${DIR}/steps/index.ts`]: withMarker('агрегатор\n'),
      [`${DIR}/steps/dannye/form.validation.ts`]: 'мои правила шага\n',
      [`${DIR}/steps/dannye/form.render.ts`]: withMarker('x\n'),
    };
    const behavior = file({ path: 'behavior/index.ts', cls: 'user', regenerable: true });
    expect(await noted(files, [behavior], 'flat')).toEqual([
      'index.tsx',
      'wizard.tsx',
      'form.render.ts',
      'steps/index.ts',
      'steps/dannye/form.validation.ts',
      'steps/dannye/form.render.ts',
    ]);
  });

  it('папка шага с кодом прежней раскладки — не сирота шага, а файлы прежнего контракта', async () => {
    // У формы с документом в корне модуля схемы шагов и прежний код шагов делят одну папку
    // `steps/`. Папка без схемы шага сиротой не называется — иначе об одном и том же сказали бы
    // дважды и разными словами.
    const files = { [`${DIR}/steps/dannye/form.validation.ts`]: 'x\n' };
    const module = [file({ path: 'README.md' })];
    expect(await noted(files, module, 'orphans', 'form.schema.json')).toEqual([]);
    expect(await noted(files, module, 'flat', 'form.schema.json')).toEqual([
      'steps/dannye/form.validation.ts',
    ]);
  });

  it('файл, который модуль печатает сам, прежним не считается', async () => {
    // Чужая цель вправе положить в корень модуля свой `api.ts` — это часть модуля, а не остаток.
    const files = { [`${DIR}/api.ts`]: 'x\n' };
    expect(await noted(files, [file({ path: 'api.ts', cls: 'user' })], 'flat')).toEqual([]);
  });

  it('документ формы и README прежними не считаются: они живут под теми же именами', async () => {
    const files = { [`${DIR}/form.schema.json`]: '{}', [`${DIR}/README.md`]: '# старое\n' };
    expect(await noted(files, [file({ path: 'types/x.ts' })], 'flat')).toEqual([]);
  });
});
