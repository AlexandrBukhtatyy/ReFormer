/**
 * Создание фикстуры: адрес вне каталога формы и политика «правки человека не трутся».
 *
 * @module plugins/reformer/codegen/commands/fixture-command.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { withMarker } from '@reformer/builder-toolkit';
import type { ResourceId } from '@reformer/builder-plugin-api';
import type { CatalogEntry } from '../../../core/catalog';
import { createFixture } from './fixture-command';
import type { CodegenHost } from '../host';

const DOCUMENT = 'src/forms/credit/form.schema.json' as unknown as ResourceId;
const FIXTURE_PATH = 'src/forms/credit/fixture.ts';

const SCHEMA = {
  format: 2,
  root: {
    component: '$component(Form)',
    children: [{ model: '$model(amount)', component: '$component(Input)' }],
  },
} as unknown as JsonFormSchema;

/**
 * Та же форма в ПРЕЖНЕМ формате: без `format`, привязка поля — в `value`.
 *
 * Литерал прежнего формата здесь намеренно: это вход проверки перевода, а не недосмотр переноса.
 */
const LEGACY_SCHEMA = {
  root: {
    component: '$component(Form)',
    children: [{ value: '$model(amount)', component: '$component(Input)' }],
  },
};

interface Harness {
  readonly host: CodegenHost;
  readonly written: Map<string, string>;
  readonly saved: string[];
  readonly opened: string[];
}

function harness(
  options: {
    existing?: string;
    write?: boolean;
    model?: unknown;
    catalog?: readonly CatalogEntry[];
  } = {}
): Harness {
  const written = new Map<string, string>();
  const saved: string[] = [];
  const opened: string[] = [];
  const host = {
    documentOf: (id: ResourceId) =>
      id === DOCUMENT
        ? {
            id,
            ref: { path: 'src/forms/credit/form.schema.json' },
            model: () => ('model' in options ? options.model : SCHEMA),
          }
        : null,
    sourceOf: () => ({ write: options.write ?? true }),
    catalog: () => options.catalog ?? [],
    resolveFromRoot: (_anchor: ResourceId, path: string) => path as unknown as ResourceId,
    readText: (id: ResourceId) =>
      Promise.resolve(written.get(id as unknown as string) ?? options.existing ?? null),
    writeText: (id: ResourceId, text: string) => {
      written.set(id as unknown as string, text);
      return Promise.resolve();
    },
    save: (ids: readonly ResourceId[]) => {
      saved.push(...(ids as unknown as string[]));
      return Promise.resolve(true);
    },
    openResource: (id: ResourceId) => opened.push(id as unknown as string),
  } as unknown as CodegenHost;
  return { host, written, saved, opened };
}

describe('создание фикстуры', () => {
  it('пишет скелет по адресу вне каталога формы', async () => {
    const { host, written, saved } = harness();

    const outcome = await createFixture(host, DOCUMENT);

    expect(outcome).toMatchObject({ kind: 'written', path: FIXTURE_PATH });
    expect(written.get(FIXTURE_PATH)).toContain('export const fixture');
    // Модуль формы не тронут: фикстура лежит в своём дереве.
    expect([...written.keys()]).toEqual([FIXTURE_PATH]);
    expect(saved).toEqual([FIXTURE_PATH]);
  });

  it('скелет несёт маркер происхождения — иначе его нельзя будет обновить', async () => {
    const { host, written } = harness();

    await createFixture(host, DOCUMENT);

    expect(written.get(FIXTURE_PATH)?.startsWith('// @reformer-generated')).toBe(true);
  });

  it('нетронутый скелет перезаписывается', async () => {
    const { host, written } = harness({ existing: withMarker('export const fixture = {};\n') });

    const outcome = await createFixture(host, DOCUMENT);

    expect(outcome.kind).toBe('written');
    expect(written.get(FIXTURE_PATH)).toContain('$dataSource');
  });

  it('ПРАВЛЕННУЮ фикстуру не трогает и говорит об этом', async () => {
    const authored = withMarker('export const fixture = {};\n') + '\n// моя правка\n';
    const { host, written, opened } = harness({ existing: authored });

    const outcome = await createFixture(host, DOCUMENT);

    expect(outcome.kind).toBe('edited');
    expect(written.size).toBe(0);
    expect(opened).toEqual([]);
  });

  it('написанную руками фикстуру (без маркера) тоже не трогает', async () => {
    const { host, written } = harness({ existing: 'export const fixture = { model: {} };' });

    expect((await createFixture(host, DOCUMENT)).kind).toBe('edited');
    expect(written.size).toBe(0);
  });

  it('источник только на чтение — отказ, а не запись в никуда', async () => {
    const { host, written } = harness({ write: false });

    expect((await createFixture(host, DOCUMENT)).kind).toBe('no-target');
    expect(written.size).toBe(0);
  });

  it('документ без разобранной схемы — печатать нечего', async () => {
    const { host } = harness({ model: undefined });

    expect((await createFixture(host, DOCUMENT)).kind).toBe('no-schema');
  });

  it('модель, в которой `root` — не узел, схемой не считается', async () => {
    const { host, written } = harness({ model: { root: 'не узел' } });

    expect((await createFixture(host, DOCUMENT)).kind).toBe('no-schema');
    expect(written.size).toBe(0);
  });

  it('по модели прежнего формата печатает ту же фикстуру, что и по формату 2', async () => {
    // Посылка: разметка прежнего формата — не та, с которой работает генерация.
    expect(LEGACY_SCHEMA.root).not.toEqual(SCHEMA.root);
    const modern = harness();
    const legacy = harness({ model: LEGACY_SCHEMA });

    await createFixture(modern.host, DOCUMENT);
    await createFixture(legacy.host, DOCUMENT);

    expect(legacy.written.get(FIXTURE_PATH)).toBe(modern.written.get(FIXTURE_PATH));
    // Не пустой скелет: поле найдено — без перевода `value` в `model` его бы не было.
    expect(legacy.written.get(FIXTURE_PATH)).toContain('amount');
  });

  it('документ в папке schema: фикстура ложится в КОРЕНЬ модуля формы, а не в schema/', async () => {
    // Раскладка «папки по ролям»: документ — `<модуль>/schema/form.schema.json`, а фикстура —
    // артефакт формы целиком. Адрес считает `fixturePathOf` — один на кодоген, превью и шаблоны.
    const nested = 'src/forms/credit/schema/form.schema.json' as unknown as ResourceId;
    const written = new Map<string, string>();
    const host = {
      documentOf: (id: ResourceId) =>
        id === nested
          ? { id, ref: { path: nested as unknown as string }, model: () => SCHEMA }
          : null,
      sourceOf: () => ({ write: true }),
      catalog: () => [],
      resolveFromRoot: (_anchor: ResourceId, path: string) => path as unknown as ResourceId,
      readText: () => Promise.resolve(null),
      writeText: (id: ResourceId, text: string) => {
        written.set(id as unknown as string, text);
        return Promise.resolve();
      },
    } as unknown as CodegenHost;

    const outcome = await createFixture(host, nested);

    expect(outcome).toMatchObject({ kind: 'written', path: FIXTURE_PATH });
    expect([...written.keys()]).toEqual([FIXTURE_PATH]);
  });

  it('вид значения поля — из каталога активного кита: CheckboxGroup пуст как null, а не как строка', async () => {
    const schema = {
      format: 2,
      root: {
        component: '$component(Form)',
        children: [
          {
            model: '$model(channels)',
            component: '$component(CheckboxGroup)',
            componentProps: { options: [{ value: 'email', label: 'Email' }] },
          },
        ],
      },
    };
    // Запись поля, как её пишет каталог HexaUI: тип значения — в `x-runtimeProps.value.type`.
    const checkboxGroup = {
      name: 'CheckboxGroup',
      role: 'field',
      propsSchema: {
        type: 'object',
        properties: {},
        'x-runtimeProps': { value: { group: 'Control', type: 'string[] | null' } },
      },
      makeNode: () => ({}),
    } as unknown as CatalogEntry;
    const bare = harness({ model: schema });
    const hexa = harness({ model: schema, catalog: [checkboxGroup] });

    await createFixture(bare.host, DOCUMENT);
    await createFixture(hexa.host, DOCUMENT);

    // Без каталога `options` делают поле списком с одним значением — пустая строка; с каталогом
    // вид тот же, что у кодогена: набор значений, пустой — `null`.
    expect(bare.written.get(FIXTURE_PATH)).toContain("channels: '',");
    expect(hexa.written.get(FIXTURE_PATH)).toContain('channels: null,');
  });

  it('без порта адресации команда отказывается, а не пишет рядом со схемой', async () => {
    const { host } = harness();
    const crippled = { ...host, resolveFromRoot: undefined } as unknown as CodegenHost;

    expect((await createFixture(crippled, DOCUMENT)).kind).toBe('no-target');
  });
});
