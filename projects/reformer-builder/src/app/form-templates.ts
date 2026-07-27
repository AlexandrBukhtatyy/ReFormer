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
 */
import { validate, defineValidationSchema } from '@reformer/core/validation';
import { required, email, minLength } from '@reformer/core/validators';
import type { FormShape } from './model';

export const formValidation = defineValidationSchema<FormShape>(({ model }) => {
  validate(model.$.name, [required({ message: 'Укажите имя' }), minLength(2)]);
  validate(model.$.email, [required(), email()]);
});
`;
}

/** Схема поведения формы (TS-DSL над моделью) — @reformer/core/behaviors. */
export function behaviorTsTemplate(formName: string): string {
  return `/**
 * Поведение формы «${formName}» — реактивные связи над МОДЕЛЬЮ (вычисляемые поля, копирование,
 * доступность). Docs: @reformer/core/behaviors.
 */
import { defineFormBehavior, computeFrom } from '@reformer/core/behaviors';
import type { FormShape } from './model';

export const formBehavior = defineFormBehavior<FormShape>(({ model }) => {
  // Пример: greeting вычисляется из name.
  computeFrom([model.$.name], model.$.greeting, (name) => (name ? \`Привет, \${name}!\` : ''));
});
`;
}

/** Схема поведения UI (render-behavior над деревом рендера) — @reformer/renderer-react. */
export function uiTsTemplate(formName: string): string {
  return `/**
 * Поведение UI формы «${formName}» — декларативные правила над деревом рендера (скрытие узлов,
 * патч пропсов) по selector'ам из form.json. Docs: @reformer/renderer-react render-behavior.
 */
import type { RenderBehaviorFn } from '@reformer/renderer-react';
import type { FormShape } from './model';
// import { hideWhen } from '@reformer/renderer-react';

export const formUiBehavior: RenderBehaviorFn<FormShape> = (schema) => {
  // Пример: скрыть узел с selector 'email', пока не заполнено 'name':
  // hideWhen(schema.node('email'), () => !form.name.value.value);
  void schema;
};
`;
}
