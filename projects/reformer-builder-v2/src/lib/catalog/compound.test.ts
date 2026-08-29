/**
 * Части compound-компонентов в каталоге: `Alert` собирается из `AlertTitle`/`AlertDescription`,
 * и без них голый `text` в корне (grid `grid-cols-[0_1fr]`) печатается по одному слову в строке.
 *
 * Гейт валидации схемы здесь зовётся НАПРЯМУЮ (`validateFormSchema` из
 * `@reformer/renderer-json/validate`): в v1 тест ходил через `io/validate.validateSchema`, а та
 * обёртка тянет за собой реестр превью и структурный линт — слои, которых в v2 ещё нет. Проверяемое
 * при этом то же самое: структура узлов + типы `componentProps` против схем каталога.
 *
 * @module reformer-builder/lib/catalog/compound.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateFormSchema } from '@reformer/renderer-json/validate';
import { builtinEntries } from './__fixtures__/builtin-catalog';
import { COMPOUND_TEMPLATES } from './make-node';
import { collectOperatorNames } from '../form-model/query';
import { compoundParentOf, hasParts, isCompoundPart, partNamesOf, partsOf } from './compound';

const catalog = builtinEntries();

describe('compound-части каталога', () => {
  it('Alert поставляет свои части', () => {
    expect(partNamesOf(catalog, 'Alert')).toEqual(['AlertDescription', 'AlertTitle']);
    expect(compoundParentOf(catalog, 'AlertTitle')).toBe('Alert');
    expect(hasParts(catalog, 'Alert')).toBe(true);
  });

  it('части есть у ключевых compound-корней', () => {
    for (const parent of ['Card', 'Accordion', 'Tabs', 'Table', 'Breadcrumb', 'Empty', 'Item']) {
      expect(partsOf(catalog, parent).length, parent).toBeGreaterThan(0);
    }
  });

  it('обычный компонент частью не является и частей не имеет', () => {
    expect(compoundParentOf(catalog, 'Button')).toBeUndefined();
    expect(hasParts(catalog, 'Button')).toBe(false);
    expect(isCompoundPart({ compoundParent: undefined })).toBe(false);
    expect(isCompoundPart({ compoundParent: 'Alert' })).toBe(true);
  });

  it('служебные экспорты ui-kit частями не считаются', () => {
    const names = new Set(catalog.map((e) => e.name));
    // cva-функции, field-обёртки, порталы/оверлеи/провайдеры — не визуальные узлы формы.
    for (const junk of [
      'alertVariants',
      'AlertDialogPortal',
      'DialogOverlay',
      'InputBaseField',
      'MessageScrollerProvider',
    ]) {
      expect(names.has(junk), junk).toBe(false);
    }
  });

  it('части form-control’ов в каталог не идут (варианты задаются пропом options)', () => {
    for (const name of ['SelectItem', 'RadioGroupItem', 'NativeSelectOption', 'ToggleGroupItem']) {
      expect(partsOf(catalog, name)).toEqual([]);
      expect(compoundParentOf(catalog, name)).toBeUndefined();
    }
  });

  it('часть наследует категорию своего корня', () => {
    const alert = catalog.find((e) => e.name === 'Alert')!;
    for (const part of partsOf(catalog, 'Alert')) expect(part.category).toBe(alert.category);
  });

  it('часть — контейнер с редактируемым className', () => {
    for (const part of partsOf(catalog, 'Card')) {
      expect(part.role).toBe('container');
      expect(part.propsSchema.properties).toHaveProperty('className');
    }
  });

  it('композиция из частей проходит гейт валидации схемы', () => {
    // Схемы пропсов берём из КАТАЛОГА: у field-записей там `mergeFieldPropsSchema` (враппер +
    // вариант), и без этого валидатор ложно ругался бы «unknown property label».
    const propSchemas = Object.fromEntries(catalog.map((e) => [e.name, e.propsSchema]));
    for (const [name, make] of Object.entries(COMPOUND_TEMPLATES)) {
      const schema = {
        version: '1.0',
        root: { component: '$component(Box)', children: [make()] },
      } as unknown as JsonFormSchema;
      const ops = collectOperatorNames(schema);
      const result = validateFormSchema(schema, {
        componentNames: [...new Set([...ops.components, ...Object.keys(propSchemas)])],
        dataSourceNames: ops.dataSources,
        fnNames: ops.fns,
        localeKeys: ops.locales,
        propSchemas,
      });
      expect(result.errors, name).toEqual([]);
      expect(result.valid, name).toBe(true);
    }
  });

  it('критичные пропсы частей объявлены (Radix value, ссылки, картинки)', () => {
    const props = (name: string) =>
      catalog.find((e) => e.name === name)!.propsSchema.properties ?? {};
    expect(props('TabsTrigger')).toHaveProperty('value');
    expect(props('TabsContent')).toHaveProperty('value');
    expect(props('AccordionItem')).toHaveProperty('value');
    expect(props('AvatarImage')).toHaveProperty('src');
    expect(props('BreadcrumbLink')).toHaveProperty('href');
  });
});
