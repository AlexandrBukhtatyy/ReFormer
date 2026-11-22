/**
 * Где форма: поиск схемы в каталоге формы и схема открытого документа.
 *
 * @module plugins/reformer/codegen/stack/find.test
 */

import { describe, expect, it, vi } from 'vitest';
import type { ResourceId, ResourceRef } from '@reformer/builder-plugin-api';
import { createFakeDocument, createFakeReader } from '../../../../.shared/codegen-fakes';
import { findSchemaIn, schemaCandidates, schemaOf } from './find';

/** Минимальная схема, которую `isFormSchema` признаёт формой. */
const FORM = {
  format: 2,
  version: '1.0',
  root: {
    component: '$html(div)',
    children: [{ selector: 'name', model: '$model(name)', component: '$component(Input)' }],
  },
};
const SCHEMA = JSON.stringify(FORM);

/**
 * Та же форма в ПРЕЖНЕМ формате: без `format`, привязка поля — в `value`.
 *
 * Литерал прежнего формата здесь намеренно: это вход проверки перевода, а не недосмотр переноса.
 */
const LEGACY_FORM = {
  version: '1.0',
  root: {
    component: '$html(div)',
    children: [{ selector: 'name', value: '$model(name)', component: '$component(Input)' }],
  },
};
const LEGACY_SCHEMA = JSON.stringify(LEGACY_FORM);

const DIR = 'fake:forms/credit' as ResourceId;

function file(name: string): ResourceRef {
  return {
    id: `${DIR}/${name}` as ResourceId,
    sourceId: 'fake',
    path: `forms/credit/${name}`,
    name,
    kind: 'file',
    mediaType: 'application/json',
  };
}

const DOC = 'src/forms/credit.schema.json';

describe('схема открытого документа', () => {
  it('модель документа предпочтительнее текста буфера', () => {
    const document = { ...createFakeDocument(DOC, 'сломанный текст'), model: () => FORM };
    expect(schemaOf(document)).toBe(FORM);
  });

  it('текст и модель прежнего формата отдаются переведёнными в формат 2', () => {
    // Посылка: разметка прежнего формата — не та, с которой работает генерация.
    expect(LEGACY_FORM.root).not.toEqual(FORM.root);

    expect(schemaOf(createFakeDocument(DOC, LEGACY_SCHEMA))).toEqual(FORM);

    const fromModel = { ...createFakeDocument(DOC, 'сломанный текст'), model: () => LEGACY_FORM };
    expect(schemaOf(fromModel)).toEqual(FORM);
  });

  it('документ, который не разбирается в схему, — null', () => {
    expect(schemaOf(createFakeDocument(DOC, 'не json'))).toBeNull();
    expect(schemaOf(createFakeDocument(DOC, '{"x":1}'))).toBeNull();
  });
});

describe('поиск схемы в каталоге', () => {
  it('канон идёт первым, остальные — по алфавиту', () => {
    const names = schemaCandidates([
      file('zebra.schema.json'),
      file('renderer.schema.json'),
      file('alpha.form.json'),
      file('form.schema.json'),
      file('types.ts'),
    ]).map((ref) => ref.name);

    // Канон, затем прежнее имя (форма, перегенерированная по новой раскладке, старый файл
    // не удаляет), затем по алфавиту.
    expect(names).toEqual([
      'form.schema.json',
      'renderer.schema.json',
      'alpha.form.json',
      'zebra.schema.json',
    ]);
  });

  it('файлы, не похожие на схему, не читаются вовсе', async () => {
    const host = createFakeReader({ [`${DIR}/model.ts`]: 'export const x = 1;' });
    const readText = vi.spyOn(host, 'readText');

    expect(await findSchemaIn(host, DIR)).toBeNull();
    expect(readText).not.toHaveBeenCalled();
  });

  it('неразбираемый кандидат не прекращает поиск', async () => {
    const host = createFakeReader({
      [`${DIR}/broken.form.json`]: '{ не json',
      [`${DIR}/ok.schema.json`]: SCHEMA,
    });

    expect((await findSchemaIn(host, DIR))?.ref.name).toBe('ok.schema.json');
  });

  it('открытый документ важнее файла на диске: в нём текст, который человек видит', async () => {
    const edited = JSON.stringify({
      format: 2,
      version: '1.0',
      root: { component: '$html(section)', children: [] },
    });
    const document = createFakeDocument(`${DIR}/form.schema.json`, edited);
    const host = createFakeReader({ [`${DIR}/form.schema.json`]: SCHEMA }, () => document);

    expect((await findSchemaIn(host, DIR))?.schema.root).toMatchObject({
      component: '$html(section)',
    });
  });

  it('форма под прежним именем схемы тоже находится', async () => {
    const host = createFakeReader({ [`${DIR}/renderer.schema.json`]: SCHEMA });
    expect((await findSchemaIn(host, DIR))?.ref.name).toBe('renderer.schema.json');
  });

  it('без листинга искать негде', async () => {
    const host = createFakeReader({ [`${DIR}/form.schema.json`]: SCHEMA });

    expect(await findSchemaIn({ ...host, list: undefined }, DIR)).toBeNull();
  });

  it('файл прежнего формата находится и отдаётся переведённым в формат 2', async () => {
    // Посылка: разметка на диске — не та, с которой работает генерация.
    expect(LEGACY_FORM.root).not.toEqual(FORM.root);
    const host = createFakeReader({ [`${DIR}/form.schema.json`]: LEGACY_SCHEMA });

    expect((await findSchemaIn(host, DIR))?.schema).toEqual(FORM);
  });

  it('ищет документ в папке schema/ каталога, а корнем модуля называет сам каталог', async () => {
    const host = createFakeReader({ [`${DIR}/schema/form.schema.json`]: SCHEMA });

    const found = await findSchemaIn(host, DIR);
    expect(found?.ref.id).toBe(`${DIR}/schema/form.schema.json`);
    expect(found?.root).toBe(DIR);
    expect(found?.schemaPath).toBe('schema/form.schema.json');
  });

  it('документ в schema/ важнее документа в самом каталоге', async () => {
    // Форма переехала на папки ролей, а прежний документ в корне остался: открывается новый.
    const moved = JSON.stringify({ ...FORM, version: '2.0' });
    const host = createFakeReader({
      [`${DIR}/form.schema.json`]: SCHEMA,
      [`${DIR}/schema/form.schema.json`]: moved,
    });

    const found = await findSchemaIn(host, DIR);
    expect(found?.schemaPath).toBe('schema/form.schema.json');
    expect(found?.schema.version).toBe('2.0');
  });

  it('документ в самом каталоге — форма прежней плоской раскладки: схема остаётся в корне', async () => {
    const host = createFakeReader({ [`${DIR}/form.schema.json`]: SCHEMA });

    const found = await findSchemaIn(host, DIR);
    expect(found?.root).toBe(DIR);
    expect(found?.schemaPath).toBe('form.schema.json');
  });

  it('выбран сам каталог schema — корень модуля его родитель', async () => {
    const schemaDir = `${DIR}/schema` as ResourceId;
    const host = createFakeReader({ [`${schemaDir}/form.schema.json`]: SCHEMA });

    const found = await findSchemaIn(host, schemaDir);
    expect(found?.root).toBe(DIR);
    expect(found?.schemaPath).toBe('schema/form.schema.json');
  });

  it('документ под прежним именем называет в модуле уже новое имя', async () => {
    const host = createFakeReader({ [`${DIR}/renderer.schema.json`]: SCHEMA });
    expect((await findSchemaIn(host, DIR))?.schemaPath).toBe('form.schema.json');
  });

  it('открытый документ с текстом прежнего формата тоже отдаётся в формате 2', async () => {
    const document = createFakeDocument(`${DIR}/form.schema.json`, LEGACY_SCHEMA);
    const host = createFakeReader({ [`${DIR}/form.schema.json`]: SCHEMA }, () => document);

    const found = await findSchemaIn(host, DIR);
    expect(found?.document).toBeDefined();
    expect(found?.schema).toEqual(FORM);
  });
});
