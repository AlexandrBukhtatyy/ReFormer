import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateSchema } from './validate';
import { getAt } from '../model';
import { P, sampleSchema } from '../model/__fixtures__/sample-schema';

describe('validateSchema', () => {
  it('корректная схема → valid', () => {
    const res = validateSchema(sampleSchema());
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
  });

  it('неверный тип componentProps → ошибки', () => {
    // Input.min должен быть number; строка → ошибка componentProps-валидации
    const schema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            value: '$model(x)',
            component: '$component(Input)',
            componentProps: { min: 'не-число' },
          },
        ],
      },
    } as unknown as JsonFormSchema;
    const res = validateSchema(schema);
    expect(res.valid).toBe(false);
    expect(res.errors.length).toBeGreaterThan(0);
  });
});

/** Схема с одним полем на компоненте `name`. */
function schemaWithComponent(name: string): JsonFormSchema {
  return {
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [{ value: '$model(email)', component: `$component(${name})` }],
    },
  } as unknown as JsonFormSchema;
}

describe('validateSchema — строгий режим', () => {
  it('мягкий режим НЕ ловит выдуманное имя компонента (документирует причину строгого)', () => {
    // componentNames собираются из самой схемы, поэтому проверка самоисполняющаяся.
    expect(validateSchema(schemaWithComponent('EmailField')).valid).toBe(true);
  });

  it('строгий режим ловит его', () => {
    const res = validateSchema(schemaWithComponent('EmailField'), { strict: true });
    expect(res.valid).toBe(false);
    expect(res.errors.join('\n')).toContain('EmailField');
  });

  it('строгий режим не ломает INFRA-имена вне палитры (List у display-массива)', () => {
    const schema = {
      version: '1.0',
      root: {
        component: '$component(Box)',
        children: [
          {
            array: '$model(items)',
            component: '$component(List)',
            item: { $template: { value: '$model(title)', component: '$component(Input)' } },
          },
        ],
      },
    } as unknown as JsonFormSchema;
    expect(validateSchema(schema, { strict: true }).errors.join('\n')).not.toContain('List');
  });

  it('project-specific компонент исходной формы законен, если передана baseline', () => {
    // RendererFormWizard живёт в реестре конкретного проекта, каталогу билдера он неизвестен.
    const schema = sampleSchema();
    expect(validateSchema(schema, { strict: true }).errors.join('\n')).toContain(
      'RendererFormWizard'
    );
    // toMatchObject, а не toEqual: результат со временем прирастает полями (структурные
    // предупреждения), и тест про имена компонентов не должен падать из-за соседнего контракта.
    expect(validateSchema(schema, { strict: true, baseline: sampleSchema() })).toMatchObject({
      valid: true,
      errors: [],
    });
  });

  it('baseline не пропускает НОВОЕ выдуманное имя', () => {
    const draft = sampleSchema();
    const children = getAt(draft, P.step0children) as unknown[];
    children.push({ value: '$model(email)', component: '$component(EmailField)' });
    const res = validateSchema(draft, { strict: true, baseline: sampleSchema() });
    expect(res.valid).toBe(false);
    expect(res.errors.join('\n')).toContain('EmailField');
    expect(res.errors.join('\n')).not.toContain('RendererFormWizard');
  });
});
