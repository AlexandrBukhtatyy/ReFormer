/**
 * Компилирующая поверхность на модуле в раскладке «папки по ролям» — в настоящем браузере и на
 * настоящем ките.
 *
 * Node-тесты пути (`./pipeline.test`) доводят модуль до собранной формы, но остаются по эту
 * сторону React: кнопку там не нажать. Здесь проверяется то, что видит человек: «Далее» визарда
 * не пускает пустой обязательный шаг (правила шага идут потоком сборки), начальные значения
 * модуля стоят в полях, а нажатие «Отправить» доходит до отправки модуля и её итог появляется
 * полосой над формой.
 *
 * Модуль написан на CommonJS: движок транспиляции тут не предмет проверки, а подставной загрузчик
 * резолвит пути так же, как линковщик оболочки.
 *
 * @module plugins/reformer/render/compiling/module.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as behaviors from '@reformer/core/behaviors';
import * as validation from '@reformer/core/validation';
import * as validators from '@reformer/core/validators';
import * as rendererJson from '@reformer/renderer-json';
import * as uiKit from '@reformer/ui-kit';
import type { JsonFormSchema } from '@reformer/renderer-json';
import { builtinCatalog } from '../../../core/testing';
import type { KitNamespace } from '@reformer/builder-plugin-api';
import type {
  Disposable,
  DocumentRef,
  NodeId,
  PreviewContext,
  PreviewProblem,
} from '@reformer/builder-plugin-api';
import { builtinSurfaces } from '../plugin';
import { createFakeHost, createFakeModules, fakeRef } from '../testing';
import { COMPILING_SURFACE_ID } from './surface';

const NOOP: Disposable = Object.freeze({ dispose: () => undefined });
const NO_SELECTION: readonly NodeId[] = Object.freeze([]);

/** Пакеты оболочки, которые берёт код модуля, — те же объекты, которыми собирает форму превью. */
const PACKAGES = {
  '@reformer/core/behaviors': behaviors,
  '@reformer/core/validation': validation,
  '@reformer/core/validators': validators,
  '@reformer/renderer-json': rendererJson,
};

const DOCUMENT = 'fake:form/schema/form.schema.json';

/** Живая схема: визард из двух шагов, селекторы — те, что проставляет кодоген. */
function wizardSchema(title = 'Данные'): JsonFormSchema {
  return {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          component: '$component(Wizard)',
          selector: 'wizard',
          children: [
            {
              component: '$component(Step)',
              selector: 'dannye-section',
              componentProps: { title },
              children: [
                {
                  model: '$model(email)',
                  component: '$component(Input)',
                  componentProps: { label: 'Почта', testId: 'email' },
                },
              ],
            },
            {
              component: '$component(Step)',
              selector: 'kontakty-section',
              componentProps: { title: 'Контакты' },
              children: [
                {
                  model: '$model(comment)',
                  component: '$component(Input)',
                  componentProps: { label: 'Комментарий', testId: 'comment' },
                },
              ],
            },
          ],
        },
      ],
    },
  } as unknown as JsonFormSchema;
}

/**
 * Модуль формы — файлы и экспорты как у кодогена. Страница и сборка приложения бросают:
 * исполни их превью, форма осталась бы с находкой вместо поведения.
 */
const MODULE: Record<string, string> = {
  'form/ZayavkaForm.tsx': 'throw new Error("страницу исполнять нельзя");',
  'form/index.ts': 'throw new Error("вход модуля исполнять нельзя");',
  'form/application/create.ts': 'throw new Error("сборку приложения исполнять нельзя");',
  'form/application/entry.ts': 'throw new Error("запись реестра исполнять нельзя");',
  'form/application/submit.ts':
    'var behaviors = require("@reformer/core/behaviors");\n' +
    'var api = require("../api");\n' +
    'exports.wireSubmit = function (scope, options) {\n' +
    '  behaviors.onComponentEvent(scope.schema.node("wizard"), "onSubmit", function (values) {\n' +
    '    return api.submitForm(values).then(function (result) {\n' +
    '      var text = result.success ? "Форма отправлена: " + values.email : result.error;\n' +
    '      if (options.onResult) options.onResult(text, result.success);\n' +
    '    });\n' +
    '  });\n' +
    '};',
  'form/api/index.ts':
    'exports.submitForm = function () { return Promise.resolve({ success: true }); };',
  'form/model/initial-value.ts':
    'exports.createInitialValues = function () { return { email: "", comment: "из модуля" }; };',
  'form/validation/form.ts': 'exports.formValidation = {};',
  'form/validation/dannye.ts':
    'var v = require("@reformer/core/validation");\n' +
    'var rules = require("@reformer/core/validators");\n' +
    'exports.stepRules = v.defineValidation(function (scope) {\n' +
    '  v.validate(scope.model.$.email, [rules.required()]);\n' +
    '});',
  // Имя файла — от прежнего имени формы: каталог зовётся `form`, и поток находится по папке роли.
  'form/flow/zayavka-flow.ts':
    'var step = require("../validation/dannye");\n' +
    'exports.formFlow = { steps: [\n' +
    '  { id: "dannye-section", rules: step.stepRules },\n' +
    '  { id: "kontakty-section" },\n' +
    '] };',
  'form/behavior/index.ts':
    'var behaviors = require("@reformer/core/behaviors");\n' +
    'exports.behaviorRules = function () {};\n' +
    'exports.formBehavior = behaviors.defineFormBehavior(exports.behaviorRules);',
  'form/schema/registry.ts':
    'var rj = require("@reformer/renderer-json");\n' +
    'exports.createRegistry = function () { return rj.defineRegistry(function () {}); };',
};

const cleanup: (() => void)[] = [];

afterEach(() => {
  while (cleanup.length > 0) cleanup.pop()?.();
});

interface EditableContext extends PreviewContext {
  readonly problems: PreviewProblem[];
  /** Правка схемы в редакторе: поверхность пересобирает форму. */
  edit(next: JsonFormSchema): void;
}

function editableContext(): EditableContext {
  let schema = wizardSchema();
  const listeners = new Set<() => void>();
  const problems: PreviewProblem[] = [];
  const doc: DocumentRef = {
    id: DOCUMENT,
    ref: fakeRef(DOCUMENT),
    kind: 'model',
    providerId: 'form.schema',
  };
  return {
    problems,
    doc,
    schema: () => schema,
    onDidChangeSchema: (cb) => {
      listeners.add(cb);
      return { dispose: () => listeners.delete(cb) };
    },
    selection: () => NO_SELECTION,
    onDidChangeSelection: () => NOOP,
    select: () => undefined,
    mock: () => null,
    values: () => undefined,
    keepValues: () => undefined,
    report: (_source, next) => {
      problems.splice(0, problems.length, ...next);
    },
    edit(next) {
      schema = next;
      for (const listener of [...listeners]) listener();
    },
  };
}

async function mounted(
  ctx: PreviewContext,
  tree: Record<string, string> = MODULE
): Promise<HTMLElement> {
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
  const subscription = surface.mount(element, ctx);
  cleanup.push(() => {
    subscription.dispose();
    element.remove();
  });
  await vi.waitFor(() => {
    expect(element.querySelector('[data-testid="input-email"]')).not.toBeNull();
  });
  return element;
}

const find = <T extends HTMLElement>(element: HTMLElement, testId: string): T | null =>
  element.querySelector<T>(`[data-testid="${testId}"]`);

/** Пройти первый шаг: заполнить обязательное поле и дождаться второго шага. */
async function passFirstStep(element: HTMLElement, email: string): Promise<void> {
  await userEvent.fill(find<HTMLInputElement>(element, 'input-email')!, email);
  await userEvent.click(find(element, 'btn-next')!);
  await vi.waitFor(() => {
    expect(find(element, 'input-comment')).not.toBeNull();
  });
}

describe('модуль с папками ролей в компилирующем превью', () => {
  it('«Далее» не пускает пустой обязательный шаг: правила шага идут потоком сборки', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx);

    await userEvent.click(find(element, 'btn-next')!);

    // Замечание показано у поля — значит шаг проверен, а не просто «кнопка не сработала».
    await vi.waitFor(() => {
      expect(find(element, 'error-email')?.textContent?.trim()).toBeTruthy();
    });
    expect(find(element, 'input-comment')).toBeNull();
    // Страница и сборка приложения не исполнялись: иначе здесь были бы находки.
    expect(ctx.problems).toEqual([]);
  });

  it('заполненный шаг проходит, во втором стоят начальные значения модуля', async () => {
    const element = await mounted(editableContext());

    await passFirstStep(element, 'anya@example.com');

    expect(find<HTMLInputElement>(element, 'input-comment')?.value).toBe('из модуля');
  });

  it('«Отправить» доходит до отправки модуля, итог — полосой над формой', async () => {
    const element = await mounted(editableContext());
    expect(find(element, 'submit-result')).toBeNull();

    await passFirstStep(element, 'anya@example.com');
    await userEvent.click(find(element, 'btn-submit')!);

    const strip = await vi.waitFor(() => {
      const found = find(element, 'submit-result');
      expect(found?.textContent).toBe('Форма отправлена: anya@example.com');
      return found;
    });
    expect(strip?.getAttribute('data-ok')).toBe('true');
    // Полоса — снаружи области формы: щелчок по ней не промах по форме и выделения не снимает.
    expect(strip?.closest('[data-slot="scroll-area"]')).toBeNull();
  });

  it('фикстура из КОРНЯ модуля подменяет запрос по строке импорта — `../api`', async () => {
    const element = await mounted(editableContext(), {
      ...MODULE,
      'form/fixture.ts':
        'exports.fixture = { modules: { "../api": {\n' +
        '  submitForm: function () {\n' +
        '    return Promise.resolve({ success: false, error: "Сервер отказал" });\n' +
        '  },\n' +
        '} } };',
    });

    await passFirstStep(element, 'anya@example.com');
    await userEvent.click(find(element, 'btn-submit')!);

    const strip = await vi.waitFor(() => {
      const found = find(element, 'submit-result');
      expect(found?.textContent).toBe('Сервер отказал');
      return found;
    });
    expect(strip?.getAttribute('data-ok')).toBe('false');
  });

  it('пересборка формы убирает итог прежней сборки', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx);
    await passFirstStep(element, 'anya@example.com');
    await userEvent.click(find(element, 'btn-submit')!);
    await vi.waitFor(() => {
      expect(find(element, 'submit-result')).not.toBeNull();
    });

    // Схему поправили: форма теперь другая, и «отправлено» к ней не относится.
    ctx.edit(wizardSchema('Личные данные'));

    await vi.waitFor(() => {
      expect(find(element, 'submit-result')).toBeNull();
    });
  });

  it('узла отправки нет в живой схеме — форма на месте, а находка называет файл отправки', async () => {
    const ctx = editableContext();
    const withoutSelector = wizardSchema();
    const root = withoutSelector.root as unknown as { children: { selector?: string }[] };
    delete root.children[0].selector;
    ctx.edit(withoutSelector);

    await mounted(ctx);

    await vi.waitFor(() => {
      expect(ctx.problems).toEqual([
        expect.objectContaining({
          file: 'application/submit.ts',
          resource: 'fake:form/application/submit.ts',
        }),
      ]);
    });
  });
});
