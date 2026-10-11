/**
 * Чем в реестре регистрируются визард и тело шага.
 *
 * Текст `schema/registry.ts` удерживают побайтовые снимки (`plugins/reformer/codegen/golden.test.ts`,
 * комбинации `wizard-builtin`, `wizard-foreign` и `wizard-no-adapter`). Здесь проверяется РЕШЕНИЕ:
 * какой символ и откуда импортировать, а когда — заглушка. Снимком оно не выражается: причину,
 * по которой вместо символа стоит заглушка, состав модуля не называет.
 *
 * Прежде тот же вопрос звучал как «нужен ли форме шим визарда»: переходник приложения
 * (`wizard.tsx`) печатался отдельным файлом. Шима больше нет — визард библиотечный, и вопрос
 * свёлся к привязке в реестре.
 *
 * Второй вопрос — из какого ВХОДА пакета кита берётся символ записи: главного или подпутя,
 * который запись объявила. Подпуть — не причина для заглушки, а адрес импорта.
 *
 * @module plugins/reformer/core/codegen/view/registry.test
 */

import { describe, expect, it } from 'vitest';
import { renderTemplate } from '@reformer/builder-toolkit';
import type { JsonFormSchema, JsonNode } from '@reformer/renderer-json';
import {
  builtinKit,
  foreignKit,
  noWizardKit,
  plainSchema,
  subpathSchema,
  wizardSchema,
} from '../__fixtures__/kit';
import { prepare, type CodegenInput, type EmitContext } from '../context';
import { registryTemplate } from '../templates';
import { buildView } from './index';
import { registryView, STEP_IMPORT } from './registry';

function ctxOf(input: Partial<CodegenInput> = {}): EmitContext {
  return prepare({
    schema: input.schema ?? plainSchema(),
    formName: input.formName ?? 'Заявка на кредит',
    kit: input.kit ?? builtinKit(),
  });
}

describe('визард в реестре — библиотечный компонент кита', () => {
  it('визард в схеме и адаптер у кита — узел регистрируется символом адаптера', () => {
    const registry = registryView(ctxOf({ schema: wizardSchema() }));
    expect(registry.wizard).toMatchObject({ hostNames: ['Wizard'], symbol: 'FormWizard' });
    // Главный вход, а не подпуть: символ визарда лежит в бочке кита, и адаптер подпуть не
    // объявляет — его называют только тому, чего в главном входе нет.
    expect(registry.wizard?.importFrom).toBe('@reformer/ui-kit');
    // Символ из главного входа кита уезжает одной строкой импорта с остальными компонентами.
    expect(registry.kitSymbols).toContain('FormWizard');
  });

  it('тело шага — из cdk у любого кита, отдельной строкой импорта', () => {
    const registry = registryView(ctxOf({ schema: wizardSchema() }));
    expect(registry.wizard?.stepName).toBe('Step');
    expect(registry.extraImports).toEqual([{ symbols: ['Step'], from: STEP_IMPORT }]);
    expect(STEP_IMPORT).toBe('@reformer/cdk/form-wizard');
    // Ни визард, ни шаг второй раз не привязываются — и заглушек под них нет.
    expect(registry.components.map((c) => c.name)).not.toContain('Wizard');
    expect(registry.components.map((c) => c.name)).not.toContain('Step');
    expect(registry.hasPlaceholder).toBe(false);
  });

  it('чужой кит даёт свой символ и свой subpath', () => {
    const registry = registryView(ctxOf({ schema: wizardSchema(), kit: foreignKit() }));
    expect(registry.wizard?.symbol).toBe('HexWizard');
    expect(registry.wizard?.importFrom).toBe('@hexa/ui/wizard');
    // Символ за подпутём в импорт главного входа кита не попадает.
    expect(registry.kitSymbols).not.toContain('HexWizard');
    expect(registry.extraImports).toEqual([
      { symbols: ['HexWizard'], from: '@hexa/ui/wizard' },
      { symbols: ['Step'], from: STEP_IMPORT },
    ]);
  });

  it('кит без адаптера визарда получает заглушки с причиной — и для хозяина шагов, и для шага', () => {
    // Отказ, который это удерживает: раньше в таком случае печатался импорт из пакета,
    // которого у кита нет, и форма не собиралась у пользователя. Теперь оба имени
    // регистрируются заглушкой с причиной — см. снимок `wizard-no-adapter`.
    const registry = registryView(ctxOf({ schema: wizardSchema(), kit: noWizardKit() }));
    expect(registry.wizard).toBeNull();
    expect(registry.extraImports).toEqual([]);
    const placeholders = registry.components.filter((c) => c.placeholder);
    expect(placeholders.map((c) => c.name).sort()).toEqual(['Step', 'Wizard']);
    for (const placeholder of placeholders) {
      expect(placeholder.symbol).toBeNull();
      expect(placeholder.reason).toBe('кит «HexaUI» не поставляет адаптер визарда');
    }
  });

  it('форма без визарда привязки визарда не имеет', () => {
    const registry = registryView(ctxOf());
    expect(registry.wizard).toBeNull();
    expect(registry.extraImports).toEqual([]);
  });
});

describe('импорты кита — по входам пакета', () => {
  /** Плоская форма из перечисленных компонентов: проверяется импорт, а не разметка. */
  function schemaOf(...components: readonly string[]): JsonFormSchema {
    const root: JsonNode = {
      component: '$component(Box)',
      children: components.map(
        (component, index): JsonNode => ({
          model: `$model(field${index})`,
          component: `$component(${component})`,
          componentProps: { label: component },
        })
      ),
    };
    return { format: 2, version: '1.0', root };
  }

  it('запись с подпутём импортируется с подпутя, а не становится заглушкой', () => {
    // Отказ, который это удерживает: комбобокс и выбор даты встроенного кита лежат вне главного
    // входа. Пока каталог об этом молчал, печатался `import { Combobox } from '@reformer/ui-kit'`
    // (TS2305); объяви он подпуть при прежнем смысле — печаталась бы заглушка `Placeholder`.
    const registry = registryView(ctxOf({ schema: subpathSchema() }));
    const byName = new Map(registry.components.map((c) => [c.name, c]));

    expect(byName.get('Combobox')).toEqual({
      name: 'Combobox',
      symbol: 'Combobox',
      importFrom: '@reformer/ui-kit/combobox',
      placeholder: false,
    });
    expect(byName.get('ComboboxMulti')?.importFrom).toBe('@reformer/ui-kit/combobox');
    expect(byName.get('DatePicker')?.importFrom).toBe('@reformer/ui-kit/date-picker');
    // Подпуть — не свойство полей: контейнер и его части импортируются так же.
    expect(byName.get('Carousel')?.importFrom).toBe('@reformer/ui-kit/carousel');
    expect(byName.get('CarouselItem')?.importFrom).toBe('@reformer/ui-kit/carousel');
    // Запись без подпутя — из главного входа.
    expect(byName.get('Input')?.importFrom).toBe('@reformer/ui-kit');
    expect(registry.hasPlaceholder).toBe(false);
  });

  it('главный вход — первой строкой, подпути — по алфавиту, символы в строке — по алфавиту', () => {
    const registry = registryView(ctxOf({ schema: subpathSchema() }));
    // В главный вход символы подпутей не попадают — иначе импорт не собрался бы. `Button` —
    // кнопка отправки, которую кодоген дописывает форме без неё.
    expect(registry.kitSymbols).toEqual(['Box', 'Button', 'FormField', 'Input']);
    expect(registry.extraImports).toEqual([
      {
        symbols: ['Carousel', 'CarouselContent', 'CarouselItem'],
        from: '@reformer/ui-kit/carousel',
      },
      { symbols: ['Combobox', 'ComboboxMulti'], from: '@reformer/ui-kit/combobox' },
      { symbols: ['DatePicker'], from: '@reformer/ui-kit/date-picker' },
    ]);
  });

  it('шаблон раскладывает импорты в том порядке, в каком их решил вид', () => {
    const code = renderTemplate(
      'test.registry',
      registryTemplate,
      buildView(ctxOf({ schema: subpathSchema() }))
    );
    expect(code).toContain(
      [
        "import { Box, Button, FormField, Input } from '@reformer/ui-kit';",
        "import { Carousel, CarouselContent, CarouselItem } from '@reformer/ui-kit/carousel';",
        "import { Combobox, ComboboxMulti } from '@reformer/ui-kit/combobox';",
        "import { DatePicker } from '@reformer/ui-kit/date-picker';",
        "import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';",
      ].join('\n')
    );
    expect(code).toContain("    reg.component('Combobox', Combobox);");
    expect(code).toContain("    reg.component('DatePicker', DatePicker);");
    expect(code).not.toContain('Placeholder');
    expect(code).not.toContain('subpath-only');
  });

  it('символ за подпутём называет каталог — имя записи в импорт не попадает', () => {
    // `Chart` и `Calendar` — имена ЗАПИСЕЙ: экспортов с такими именами у кита нет.
    const registry = registryView(ctxOf({ schema: schemaOf('Chart', 'Calendar') }));
    expect(registry.extraImports).toEqual([
      { symbols: ['CalendarSingle'], from: '@reformer/ui-kit/calendar' },
      { symbols: ['ChartContainer'], from: '@reformer/ui-kit/chart' },
    ]);
    expect(registry.components.map((c) => [c.name, c.symbol])).toEqual([
      ['Box', 'Box'],
      ['Chart', 'ChartContainer'],
      ['Calendar', 'CalendarSingle'],
      // Кнопка отправки — её кодоген дописывает форме без неё.
      ['Button', 'Button'],
    ]);
  });

  it('у встроенного кита заглушки за подпуть не получает ни одна запись', () => {
    // Все записи, объявившие подпуть, разом: причина заглушки, если она есть, — запрет живого
    // рендера или отсутствие адаптера, но не подпуть.
    const kit = builtinKit();
    const names = [...kit.kit.subpaths.keys()];
    // Десятки записей палитры, а не семь корней, как было, пока подпути набирались руками.
    expect(names.length).toBeGreaterThan(20);
    expect(names).toEqual(expect.arrayContaining(['Combobox', 'DatePicker', 'Table', 'Carousel']));
    const registry = registryView(ctxOf({ schema: schemaOf(...names) }));
    for (const component of registry.components) {
      expect(component.placeholder, component.name).toBe(false);
      expect(component.importFrom, component.name).not.toBeNull();
    }
    // Каждая строка импорта — подпуть кита, и главного входа среди них нет.
    for (const extra of registry.extraImports) {
      expect(extra.from.startsWith('@reformer/ui-kit/'), extra.from).toBe(true);
    }
    expect(registry.extraImports.map((extra) => extra.from)).toEqual(
      [...new Set(names.map((name) => `@reformer/ui-kit/${kit.kit.subpaths.get(name)}`))].sort()
    );
  });

  it('чужой кит: запись и адаптер визарда с одного подпутя делят строку импорта', () => {
    const kit = foreignKit({
      subpaths: new Map([
        ['Input', 'wizard'],
        ['Box', 'layout'],
      ]),
    });
    const registry = registryView(ctxOf({ schema: wizardSchema(), kit }));
    // В главном входе остаётся только обёртка поля.
    expect(registry.kitSymbols).toEqual(['HexField']);
    expect(registry.extraImports).toEqual([
      { symbols: ['HexBox'], from: '@hexa/ui/layout' },
      { symbols: ['HexInput', 'HexWizard'], from: '@hexa/ui/wizard' },
      { symbols: ['Step'], from: STEP_IMPORT },
    ]);
  });
});
