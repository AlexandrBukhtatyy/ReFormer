import { beforeAll, describe, expect, it } from 'vitest';
import { defaultPropSchemas } from '@reformer/ui-kit/meta';
import { loadCatalogValidator, type CatalogValidator } from '@reformer/builder-plugin-api/tooling';
import { buildCatalog } from './catalog';
import { composeCatalogJson, buildCatalogFromJson, kitFactsOf } from './contract';
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
    expect(names.has('FieldArray')).toBe(true);
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
    expect(json.components.find((c) => c.name === 'FieldArray')?.role).toBe('array');
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

  it('synthetic-тоглы: отключить wizard/fieldArray, сузить html', () => {
    const names = new Set(
      composeCatalogJson(BUILTIN_CATALOG, {
        synthetic: { wizard: false, fieldArray: false, htmlTags: ['div'] },
      }).components.map((c) => c.name)
    );
    expect(names.has('Wizard')).toBe(false);
    expect(names.has('Step')).toBe(false);
    expect(names.has('FieldArray')).toBe(false);
    expect(names.has('$html(div)')).toBe(true);
    expect(names.has('$html(section)')).toBe(false);
    expect(names.has('Input')).toBe(true); // компоненты каталога не тронуты
  });

  it('прежний ключ тогла `formArray` — ошибка, а не молча пропущенная настройка', () => {
    // Конфиг клиента — данные: без ошибки запись массива вернулась бы в палитру незаметно.
    const legacy = { synthetic: { formArray: false } } as unknown as Parameters<
      typeof composeCatalogJson
    >[1];
    expect(() => composeCatalogJson(BUILTIN_CATALOG, legacy)).toThrow(
      /synthetic.formArray.*fieldArray/
    );
  });

  it('categoryByName переопределяет категорию', () => {
    const entries = buildCatalogFromJson(composed(), undefined, { Input: 'Кастом-поля' });
    expect(entries.find((e) => e.name === 'Input')?.category).toBe('Кастом-поля');
  });

  it('синтетическая запись выигрывает у одноимённой клиентской (FieldArray — array-узел)', () => {
    // У кита `FieldArray` — обычный React-компонент; у билдера — array-узел со своей ролью.
    // Дубль имени снимается на границе источника, иначе ломается ТИП узла, а не только палитра.
    const json = composeCatalogJson({
      version: '1.0',
      components: [{ name: 'FieldArray', role: 'container', propsSchema: {} }],
    });
    const fieldArray = json.components.filter((c) => c.name === 'FieldArray');
    expect(fieldArray).toHaveLength(1);
    expect(fieldArray[0].role).toBe('array');
  });

  it('узел-массив из палитры несёт компонент кита, когда кит умеет его рисовать', () => {
    // Встроенный кит поставляет `FieldArray`: без `component` рендерер клал бы строки подряд —
    // без заголовка и кнопок «добавить» / «удалить».
    const builtin = buildCatalog(BUILTIN_CATALOG);
    const array = builtin.entries.find((entry) => entry.role === 'array');
    expect(array?.makeNode()).toMatchObject({
      model: '$model(items)',
      component: '$component(FieldArray)',
    });
    expect(kindOf(array!.makeNode())).toBe('array');
  });

  it('у кита без компонента массива узел остаётся без component', () => {
    // Ссылка на компонент, которого у кита нет, дала бы заглушку на месте строк.
    const bare = buildCatalog({
      version: '2.0',
      components: [{ name: 'Box', role: 'container', propsSchema: {} }],
    });
    const array = bare.entries.find((entry) => entry.role === 'array');
    expect(array).toBeDefined();
    expect(array?.makeNode()).not.toHaveProperty('component');
    expect(kitFactsOf(BUILTIN_CATALOG)).toEqual({ arrayComponent: 'FieldArray' });
    expect(kitFactsOf({ version: '2.0', components: [] })).toEqual({});
  });

  it('составной компонент кита без частей шаблона вставляется контейнером', () => {
    // Как у HexaUI: `Card` и `Alert` есть, `CardHeader`/`AlertTitle` — нет. Шаблон ui-kit вставил
    // бы ссылки на части, которых в ките нет: заглушки в превью и импорты в никуда в модуле.
    const kit = buildCatalog({
      version: '3.0',
      components: [
        { name: 'Card', role: 'container', propsSchema: {} },
        { name: 'Alert', role: 'container', propsSchema: {} },
      ],
    });
    for (const name of ['Card', 'Alert']) {
      expect(kit.entries.find((entry) => entry.name === name)?.makeNode()).toEqual({
        component: `$component(${name})`,
        componentProps: { className: 'space-y-4' },
        children: [],
      });
    }
  });

  it('кит со всеми частями шаблона получает собранную композицию', () => {
    const kit = buildCatalog({
      version: '3.0',
      components: [
        { name: 'Alert', role: 'container', propsSchema: {} },
        { name: 'AlertTitle', role: 'container', propsSchema: {}, compoundParent: 'Alert' },
        { name: 'AlertDescription', role: 'container', propsSchema: {}, compoundParent: 'Alert' },
      ],
    });
    const alert = kit.entries.find((entry) => entry.name === 'Alert')?.makeNode();
    expect(alert).toEqual({
      component: '$component(Alert)',
      children: [
        { component: '$component(AlertTitle)', children: ['Заголовок'] },
        { component: '$component(AlertDescription)', children: ['Описание'] },
      ],
    });
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
