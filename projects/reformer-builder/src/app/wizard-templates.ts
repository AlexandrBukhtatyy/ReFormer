/**
 * Шаблоны-«рыба» пошаговой формы (визарда) — второй встроенный шаблон рядом с простой формой
 * (`form-templates.ts`). Отличия от простой: схема начинается с узла `$component(Wizard)`, шаги
 * лежат в `componentProps.steps[]`, а к набору файлов добавляется тонкий адаптер `wizard.tsx`.
 *
 * Как это работает: renderer-react сам пробрасывает `form` в компоненты с маркером
 * `__selfManagedChildren`, а ui-kit `FormWizard` умеет рендерить `step.body` как RenderNode.
 * Адаптеру остаётся поднять `title`/`icon` из узла шага и отдать сам узел телом шага — без
 * `patchProps` и прочей проводки. Шаги — обычные `Box`-узлы, поэтому отдельный `Step`-компонент
 * регистрировать не нужно, а canvas билдера показывает их через слот `steps`.
 *
 * @module reformer-builder/app/wizard-templates
 */

import { componentName } from './form-templates';

/** Схема пошаговой формы: `Wizard` c двумя шагами-`Box`; каждый шаг несёт поля модели. */
export function wizardFormJsonTemplate(): string {
  const step = (title: string, icon: string, children: unknown[]): unknown => ({
    component: '$component(Box)',
    componentProps: { title, icon, className: 'space-y-4' },
    children,
  });
  const field = (
    model: string,
    component: string,
    componentProps: Record<string, unknown>
  ): unknown => ({ selector: model, value: `$model(${model})`, component, componentProps });

  const schema = {
    $schema: './form-schema.schema.json',
    version: '1.0',
    root: {
      selector: 'wizard',
      component: '$component(Wizard)',
      componentProps: {
        className: 'rounded-lg bg-white p-6 shadow-sm',
        steps: [
          step('Контакты', '👤', [
            field('fullName', '$component(Input)', { label: 'ФИО', placeholder: 'Иванов Иван' }),
            field('email', '$component(Input)', { label: 'Email', type: 'email' }),
          ]),
          step('Адрес', '🏠', [
            field('city', '$component(Input)', { label: 'Город' }),
            field('address', '$component(Input)', { label: 'Улица, дом, квартира' }),
            field('agree', '$component(Checkbox)', { label: 'Данные указаны верно' }),
          ]),
        ],
      },
    },
  };
  return JSON.stringify(schema, null, 2) + '\n';
}

/** Модель пошаговой формы: поля обоих шагов. */
export function wizardModelTsTemplate(formName: string): string {
  return `/**
 * Модель пошаговой формы «${formName}» — поля всех шагов в одном объекте: визард шагает по одной
 * модели, а не по нескольким. Docs: @reformer/core (FormModel<T>), @reformer/cdk (FormWizard).
 */

export interface FormShape {
  // Шаг 1 — контакты.
  fullName: string;
  email: string;
  // Шаг 2 — адрес.
  city: string;
  address: string;
  agree: boolean;
}

/** Начальные значения — для createJsonForm/useFormControl. */
export const initialFormModel: FormShape = {
  fullName: '',
  email: '',
  city: '',
  address: '',
  agree: false,
};
`;
}

/** Адаптер визарда: узлы шагов из JSON → шаги ui-kit `FormWizard`. */
export function wizardAdapterTsxTemplate(formName: string): string {
  return `/**
 * Адаптер визарда для формы «${formName}»: связывает JSON-схему и ui-kit \`FormWizard\`.
 *
 * Шаги в схеме лежат в \`componentProps.steps[]\` — конвертер renderer-json уже превратил их в
 * RenderNode, поэтому здесь достаточно поднять \`title\`/\`icon\` из узла и отдать сам узел как
 * \`body\`, а отрисовку узла дать пропом \`renderStepBody\`: ui-kit \`FormWizard\` намеренно не
 * зависит от \`@reformer/renderer-react\`. \`form\` приходит пропом — маркер
 * \`__selfManagedChildren\` просит рендерер отдать её и не обходить детей самому.
 *
 * \`onSubmit\` навешивается снаружи — в render-behavior.ts через onComponentEvent.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { FormShape } from './model';

/** Узел шага после конвертации: \`title\`/\`icon\` лежат в его \`componentProps\`. */
interface StepNode {
  componentProps?: { title?: string; icon?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface WizardProps {
  /** Приходит от рендерера (см. \`__selfManagedChildren\`). */
  form?: FormProxy<FormShape>;
  /** Узлы шагов из \`componentProps.steps\`. */
  steps?: StepNode[];
  className?: string;
  onSubmit?: (values: FormShape) => void | Promise<void>;
}

export function Wizard({ form, steps = [], className, onSubmit }: WizardProps): ReactNode {
  const wizardSteps: FormWizardStep<FormShape, RenderNode<FormShape>>[] = steps.map((node, i) => ({
    number: i + 1,
    title: node.componentProps?.title ?? \`Шаг \${i + 1}\`,
    icon: node.componentProps?.icon,
    body: node as any,
  }));

  return (
    <FormWizard<FormShape, RenderNode<FormShape>>
      form={form as FormProxy<FormShape>}
      className={className}
      steps={wizardSteps}
      config={{}}
      renderStepBody={(body, wizardForm) => <RenderNodeComponent node={body} form={wizardForm} />}
      onSubmit={onSubmit ? () => onSubmit(form?.getValue() as FormShape) : undefined}
    />
  );
}

// Контракт с рендерером: получить \`form\` пропом и сырые \`steps\`, без обхода детей.
(Wizard as any).__selfManagedChildren = true;
`;
}

/** Реестр пошаговой формы: поля + контейнеры + адаптер визарда. */
export function wizardRegistryTsTemplate(formName: string): string {
  return `/**
 * Реестр компонентов формы «${formName}» — что рендерить под каждое \`$component(...)\` из form.json.
 * \`FIELD_WRAPPER\` (FormField) оборачивает каждый лист: label + ошибки. \`Wizard\` — локальный
 * адаптер (wizard.tsx); шаги визарда рендерятся как обычные \`Box\`-узлы. Docs: @reformer/renderer-json.
 */
import { Box, CheckboxField, FormField, InputField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { Wizard } from './wizard';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);
    // Контейнеры: визард и тела шагов.
    reg.component('Wizard', Wizard);
    reg.component('Box', Box);
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
    reg.component('Checkbox', CheckboxField);
  });
}
`;
}

/** Валидация пошаговой формы: правила разложены по шагам. */
export function wizardValidationTsTemplate(formName: string): string {
  return `/**
 * Схема валидации формы «${formName}» — правила над МОДЕЛЬЮ, сгруппированные по шагам визарда.
 * Запуск: validateModel(model, formValidation). Docs: @reformer/core/validation.
 */
import {
  validate,
  defineValidationSchema,
  type ValidationStrategyOptions,
} from '@reformer/core/validation';
import { email, minLength, required } from '@reformer/core/validators';
import type { FormShape } from './model';

/**
 * КОГДА гонять валидацию. Одна точка истины: её читают и \`index.tsx\`, и Renderer-превью билдера.
 * У визарда осмысленнее \`blur\` — шаг проверяется по мере заполнения, а не только на отправке.
 */
export const validationOptions: ValidationStrategyOptions = { strategy: 'blur' };

export const formValidation = defineValidationSchema<FormShape>(({ model }) => {
  // Шаг 1 — контакты.
  validate(model.$.fullName, [required({ message: 'Укажите ФИО' }), minLength(3)]);
  validate(model.$.email, [required(), email()]);

  // Шаг 2 — адрес.
  validate(model.$.city, [required({ message: 'Укажите город' })]);
  validate(model.$.address, [required({ message: 'Укажите адрес' })]);
  validate(model.$.agree, [
    (value) => (value === true ? null : { code: 'agree', message: 'Подтвердите данные' }),
  ]);
});
`;
}

/** Поведение пошаговой формы. */
export function wizardFormBehaviorTsTemplate(formName: string): string {
  return `/**
 * Поведение формы «${formName}» — реактивные связи над МОДЕЛЬЮ. Работает одинаково на всех шагах:
 * визард переключает видимость, а модель и её связи общие. Docs: @reformer/core/behaviors.
 */
import { defineFormBehavior, enableWhen } from '@reformer/core/behaviors';
import type { FormShape } from './model';

export const formBehavior = defineFormBehavior<FormShape>(({ model }) => {
  // Адрес заполняется только после города — поле недоступно, пока город пуст.
  enableWhen(model.$.address, () => model.city.trim().length > 0);

  // ── Шпаргалка (скопируйте под свои поля) ──
  // computeFrom([model.$.fullName], model.$.greeting, (name) => name ? \`Привет, \${name}!\` : '');
  // copyFrom(model.$.email, model.$.login);
  // onChange(model.$.city, (value) => void loadStreets(value), { debounce: 300 });
});
`;
}

/** Поведение UI пошаговой формы: submit визарда. */
export function wizardRenderBehaviorTsTemplate(formName: string): string {
  return `/**
 * Поведение UI формы «${formName}» — правила над деревом рендера по selector'ам из form.json.
 * Здесь висит submit визарда: ui-kit FormWizard зовёт \`onSubmit\` на последнем шаге, а мы гоняем
 * валидацию модели и отправляем значения. Docs: @reformer/renderer-react render-behavior.
 *
 * Это ФАБРИКА: ни форма, ни модель из схемы рендера не достаются, поэтому приходят замыканием из
 * index.tsx. Через неё же визард получает \`form\`: корневому узлу рендерер форму пропом не отдаёт,
 * поэтому кладём её в \`componentProps\` на onInit — как в примерах renderer-json.
 */
import { onComponentEvent, onInit, type RenderBehaviorFn } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import type { FormModel, FormProxy } from '@reformer/core';
import { formValidation } from './validation';
import type { FormShape } from './model';

export function createRenderBehavior(
  form: FormProxy<FormShape>,
  model: FormModel<FormShape>
): RenderBehaviorFn<FormShape> {
  return (schema) => {
    // Визард — self-managed компонент: форму ему передаём явно.
    onInit(schema.node('wizard'), () => {
      schema.node('wizard').patchProps({ form });
    });

    onComponentEvent(schema.node('wizard'), 'onSubmit', async (values: FormShape) => {
      if (!(await validateModel(model, formValidation))) return;
      // TODO: отправка на бэкенд.
      // eslint-disable-next-line no-console
      console.info('[${formName}] submit', values);
    });

    // ── Шпаргалка ──
    // hideWhen(schema.node('address'), () => !model.get().city);
    // onInit(schema.node('wizard'), () => schema.node('wizard').patchProps({ scrollToTop: true }));
  };
}
`;
}

/** Точка сборки пошаговой формы. */
export function wizardIndexTsxTemplate(formName: string): string {
  const Comp = componentName(formName);
  return `/**
 * Пошаговая форма «${formName}» — сборка и рендер. В JSX только провайдер реестра и рендерер:
 * шаги и layout живут в form.json, значения/поведение/валидация — в model.ts / form-behavior.ts /
 * validation.ts / render-behavior.ts, навигация и кнопки — в ui-kit FormWizard (адаптер wizard.tsx).
 *
 * Подключение в react-playground: \`import ${Comp} from './pages/examples/<папка>';\`
 * + \`<Route element={<${Comp} />} />\`.
 */
import { useMemo } from 'react';
import { useFormValidation } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawSchema from './form.json';
import { createRegistry } from './registry';
import { initialFormModel, type FormShape } from './model';
import { formBehavior } from './form-behavior';
import { formValidation, validationOptions } from './validation';
import { createRenderBehavior } from './render-behavior';

// В чистом JSON операторы типизируются как \`string\` — приведение = сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<FormShape>;

export default function ${Comp}() {
  // Сборка одним проходом: createJsonForm бандлит model+form+registry из одной схемы;
  // useJsonForm (ленивый useState) держит бандл стабильным между рендерами.
  const jsonForm = useJsonForm(() =>
    createJsonForm<FormShape>({
      schema,
      registry: createRegistry(),
      initial: { ...initialFormModel },
      behavior: formBehavior,
    })
  );

  // Стратегия запуска валидации — из validation.ts (её же читает превью билдера). Полный прогон
  // на submit визарда делает render-behavior; здесь армится live-фаза выбранной стратегии.
  useFormValidation({ model: jsonForm.model, schema: formValidation, ...validationOptions });

  // Поведение UI держит форму (её получает визард) и модель (валидация на submit) — собираем его
  // один раз на бандл формы.
  const renderBehavior = useMemo(
    () => createRenderBehavior(jsonForm.form, jsonForm.model),
    [jsonForm]
  );

  return (
    <div className="mx-auto max-w-2xl p-6">
      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<FormShape>
          form={jsonForm}
          renderBehavior={renderBehavior}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
`;
}
