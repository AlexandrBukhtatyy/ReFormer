import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  defineKitCatalog,
  groupByName,
  optionsProp,
  REFORMER_FIELD_WRAPPER,
  SEAM_RUNTIME_PROPS,
} from './config.js';
import { checkKitCatalogConfig, loadKitCatalogConfig } from './load-config.js';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'reformer-catalog-config-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

const minimal = { entry: './src/index.ts', kit: { id: 'acme' } };

describe('loadKitCatalogConfig', () => {
  it('catalog.config.mjs — default-экспорт; .mjs важнее .json', async () => {
    await writeFile(
      join(dir, 'catalog.config.json'),
      JSON.stringify({ ...minimal, out: 'x.json' })
    );
    await writeFile(
      join(dir, 'catalog.config.mjs'),
      `export default ${JSON.stringify({ ...minimal, out: 'from-mjs.json' })};\n`
    );

    const loaded = await loadKitCatalogConfig(dir);
    expect(loaded.ok && loaded.config.out).toBe('from-mjs.json');
    expect(loaded.ok && loaded.file).toBe(join(dir, 'catalog.config.mjs'));
  });

  it('.json и явный файл', async () => {
    const file = join(dir, 'kit.catalog.json');
    await writeFile(file, JSON.stringify(minimal));

    const loaded = await loadKitCatalogConfig(dir, file);
    expect(loaded.ok && loaded.config.kit.id).toBe('acme');
  });

  it('нет конфига, не загружается, не та форма — catalog-config-invalid', async () => {
    const missing = await loadKitCatalogConfig(dir);
    expect(missing.ok ? [] : missing.findings.map((f) => f.code)).toEqual([
      'catalog-config-invalid',
    ]);

    await writeFile(join(dir, 'catalog.config.json'), '{ broken');
    const broken = await loadKitCatalogConfig(dir);
    expect(broken.ok ? '' : broken.findings[0]?.message).toContain('конфиг не загружается');

    await writeFile(join(dir, 'catalog.config.json'), JSON.stringify({ kit: {} }));
    const invalid = await loadKitCatalogConfig(dir);
    expect(invalid.ok ? [] : invalid.findings.map((f) => f.message)).toEqual([
      'entry: обязателен',
      'kit.id: нужна непустая строка',
    ]);
  });
});

describe('checkKitCatalogConfig', () => {
  it('ловит опечатку в ключе и значения не того типа', () => {
    expect(
      checkKitCatalogConfig({
        ...minimal,
        categoris: {},
        fields: { Input: { valu: 'string' } },
        statics: { 'A.B': 1 },
        unclassified: 'ignore',
        props: { groups: { size: 'Look' } },
      })
    ).toEqual([
      'categoris: неизвестный ключ',
      'fields.Input.value: обязателен',
      'fields.Input.valu: неизвестный ключ',
      'statics.A.B: нужна непустая строка',
      'unclassified: допустимо "service" | "refuse"',
      'props.groups.size: допустимо "Control" | "Options" | "Textfield" | "Behavior" | "State"',
    ]);
  });

  it('разделы палитры — только через categories', () => {
    expect(
      checkKitCatalogConfig({ ...minimal, kit: { id: 'acme', palette: { categoryByName: {} } } })
    ).toEqual(['kit.palette.categoryByName: разделы палитры задаёт ключ categories конфига']);
  });

  it('правило секций — функцией или таблицей', () => {
    expect(checkKitCatalogConfig({ ...minimal, props: { groups: groupByName } })).toEqual([]);
    expect(checkKitCatalogConfig(defineKitCatalog({ ...minimal, fieldWrapper: false }))).toEqual(
      []
    );
  });
});

describe('пресеты', () => {
  it('обёртка поля и шов — тексты ui-kit', () => {
    expect(Object.keys(REFORMER_FIELD_WRAPPER)).toEqual([
      'label',
      'required',
      'description',
      'labelTooltip',
      'testId',
      'tooltip',
    ]);
    expect(Object.keys(SEAM_RUNTIME_PROPS)).toEqual(['value', 'onChange', 'onBlur', 'disabled']);
  });

  it('groupByName: таблица, затем форма имени', () => {
    expect(groupByName('label')).toBe('Textfield');
    expect(groupByName('options')).toBe('Options');
    expect(groupByName('isOpen')).toBe('State');
    expect(groupByName('defaultValue')).toBe('State');
    expect(groupByName('searchPlaceholder')).toBe('Textfield');
    expect(groupByName('dropdownClassName')).toBe('Control');
    expect(groupByName('onSearch')).toBeUndefined();
  });

  it('optionsProp — массив { value, label } в секции Options', () => {
    expect(optionsProp({ description: 'Варианты.' })).toEqual({
      type: 'array',
      items: {
        type: 'object',
        required: ['value', 'label'],
        additionalProperties: false,
        properties: { value: { type: ['string', 'number'] }, label: { type: 'string' } },
      },
      description: 'Варианты.',
      'x-doc': { group: 'Options', type: 'Array<{ value; label }>', kind: 'readonly' },
    });
  });
});
