/**
 * Валидация модуля в компилирующем превью — в настоящем браузере и на настоящем ките: тексты
 * замечаний из словаря формы и живая проверка по потере фокуса.
 *
 * Обе вещи в приложении включает то, чего превью не исполняет либо делает само:
 *
 * - **словарь замечаний** (`validation/messages.ts`, экспорт `formMessages`) подключает страница
 *   модуля — `<ValidationMessagesProvider messages={formMessages}>`. Страницу превью не исполняет,
 *   поэтому провайдер ставит поверхность. Без него замечания шли бы текстами локали — английскими;
 * - **живую проверку** (`strategy: 'blur'` в `validation/form.ts`) армирует `useFormBundle`
 *   страницы. Превью собирает форму само и армирует контроллер своим эффектом. Не сделай оно этого
 *   — замечание висело бы под уже исправленным полем до следующего нажатия «Отправить».
 *
 * Node-тесты (`./pipeline.test`) доводят словарь до контракта, а стратегию — до сборки, но остаются
 * по эту сторону React: ни текста под полем, ни ухода фокуса там нет.
 *
 * Модуль — простая форма, какой её печатает кодоген (набор `plain-rules`), только на CommonJS:
 * движок транспиляции тут не предмет проверки. Отправка идёт мимо сборки — `validateModel` с теми
 * же правилами, — поэтому после отказа отправки живой остаётся только стратегия `blur`.
 *
 * @module plugins/reformer/render/compiling/validation.browser.test
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import * as behaviors from '@reformer/core/behaviors';
import * as coreI18n from '@reformer/core/i18n';
import * as coreRu from '@reformer/core/locale/ru';
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
  '@reformer/core/i18n': coreI18n,
  '@reformer/core/locale/ru': coreRu,
  '@reformer/core/validation': validation,
  '@reformer/core/validators': validators,
  '@reformer/renderer-json': rendererJson,
};

const DOCUMENT = 'fake:form/schema/form.schema.json';

/** Живая схема: два поля и кнопка отправки; селектор кнопки — тот, что проставляет кодоген. */
function plainSchema(label = 'Почта'): JsonFormSchema {
  return {
    format: 2,
    version: '1.0',
    root: {
      component: '$component(Box)',
      children: [
        {
          model: '$model(email)',
          component: '$component(Input)',
          componentProps: { label, testId: 'email' },
        },
        {
          model: '$model(comment)',
          component: '$component(Input)',
          componentProps: { label: 'Комментарий', testId: 'comment' },
        },
        {
          component: '$component(Button)',
          selector: 'submit',
          componentProps: { type: 'submit' },
          children: ['Отправить'],
        },
      ],
    },
  } as unknown as JsonFormSchema;
}

/** `validation/form.ts`: правила формы и поле `validation` сборки — со стратегией или без. */
function validationFile(strategy: 'blur' | null): string {
  return (
    'var v = require("@reformer/core/validation");\n' +
    'var rules = require("@reformer/core/validators");\n' +
    'exports.formRules = v.defineValidation(function (scope) {\n' +
    '  v.validate(scope.model.$.email, [rules.required(), rules.email()]);\n' +
    '});\n' +
    (strategy === null
      ? 'exports.formValidation = { rules: exports.formRules };'
      : `exports.formValidation = { rules: exports.formRules, strategy: "${strategy}" };`)
  );
}

/** `validation/messages.ts`: словарь текстов замечаний — контракт роли, экспорт `formMessages`. */
const MESSAGES_FILE =
  'var i18n = require("@reformer/core/i18n");\n' +
  'exports.formMessages = i18n.defineIssueMessages({\n' +
  '  required: "Заполните поле",\n' +
  '  email: "Почта выглядит иначе: имя@сайт",\n' +
  '});';

/**
 * Модуль формы — файлы и экспорты как у кодогена. Страница, которая в приложении подключает
 * словарь и армирует живую проверку, бросает: исполни её превью, осталась бы находка.
 */
function moduleTree(options: {
  readonly strategy: 'blur' | null;
  /** Текст файла словаря; `null` — файла в модуле нет. */
  readonly messages: string | null;
}): Record<string, string> {
  return {
    'form/AnketaForm.tsx': 'throw new Error("страницу исполнять нельзя");',
    'form/index.ts': 'throw new Error("вход модуля исполнять нельзя");',
    'form/application/create.ts': 'throw new Error("сборку приложения исполнять нельзя");',
    'form/application/entry.ts': 'throw new Error("запись реестра исполнять нельзя");',
    // Отправка простой формы идёт мимо сборки: `validateModel` с правилами формы и `touch: true`.
    'form/application/submit.ts':
      'var behaviors = require("@reformer/core/behaviors");\n' +
      'var v = require("@reformer/core/validation");\n' +
      'var api = require("../api");\n' +
      'var form = require("../validation/form");\n' +
      'exports.wireSubmit = function (scope, options) {\n' +
      '  behaviors.onComponentEvent(scope.schema.node("submit"), "onClick", function () {\n' +
      '    return v.validateModel(scope.model, form.formRules, { touch: true }).then(function (ok) {\n' +
      '      if (!ok) {\n' +
      '        if (options.onResult) options.onResult("Проверьте заполнение формы", false);\n' +
      '        return undefined;\n' +
      '      }\n' +
      '      return api.submitForm(scope.model.get()).then(function (result) {\n' +
      '        if (options.onResult) options.onResult("Форма отправлена", result.success);\n' +
      '      });\n' +
      '    });\n' +
      '  });\n' +
      '};',
    'form/api/index.ts':
      'exports.submitForm = function () { return Promise.resolve({ success: true }); };',
    'form/model/initial-value.ts':
      'exports.createInitialValues = function () { return { email: "", comment: "" }; };',
    'form/validation/form.ts': validationFile(options.strategy),
    ...(options.messages === null ? {} : { 'form/validation/messages.ts': options.messages }),
    'form/behavior/index.ts':
      'var behaviors = require("@reformer/core/behaviors");\n' +
      'exports.behaviorRules = function () {};\n' +
      'exports.formBehavior = behaviors.defineFormBehavior(exports.behaviorRules);',
    'form/schema/registry.ts':
      'var rj = require("@reformer/renderer-json");\n' +
      'exports.createRegistry = function () { return rj.defineRegistry(function () {}); };',
  };
}

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
  let schema = plainSchema();
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

async function mounted(ctx: PreviewContext, tree: Record<string, string>): Promise<HTMLElement> {
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

/** Текст замечания под полем почты; пустая строка — замечания нет. */
const remark = (element: HTMLElement): string =>
  find(element, 'error-email')?.textContent?.trim() ?? '';

/** Кнопка отправки: у кнопки кита своего `data-testid` нет — ищем по типу. */
function submitButton(element: HTMLElement): HTMLButtonElement {
  const button = element.querySelector<HTMLButtonElement>('button[type="submit"]');
  if (button === null) throw new Error('кнопка отправки не нарисована');
  return button;
}

/** Нажать «Отправить» и дождаться отказа: полоса итога сообщает, что форма не прошла проверку. */
async function submitInvalid(element: HTMLElement): Promise<void> {
  await userEvent.click(submitButton(element));
  await vi.waitFor(() => {
    expect(find(element, 'submit-result')?.getAttribute('data-ok')).toBe('false');
  });
}

/**
 * Словарь с языком формы — как печатает кодоген: `formLocale` рядом с `formMessages`. Запись
 * словаря — функцией, чтобы видеть, ПО КАКОМУ языку форматируется словарь.
 */
const LOCALE_FILE =
  'var i18n = require("@reformer/core/i18n");\n' +
  'var locale = require("@reformer/core/locale/ru");\n' +
  'exports.formLocale = locale.ru;\n' +
  'exports.formMessages = i18n.defineIssueMessages({\n' +
  '  email: function (params, handle) { return "язык формы: " + handle.code; },\n' +
  '});';

describe('язык формы в компилирующем превью', () => {
  it('formLocale задаёт форме язык: чего нет в словаре — из её локали, а не из оболочки', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx, moduleTree({ strategy: 'blur', messages: LOCALE_FILE }));

    await submitInvalid(element);

    // `required` в словаре нет: текст даёт локаль формы, русская, а не английская оболочки.
    await vi.waitFor(() => {
      expect(remark(element)).toBe('Обязательное поле');
    });
    expect(ctx.problems).toEqual([]);
  });

  it('словарь форматируется по языку формы — склонения и единицы не берутся у оболочки', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx, moduleTree({ strategy: 'blur', messages: LOCALE_FILE }));

    const email = find<HTMLInputElement>(element, 'input-email');
    if (email === null) throw new Error('поле почты не нарисовано');
    await userEvent.type(email, 'не-почта');
    await userEvent.tab();

    await vi.waitFor(() => {
      expect(remark(element)).toBe('язык формы: ru');
    });
  });
});

describe('словарь замечаний формы в компилирующем превью', () => {
  it('замечания показаны текстами словаря модуля, а не текстами локали', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx, moduleTree({ strategy: 'blur', messages: MESSAGES_FILE }));

    await submitInvalid(element);

    await vi.waitFor(() => {
      expect(remark(element)).toBe('Заполните поле');
    });
    // Страница модуля не исполнялась: словарь подключила сама поверхность.
    expect(ctx.problems).toEqual([]);
  });

  it('модуль без словаря работает как раньше — текст замечания даёт локаль', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx, moduleTree({ strategy: 'blur', messages: null }));

    await submitInvalid(element);

    await vi.waitFor(() => {
      expect(remark(element)).toBe('This field is required');
    });
    expect(ctx.problems).toEqual([]);
  });

  it('отказ файла словаря — находка с его именем; форма собрана и проверяется', async () => {
    const ctx = editableContext();
    const element = await mounted(
      ctx,
      moduleTree({ strategy: 'blur', messages: 'throw new Error("словарь сломан");' })
    );

    await vi.waitFor(() => {
      expect(ctx.problems).toEqual([
        {
          file: 'validation/messages.ts',
          phase: 'evaluate',
          message: 'словарь сломан',
          resource: 'fake:form/validation/messages.ts',
        },
      ]);
    });
    // Остальные роли на месте: отправка подключена, правила работают, тексты — из локали.
    await submitInvalid(element);
    await vi.waitFor(() => {
      expect(remark(element)).toBe('This field is required');
    });
  });

  it('словарь переживает пересборку формы после правки схемы', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx, moduleTree({ strategy: 'blur', messages: MESSAGES_FILE }));

    ctx.edit(plainSchema('Электронная почта'));
    await vi.waitFor(() => {
      expect(element.textContent).toContain('Электронная почта');
    });
    await submitInvalid(element);

    await vi.waitFor(() => {
      expect(remark(element)).toBe('Заполните поле');
    });
  });
});

describe('живая проверка по потере фокуса в компилирующем превью', () => {
  it('после неудачной отправки замечание под исправленным полем уходит, когда поле теряет фокус', async () => {
    const element = await mounted(
      editableContext(),
      moduleTree({ strategy: 'blur', messages: MESSAGES_FILE })
    );
    await submitInvalid(element);
    await vi.waitFor(() => {
      expect(remark(element)).toBe('Заполните поле');
    });

    // Поле исправили, но фокус ещё в нём: стратегия `blur` на ввод не реагирует.
    await userEvent.fill(find<HTMLInputElement>(element, 'input-email')!, 'anya@example.com');
    expect(document.activeElement).toBe(find(element, 'input-email'));
    expect(remark(element)).toBe('Заполните поле');

    // Фокус ушёл в соседнее поле — контроллер живой проверки сборки перепроверил форму.
    await userEvent.click(find<HTMLInputElement>(element, 'input-comment')!);

    await vi.waitFor(() => {
      expect(remark(element)).toBe('');
    });
  });

  it('уход из поля с новой ошибкой показывает её замечание — проверка идёт, а не снимается', async () => {
    const element = await mounted(
      editableContext(),
      moduleTree({ strategy: 'blur', messages: MESSAGES_FILE })
    );
    await submitInvalid(element);

    // Пустое поле заполнили неверно: «обязательное» должно смениться на замечание о формате.
    await userEvent.fill(find<HTMLInputElement>(element, 'input-email')!, 'не почта');
    await userEvent.click(find<HTMLInputElement>(element, 'input-comment')!);

    await vi.waitFor(() => {
      expect(remark(element)).toBe('Почта выглядит иначе: имя@сайт');
    });
  });

  it('живая проверка вооружена и у пересобранной формы', async () => {
    const ctx = editableContext();
    const element = await mounted(ctx, moduleTree({ strategy: 'blur', messages: MESSAGES_FILE }));
    // Схему поправили: форма собрана заново, и её контроллер — другой.
    ctx.edit(plainSchema('Электронная почта'));
    await vi.waitFor(() => {
      expect(element.textContent).toContain('Электронная почта');
    });

    await submitInvalid(element);
    await vi.waitFor(() => {
      expect(remark(element)).toBe('Заполните поле');
    });
    await userEvent.fill(find<HTMLInputElement>(element, 'input-email')!, 'anya@example.com');
    await userEvent.click(find<HTMLInputElement>(element, 'input-comment')!);

    await vi.waitFor(() => {
      expect(remark(element)).toBe('');
    });
  });

  it('контроль — без стратегии замечание остаётся под исправленным полем до отправки', async () => {
    // Тот же модуль со стратегией по умолчанию (`submit`): убеждаемся, что замечание выше снимает
    // именно живая проверка, а не сам уход фокуса.
    const element = await mounted(
      editableContext(),
      moduleTree({ strategy: null, messages: MESSAGES_FILE })
    );
    await submitInvalid(element);
    await vi.waitFor(() => {
      expect(remark(element)).toBe('Заполните поле');
    });

    await userEvent.fill(find<HTMLInputElement>(element, 'input-email')!, 'anya@example.com');
    await userEvent.click(find<HTMLInputElement>(element, 'input-comment')!);
    // Дать живой проверке шанс сработать, если бы она была вооружена.
    await new Promise((resolve) => setTimeout(resolve, 150));

    expect(remark(element)).toBe('Заполните поле');
    // Следующая отправка проходит и замечание снимает.
    await userEvent.click(submitButton(element));
    await vi.waitFor(() => {
      expect(find(element, 'submit-result')?.getAttribute('data-ok')).toBe('true');
    });
    expect(remark(element)).toBe('');
  });
});
