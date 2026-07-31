/**
 * Шаблоны-«рыба» для генерации артефактов формы (контекстное меню дерева файлов). В ReFormer JSON
 * несёт только схему формы (layout); валидация/поведение формы/поведение UI — это TS-DSL
 * (`defineValidationSchema` / `defineFormBehavior` / `RenderBehaviorFn`), поэтому генерируются `.ts`.
 * Всё — рабочий прототип: form.json открывается в canvas, `.ts` правятся в Monaco.
 *
 * @module reformer-builder/app/form-templates
 */

/** Какие файлы генерировать в каталоге формы. */
export interface FormDirFiles {
  model: boolean;
  form: boolean;
  validation: boolean;
  /** Поведение формы (form-behavior.ts) — реактивные связи над моделью. */
  formBehavior: boolean;
  /** Поведение UI (render-behavior.ts) — render-behavior над деревом рендера. */
  renderBehavior: boolean;
  /** Реестр компонентов (registry.ts) — привязка `$component` к ui-kit. */
  registry: boolean;
  /** Страница-компонент (index.tsx) — рендерит форму. Требует остальные файлы. */
  component: boolean;
}

/**
 * Эффективный набор файлов: страница-компонент (index.tsx) не соберётся без модели, схемы, реестра,
 * валидации, поведения и ui-behavior — поэтому при `component` его зависимости включаются
 * принудительно. Так «Каталог с формой» отдаёт форму, работающую сразу после копирования в проект.
 */
export function resolveFormDirFiles(which: FormDirFiles): FormDirFiles {
  if (!which.component) return which;
  return {
    model: true,
    form: true,
    validation: true,
    formBehavior: true,
    renderBehavior: true,
    registry: true,
    component: true,
  };
}

/** PascalCase-идентификатор из имени формы (для имени компонента-страницы). */
function pascalCase(formName: string): string {
  const parts = formName.split(/[^a-zA-Z0-9]+/).filter(Boolean);
  return parts.map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
}

/**
 * Имя компонента-страницы: валидный JS-идентификатор с суффиксом `Form`. Ведущая цифра/пустое имя
 * получают префикс `Form`; уже имеющийся суффикс `Form` не задваивается (имя формы «profile form»
 * → `ProfileForm`, а не `ProfileFormForm`).
 */
function componentName(formName: string): string {
  const pascal = pascalCase(formName);
  const base = /^[A-Za-z]/.test(pascal) ? pascal : `Form${pascal}`;
  return base.endsWith('Form') ? base : `${base}Form`;
}

/** Схема формы (JSON) — рабочая «рыба»: Div + пара полей, распознаётся как форма (canvas). */
export function formJsonTemplate(): string {
  const schema = {
    $schema: './form-schema.schema.json',
    version: '1.0',
    root: {
      component: '$html(div)',
      componentProps: { className: 'space-y-4' },
      children: [
        {
          selector: 'name',
          value: '$model(name)',
          component: '$component(Input)',
          componentProps: { label: 'Имя' },
        },
        {
          selector: 'email',
          value: '$model(email)',
          component: '$component(Input)',
          componentProps: { label: 'Email', type: 'email' },
        },
      ],
    },
  };
  return JSON.stringify(schema, null, 2) + '\n';
}

/** Модель формы (тип данных + начальные значения) — источник истины для валидации/поведения/UI. */
export function modelTsTemplate(formName: string): string {
  return `/**
 * Модель формы «${formName}» — тип данных (источник истины) и начальные значения.
 * Импортируется схемами валидации/поведения/UI. Docs: @reformer/core (FormModel<T>).
 */

export interface FormShape {
  name: string;
  email: string;
  /** Пример вычисляемого поля (заполняется form-behavior.ts). */
  greeting: string;
}

/** Начальные значения — для createForm/useFormControl. */
export const initialFormModel: FormShape = {
  name: '',
  email: '',
  greeting: '',
};
`;
}

/** Схема валидации (TS-DSL над моделью) — @reformer/core/validation. */
export function validationTsTemplate(formName: string): string {
  return `/**
 * Схема валидации формы «${formName}» — правила над МОДЕЛЬЮ (не в JSON-схеме формы).
 * Запуск: validateModel(model, formValidation). Docs: @reformer/core/validation.
 *
 * Ниже — активные правила под поля model.ts + шпаргалка частых случаев (раскомментируйте/
 * скопируйте под свои поля). Импорты покрывают все примеры — лишнее удалите.
 */
import {
  validate,
  validateAsync,
  validateWhen,
  cross,
  each,
  apply,
  defineValidationSchema,
} from '@reformer/core/validation';
import {
  required,
  email,
  min,
  max,
  minLength,
  maxLength,
  pattern,
  url,
  phone,
  isNumber,
  integer,
  multipleOf,
  nonNegative,
} from '@reformer/core/validators';
import type { FormShape } from './model';

export const formValidation = defineValidationSchema<FormShape>(({ model }) => {
  // ── Активные правила ──
  validate(model.$.name, [required({ message: 'Укажите имя' }), minLength(2), maxLength(50)]);
  validate(model.$.email, [required(), email()]);

  // ── Шпаргалка (скопируйте под свои поля) ──

  // Обязательное:
  // validate(model.$.field, [required({ message: 'Обязательное поле' })]);

  // Число в диапазоне:
  // validate(model.$.amount, [required(), isNumber(), min(1000), max(1_000_000)]);

  // Длина строки:
  // validate(model.$.login, [required(), minLength(3), maxLength(20)]);

  // Регэксп (ИНН/паспорт/код):
  // validate(model.$.inn, [required(), pattern(/^\\d{10,12}$/, { message: 'ИНН — 10–12 цифр' })]);

  // URL / телефон / целое / кратное / неотрицательное:
  // validate(model.$.site, [url()]);
  // validate(model.$.phone, [required(), phone()]);
  // validate(model.$.count, [integer(), nonNegative()]);
  // validate(model.$.step, [multipleOf(5)]);

  // Условная валидация (активна только при условии):
  // validateWhen(() => model.employmentStatus === 'employed', () => {
  //   validate(model.$.companyName, [required({ message: 'Укажите компанию' })]);
  //   validate(model.$.companyInn, [required(), pattern(/^\\d{10}$/)]);
  // });

  // Cross-field (сравнение полей — читает снапшот формы):
  // cross(model.$.initialPayment, (f) =>
  //   f.initialPayment > f.propertyValue
  //     ? { code: 'tooBig', message: 'Взнос больше стоимости' }
  //     : null,
  // );

  // Массив: правило к каждому элементу:
  // each(model.coBorrowers, (item) => {
  //   validate(item.$.firstName, [required()]);
  //   validate(item.$.income, [isNumber(), min(0)]);
  // });

  // Async (проверка на сервере):
  // validateAsync(model.$.login, [
  //   async (value) => ((await isLoginTaken(value)) ? { code: 'taken', message: 'Логин занят' } : null),
  // ]);

  // Композиция под-схем (например, по шагам):
  // apply(step1Validation, step2Validation);
});
`;
}

/** Схема поведения формы (TS-DSL над моделью) — @reformer/core/behaviors. */
export function formBehaviorTsTemplate(formName: string): string {
  return `/**
 * Поведение формы «${formName}» — реактивные связи над МОДЕЛЬЮ (вычисляемые поля, копирование,
 * доступность, ре-валидация). Docs: @reformer/core/behaviors.
 *
 * Ниже — активное поведение под поля model.ts + шпаргалка частых случаев. Импорты покрывают все
 * примеры — лишнее удалите.
 */
import {
  defineFormBehavior,
  compute,
  computeFrom,
  copyFrom,
  syncFields,
  onChange,
  enableWhen,
  disableWhen,
  resetWhen,
  revalidateWhen,
} from '@reformer/core/behaviors';
import type { FormShape } from './model';

export const formBehavior = defineFormBehavior<FormShape>(({ model }) => {
  // ── Активное поведение ──
  // greeting вычисляется из name.
  computeFrom([model.$.name], model.$.greeting, (name) => (name ? \`Привет, \${name}!\` : ''));

  // ── Шпаргалка (скопируйте под свои поля) ──

  // Вычисляемое поле (авто-трекинг зависимостей внутри read):
  // compute(model.$.total, () => model.price * model.qty);

  // Вычисляемое из явного списка источников:
  // computeFrom([model.$.amount, model.$.rate, model.$.term], model.$.monthlyPayment,
  //   (amount, rate, term) => annuity(amount, rate, term));

  // Копирование значения (опционально по условию):
  // copyFrom(model.$.email, model.$.login);
  // copyFrom(model.$.legalAddress, model.$.actualAddress, { when: () => model.sameAddress });

  // Двусторонняя синхронизация (с трансформом):
  // syncFields(model.$.priceWithVat, model.$.priceNoVat, { transform: (v) => v / 1.2 });

  // Реакция на изменение (с debounce):
  // onChange(model.$.query, (value) => void search(value), { debounce: 300 });

  // Доступность поля по условию:
  // enableWhen(model.$.companyName, () => model.employmentStatus === 'employed');
  // disableWhen(model.$.promoCode, () => !model.hasPromo, { resetOnDisable: true });

  // Сброс поля при условии:
  // resetWhen(model.$.childrenCount, () => !model.hasChildren, { resetValue: 0 });

  // Ре-валидация зависимого поля (мост к валидации):
  // revalidateWhen([model.$.password], () => void validateModel(model, formValidation));
});
`;
}

/** Схема поведения UI (render-behavior над деревом рендера) — @reformer/renderer-react. */
export function renderBehaviorTsTemplate(formName: string): string {
  return `/**
 * Поведение UI формы «${formName}» — декларативные правила над деревом рендера (скрытие узлов,
 * патч пропсов, события, lifecycle) по selector'ам из form.json. Docs: @reformer/renderer-react
 * render-behavior. \`form\` берётся из замыкания фабрики или через getRef() wizard-узла.
 *
 * Ниже — шпаргалка частых случаев (раскомментируйте нужное + импорт хелпера).
 */
import type { RenderBehaviorFn } from '@reformer/renderer-react';
// import { hideWhen, renderEffect, onComponentEvent, onInit, onMount, onUnmount } from '@reformer/renderer-react';
import type { FormShape } from './model';

export const formRenderBehavior: RenderBehaviorFn<FormShape> = (schema) => {
  // Скрыть узел по условию (реактивно — читай сигнал целиком):
  // hideWhen(schema.node('mortgage-section'), () => form.loanType.value.value !== 'mortgage');

  // Патч пропсов узла при инициализации (напр. инъекция конфига валидации в wizard):
  // onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ ...config }));

  // Обработчик проп-события компонента (onSubmit и т.п.):
  // onComponentEvent(schema.node('wizard'), 'onSubmit', async (values) => { await submit(values); });

  // Реактивный эффект на уровне всего дерева (первый аргумент — СХЕМА, не узел):
  // renderEffect(schema, () => { if (form.done.value.value) goToLastStep(); });

  // Lifecycle узла (onMount может вернуть cleanup):
  // onMount(schema.node('data'), () => { void load(); return () => cleanup(); });
  // onUnmount(schema.node('wizard'), () => console.log('unmounted'));

  void schema;
};
`;
}

/**
 * Реестр компонентов (renderer-json) — привязка `$component(...)` из form.json к реализациям
 * @reformer/ui-kit. `FIELD_WRAPPER` оборачивает каждое поле (label + ошибки). Регенерируется целиком.
 */
export function registryTsTemplate(formName: string): string {
  return `/**
 * Реестр компонентов формы «${formName}» — что рендерить под каждое \`$component(...)\` из form.json.
 * \`FIELD_WRAPPER\` (FormField) оборачивает каждый лист: label + ошибки. Добавили в схему новый
 * \`$component(X)\` — зарегистрируйте X здесь (field-компоненты ui-kit: \`XField\`). Docs: @reformer/renderer-json.
 */
import { InputField, FormField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
  });
}
`;
}

/**
 * Точка сборки формы (renderer-json) — модель + form.json + реестр + поведение → JsonFormRenderer.
 * Default-export страница: подключается в react-playground одной строкой. Регенерируется целиком.
 */
export function indexTsxTemplate(formName: string): string {
  const Comp = componentName(formName);
  return `/**
 * Форма «${formName}» — сборка и рендер. В JSX только провайдер реестра и рендерер: весь layout
 * живёт в form.json, значения/поведение/валидация — в model.ts / form-behavior.ts / validation.ts / render-behavior.ts.
 *
 * Готова к работе сразу: рендерится на \`initialFormModel\`, «Отправить» гоняет валидацию. Подключение
 * в react-playground: \`import ${Comp} from './pages/examples/<папка>';\` + \`<Route element={<${Comp} />} />\`.
 */
import { useMemo, useState } from 'react';
import { createModel, createForm } from '@reformer/core';
import { validateModel } from '@reformer/core/validation';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  convertJsonToM1Tree,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { Button } from '@reformer/ui-kit';
import rawSchema from './form.json';
import { createRegistry } from './registry';
import { initialFormModel, type FormShape } from './model';
import { formBehavior } from './form-behavior';
import { formValidation } from './validation';
import { formRenderBehavior } from './render-behavior';

// В чистом JSON операторы типизируются как \`string\` — приведение = сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema;

export default function ${Comp}() {
  const [status, setStatus] = useState<string | null>(null);

  // Один раз: повторная сборка создала бы новый реестр и пересоздала бы форму на каждый рендер.
  const registry = useMemo(() => createRegistry(), []);
  const { model, form } = useMemo(() => {
    const model = createModel<FormShape>({ ...initialFormModel });
    const form = createForm<FormShape>({
      model,
      schema: convertJsonToM1Tree(schema, registry, model),
      behavior: formBehavior,
    });
    return { model, form };
  }, [registry]);

  const submit = async (): Promise<void> => {
    form.markAsTouched();
    const valid = await validateModel(model, formValidation);
    if (!valid) {
      setStatus('Проверьте выделенные поля');
      return;
    }
    // TODO: отправка на бэкенд (пример флоу — в renderer-json examples: api.ts + submit).
    // eslint-disable-next-line no-console
    console.info('[${formName}] submit', model.get());
    setStatus('Форма валидна — данные готовы к отправке');
  };

  return (
    <div className="mx-auto max-w-xl space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold text-gray-800">${formName}</h1>
      </header>

      {status && (
        <div role="status" className="rounded-md border p-3 text-sm">
          {status}
        </div>
      )}

      <JsonRendererProvider settings={{ registry }}>
        <JsonFormRenderer<FormShape>
          schema={schema}
          model={model}
          renderBehavior={formRenderBehavior}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>

      <Button onClick={() => void submit()}>Отправить</Button>
    </div>
  );
}
`;
}
