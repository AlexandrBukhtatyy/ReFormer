/**
 * Подпуть записи каталога встречается с пространством имён встроенного кита.
 *
 * Подпуть значит одно — откуда импортируется символ записи. Рисовать ли компонент вживую, решает
 * не он, а факт: есть ли символ в пространстве имён активного кита. Каталог встроенного кита
 * объявляет подпуть каждой записи, которой нет в главном входе пакета, а его пространство имён
 * (`plugins/forms/kits`) собрано из главного входа и ПОЛЕЙ с подпутей. Политика превью
 * (`plugins/reformer/render`) обязана развести их по факту: комбобокс и выбор даты — живые,
 * карусель и таблица — подписанные заглушки. Каталог, пространство имён и политика живут в трёх
 * разных местах, и встретиться они могут только здесь.
 *
 * Второй стык — кит, внесённый ПЛАГИНОМ. Его пакета в реестре модулей оболочки нет: импорт кита
 * коду формы подставляет компилирующая поверхность — пространством имён кита, по спецификатору
 * (`plugins/reformer/render/compiling/kit-imports`). Кодоген печатает импорт записи с подпутём
 * как `<пакет>/<подпуть>`, а линковщик оболочки сверяет подстановку с текстом импорта точным
 * совпадением. Сойтись эти три места — каталог кита, подстановки превью и линковщик — могут
 * только на настоящем линковщике.
 *
 * @module shell/boot/integration/kit-subpaths.test
 */

import { describe, expect, it } from 'vitest';
import { exportNameFor, toDescriptor, type KitNamespace } from '@reformer/builder-plugin-api';
import { RUNTIME_MODULES } from '@/application/composer/runtime-modules';
import { createPluginModules } from '@/shell/boot/plugin-modules';
import { loadBuiltinNamespace } from '../../forms/kits/src/builtin';
import { builtinCatalog } from '../core/testing';
import { compileForm } from '../render/src/compiling/compile';
import { extractContract, runFactories } from '../render/src/compiling/exports';
import { kitImportOverrides } from '../render/src/compiling/kit-imports';
import { planModule } from '../render/src/compiling/module';
import type { PreviewModules } from '../render/src/host';
import { classifyEntry } from '../render/src/runtime/policy';

const BUILT = builtinCatalog();

/** Записи палитры, объявившие подпуть, и то, что о них решила политика превью. */
function decisions(namespace: KitNamespace) {
  return BUILT.entries
    .filter((entry) => BUILT.descriptor.subpaths.has(entry.name))
    .map((entry) => ({
      name: entry.name,
      role: entry.role,
      subpath: BUILT.descriptor.subpaths.get(entry.name) ?? '',
      inNamespace: namespace[exportNameFor(entry)] !== undefined,
      decision: classifyEntry(entry, namespace, BUILT.descriptor),
    }));
}

// Свой запас времени: пространство имён кита — импорт всего кита с подпутями, на холодном кеше
// трансформаций он занимает секунды.
describe('подпуть записи и пространство имён встроенного кита', { timeout: 30_000 }, () => {
  it('поле за подпутём рисуется вживую: его символ в пространстве имён есть', async () => {
    const all = decisions(await loadBuiltinNamespace());
    const fields = all.filter((item) => item.role === 'field');

    // Поля, ради которых подпуть перестал означать заглушку.
    expect(fields.map((item) => item.name).sort()).toEqual(
      [
        'Calendar',
        'Combobox',
        'ComboboxMulti',
        'ComboboxTree',
        'ComboboxTreeMulti',
        'DatePicker',
        'InputOTP',
      ].sort()
    );
    for (const field of fields) {
      expect(field.inNamespace, field.name).toBe(true);
      expect(field.decision.policy, field.name).toBe('live');
    }
  });

  it('живой или заглушка — по факту наличия символа, а не по подпутю', async () => {
    const all = decisions(await loadBuiltinNamespace());

    expect(all.length).toBeGreaterThan(20);
    for (const item of all) {
      // Одно и то же свойство «объявлен подпуть» — у обеих половин; различает их только факт.
      expect(item.decision.policy, item.name).toBe(item.inNamespace ? 'live' : 'limited');
    }
    // Обе половины непусты — иначе проверка выше ничего не различала бы.
    expect(all.some((item) => item.inNamespace)).toBe(true);
    expect(all.some((item) => !item.inNamespace)).toBe(true);
  });

  it('заглушка называет подпуть, который превью не загрузило', async () => {
    const byName = new Map(
      decisions(await loadBuiltinNamespace()).map((item) => [item.name, item.decision])
    );

    // Карусель, таблица и график форме не нужны — пространство имён их подпути не грузит.
    expect(byName.get('Carousel')).toEqual({
      policy: 'limited',
      reason: 'лежит в @reformer/ui-kit/carousel — этот подпуть в превью не загружен',
    });
    expect(byName.get('Table')).toEqual({
      policy: 'limited',
      reason: 'лежит в @reformer/ui-kit/table — этот подпуть в превью не загружен',
    });
    // Часть составного компонента объясняется своим подпутём — тем же, что у корня.
    expect(byName.get('CarouselItem')).toEqual(byName.get('Carousel'));
    // Корень графика лежит под другим именем экспорта, но адрес тот же.
    expect(byName.get('Chart')).toEqual({
      policy: 'limited',
      reason: 'лежит в @reformer/ui-kit/chart — этот подпуть в превью не загружен',
    });
  });

  it('без пространства имён (кит ещё не доехал) заглушкой становится и поле', () => {
    const all = decisions({});
    for (const item of all) expect(item.decision.policy, item.name).toBe('limited');
  });
});

describe('подпуть кита, внесённого плагином, в компилирующем превью', { timeout: 30_000 }, () => {
  // Синтетический кит `@vendor/hexa`: поле ввода — в главном входе, график — за подпутём, визард
  // — за подпутём адаптера. В реестре оболочки пакета нет, компоненты живут в пространстве имён.
  const Input = (): null => null;
  const Chart = (): null => null;
  const Wizard = (): null => null;
  const namespace: KitNamespace = { Input, Chart, Wizard };
  const descriptor = toDescriptor({
    version: '2.1',
    kit: {
      id: 'hexa',
      label: 'Hexa',
      package: '@vendor/hexa',
      adapters: { wizard: { symbol: 'Wizard', subpath: 'wizard' } },
    },
    components: [
      { name: 'Input', role: 'field', propsSchema: {} },
      { name: 'Chart', role: 'container', propsSchema: {}, subpath: 'chart' },
    ],
  });

  /** Реестр формы, как его печатает кодоген под таким китом: импорты — по входам пакета. */
  const FILES: ReadonlyMap<string, string> = new Map([
    [
      'schema/registry.ts',
      [
        "import { Input } from '@vendor/hexa';",
        "import { Chart } from '@vendor/hexa/chart';",
        "import { Wizard } from '@vendor/hexa/wizard';",
        "import { defineRegistry, type ComponentRegistry } from '@reformer/renderer-json';",
        '',
        'export const seen = { Input, Chart, Wizard };',
        '',
        'export function createRegistry(): ComponentRegistry {',
        '  return defineRegistry((reg) => {',
        "    reg.component('Input', Input);",
        "    reg.component('Chart', Chart);",
        "    reg.component('Wizard', Wizard);",
        '  });',
        '}',
        '',
      ].join('\n'),
    ],
  ]);

  /** Скомпилировать реестр настоящим линковщиком оболочки с такими подстановками. */
  async function compiled(overrides: ReadonlyMap<string, unknown>) {
    const plugin = createPluginModules({ modules: RUNTIME_MODULES });
    const loader: PreviewModules = {
      load: plugin.modules.load,
      prepare: async (set) => {
        const [primed] = await Promise.all([plugin.prepareCached(set), plugin.warm(set)]);
        return primed;
      },
    };
    const plan = planModule(FILES.keys());
    try {
      const result = await compileForm(FILES, loader, { overrides }, plan);
      return { result, contract: extractContract(result.modules, plan) };
    } finally {
      plugin.dispose();
    }
  }

  it('оболочка пакета кита-плагина не отдаёт — ни корня, ни подпутей', () => {
    const plugin = createPluginModules({ modules: RUNTIME_MODULES });
    for (const specifier of ['@vendor/hexa', '@vendor/hexa/chart', '@vendor/hexa/wizard']) {
      expect(plugin.specifiers).not.toContain(specifier);
    }
    plugin.dispose();
  });

  it('импорты с подпутей записи и адаптера линкуются в пространство имён кита', async () => {
    const { result, contract } = await compiled(
      kitImportOverrides({
        origin: { kind: 'plugin', pluginId: 'kit-hexa' },
        descriptor,
        namespace,
      })
    );

    expect(result.problems).toEqual([]);
    // Корень и оба подпутя отдали символы ОДНОГО пространства имён.
    expect(result.modules.get('schema/registry.ts')).toMatchObject({
      seen: { Input, Chart, Wizard },
    });
    const values = runFactories(contract);
    expect(values.problems).toEqual([]);
    expect(values.registry).toBeDefined();
  });

  it('контроль — подставь превью только корень, реестр формы не слинковался бы', async () => {
    // Так было: форма под китом плагина с записью-подпутём теряла реестр целиком.
    const { result, contract } = await compiled(
      new Map<string, unknown>([['@vendor/hexa', namespace]])
    );

    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]).toMatchObject({ file: 'schema/registry.ts', phase: 'resolve' });
    expect(result.problems[0]?.message).toContain('@vendor/hexa/chart');
    expect(contract.createRegistry).toBeUndefined();
  });
});
