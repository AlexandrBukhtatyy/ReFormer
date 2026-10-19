import { relative } from 'node:path';

import { loadCatalogValidator } from '@reformer/builder-plugin-api/tooling';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

import {
  absoluteFiles,
  acmeConfig,
  ACME_FILES,
  memoryHost,
  ROOT,
} from './__fixtures__/acme-kit.js';
import type { KitCatalogConfig } from './config.js';
import { generateKitCatalog, type KitCatalogResult } from './index.js';
import { displayType, MAX_TS_TYPE_LENGTH, splitTopLevelUnion } from './introspect.js';
import { compareCodePoints } from './policy.js';
import { portableTypeProblem } from './records.js';

type Json = Record<string, unknown>;
type Ok = Extract<KitCatalogResult, { ok: true }>;

async function generate(
  patch: (config: KitCatalogConfig) => KitCatalogConfig = (c) => c,
  files: Readonly<Record<string, string>> = ACME_FILES
): Promise<KitCatalogResult> {
  return generateKitCatalog({
    dir: ROOT,
    config: patch(acmeConfig()),
    typescript: ts,
    compilerHost: memoryHost(ts, absoluteFiles(ROOT, files)),
    prettier: false,
  });
}

async function generateOk(patch?: (config: KitCatalogConfig) => KitCatalogConfig): Promise<Ok> {
  const result = await generate(patch);
  if (!result.ok) throw new Error(JSON.stringify(result.findings, null, 2));
  return result;
}

function record(result: Ok, name: string): Json {
  const found = result.catalog.components.find((r) => r.name === name);
  if (found === undefined) throw new Error(`нет записи ${name}`);
  return found as unknown as Json;
}

function schemaOf(result: Ok, name: string): Json {
  return record(result, name).propsSchema as Json;
}

function propsOf(result: Ok, name: string): Record<string, Json> {
  return (schemaOf(result, name).properties ?? {}) as Record<string, Json>;
}

/** Отказы генерации: код и сообщение. */
async function refusals(
  patch: (config: KitCatalogConfig) => KitCatalogConfig
): Promise<{ code: string; message: string }[]> {
  const result = await generate(patch);
  if (result.ok) throw new Error('ожидался отказ');
  return result.findings.map(({ code, message }) => ({ code, message }));
}

describe('generateKitCatalog — каталог из типов', () => {
  it('проходит контракт каталога (loadCatalogValidator)', async () => {
    const result = await generateOk();
    const validate = await loadCatalogValidator();

    expect(validate(result.catalog)).toEqual({ valid: true, errors: [] });
    expect(result.catalog.version).toBe('3.0');
    expect(result.catalog.$schema).toBe(acmeConfig().schemaRef);
    expect(result.stats).toMatchObject({ records: 15, palette: 11 });
  });

  it('в каталоге — компоненты входа; функции, хуки, константы и исключённые — нет', async () => {
    const result = await generateOk();
    const names = result.catalog.components.map((r) => r.name);

    expect(names).toEqual([...names].sort(compareCodePoints));
    expect(names).toContain('Badge');
    for (const absent of [
      'Wizard',
      'FormatLabel',
      'WithTheme',
      'AcmeContext',
      'useAcme',
      'ACME_VERSION',
      'DateField',
    ]) {
      expect(names).not.toContain(absent);
    }
  });

  describe('тип пропсов', () => {
    it('функция, FC, forwardRef, memo — по сигнатуре', async () => {
      const result = await generateOk();

      expect(Object.keys(propsOf(result, 'Button'))).toContain('variant');
      expect(Object.keys(propsOf(result, 'Tabs'))).toEqual(['activeKey']);
      expect(Object.keys(propsOf(result, 'Panel'))).toEqual(['collapsible', 'title']);
      expect(Object.keys(propsOf(result, 'Card'))).toEqual(['elevated']);
    });

    it('VFC и React.VFC (нет в @types/react 19) — по аннотации', async () => {
      const result = await generateOk();

      expect(Object.keys(propsOf(result, 'DateInput'))).toEqual(['format', 'onChange', 'value']);
      expect(Object.keys(propsOf(result, 'DateRange'))).toEqual([
        'format',
        'onChange',
        'separator',
        'value',
      ]);
    });

    it('memo над VFC: сигнатура есть, пропсы размыты — берутся из аннотации', async () => {
      const result = await generateOk();

      expect(Object.keys(propsOf(result, 'MemoDate'))).toEqual(['format', 'onChange', 'value']);
    });

    it('StyledComponent без типов styled-components: тег + O, функция в C', async () => {
      const result = await generateOk();

      // Тег 'div' даёт HTML-атрибуты: className остаётся, прочее — маркером x-inherits.react.
      expect(Object.keys(propsOf(result, 'GridItem'))).toEqual(['area', 'className', 'span']);
      expect(schemaOf(result, 'GridItem')['x-inherits']).toEqual({
        react: ['AriaAttributes', 'Attributes', 'DOMAttributes', 'HTMLAttributes', 'RefAttributes'],
        packages: [],
      });
      expect(Object.keys(propsOf(result, 'Skeleton'))).toEqual(['flex', 'size']);
    });

    it('нераспознанный тип: служебная запись без перечня пропсов и заметка', async () => {
      const result = await generateOk();

      expect(record(result, 'Unknown')).toMatchObject({
        palette: false,
        propsSchema: { type: 'object', additionalProperties: true },
      });
      expect(result.notices.join('\n')).toContain('тип пропсов не выведен');
      expect(result.notices.join('\n')).toContain('Unknown');
    });
  });

  describe('владение пропсами и x-inherits', () => {
    it('свои пакеты — в properties, @types/react — в x-inherits.react', async () => {
      const result = await generateOk();
      const button = propsOf(result, 'Button');

      expect(Object.keys(button)).toEqual([
        'Zeta',
        'alpha',
        'className',
        'onOpenChange',
        'shape',
        'text',
        'tone',
        'variant',
      ]);
      expect(schemaOf(result, 'Button')['x-inherits']).toEqual({
        react: ['AriaAttributes', 'DOMAttributes', 'HTMLAttributes'],
        packages: [],
      });
    });

    it('DOM-событие уходит, даже переобъявленное своим пакетом; колбэк компонента остаётся', async () => {
      const result = await generateOk();
      const button = propsOf(result, 'Button');

      expect(button.onClick).toBeUndefined();
      expect(button.onOpenChange).toMatchObject({ 'x-doc': { kind: 'readonly' } });
    });

    it('@deprecated-проп не попадает никуда', async () => {
      const result = await generateOk();

      expect(propsOf(result, 'Button').legacySize).toBeUndefined();
    });

    it('проп чужого пакета — в x-inherits.packages; без своего пакета в ownership — тоже', async () => {
      const result = await generateOk();
      expect(schemaOf(result, 'TextInput')['x-inherits']).toEqual({
        react: [],
        packages: ['@acme/base'],
      });
      expect(Object.keys(propsOf(result, 'TextInput'))).not.toContain('size');

      const foreign = await generateOk((c) => ({
        ...c,
        ownership: { packages: [] },
        props: { pick: { Input: ['bordered'] } },
      }));
      expect(Object.keys(propsOf(foreign, 'Card'))).toEqual([]);
      expect(schemaOf(foreign, 'Card')['x-inherits']).toEqual({
        react: [],
        packages: ['@acme/ds'],
      });
      // Исходники кита — свои всегда.
      expect(Object.keys(propsOf(foreign, 'Badge'))).toEqual(['count', 'label', 'tone']);
    });
  });

  describe('props: pick / omit / override', () => {
    it('pick возвращает чужой проп, omit убирает, override уточняет', async () => {
      const result = await generateOk();
      const input = propsOf(result, 'Input');

      expect(input.bordered).toMatchObject({ type: 'boolean' });
      expect(input.validationStatus).toBeUndefined();
      expect(propsOf(result, 'Button').variant).toMatchObject({
        description: 'Вид кнопки (уточнено конфигом).',
        'x-doc': { type: "'primary' | 'secondary' | 'ghost'" },
      });
    });

    it('pick возвращает и HTML-атрибут', async () => {
      const result = await generateOk((c) => ({
        ...c,
        props: { ...c.props, pick: { Button: ['title'] } },
      }));

      expect(propsOf(result, 'Button').title).toMatchObject({ type: 'string' });
    });

    it('override отсутствующего пропа, pick структурного — отказ', async () => {
      const found = await refusals((c) => ({
        ...c,
        props: {
          pick: { Button: ['style'] },
          override: { Card: { nope: { description: 'x' } } },
        },
      }));

      expect(found.map((f) => f.code)).toEqual([
        'catalog-config-invalid',
        'catalog-config-invalid',
      ]);
      expect(found[0]?.message).toContain('«style» не бывает пропсом схемы');
      expect(found[1]?.message).toContain('props.override.Card: пропа «nope»');
    });

    it('групповой селектор, не сработавший ни разу, — отказ', async () => {
      const found = await refusals((c) => ({ ...c, props: { omit: { '@field': ['nope'] } } }));

      expect(found[0]?.message).toContain(
        "props.omit['@field']: пропа «nope» нет ни у одной записи"
      );
    });
  });

  it('enum — в порядке объявления, а не компилятора; умолчания — из JSDoc и деструктуризации', async () => {
    const result = await generateOk();

    expect(propsOf(result, 'Button').variant).toMatchObject({
      enum: ['primary', 'secondary', 'ghost'],
      default: 'primary',
    });
    expect(propsOf(result, 'Badge').tone).toMatchObject({
      enum: ['info', 'warning', 'danger'],
      default: 'info',
    });
    expect(propsOf(result, 'Badge').count).toMatchObject({ default: -1 });
  });

  it('отображаемый тип: без import("…"), ограниченной длины', async () => {
    const result = await generateOk();
    const button = propsOf(result, 'Button');
    const toneType = (button.tone?.['x-doc'] as Json).type as string;

    expect((button.shape?.['x-doc'] as Json).type).toBe('BaseShape');
    expect(toneType.length).toBe(MAX_TS_TYPE_LENGTH);
    expect(toneType.endsWith('…')).toBe(true);
    expect(JSON.stringify(result.catalog)).not.toContain('import(');
  });

  describe('поля', () => {
    it('properties = пропсы обёртки − шов + обёртка поля; x-runtimeProps — тип значения из конфига', async () => {
      const result = await generateOk();

      expect(record(result, 'Input')).toMatchObject({
        role: 'field',
        variantGroup: 'Input',
        variant: 'Текст',
      });
      expect(Object.keys(propsOf(result, 'Input'))).toEqual([
        'bordered',
        'description',
        'label',
        'labelTooltip',
        'placeholder',
        'required',
        'testId',
        'tooltip',
      ]);
      expect(propsOf(result, 'Input').label).toMatchObject({
        description: 'Подпись поля (рендерит FormField.Label).',
      });
      const runtime = schemaOf(result, 'Input')['x-runtimeProps'] as Record<string, Json>;
      expect(Object.keys(runtime)).toEqual(['value', 'onChange', 'onBlur', 'disabled']);
      expect(runtime.value).toMatchObject({ type: 'string | null' });
      expect(runtime.onChange).toMatchObject({ type: '(value: string | null) => void' });
    });

    it('запись поля называет экспорт обёртки; описание значения — из конфига', async () => {
      const result = await generateOk();
      const runtime = schemaOf(result, 'DatePicker')['x-runtimeProps'] as Record<string, Json>;

      expect(record(result, 'DatePicker')).toMatchObject({
        role: 'field',
        exportName: 'DateField',
      });
      expect(Object.keys(propsOf(result, 'DatePicker'))).toContain('hint');
      expect(Object.keys(propsOf(result, 'DatePicker'))).not.toContain('value');
      expect(runtime.value).toEqual({
        group: 'Control',
        type: 'Date | null',
        description: 'Выбранная дата; пусто — null.',
      });
    });

    it('fieldWrapper: false — без обёртки; seam поля убирает свои пропсы', async () => {
      const result = await generateOk((c) => ({
        ...c,
        fieldWrapper: false,
        fields: { ...c.fields, Input: { value: 'string | null', seam: ['placeholder'] } },
      }));

      expect(Object.keys(propsOf(result, 'Input'))).toEqual(['bordered']);
    });

    it('биекция: обёртка с reformerAdapter вне fields — отказ', async () => {
      const found = await refusals((c) => ({
        ...c,
        fields: { Input: { value: 'string | null' } },
      }));

      expect(found).toContainEqual({
        code: 'catalog-config-invalid',
        message:
          'экспорт «DateField» несёт статику reformerAdapter — это поле формы, а fields его не описывает',
      });
    });

    it('биекция: поле без статики reformerAdapter — отказ', async () => {
      const found = await refusals((c) => ({
        ...c,
        fields: { ...c.fields, Button: { value: 'boolean' } },
        palette: [],
      }));

      expect(found.map((f) => f.message).join('\n')).toContain(
        'fields.Button: у экспорта «Button» нет статики reformerAdapter'
      );
    });

    it('непереносимый тип значения — отказ', async () => {
      const found = await refusals((c) => ({
        ...c,
        fields: { ...c.fields, Input: { value: 'Dayjs | null' } },
      }));

      expect(found[0]?.message).toContain('fields.Input.value: тип значения «Dayjs | null»');
    });
  });

  describe('статики и части', () => {
    it('найденная статика без решения — отказ; @deprecated-статика решения не требует', async () => {
      const found = await refusals((c) => ({ ...c, statics: { 'Tabs.TabPane': 'TabPane' } }));

      expect(found).toEqual([
        {
          code: 'catalog-config-invalid',
          message:
            "статики без решения в statics ('ignore' либо имя плоского экспорта кита): TextInput.Password",
        },
      ]);
    });

    it('решение — несуществующий плоский экспорт или устаревший ключ — отказ', async () => {
      const found = await refusals((c) => ({
        ...c,
        statics: { ...c.statics, 'Tabs.TabPane': 'Pane', 'Tabs.Gone': 'ignore' },
      }));

      expect(found).toContainEqual({
        code: 'catalog-symbol-missing',
        message: 'statics.Tabs.TabPane: плоского экспорта «Pane» у входа кита нет',
      });
      expect(found.map((f) => f.message)).toContain(
        'statics: статики «Tabs.Gone» у экспортов входа нет'
      );
    });

    it('часть — только явно (parts): compoundParent', async () => {
      const result = await generateOk();

      expect(record(result, 'TabPane')).toMatchObject({ compoundParent: 'Tabs' });
      expect(record(result, 'TextInput').compoundParent).toBeUndefined();
    });
  });

  describe('классификация', () => {
    it('палитра, limited, service, leaves, разделы — из конфига', async () => {
      const result = await generateOk();

      expect(record(result, 'Button').palette).toBeUndefined();
      expect(record(result, 'TextInput').palette).toBe(false);
      expect(record(result, 'DateRange').preview).toEqual({
        mode: 'limited',
        reason: 'тяжёлый виджет',
      });
      expect(record(result, 'Skeleton').leaf).toBe(true);
      expect(result.notices).toContain('в палитре экспорты с @deprecated: Card');
      expect(result.catalog.kit?.palette).toEqual({
        categoryByName: {
          Input: 'Поля ввода',
          DatePicker: 'Поля ввода',
          Panel: 'Контейнеры',
          Card: 'Контейнеры',
          Tabs: 'Контейнеры',
          GridItem: 'Контейнеры',
          Badge: 'Отображение',
          Skeleton: 'Отображение',
        },
        order: ['Поля ввода', 'Контейнеры', 'Отображение'],
      });
    });

    it('экспорт без роли — служебная запись с заметкой; unclassified: refuse — отказ', async () => {
      const result = await generateOk();
      expect(result.notices[0]).toContain('без роли в конфиге');

      const found = await refusals((c) => ({ ...c, unclassified: 'refuse' }));
      expect(found[0]?.message).toContain('экспорты без роли');
      expect(found[0]?.message).toContain('Unknown');
    });

    it('переименование записи: records.exportName', async () => {
      const result = await generateOk((c) => ({
        ...c,
        records: { Grid: { exportName: 'GridItem' } },
        categories: { ...c.categories, Контейнеры: ['Panel', 'Card', 'Tabs', 'Grid'] },
      }));

      expect(record(result, 'Grid')).toMatchObject({ exportName: 'GridItem' });
      expect(result.catalog.components.map((r) => r.name)).not.toContain('GridItem');
    });
  });

  describe('отказы генерации', () => {
    it('имя из конфига без записи', async () => {
      const found = await refusals((c) => ({
        ...c,
        categories: { Прочее: ['Nope'] },
        leaves: ['Ghost'],
        exclude: [...(c.exclude ?? []), 'Missing'],
      }));

      expect(found.map((f) => f.message)).toEqual(
        expect.arrayContaining([
          'exclude: экспорта «Missing» у входа кита нет',
          'categories.Прочее: записи «Nope» нет',
          'leaves: записи «Ghost» нет',
        ])
      );
    });

    it('конфликт с синтетикой билдера: Wizard в каталоге', async () => {
      const found = await refusals((c) => ({ ...c, exclude: [] }));

      expect(found[0]?.message).toContain(
        'запись «Wizard» совпадает с синтетической записью билдера'
      );
    });

    it('символ записи, infra или adapters не экспортирован входом', async () => {
      const found = await refusals((c) => ({
        ...c,
        kit: {
          ...c.kit,
          infra: { fieldWrapper: 'FormField' },
          adapters: { wizard: { symbol: 'FormWizard' } },
        },
        records: { Separator: { exportName: 'Divider' } },
      }));

      expect(found.map((f) => f.code)).toEqual([
        'catalog-symbol-missing',
        'catalog-symbol-missing',
        'catalog-symbol-missing',
      ]);
      expect(found.map((f) => f.message)).toEqual(
        expect.arrayContaining([
          'records.Separator: экспорта «Divider» у входа кита нет',
          'kit.infra.fieldWrapper: экспорта «FormField» у входа кита нет',
          'kit.adapters.wizard: экспорта «FormWizard» у входа кита нет',
        ])
      );
    });

    it('у палитровой записи не выведены пропсы; запасной путь — propsFrom', async () => {
      const found = await refusals((c) => ({ ...c, palette: ['Button', 'Unknown'] }));
      expect(found[0]?.message).toContain('запись «Unknown» в палитре, но тип пропсов');

      const borrowed = await generateOk((c) => ({
        ...c,
        palette: ['Button', 'Unknown'],
        records: { Unknown: { propsFrom: 'Card' } },
      }));
      expect(Object.keys(propsOf(borrowed, 'Unknown'))).toEqual(['elevated']);
    });

    it('противоречие ролей: service и палитра одновременно', async () => {
      const found = await refusals((c) => ({ ...c, service: [...(c.service ?? []), 'Button'] }));

      expect(found[0]?.message).toBe('«Button» одновременно служебная (service) и в палитре');
    });

    it('форма конфига проверяется до TypeScript', async () => {
      const found = await refusals((c) => ({ ...c, categoris: {} }) as unknown as KitCatalogConfig);

      expect(found).toEqual([
        { code: 'catalog-config-invalid', message: 'categoris: неизвестный ключ' },
      ]);
    });
  });

  it('детерминизм: два прогона дают один и тот же текст', async () => {
    const first = await generateOk();
    const second = await generateOk();

    expect(second.text).toBe(first.text);
    expect(first.text.endsWith('\n')).toBe(true);
  });

  it('относительный каталог кита даёт тот же каталог: пропсы исходников кита остаются своими', async () => {
    const absolute = await generateOk();
    const result = await generateKitCatalog({
      dir: relative(process.cwd(), ROOT),
      config: acmeConfig(),
      typescript: ts,
      compilerHost: memoryHost(ts, absoluteFiles(ROOT, ACME_FILES)),
      prettier: false,
    });
    if (!result.ok) throw new Error(JSON.stringify(result.findings, null, 2));

    expect(result.text).toBe(absolute.text);
  });
});

describe('помощники отображения и переносимости', () => {
  it('splitTopLevelUnion не режет сигнатуры и строки', () => {
    expect(splitTopLevelUnion("((a: string | number) => void) | 'x|y' | undefined")).toEqual([
      '((a: string | number) => void)',
      "'x|y'",
      'undefined',
    ]);
  });

  it('displayType снимает import("…"), undefined и лишние скобки', () => {
    expect(displayType('import("D:/x/node_modules/@acme/base/index").BaseShape | undefined')).toBe(
      'BaseShape'
    );
    expect(displayType('(() => void) | undefined')).toBe('() => void');
    expect(displayType('(a: string) => (b: number)')).toBe('(a: string) => (b: number)');
  });

  it('compareCodePoints — не localeCompare', () => {
    expect(['b', 'a', 'Z', 'é'].sort(compareCodePoints)).toEqual(['Z', 'a', 'b', 'é']);
  });

  it('portableTypeProblem: встроенные типы — да, типы пакетов и typeof — нет', () => {
    expect(portableTypeProblem(ts, 'string | null')).toBeUndefined();
    expect(portableTypeProblem(ts, '[Date, Date] | null')).toBeUndefined();
    expect(portableTypeProblem(ts, 'Record<string, number[]> | null')).toBeUndefined();
    expect(portableTypeProblem(ts, 'File[] | null')).toBeUndefined();
    expect(portableTypeProblem(ts, 'Dayjs')).toContain('«Dayjs»');
    expect(portableTypeProblem(ts, 'import("x").Y')).toContain('импортирует');
    expect(portableTypeProblem(ts, 'typeof value')).toContain('typeof');
    expect(portableTypeProblem(ts, 'string |')).toContain('не разбирается');
  });
});
