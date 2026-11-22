/**
 * Правило узла внутри строки массива — в настоящем браузере и на настоящем ките.
 *
 * Области схемы изолированы: узел шаблона строки адресуется из поведения СТРОКИ
 * (`applyEach(model.$.items, поведениеСтроки)`), а не из корневого. Кодоген печатает правило в
 * поведении области своего узла — здесь проверяется, что такая форма действительно работает:
 * флажок строки прячет поле ЭТОЙ строки. Рядом — контрольный модуль с тем же правилом в корне,
 * каким оно печаталось раньше: поле не прячется, а ядро называет причину предупреждением.
 *
 * Модуль написан на CommonJS: движок транспиляции тут не предмет проверки, а подставной загрузчик
 * резолвит пути так же, как линковщик оболочки.
 *
 * @module plugins/reformer/render/compiling/row-scopes.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as behaviors from '@reformer/core/behaviors';
import * as rendererJson from '@reformer/renderer-json';
import * as uiKit from '@reformer/ui-kit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinCatalog } from '../../../core/testing';
import type {
  Disposable,
  DocumentRef,
  KitNamespace,
  NodeId,
  PreviewContext,
  PreviewProblem,
} from '@reformer/builder-plugin-api';
import { builtinSurfaces } from '../plugin';
import { createFakeHost, createFakeModules, fakeRef } from '../testing';
import { COMPILING_SURFACE_ID } from './surface';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

const PACKAGES = {
  '@reformer/core/behaviors': behaviors,
  '@reformer/renderer-json': rendererJson,
};

const DOCUMENT = 'fake:form/schema/form.schema.json';

/** Массив рекомендателей: в строке флажок «без телефона» и поле телефона с селектором. */
const SCHEMA = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Box)',
    children: [
      {
        selector: 'references',
        model: '$model(references)',
        component: '$component(FieldArray)',
        componentProps: { title: 'Рекомендатели' },
        initialValue: { noPhone: false, phone: '' },
        item: {
          $template: {
            component: '$component(Box)',
            children: [
              {
                model: '$model(noPhone)',
                component: '$component(Checkbox)',
                componentProps: { label: 'Без телефона', testId: 'no-phone' },
              },
              {
                selector: 'ref-phone',
                model: '$model(phone)',
                component: '$component(Input)',
                componentProps: { label: 'Телефон', testId: 'ref-phone' },
              },
            ],
          },
        },
      },
    ],
  },
} as unknown as JsonFormSchema;

/** Общая часть модуля: одна строка в массиве с самого начала, пустой реестр, без правил формы. */
const BASE: Record<string, string> = {
  'form/model/initial-value.ts':
    'exports.createInitialValues = function () {\n' +
    '  return { references: [{ noPhone: false, phone: "" }] };\n' +
    '};',
  'form/validation/form.ts': 'exports.formValidation = {};',
  'form/schema/registry.ts':
    'var rj = require("@reformer/renderer-json");\n' +
    'exports.createRegistry = function () { return rj.defineRegistry(function () {}); };',
};

/** Как печатает кодоген: правило — в поведении строки, корень подключает его `applyEach`. */
const SCOPED: Record<string, string> = {
  ...BASE,
  'form/behavior/index.ts':
    'var behaviors = require("@reformer/core/behaviors");\n' +
    'var referencesRow = behaviors.defineFormBehavior(function (scope) {\n' +
    '  behaviors.hideWhen(scope.schema.node("ref-phone"), function () {\n' +
    '    return scope.model.noPhone;\n' +
    '  });\n' +
    '});\n' +
    'exports.behaviorRules = function (scope) {\n' +
    '  behaviors.applyEach(scope.model.$.references, referencesRow);\n' +
    '};\n' +
    'exports.formBehavior = behaviors.defineFormBehavior(exports.behaviorRules);',
};

/** Как печаталось раньше: то же правило в корневой области. */
const AT_ROOT: Record<string, string> = {
  ...BASE,
  'form/behavior/index.ts':
    'var behaviors = require("@reformer/core/behaviors");\n' +
    'exports.behaviorRules = function (scope) {\n' +
    '  behaviors.hideWhen(scope.schema.node("ref-phone"), function () {\n' +
    '    return scope.model.references.some(function (row) { return row.noPhone; });\n' +
    '  });\n' +
    '};\n' +
    'exports.formBehavior = behaviors.defineFormBehavior(exports.behaviorRules);',
};

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
  vi.restoreAllMocks();
});

function context(problems: PreviewProblem[]): PreviewContext {
  const doc: DocumentRef = {
    id: DOCUMENT,
    ref: fakeRef(DOCUMENT),
    kind: 'model',
    providerId: 'form.schema',
  };
  return {
    doc,
    schema: () => SCHEMA,
    onDidChangeSchema: () => NOOP,
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => null,
    values: () => undefined,
    keepValues: () => undefined,
    report: (_source, next) => {
      problems.splice(0, problems.length, ...next);
    },
  };
}

async function mounted(tree: Record<string, string>, problems: PreviewProblem[] = []) {
  const built = builtinCatalog();
  const host = createFakeHost({
    catalog: built.entries,
    descriptor: built.descriptor,
    namespace: uiKit as unknown as KitNamespace,
    source: { executesCode: true },
    modules: createFakeModules(PACKAGES),
    tree,
  });
  const surface = builtinSurfaces(host, (key) => key).find(
    (candidate) => candidate.id === COMPILING_SURFACE_ID
  );
  if (surface === undefined) throw new Error('компилирующая поверхность не зарегистрирована');

  const element = document.createElement('div');
  document.body.append(element);
  const subscription = surface.mount(element, context(problems));
  cleanup.push(() => {
    subscription.dispose();
    element.remove();
  });
  await vi.waitFor(() => {
    expect(element.querySelector('[data-testid="input-ref-phone"]')).not.toBeNull();
  });
  return element;
}

const phone = (element: HTMLElement): Element | null =>
  element.querySelector('[data-testid="input-ref-phone"]');

async function tickNoPhone(element: HTMLElement): Promise<void> {
  const box = element.querySelector<HTMLElement>('[data-testid="input-no-phone"]');
  if (box === null) throw new Error('флажок «Без телефона» не найден');
  await userEvent.click(box);
}

describe('правило узла строки массива в компилирующем превью', () => {
  it('в поведении строки: флажок строки прячет поле этой строки', async () => {
    const problems: PreviewProblem[] = [];
    const element = await mounted(SCOPED, problems);
    expect(problems).toEqual([]);

    await tickNoPhone(element);

    await vi.waitFor(() => {
      expect(phone(element)).toBeNull();
    });
  });

  it('контроль — то же правило в корне не делает ничего, и ядро называет причину', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const element = await mounted(AT_ROOT);

    await tickNoPhone(element);
    // Дать правилу время сработать, если бы оно могло: скрытие приходит следующим кадром.
    await new Promise((resolve) => setTimeout(resolve, 300));

    expect(phone(element)).not.toBeNull();
    const warned = warn.mock.calls.map((call) => call.map(String).join(' ')).join('\n');
    expect(warned).toContain('ref-phone');
    expect(warned).toContain('applyEach');
  });
});
