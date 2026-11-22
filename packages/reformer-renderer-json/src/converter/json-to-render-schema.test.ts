/**
 * Конвертер документа формата 2: резолв операторов (`$component`, `$dataSource`, `$fn`,
 * `$locale`, `$html`), текстовые части, обёртка поля, массив под-форм. Подформы и части
 * документа — в `json-to-render-schema.v2.test.tsx`.
 */
import { describe, it, expect, vi } from 'vitest';
import { convertJsonSchema } from './json-to-render-schema';
import { defineRegistry } from '../registry/component-registry';
import { createLocaleResolver, createLocaleService } from '../locale/locale-service';
import type { JsonFormSchema } from '../types/json-schema';
import { compileSchema, createModel, type FormModel } from '@reformer/core';

/*
 * Заглушка модели: для поля конвертер трогает только `signalAt`, поэтому реальная FormModel из
 * core не нужна — изолируем поведение самого конвертера. Массиву под-форм нужна настоящая модель:
 * узел привязывается ручкой массива.
 */
const FormFieldStub = (): null => null;
const InputStub = (): null => null;
const ListStub = (): null => null;
const LOAN_TYPES = [{ value: 'consumer', label: 'Потребительский' }];
const itemLabelFn = (_c: unknown, i: number): string => `#${i + 1}`;

const registry = defineRegistry((reg) => {
  reg.component('Input', InputStub);
  reg.component('FormField', FormFieldStub);
  reg.component('List', ListStub);
  reg.dataSource('LOAN_TYPES', LOAN_TYPES);
  // Источник-строка: так в схему попадает «живой» текст не из модели (в реальных формах — computed).
  reg.dataSource('STATUS_TEXT', 'готово');
  reg.fn('itemLabel', itemLabelFn);
  reg.locale(createLocaleResolver({ 'fields.email.label': 'Email' }));
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const stubModel = { signalAt: (p: string) => ({ __path: p }) } as any;

/** Документ формата 2 из одного корня. */
const documentOf = (root: unknown): JsonFormSchema => ({ format: 2, root }) as JsonFormSchema;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const convert = (root: any): any => convertJsonSchema(documentOf(root), registry, stubModel);

describe('convertJsonSchema: операторы и узлы', () => {
  describe('per-field wrapper (JSON `wrapper` → renderer `componentProps.fieldWrapper`)', () => {
    it('maps `wrapper: { component: "$component(FormField)" }` to componentProps.fieldWrapper', () => {
      const node = convert({
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: 'Email' },
        wrapper: { component: '$component(FormField)' },
      });
      // Раньше `wrapper` молча отбрасывался — теперь резолвится в компонент-обёртку.
      expect(node.componentProps.fieldWrapper).toBe(FormFieldStub);
      expect(node.componentProps.label).toBe('Email');
    });

    it('leaves fieldWrapper unset when `wrapper` is absent', () => {
      const node = convert({ model: '$model(email)', component: '$component(Input)' });
      expect(node.componentProps?.fieldWrapper).toBeUndefined();
    });
  });

  describe('resolveDataSource type check (runtime matches validator)', () => {
    it('throws when a component is used as $dataSource(...)', () => {
      expect(() =>
        convert({
          model: '$model(loanType)',
          component: '$component(Input)',
          componentProps: { options: '$dataSource(Input)' },
        })
      ).toThrow(/cannot be used as \$dataSource/i);
    });

    it('resolves a real dataSource name to its registered value', () => {
      const node = convert({
        model: '$model(loanType)',
        component: '$component(Input)',
        componentProps: { options: '$dataSource(LOAN_TYPES)' },
      });
      expect(node.componentProps.options).toBe(LOAN_TYPES);
    });
  });

  describe('array node with optional $component (component-rendered list)', () => {
    const listSchema = {
      model: '$model(alerts)',
      component: '$component(List)',
      item: {
        $template: {
          component: '$component(Input)',
          componentProps: { message: '$model(message)' },
        },
      },
    };

    // Массив под-форм привязывается только к настоящему массиву модели: ручка, а не фасад.
    const alertsModel = () => createModel({ alerts: [{ message: 'первое' }] });
    const convertWith = (
      model: FormModel<{ alerts: { message: string }[] }>,
      root: unknown = listSchema
    ) =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      convertJsonSchema(documentOf(root), registry, model) as any;

    it('attaches the resolved component + item factory', () => {
      const model = alertsModel();
      const node = convertWith(model);
      expect(node.component).toBe(ListStub);
      expect(node.model).toBe(model.$.alerts);
      expect(typeof node.item).toBe('function');
    });

    it('re-scopes $model inside the item $template to the element sub-model', () => {
      const model = alertsModel();
      const node = convertWith(model);
      // item(im) прогоняет transformProps со scope=im → $model(message) резолвится через im.signalAt
      const sub = node.item(model.alerts.at(0));
      expect(sub.componentProps.message).toBe(model.alerts.at(0)!.$.message);
    });

    it('массива нет в модели — ошибка при сборке дерева, а не узел без строк', () => {
      expect(() => convert(listSchema)).toThrow(/"\$model\(alerts\)" is not an array of the model/);
    });

    it('leaves component undefined for a plain array node (built-in path)', () => {
      const node = convertWith(alertsModel(), {
        model: '$model(alerts)',
        item: { $template: { model: '$model(message)', component: '$component(Input)' } },
      });
      expect(node.component).toBeUndefined();
      expect(typeof node.item).toBe('function');
    });
  });

  describe('$fn — function reference from registry', () => {
    it('resolves $fn(name) to the registered function verbatim', () => {
      const node = convert({
        model: '$model(properties)',
        component: '$component(List)',
        componentProps: { itemLabel: '$fn(itemLabel)' },
      });
      expect(node.componentProps.itemLabel).toBe(itemLabelFn);
    });

    it('throws when a dataSource is used as $fn(...)', () => {
      expect(() =>
        convert({
          model: '$model(x)',
          component: '$component(Input)',
          componentProps: { format: '$fn(LOAN_TYPES)' },
        })
      ).toThrow(/cannot be used as \$fn/i);
    });

    it('throws when a fn is used as $component(...)', () => {
      expect(() => convert({ model: '$model(x)', component: '$component(itemLabel)' })).toThrow(
        /cannot be used as \$component/i
      );
    });
  });

  describe('$locale — key resolved to a plain string at convert-time', () => {
    it('resolves a known key through the registered locale service', () => {
      const node = convert({
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: '$locale(fields.email.label)' },
      });
      expect(node.componentProps.label).toBe('Email'); // строка, не сигнал/объект
    });

    it('falls back to the key itself for an unknown key', () => {
      const node = convert({
        model: '$model(email)',
        component: '$component(Input)',
        componentProps: { label: '$locale(fields.unknown)' },
      });
      expect(node.componentProps.label).toBe('fields.unknown');
    });

    it('falls back to the key when no locale service is registered', () => {
      const bare = defineRegistry((reg) => reg.component('Input', InputStub));
      const node = convertJsonSchema(
        documentOf({
          model: '$model(email)',
          component: '$component(Input)',
          componentProps: { label: '$locale(fields.email.label)' },
        }),
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
      convertJsonSchema(documentOf(root), reg, stubModel);

    it('resolves { $locale, params } to an interpolated string', () => {
      const node = convertWith({
        model: '$model(x)',
        component: '$component(Input)',
        componentProps: { label: { $locale: 'fields.min', params: { count: 3 } } },
      });
      expect(node.componentProps.label).toBe('Минимум 3 символов');
    });

    it('falls back to the key when the service is absent', () => {
      const bare = defineRegistry((reg) => reg.component('Input', InputStub));
      const node = convertWith(
        {
          model: '$model(x)',
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
      const node = convertJsonSchema(
        documentOf({
          model: '$model(x)',
          component: '$component(Input)',
          componentProps: {
            label: { $locale: 'fields.min', params: { count: '$model(minLen)' } },
          },
        }),
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
        model: '$model(x)',
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
          { component: '$html(h3)', children: ['Итого'] },
          { model: '$model(email)', component: '$component(Input)' },
        ],
      });
      expect(node.children[0].component).toBe('h3');
      expect(node.children[0].children).toEqual(['Итого']);
      expect(node.children[1].component).toBe(InputStub);
    });

    it('оставляет литеральные текстовые части как есть', () => {
      expect(convert({ component: '$html(p)', children: ['Внимание'] }).children).toEqual([
        'Внимание',
      ]);
      expect(convert({ component: '$html(p)', children: [42] }).children).toEqual([42]);
    });

    it('резолвит $model(...) в тексте в сигнал — рендерер на него подпишется', () => {
      const node = convert({ component: '$html(p)', children: ['$model(monthlyPayment)'] });
      expect(node.children).toEqual([{ __path: 'monthlyPayment' }]);
    });

    it('резолвит текстовые части по отдельности, сохраняя порядок', () => {
      const node = convert({
        component: '$html(p)',
        children: ['Платёж: ', '$model(monthlyPayment)', ' ₽'],
      });
      expect(node.children).toEqual(['Платёж: ', { __path: 'monthlyPayment' }, ' ₽']);
    });

    it('резолвит $locale(...) в тексте в строку каталога', () => {
      expect(
        convert({ component: '$html(span)', children: ['$locale(fields.email.label)'] }).children
      ).toEqual(['Email']);
    });

    it('держит текст и узлы в одном массиве в порядке следования', () => {
      const node = convert({
        component: '$html(p)',
        children: [{ component: '$html(b)', children: ['Важно:'] }, ' и далее текст'],
      });
      expect(node.children[0].component).toBe('b');
      expect(node.children[1]).toBe(' и далее текст');
    });

    it('$dataSource в тексте отдаёт значение реестра — «живой» текст не из модели', () => {
      const node = convert({ component: '$html(p)', children: ['$dataSource(STATUS_TEXT)'] });
      expect(node.children).toEqual(['готово']);
    });

    it('бросает на операторе, который не резолвится в текст', () => {
      expect(() => convert({ component: '$html(p)', children: ['$component(Input)'] })).toThrow(
        /cannot be a text child/i
      );
      // Источник, отдающий не-текст (массив options), в позиции текста — тоже ошибка схемы.
      expect(() =>
        convert({ component: '$html(p)', children: ['$dataSource(LOAN_TYPES)'] })
      ).toThrow(/non-text value/i);
    });

    it('не добавляет ключ children, если его нет в схеме', () => {
      expect(convert({ component: '$html(div)' }).children).toBeUndefined();
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

    it('конвертирует узлы, вложенные в произвольный componentProps', () => {
      const node = convert({
        component: '$component(Input)',
        componentProps: {
          header: [{ component: '$html(section)', children: ['Шапка'] }],
          footer: { model: '$model(note)', component: '$component(Input)' },
        },
      });
      expect(node.componentProps.header[0].component).toBe('section');
      expect(node.componentProps.header[0].children).toEqual(['Шапка']);
      expect(node.componentProps.footer.model).toEqual({ __path: 'note' });
      expect(node.componentProps.footer.component).toBe(InputStub);
    });
  });
});

describe('массив как значение поля (`$model(<массив>)`)', () => {
  // Настоящая модель, а не заглушка: проверяется шов с ядром — путь массива резолвится в ручку
  // значения, и рендерер узнаёт в узле поле.
  const model = createModel({ name: '', tags: [] as string[], profile: { langs: ['en'] } });
  const convertReal = (
    root: unknown
  ): { model: unknown; componentProps?: Record<string, unknown> } =>
    convertJsonSchema(documentOf(root), registry, model) as never;

  it('узел-поле получает ручку массива и распознаётся рендерером как поле', () => {
    const node = convertReal({ model: '$model(tags)', component: '$component(Input)' });

    expect(node.model).toBe(model.$.tags);
    expect(compileSchema(node as never, model).root.kind).toBe('field');
    // Вложенный путь — тем же способом.
    const nested = convertReal({ model: '$model(profile.langs)', component: '$component(Input)' });
    expect(nested.model).toBe(model.$.profile.langs);
  });

  it('`$model(<массив>)` в componentProps отдаёт ту же ручку — рендерер развернёт её в значение', () => {
    const node = convertReal({
      model: '$model(name)',
      component: '$component(Input)',
      componentProps: { suggestions: '$model(tags)' },
    });

    expect(node.componentProps?.suggestions).toBe(model.$.tags);
  });
});
