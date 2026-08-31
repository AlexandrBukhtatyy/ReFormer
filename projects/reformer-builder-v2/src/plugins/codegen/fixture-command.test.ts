/**
 * Создание фикстуры: адрес вне каталога формы и политика «правки человека не трутся».
 *
 * @module plugins/codegen/fixture-command.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { withMarker } from '@/lib/codegen';
import type { ResourceId } from '@/sdk';
import { createFixture } from './fixture-command';
import type { CodegenHost } from './host';

const DOCUMENT = 'src/forms/credit/schema.json' as unknown as ResourceId;
const FIXTURE_PATH = 'src/forms/credit/fixture.ts';

const SCHEMA = {
  root: {
    component: '$component(Form)',
    children: [{ value: '$model(amount)', component: '$component(Input)' }],
  },
} as unknown as JsonFormSchema;

interface Harness {
  readonly host: CodegenHost;
  readonly written: Map<string, string>;
  readonly saved: string[];
  readonly opened: string[];
}

function harness(options: { existing?: string; write?: boolean; model?: unknown } = {}): Harness {
  const written = new Map<string, string>();
  const saved: string[] = [];
  const opened: string[] = [];
  const host = {
    documentOf: (id: ResourceId) =>
      id === DOCUMENT
        ? {
            id,
            ref: { path: 'src/forms/credit/schema.json' },
            model: () => ('model' in options ? options.model : SCHEMA),
          }
        : null,
    sourceOf: () => ({ write: options.write ?? true }),
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

  it('без порта адресации команда отказывается, а не пишет рядом со схемой', async () => {
    const { host } = harness();
    const crippled = { ...host, resolveFromRoot: undefined } as unknown as CodegenHost;

    expect((await createFixture(crippled, DOCUMENT)).kind).toBe('no-target');
  });
});
