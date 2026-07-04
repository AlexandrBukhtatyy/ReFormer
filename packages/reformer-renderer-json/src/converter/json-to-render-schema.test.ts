import { describe, it, expect } from 'vitest';
import { convertJsonToM1Tree } from './json-to-render-schema';
import { defineRegistry } from '../registry/component-registry';
import type { JsonFormSchema } from '../types/json-schema';

/**
 * Заглушка модели: конвертер трогает только `signalAt` (лист) и dot-обход (массив),
 * поэтому реальная FormModel из core не нужна — изолируем поведение самого конвертера.
 */
const FormFieldStub = (): null => null;
const InputStub = (): null => null;
const LOAN_TYPES = [{ value: 'consumer', label: 'Потребительский' }];

const registry = defineRegistry((reg) => {
  reg.component('Input', InputStub);
  reg.component('FormField', FormFieldStub);
  reg.dataSource('LOAN_TYPES', LOAN_TYPES);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubModel = { signalAt: (p: string) => ({ __path: p }) } as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convert = (root: any): any =>
  convertJsonToM1Tree({ root } as JsonFormSchema, registry, stubModel);

describe('convertJsonToM1Tree', () => {
  describe('per-field wrapper (JSON `wrapper` → renderer `componentProps.fieldWrapper`)', () => {
    it('maps `wrapper: { component: "$component(FormField)" }` to componentProps.fieldWrapper', () => {
      const node = convert({
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
        wrapper: { component: '$component(FormField)' },
      });
      // Раньше `wrapper` молча отбрасывался — теперь резолвится в компонент-обёртку.
      expect(node.componentProps.fieldWrapper).toBe(FormFieldStub);
      expect(node.componentProps.label).toBe('Email');
    });

    it('leaves fieldWrapper unset when `wrapper` is absent', () => {
      const node = convert({ value: '$model(email)', component: '$component(Input)' });
      expect(node.componentProps?.fieldWrapper).toBeUndefined();
    });
  });

  describe('resolveDataSource type check (runtime matches validator)', () => {
    it('throws when a component is used as $dataSource(...)', () => {
      expect(() =>
        convert({
          value: '$model(loanType)',
          component: '$component(Input)',
          componentProps: { options: '$dataSource(Input)' },
        })
      ).toThrow(/cannot be used as \$dataSource/i);
    });

    it('resolves a real dataSource name to its registered value', () => {
      const node = convert({
        value: '$model(loanType)',
        component: '$component(Input)',
        componentProps: { options: '$dataSource(LOAN_TYPES)' },
      });
      expect(node.componentProps.options).toBe(LOAN_TYPES);
    });
  });
});
