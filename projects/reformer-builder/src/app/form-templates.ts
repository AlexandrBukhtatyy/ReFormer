/**
 * Шаблоны-«рыба» для генерации артефактов формы: одиночные пункты «Сгенерировать» в контекстном
 * меню дерева и содержимое встроенного шаблона (`templates/builtin.ts`). В ReFormer JSON несёт
 * только схему формы (layout); валидация/поведение формы/поведение UI — это TS-DSL
 * (`defineValidationSchema` / `defineFormBehavior` / `RenderBehaviorFn`), поэтому генерируются `.ts`.
 * Всё — рабочий прототип: renderer.schema.json открывается в canvas, `.ts` правятся в Monaco.
 *
 * Имена файлов — канон раскладки формы (`@reformer/mcp` docs/llms/06-form-directory-layout.md):
 * плоские по умолчанию, точечный префикс только у двух concern'ов с двумя слоями — `form.` (модель)
 * и `renderer.` (рендер).
 *
 * Состав файлов формы больше не зашит здесь: им управляет выбранный шаблон (`templates/`).
 *
 * @module reformer-builder/app/form-templates
 */

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
export function componentName(formName: string): string {
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
        {
          selector: 'contactMethod',
          value: '$model(contactMethod)',
          component: '$component(Select)',
          componentProps: {
            label: 'Способ связи',
            // Опции приходят из data-sources.ts — реестр связывает имя со значением.
            options: '$dataSource(contactMethods)',
            placeholder: 'Выберите способ',
          },
        },
      ],
    },
  };
  return JSON.stringify(schema, null, 2) + '\n';
}

/**
 * Типы формы: тип данных модели, тип элемента справочника, доменные константы. Отдельный файл —
 * требование канона раскладки (`types.ts` — «form type + enums + option type + dictionaries»),
 * и он же разрывает круг импортов: `data-sources.ts` берёт отсюда `SelectOption`, а `model.ts` —
 * `FormShape`, не завися при этом друг от друга.
 */
export function typesTsTemplate(formName: string): string {
  return `/**
 * Типы формы «${formName}» — тип данных модели и типы справочников. Источник истины для схем
 * валидации/поведения/UI: они импортируют \`FormShape\` отсюда, а не из model.ts.
 */

export interface FormShape {
  name: string;
  email: string;
  /** Способ связи — значение берётся из справочника \`contactMethods\` (data-sources.ts). */
  contactMethod: string;
  /** Пример вычисляемого поля (заполняется form.behavior.ts). */
  greeting: string;
}

/** Элемент справочника: значение + подпись. Тот же тип печатает кодоген примеров. */
export type SelectOption = { value: string; label: string };
`;
}

/** Модель формы (начальные значения) — стартовое состояние для createJsonForm/useFormControl. */
export function modelTsTemplate(formName: string): string {
  return `/**
 * Модель формы «${formName}» — начальные значения. Тип модели живёт в types.ts (канон раскладки),
 * поэтому здесь только данные. Docs: @reformer/core (FormModel<T>).
 */
import type { FormShape } from './types';

/** Начальные значения — для createJsonForm/useFormControl. */
export const initialFormModel: FormShape = {
  name: '',
  email: '',
  contactMethod: '',
  greeting: '',
};
`;
}

/**
 * Справочники и загрузчики (`data-sources.ts`) — значения, которые схема тянет оператором
 * `$dataSource(...)`, а `registry.ts` связывает с их именами.
 */
export function dataSourcesTsTemplate(formName: string): string {
  return `/**
 * Справочники формы «${formName}» — значения операторов \`$dataSource(...)\` из
 * renderer.schema.json. Имя экспорта = имя в схеме; связывает их registry.ts
 * (\`reg.dataSource('contactMethods', contactMethods)\`).
 */
import type { SelectOption } from './types';

/** Способы связи — опции поля \`contactMethod\`. */
export const contactMethods: SelectOption[] = [
  { value: 'email', label: 'Электронная почта' },
  { value: 'phone', label: 'Телефон' },
  { value: 'telegram', label: 'Telegram' },
];

// ── Шпаргалка ──

// Справочник с бэкенда: грузите его в renderer.behavior.ts (onMount узла) и кладите в реестр
// либо патчите пропсы узла — сам \`$dataSource\` синхронен и функцию-загрузчик не вызывает:
// export const cities: SelectOption[] = [];
// export async function loadCities(): Promise<SelectOption[]> {
//   const res = await fetch('/api/cities');
//   return (await res.json()) as SelectOption[];
// }
`;
}

/** Загрузка и отправка (`api.ts`) — единственное место, где форма ходит на бэкенд. */
export function apiTsTemplate(formName: string): string {
  return `/**
 * Бэкенд формы «${formName}» — отправка и загрузка. Мок с задержкой: форма работает сразу,
 * реальные запросы вписываются здесь и больше нигде.
 */
import type { FormShape } from './types';

export type ApiResult<T> = { success: true; data: T } | { success: false; error: string };

const API_DELAY = 600;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST — отправка формы. TODO: заменить на реальный запрос. */
export async function submitForm(values: FormShape): Promise<ApiResult<{ id: string }>> {
  await wait(API_DELAY);
  // eslint-disable-next-line no-console
  console.info('[${formName}] submit', values);
  return { success: true, data: { id: String(Date.now()) } };
}

// ── Шпаргалка ──

// Префилл (GET перед показом формы) — зовите из renderer.behavior.ts на onMount корневого узла
// и кладите результат в модель:
// export async function loadForm(id: string): Promise<ApiResult<FormShape>> {
//   const res = await fetch(\`/api/forms/\${id}\`);
//   if (!res.ok) return { success: false, error: res.statusText };
//   return { success: true, data: (await res.json()) as FormShape };
// }
`;
}

/** Схема валидации (TS-DSL над моделью) — @reformer/core/validation. */
export function validationTsTemplate(formName: string): string {
  return `/**
 * Схема валидации формы «${formName}» — правила над МОДЕЛЬЮ (не в JSON-схеме формы).
 * Запуск: validateModel(model, formValidation). Docs: @reformer/core/validation.
 *
 * Ниже — активные правила под поля \`FormShape\` (types.ts) + шпаргалка частых случаев (раскомментируйте/
 * скопируйте под свои поля вместе с нужным импортом).
 */
import {
  validate,
  defineValidationSchema,
  type ValidationStrategyOptions,
} from '@reformer/core/validation';
import { required, email, minLength, maxLength } from '@reformer/core/validators';
// Импорты для шпаргалки ниже — раскомментируйте то, что понадобится. Держать их подключёнными
// «на всякий случай» нельзя: проекты собираются с \`noUnusedLocals\`, и форма не скомпилируется.
// import { validateAsync, validateWhen, cross, each, apply } from '@reformer/core/validation';
// import { min, max, pattern, url, phone, isNumber, integer, multipleOf, nonNegative } from '@reformer/core/validators';
import type { FormShape } from './types';

/**
 * КОГДА гонять валидацию. Одна точка истины: её читает и \`index.tsx\` (через \`useFormValidation\`),
 * и Renderer-превью билдера, поэтому в превью форма ведёт себя ровно так же, как в приложении.
 *
 * \`submit\` — только по кнопке; \`blur\` — при потере фокуса; \`change\` — на каждый ввод;
 * \`afterFirstSubmit\` — тихо до первой отправки, затем вживую.
 */
export const validationOptions: ValidationStrategyOptions = {
  strategy: 'afterFirstSubmit',
  debounce: 300,
};

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
 * Ниже — активное поведение под поля \`FormShape\` (types.ts) + шпаргалка частых случаев (раскомментируйте нужное
 * вместе с его импортом).
 */
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
// Импорты для шпаргалки ниже — раскомментируйте то, что понадобится. Держать их подключёнными
// «на всякий случай» нельзя: проекты собираются с \`noUnusedLocals\`, и форма не скомпилируется.
// import { compute, copyFrom, syncFields, onChange, enableWhen, disableWhen, resetWhen, revalidateWhen } from '@reformer/core/behaviors';
import type { FormShape } from './types';

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

/** Схема поведения UI (renderer.behavior над деревом рендера) — @reformer/renderer-react. */
export function renderBehaviorTsTemplate(formName: string): string {
  return `/**
 * Поведение UI формы «${formName}» — декларативные правила над деревом рендера (скрытие узлов,
 * патч пропсов, события, lifecycle) по selector'ам из renderer.schema.json. Docs:
 * @reformer/renderer-react render-behavior. \`form\` берётся из замыкания фабрики или через
 * getRef() wizard-узла.
 *
 * Ниже — шпаргалка частых случаев (раскомментируйте нужное + импорт хелпера).
 */
import type { RenderBehaviorFn } from '@reformer/renderer-react';
// import { hideWhen, renderEffect, onComponentEvent, onInit, onMount, onUnmount } from '@reformer/renderer-react';
import type { FormShape } from './types';

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
 * Реестр компонентов (renderer-json) — привязка `$component(...)` из renderer.schema.json к
 * реализациям @reformer/ui-kit. `FIELD_WRAPPER` оборачивает каждое поле (label + ошибки).
 * Регенерируется целиком.
 */
export function registryTsTemplate(formName: string): string {
  return `/**
 * Реестр компонентов формы «${formName}» — что рендерить под каждое \`$component(...)\` из
 * renderer.schema.json. \`FIELD_WRAPPER\` (FormField) оборачивает каждый лист: label + ошибки. Добавили в схему новый
 * \`$component(X)\` — зарегистрируйте X здесь (field-компоненты ui-kit: \`XField\`); новый
 * \`$dataSource(y)\` — заведите \`y\` в data-sources.ts и свяжите здесь же. Docs: @reformer/renderer-json.
 */
import { FormField, InputField, SelectField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { contactMethods } from './data-sources';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
    reg.component('Select', SelectField);
    // Справочники: имя в \`$dataSource(...)\` → значение из data-sources.ts.
    reg.dataSource('contactMethods', contactMethods);
  });
}
`;
}

/**
 * Точка сборки формы (renderer-json) — модель + renderer.schema.json + реестр + поведение →
 * JsonFormRenderer. Default-export страница: подключается в react-playground одной строкой.
 * Регенерируется целиком.
 */
export function indexTsxTemplate(formName: string): string {
  const Comp = componentName(formName);
  return `/**
 * Форма «${formName}» — сборка и рендер. В JSX только провайдер реестра и рендерер: весь layout
 * живёт в renderer.schema.json, типы — в types.ts, значения/поведение/валидация — в model.ts /
 * form.behavior.ts / validation.ts / renderer.behavior.ts, справочники — в data-sources.ts,
 * запросы — в api.ts.
 *
 * Готова к работе сразу: рендерится на \`initialFormModel\`, «Отправить» гоняет валидацию. Подключение
 * в react-playground: \`import ${Comp} from './pages/examples/<папка>';\` + \`<Route element={<${Comp} />} />\`.
 */
import { useState } from 'react';
import { useFormValidation } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import { Button } from '@reformer/ui-kit';
import rawSchema from './renderer.schema.json';
import { createRegistry } from './registry';
import { initialFormModel } from './model';
import type { FormShape } from './types';
import { formBehavior } from './form.behavior';
import { formValidation, validationOptions } from './validation';
import { formRenderBehavior } from './renderer.behavior';
import { submitForm } from './api';

// В чистом JSON операторы типизируются как \`string\` — приведение = сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<FormShape>;

export default function ${Comp}() {
  const [status, setStatus] = useState<string | null>(null);

  // Сборка ОДНИМ вызовом: model + form + registry + behavior + render-behavior из одной схемы.
  // useJsonForm (ленивый useState) зовёт фабрику ровно один раз.
  const jsonForm = useJsonForm(() =>
    createJsonForm<FormShape>({
      schema,
      registry: createRegistry(),
      initial: { ...initialFormModel },
      behavior: formBehavior,
      renderBehavior: () => formRenderBehavior,
    })
  );

  // Стратегия запуска валидации живёт в validation.ts — там же, откуда её читает превью билдера.
  const validation = useFormValidation({
    model: jsonForm.model,
    schema: formValidation,
    ...validationOptions,
  });

  const submit = async (): Promise<void> => {
    if (!(await validation.submit())) {
      setStatus('Проверьте выделенные поля');
      return;
    }
    // Бэкенд — только через api.ts: страница не знает ни про fetch, ни про эндпоинты.
    const result = await submitForm(jsonForm.model.get());
    setStatus(
      result.success ? \`Отправлено, номер заявки \${result.data.id}\` : \`Ошибка: \${result.error}\`
    );
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

      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<FormShape>
          form={jsonForm}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>

      <Button disabled={validation.isValidating} onClick={() => void submit()}>
        Отправить
      </Button>
    </div>
  );
}
`;
}
