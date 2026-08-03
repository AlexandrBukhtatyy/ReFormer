import { describe, expect, it } from 'vitest';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { validateSchema } from './validate';
import { sampleSchema } from '../model/__fixtures__/sample-schema';

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
