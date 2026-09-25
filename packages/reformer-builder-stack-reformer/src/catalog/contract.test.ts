import { beforeAll, describe, expect, it } from 'vitest';
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
import { loadCatalogValidator, type CatalogValidator } from '@reformer/builder-plugin-api/tooling';
import { composeCatalogJson, buildCatalogFromJson } from './contract';
import { kindOf } from '../form-model/node-kind';
import { BUILTIN_CATALOG } from './__fixtures__/builtin-catalog';
import type { CatalogJson } from './types';

// Движок грузится один раз на файл: проверка синхронная, асинхронна только загрузка,
// поэтому ни одному из вызовов ниже про это знать не нужно.
let validateCatalog: CatalogValidator;
beforeAll(async () => {
  validateCatalog = await loadCatalogValidator();
});

/** Каталог встроенного кита, склеенный с синтетикой билдера, — то же, что собирает `buildCatalog`. */
const composed = () => composeCatalogJson(BUILTIN_CATALOG);

describe('composeCatalogJson (каталог ui-kit + синтетические)', () => {
  const json = composed();

  it('версия + ВСЕ rich-компоненты ui-kit + синтетические', () => {
    expect(typeof json.version).toBe('string');
    expect(json.version.length).toBeGreaterThan(0);
    const names = new Set(json.components.map((c) => c.name));
    // Все rich-компоненты (defaultPropSchemas) присутствуют.
    for (const name of Object.keys(defaultPropSchemas)) expect(names.has(name)).toBe(true);
    // Синтетические билдера.
    expect(names.has('$html(div)')).toBe(true);
    expect(names.has('FormArray')).toBe(true);
  });

  it('все компоненты доступны: minimal-записи тоже в каталоге', () => {
    const names = new Set(json.components.map((c) => c.name));
    // Компоненты без props.ts (minimal) — тоже в палитре.
    for (const name of ['Alert', 'Card', 'Accordion', 'Tabs', 'Dialog', 'Tooltip', 'Table']) {
      expect(names.has(name)).toBe(true);
    }
    // Каталог существенно шире 20 rich-компонентов.
    expect(json.components.length).toBeGreaterThan(40);
  });

  it('явный role у каждой записи', () => {
    expect(json.components.every((c) => ['field', 'container', 'array'].includes(c.role))).toBe(
      true
    );
    expect(json.components.find((c) => c.name === 'Input')?.role).toBe('field');
    expect(json.components.find((c) => c.name === 'Box')?.role).toBe('container');
    expect(json.components.find((c) => c.name === 'FormArray')?.role).toBe('array');
  });
});

// Синтаксис контракта (версии, блок kit, поля записей) проверяют тесты SDK
// (`@reformer/builder-plugin-api`, `kits/validator.test.ts`); здесь — что НАСТОЯЩИЙ каталог
// встроенного кита вместе с синтетикой билдера этот контракт проходит.
describe('validateCatalog (контракт)', () => {
  it('каталог кита, как его поставляет ui-kit, проходит контракт', () => {
    expect(validateCatalog(BUILTIN_CATALOG)).toEqual({ valid: true, errors: [] });
  });

  it('поставляемый каталог проходит контракт (self-check)', () => {
    const res = validateCatalog(composed());
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });
});

describe('buildCatalogFromJson (реконструкция makeNode + категория)', () => {
  it('makeNode восстанавливается, kindOf совпадает с role', () => {
    const entries = buildCatalogFromJson(composed());
    for (const e of entries) expect(kindOf(e.makeNode())).toBe(e.role);
  });

  it('категория палитры назначается каждой записи', () => {
    const entries = buildCatalogFromJson(composed());
    for (const e of entries) {
      expect(typeof e.category).toBe('string');
      expect((e.category ?? '').length).toBeGreaterThan(0);
    }
    expect(entries.find((e) => e.name === 'Input')?.category).toBe('Поля ввода');
    expect(entries.find((e) => e.name === 'Dialog')?.category).toBe('Оверлеи');
  });
});

/**
 * Источник каталога и фильтры. В v1 всё это ставилось в module-level состояние
 * (`config/state.setClientCatalog`/`setRuntimeConfig`), а `loadCatalogJson()` читала его молча —
 * поэтому тесты были обязаны прибирать за собой `afterEach(resetRuntimeState)`, иначе протекали
 * друг в друга. Здесь и источник, и конфиг — аргументы: убирать нечего и протечь нечему.
 */
describe('источник каталога и фильтры (аргументы, не состояние)', () => {
  const clientCatalog: CatalogJson = {
    version: '9.9',
    components: [{ name: 'ClientOnly', role: 'field', propsSchema: {} }],
  };

  it('клиентский каталог замещает вшитый ui-kit (+ синтетические билдера)', () => {
    const json = composeCatalogJson(clientCatalog);
    const names = new Set(json.components.map((c) => c.name));
    expect(json.version).toBe('9.9');
    expect(names.has('ClientOnly')).toBe(true);
    expect(names.has('Input')).toBe(false); // ui-kit компонентов больше нет
    expect(names.has('$html(div)')).toBe(true); // синтетические билдера остаются
  });

  it('include — whitelist по имени', () => {
    const names = composeCatalogJson(BUILTIN_CATALOG, { include: ['Input'] }).components.map(
      (c) => c.name
    );
    expect(names).toContain('Input');
    expect(names).not.toContain('Select');
    expect(names).not.toContain('$html(div)'); // синтетические вне include тоже отсеиваются
  });

  it('exclude — blacklist по имени', () => {
    const names = new Set(
      composeCatalogJson(BUILTIN_CATALOG, { exclude: ['Chart'] }).components.map((c) => c.name)
    );
    expect(names.has('Chart')).toBe(false);
    expect(names.has('Input')).toBe(true);
  });

  it('synthetic-тоглы: отключить wizard/formArray, сузить html', () => {
    const names = new Set(
      composeCatalogJson(BUILTIN_CATALOG, {
        synthetic: { wizard: false, formArray: false, htmlTags: ['div'] },
      }).components.map((c) => c.name)
    );
    expect(names.has('Wizard')).toBe(false);
    expect(names.has('Step')).toBe(false);
    expect(names.has('FormArray')).toBe(false);
    expect(names.has('$html(div)')).toBe(true);
    expect(names.has('$html(section)')).toBe(false);
    expect(names.has('Input')).toBe(true); // компоненты каталога не тронуты
  });

  it('categoryByName переопределяет категорию', () => {
    const entries = buildCatalogFromJson(composed(), undefined, { Input: 'Кастом-поля' });
    expect(entries.find((e) => e.name === 'Input')?.category).toBe('Кастом-поля');
  });

  it('синтетическая запись выигрывает у одноимённой клиентской (FormArray — array-узел)', () => {
    // У кита `FormArray` — обычный React-компонент; у билдера — array-узел со своей ролью.
    // Дубль имени снимается на границе источника, иначе ломается ТИП узла, а не только палитра.
    const json = composeCatalogJson({
      version: '1.0',
      components: [{ name: 'FormArray', role: 'container', propsSchema: {} }],
    });
    const formArray = json.components.filter((c) => c.name === 'FormArray');
    expect(formArray).toHaveLength(1);
    expect(formArray[0].role).toBe('array');
  });

  it('записи с palette: false в каталог не идут (метаданные без размещаемого узла)', () => {
    const json = composeCatalogJson({
      version: '2.0',
      components: [
        { name: 'Portal', role: 'container', propsSchema: {}, palette: false },
        { name: 'Box', role: 'container', propsSchema: {} },
      ],
    });
    const names = new Set(json.components.map((c) => c.name));
    expect(names.has('Portal')).toBe(false);
    expect(names.has('Box')).toBe(true);
  });
});
