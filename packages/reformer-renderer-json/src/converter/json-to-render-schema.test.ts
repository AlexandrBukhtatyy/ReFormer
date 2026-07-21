import { describe, it, expect, vi } from 'vitest';
import { convertJsonToM1Tree } from './json-to-render-schema';
import { defineRegistry } from '../registry/component-registry';
import { createLocaleResolver, createLocaleService } from '../locale/locale-service';
import type { JsonFormSchema } from '../types/json-schema';
import type { FormModel } from '@reformer/core';

/**
 * Заглушка модели: конвертер трогает только `signalAt` (лист) и dot-обход (массив),
 * поэтому реальная FormModel из core не нужна — изолируем поведение самого конвертера.
 */
const FormFieldStub = (): null => null;
const InputStub = (): null => null;
const LOAN_TYPES = [{ value: 'consumer', label: 'Потребительский' }];
const itemLabelFn = (_c: unknown, i: number): string => `#${i + 1}`;

const registry = defineRegistry((reg) => {
  reg.component('Input', InputStub);
  reg.component('FormField', FormFieldStub);
  reg.dataSource('LOAN_TYPES', LOAN_TYPES);
  reg.fn('itemLabel', itemLabelFn);
  reg.locale(createLocaleResolver({ 'fields.email.label': 'Email' }));
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

  describe('$fn — function reference from registry', () => {
    it('resolves $fn(name) to the registered function verbatim', () => {
      const node = convert({
        array: '$model(properties)',
        initialValue: { type: '' },
        componentProps: { itemLabel: '$fn(itemLabel)' },
        item: { $template: { value: '$model(type)', component: '$component(Input)' } },
      });
      expect(node.componentProps.itemLabel).toBe(itemLabelFn);
    });

    it('throws when a dataSource is used as $fn(...)', () => {
      expect(() =>
        convert({
          value: '$model(x)',
          component: '$component(Input)',
          componentProps: { format: '$fn(LOAN_TYPES)' },
        })
      ).toThrow(/cannot be used as \$fn/i);
    });

    it('throws when a fn is used as $component(...)', () => {
      expect(() => convert({ value: '$model(x)', component: '$component(itemLabel)' })).toThrow(
        /cannot be used as \$component/i
      );
    });
  });

  describe('$locale — key resolved to a plain string at convert-time', () => {
    it('resolves a known key through the registered locale service', () => {
      const node = convert({
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: '$locale(fields.email.label)' },
      });
      expect(node.componentProps.label).toBe('Email'); // строка, не сигнал/объект
    });

    it('falls back to the key itself for an unknown key', () => {
      const node = convert({
        value: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: '$locale(fields.unknown)' },
      });
      expect(node.componentProps.label).toBe('fields.unknown');
    });

    it('falls back to the key when no locale service is registered', () => {
      const bare = defineRegistry((reg) => reg.component('Input', InputStub));
      const node = convertJsonToM1Tree(
        {
          root: {
            value: '$model(email)',
            component: '$component(Input)',
            componentProps: { label: '$locale(fields.email.label)' },
          },
        } as JsonFormSchema,
        bare,
        stubModel
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ) as any;
      expect(node.componentProps.label).toBe('fields.email.label');
    });
  });

  describe('structured { $locale, params } form — parameterized string at convert-time', () => {
    const i18nRegistry = defineRegistry((reg) => {
      reg.component('Input', InputStub);
      reg.locale(createLocaleService({ 'fields.min': (p) => `Минимум ${p?.count} символов` }));
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const convertWith = (root: any, reg = i18nRegistry): any =>
      convertJsonToM1Tree({ root } as JsonFormSchema, reg, stubModel);

    it('resolves { $locale, params } to an interpolated string', () => {
      const node = convertWith({
        value: '$model(x)',
        component: '$component(Input)',
        componentProps: { label: { $locale: 'fields.min', params: { count: 3 } } },
      });
      expect(node.componentProps.label).toBe('Минимум 3 символов');
    });

    it('falls back to the key when the service is absent', () => {
      const bare = defineRegistry((reg) => reg.component('Input', InputStub));
      const node = convertWith(
        {
          value: '$model(x)',
          component: '$component(Input)',
          componentProps: { label: { $locale: 'fields.min', params: { count: 3 } } },
        },
        bare
      );
      expect(node.componentProps.label).toBe('fields.min');
    });

    it('snapshots $model in params (.peek() value, non-reactive) and warns pointing to I18n', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      // Модель со снимком: signalAt(path).peek() отдаёт текущее значение.
      const modelWithPeek = {
        signalAt: (p: string) => ({ peek: () => (p === 'minLen' ? 8 : undefined) }),
      } as unknown as FormModel<unknown>;
      const node = convertJsonToM1Tree(
        {
          root: {
            value: '$model(x)',
            component: '$component(Input)',
            componentProps: {
              label: { $locale: 'fields.min', params: { count: '$model(minLen)' } },
            },
          },
        } as JsonFormSchema,
        i18nRegistry,
        modelWithPeek
      ) as unknown as { componentProps: { label: string } };
      expect(node.componentProps.label).toBe('Минимум 8 символов'); // (A) снимок значения
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/используй I18n/i)); // (B) подсказка
      warn.mockRestore();
    });

    it('does not warn for literal-only params', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      convertWith({
        value: '$model(x)',
        component: '$component(Input)',
        componentProps: { label: { $locale: 'fields.min', params: { count: 3 } } },
      });
      expect(warn).not.toHaveBeenCalledWith(expect.stringMatching(/используй I18n/i));
      warn.mockRestore();
    });
  });

  describe('HTML-узлы ($html(tag) + text)', () => {
    it('резолвит $html(tag) в строку-тег для рендерера', () => {
      const node = convert({ component: '$html(div)', componentProps: { className: 'p-4' } });
      expect(node.component).toBe('div');
      expect(node.componentProps.className).toBe('p-4');
    });

    it('приводит тег к нижнему регистру', () => {
      expect(convert({ component: '$html(DIV)' }).component).toBe('div');
    });

    it('бросает на теге вне whitelist — схема недоверенная', () => {
      expect(() => convert({ component: '$html(script)' })).toThrow(/not allowed in \$html/i);
      expect(() => convert({ component: '$html(iframe)' })).toThrow(/not allowed in \$html/i);
    });

    it('рекурсивно конвертирует children html-узла', () => {
      const node = convert({
        component: '$html(div)',
        children: [
          { component: '$html(h3)', text: 'Итого' },
          { value: '$model(email)', component: '$component(Input)' },
        ],
      });
      expect(node.children[0].component).toBe('h3');
      expect(node.children[0].text).toBe('Итого');
      expect(node.children[1].component).toBe(InputStub);
    });

    it('оставляет литеральный text как есть', () => {
      expect(convert({ component: '$html(p)', text: 'Внимание' }).text).toBe('Внимание');
      expect(convert({ component: '$html(p)', text: 42 }).text).toBe(42);
    });

    it('резолвит $model(...) в тексте в сигнал — рендерер на него подпишется', () => {
      const node = convert({ component: '$html(p)', text: '$model(monthlyPayment)' });
      expect(node.text).toEqual({ __path: 'monthlyPayment' });
    });

    it('резолвит части массива-текста по отдельности', () => {
      const node = convert({
        component: '$html(p)',
        text: ['Платёж: ', '$model(monthlyPayment)', ' ₽'],
      });
      expect(node.text).toEqual(['Платёж: ', { __path: 'monthlyPayment' }, ' ₽']);
    });

    it('резолвит $locale(...) в тексте в строку каталога', () => {
      expect(convert({ component: '$html(span)', text: '$locale(fields.email.label)' }).text).toBe(
        'Email'
      );
    });

    it('не добавляет ключ text, если его нет в схеме', () => {
      expect('text' in convert({ component: '$html(div)' })).toBe(false);
    });

    it('чистит небезопасные props html-узла', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const node = convert({
        component: '$html(a)',
        componentProps: { href: 'javascript:alert(1)', className: 'link', onClick: 'x' },
      });
      expect(node.componentProps).toEqual({ className: 'link' });
      warn.mockRestore();
    });

    it('props компонентов реестра не чистит — их поверхность задаёт сам компонент', () => {
      const onClick = (): void => {};
      const node = convert({
        component: '$component(Input)',
        componentProps: { onClick },
      });
      expect(node.componentProps.onClick).toBe(onClick);
    });

    it('конвертирует html-узлы, вложенные в произвольный componentProps (напр. steps визарда)', () => {
      const node = convert({
        component: '$component(Input)',
        componentProps: { steps: [{ component: '$html(section)', text: 'Шаг' }] },
      });
      expect(node.componentProps.steps[0].component).toBe('section');
    });
  });
});
