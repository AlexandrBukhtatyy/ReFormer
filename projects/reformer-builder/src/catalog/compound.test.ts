/**
 * Части compound-компонентов в каталоге: `Alert` собирается из `AlertTitle`/`AlertDescription`,
 * и без них голый `text` в корне (grid `grid-cols-[0_1fr]`) печатается по одному слову в строке.
 *
 * @module reformer-builder/catalog/compound.test
 */

import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { getCatalog } from './index';
import { COMPOUND_TEMPLATES } from './make-node';
import { validateSchema } from '../io/validate';
import { compoundParentOf, hasParts, isCompoundPart, partNamesOf, partsOf } from './compound';

describe('compound-части каталога', () => {
  it('Alert поставляет свои части', () => {
    expect(partNamesOf('Alert')).toEqual(['AlertDescription', 'AlertTitle']);
    expect(compoundParentOf('AlertTitle')).toBe('Alert');
    expect(hasParts('Alert')).toBe(true);
  });

  it('части есть у ключевых compound-корней', () => {
    for (const parent of ['Card', 'Accordion', 'Tabs', 'Table', 'Breadcrumb', 'Empty', 'Item']) {
      expect(partsOf(parent).length, parent).toBeGreaterThan(0);
    }
  });

  it('обычный компонент частью не является и частей не имеет', () => {
    expect(compoundParentOf('Button')).toBeUndefined();
    expect(hasParts('Button')).toBe(false);
    expect(isCompoundPart({ compoundParent: undefined })).toBe(false);
    expect(isCompoundPart({ compoundParent: 'Alert' })).toBe(true);
  });

  it('служебные экспорты ui-kit частями не считаются', () => {
    const names = new Set(getCatalog().map((e) => e.name));
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
      expect(partsOf(name)).toEqual([]);
      expect(compoundParentOf(name)).toBeUndefined();
    }
  });

  it('часть наследует категорию своего корня', () => {
    const alert = getCatalog().find((e) => e.name === 'Alert')!;
    for (const part of partsOf('Alert')) expect(part.category).toBe(alert.category);
  });

  it('часть — контейнер с редактируемым className', () => {
    for (const part of partsOf('Card')) {
      expect(part.role).toBe('container');
      expect(part.propsSchema.properties).toHaveProperty('className');
    }
  });

  it('композиция из частей проходит гейт валидации схемы', () => {
    for (const [name, make] of Object.entries(COMPOUND_TEMPLATES)) {
      const schema = {
        version: '1.0',
        root: { component: '$component(Box)', children: [make()] },
      } as unknown as JsonFormSchema;
      const result = validateSchema(schema);
      expect(result.errors, name).toEqual([]);
      expect(result.valid, name).toBe(true);
    }
  });

  it('критичные пропсы частей объявлены (Radix value, ссылки, картинки)', () => {
    const props = (name: string) =>
      getCatalog().find((e) => e.name === name)!.propsSchema.properties ?? {};
    expect(props('TabsTrigger')).toHaveProperty('value');
    expect(props('TabsContent')).toHaveProperty('value');
    expect(props('AccordionItem')).toHaveProperty('value');
    expect(props('AvatarImage')).toHaveProperty('src');
    expect(props('BreadcrumbLink')).toHaveProperty('href');
  });
});
