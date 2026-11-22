import { beforeAll, describe, expect, it } from 'vitest';
import { loadCatalogValidator, type CatalogValidator } from './validator.js';

// Движок грузится один раз на файл: асинхронна только загрузка, проверка синхронна.
let validate: CatalogValidator;
beforeAll(async () => {
  validate = await loadCatalogValidator();
});

const record = (extra: Record<string, unknown> = {}) => ({
  name: 'X',
  role: 'container',
  propsSchema: {},
  ...extra,
});
const withKit = (kit: unknown) => ({ version: '2.1', components: [record()], kit });

describe('загрузка проверки', () => {
  it('повторный вызов отдаёт ту же проверку: движок и схема компилируются один раз', async () => {
    const [first, second] = await Promise.all([loadCatalogValidator(), loadCatalogValidator()]);
    expect(first).toBe(second);
    expect(first).toBe(validate);
  });
});

describe('контракт 1.0: записи', () => {
  it('каталог без блока kit валиден — разбирать его можно, принимать решает реестр', () => {
    expect(validate({ version: '1.0', components: [record()] })).toEqual({
      valid: true,
      errors: [],
    });
  });

  it('битый каталог отклоняется с указанием места', () => {
    const missingVersion = validate({ components: [] });
    expect(missingVersion.valid).toBe(false);
    expect(missingVersion.errors.join('\n')).toContain('version');
    expect(validate({ version: '1.0', components: [record({ role: 'widget' })] }).valid).toBe(
      false
    );
    expect(validate({ version: '1.0', components: [{ name: 'X', role: 'field' }] }).valid).toBe(
      false
    );
  });
});

describe('контракт 2.0: блок kit и поля записей', () => {
  it('полный блок kit проходит', () => {
    const result = validate(
      withKit({
        id: 'acme',
        label: 'Acme DS',
        package: '@acme/ds',
        version: '2.1.0',
        peerRanges: { '@reformer/core': '^7' },
        infra: { fieldWrapper: 'Field', asyncBoundary: 'Async', list: 'Repeater' },
        adapters: { wizard: { symbol: 'Stepper', subpath: 'stepper' }, step: null, provider: null },
        palette: { categoryByName: { Btn: 'Действия' }, order: ['Действия'], glyphs: { Btn: 'B' } },
        styles: { mode: 'standalone', href: 'https://cdn.example/acme.css' },
        codegen: { importSpecifier: '@acme/ds', needsShim: ['Stepper'] },
      })
    );
    expect(result.errors).toEqual([]);
  });

  it('поля записей проходят', () => {
    const result = validate({
      version: '2.0',
      components: [
        record({ exportName: 'ChartContainer', subpath: 'chart' }),
        record({ name: 'Y', preview: { mode: 'limited', reason: 'нужен портал' } }),
        record({ name: 'Z', leaf: true, palette: false, classGroups: [] }),
      ],
    });
    expect(result.errors).toEqual([]);
  });

  it('группа словаря — закрытая форма с kebab-case id', () => {
    const styles = (classNames: unknown) => withKit({ styles: { classNames } });
    expect(validate(styles([{ id: 'spacing', label: 'Отступы', classes: ['p-4'] }])).valid).toBe(
      true
    );
    expect(validate(styles([{ id: 'spacing', label: 'Отступы' }])).valid).toBe(false);
    expect(validate(styles([{ id: 'Spacing', label: 'X', classes: [] }])).valid).toBe(false);
  });

  it('classGroupsByRole — только "*" или список групп', () => {
    expect(validate(withKit({ styles: { classGroupsByRole: { field: '*' } } })).valid).toBe(true);
    expect(validate(withKit({ styles: { classGroupsByRole: { field: 'spacing' } } })).valid).toBe(
      false
    );
  });

  it('мусор ловится и в блоке kit, и в записи', () => {
    expect(validate(withKit({ id: 'acme', bogus: 1 })).valid).toBe(false);
    expect(validate({ version: '2.0', components: [record({ bogus: 1 })] }).valid).toBe(false);
    expect(
      validate({ version: '2.0', components: [record({ preview: { mode: 'maybe' } })] }).valid
    ).toBe(false);
    expect(validate(withKit({ adapters: { wizard: 'Stepper' } })).valid).toBe(false);
  });
});

describe('контракт 2.1: рамка поля и подсказки стекам', () => {
  it('рамка поля и тема RJSF проходят', () => {
    const result = validate(
      withKit({
        id: 'acme',
        infra: { fieldFrame: 'Field' },
        renderers: {
          rjsf: {
            widgets: { TextWidget: 'TextField', CheckboxWidget: 'Toggle' },
            templates: { field: 'Field', object: 'Stack', submit: 'Button' },
          },
        },
      })
    );
    expect(result.errors).toEqual([]);
  });

  it('подсказки стекам — закрытая форма', () => {
    expect(validate(withKit({ renderers: { vue: {} } })).valid).toBe(false);
    expect(validate(withKit({ renderers: { rjsf: { templates: { array: 'List' } } } })).valid).toBe(
      false
    );
    expect(validate(withKit({ renderers: { rjsf: { widgets: { TextWidget: '' } } } })).valid).toBe(
      false
    );
  });
});
