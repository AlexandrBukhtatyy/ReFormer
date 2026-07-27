/**
 * Шаблоны-«рыба» для генерации артефактов формы (контекстное меню дерева файлов). В ReFormer JSON
 * несёт только схему формы (layout); валидация/поведение формы/поведение UI — это TS-DSL
 * (`defineValidationSchema` / `defineFormBehavior` / `RenderBehaviorFn`), поэтому генерируются `.ts`.
 * Всё — рабочий прототип: form.json открывается в canvas, `.ts` правятся в Monaco.
 *
 * @module reformer-builder/app/form-templates
 */

/** Схема формы (JSON) — рабочая «рыба»: Box + пара полей, распознаётся как форма (canvas). */
export function formJsonTemplate(): string {
  const schema = {
    $schema: './form-schema.schema.json',
    version: '1.0',
    root: {
      component: '$component(Box)',
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
  /** Пример вычисляемого поля (заполняется behavior.ts). */
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
export function behaviorTsTemplate(formName: string): string {
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
export function uiTsTemplate(formName: string): string {
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

export const formUiBehavior: RenderBehaviorFn<FormShape> = (schema) => {
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
