/**
 * Шаблоны-«рыба» пошаговой формы (визарда) — второй встроенный шаблон рядом с простой формой
 * (`form-templates.ts`). Отличия от простой: схема начинается с узла `$component(Wizard)`, шаги
 * лежат в `componentProps.steps[]`, а к набору файлов добавляется тонкий адаптер `renderer.wizard.tsx`.
 *
 * `renderer.wizard.tsx` — это ровно тот опциональный слот, который канон раскладки держит для
 * renderer-json + wizard: библиотека компонент под `$component(Wizard)` не экспортирует, поэтому
 * шим пишет приложение, и канон даёт ему два равноправных места — отдельный `renderer.wizard.tsx`
 * либо инлайн в `registry.ts`. Шаблон выбирает файл: так шим переиспользуем и не раздувает
 * `index.tsx`. Правило «все шаги инлайн в `index.tsx`» это не нарушает — оно про ШАГИ формы, а
 * здесь инфраструктурный адаптер к ui-kit `FormWizard`, общий для всех шагов.
 *
 * Как это работает: renderer-react сам пробрасывает `form` в компоненты с маркером
 * `__selfManagedChildren`, а ui-kit `FormWizard` умеет рендерить `step.body` как RenderNode.
 * Адаптеру остаётся поднять `title`/`icon` из узла шага и отдать сам узел телом шага — без
 * `patchProps` и прочей проводки.
 *
 * Шаг — узел `$component(Step)`, как предписывает рецепт визарда (`@reformer/renderer-json`
 * docs/llms/07-form-wizard.md) и как сделано в примерах репозитория. `Box` на его месте не годится
 * по двум причинам: во-первых, `title`/`icon` — метаданные шага, а props-схема `Box` знает только
 * `className` и `additionalProperties: false` их отвергает, поэтому гейт `io/validate` браковал
 * схему собственного шаблона; во-вторых, шаблон учил бы форме, отличной от той, которой MCP учит
 * агентов. Сам `Step` — маркер: рендерит `children`, а метаданные снимает с узла wizard-шим
 * (см. `wizardAdapterTsxTemplate`).
 *
 * @module reformer-builder/app/wizard-templates
 */

import { componentName } from './form-templates';

/**
 * Схема пошаговой формы: `Wizard` c двумя шагами-`Step`; каждый шаг несёт поля модели. `Step` —
 * то же имя, которым canvas создаёт шаг (`catalog/make-node.ts`, `stepNode`), и та же
 * синтетическая запись каталога, чья props-схема знает `title`/`icon`.
 */
export function wizardFormJsonTemplate(): string {
  const step = (title: string, icon: string, children: unknown[]): unknown => ({
    component: '$component(Step)',
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
            // Опции приходят из data-sources.ts — реестр связывает имя со значением.
            field('city', '$component(Select)', {
              label: 'Город',
              options: '$dataSource(cities)',
              placeholder: 'Выберите город',
            }),
            field('address', '$component(Input)', { label: 'Улица, дом, квартира' }),
            field('agree', '$component(Checkbox)', { label: 'Данные указаны верно' }),
          ]),
        ],
      },
    },
  };
  return JSON.stringify(schema, null, 2) + '\n';
}

/** Типы пошаговой формы: поля всех шагов одним типом + тип элемента справочника. */
export function wizardTypesTsTemplate(formName: string): string {
  return `/**
 * Типы пошаговой формы «${formName}» — поля всех шагов в одном типе: визард шагает по одной
 * модели, а не по нескольким. Docs: @reformer/core (FormModel<T>), @reformer/cdk (FormWizard).
 */

export interface FormShape {
  // Шаг 1 — контакты.
  fullName: string;
  email: string;
  // Шаг 2 — адрес.
  /** Город — значение берётся из справочника \`cities\` (data-sources.ts). */
  city: string;
  address: string;
  agree: boolean;
}

/** Элемент справочника: значение + подпись. Тот же тип печатает кодоген примеров. */
export type SelectOption = { value: string; label: string };
`;
}

/** Модель пошаговой формы: начальные значения полей всех шагов. */
export function wizardModelTsTemplate(formName: string): string {
  return `/**
 * Модель пошаговой формы «${formName}» — начальные значения. Тип модели живёт в types.ts
 * (канон раскладки), поэтому здесь только данные. Docs: @reformer/core (FormModel<T>).
 */
import type { FormShape } from './types';

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

/** Справочники пошаговой формы: города для select-поля второго шага. */
export function wizardDataSourcesTsTemplate(formName: string): string {
  return `/**
 * Справочники формы «${formName}» — значения операторов \`$dataSource(...)\` из
 * renderer.schema.json. Имя экспорта = имя в схеме; связывает их registry.ts
 * (\`reg.dataSource('cities', cities)\`).
 */
import type { SelectOption } from './types';

/** Города — опции поля \`city\` на шаге «Адрес». */
export const cities: SelectOption[] = [
  { value: 'msk', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  { value: 'nsk', label: 'Новосибирск' },
];

// ── Шпаргалка ──

// Справочник с бэкенда: грузите его в renderer.behavior.ts (onMount узла шага) и патчите пропсы
// узла — сам \`$dataSource\` синхронен и функцию-загрузчик не вызывает:
// export async function loadCities(): Promise<SelectOption[]> {
//   const res = await fetch('/api/cities');
//   return (await res.json()) as SelectOption[];
// }
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
 * \`onSubmit\` навешивается снаружи — в renderer.behavior.ts через onComponentEvent.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import type { FormProxy } from '@reformer/core';
import { RenderNodeComponent, type RenderNode } from '@reformer/renderer-react';
import type { FormShape } from './types';

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

export interface StepProps {
  className?: string;
  children?: ReactNode;
}

/**
 * Тело шага — компонент под \`$component(Step)\`. Маркер: \`title\`/\`icon\` из его
 * \`componentProps\` снимает \`Wizard\` выше, сюда доезжает только вёрстка. Тот же маркер есть в
 * \`@reformer/cdk/form-wizard\` (\`Step\`) — если cdk уже в проекте, замените локальный на импорт.
 */
export function Step({ className, children }: StepProps): ReactNode {
  return <div className={className}>{children}</div>;
}
`;
}

/** Реестр пошаговой формы: поля + контейнеры + адаптер визарда. */
export function wizardRegistryTsTemplate(formName: string): string {
  return `/**
 * Реестр компонентов формы «${formName}» — что рендерить под каждое \`$component(...)\` из
 * renderer.schema.json.
 * \`FIELD_WRAPPER\` (FormField) оборачивает каждый лист: label + ошибки. \`Wizard\` и \`Step\` —
 * локальные компоненты шима (renderer.wizard.tsx): визард и тело шага. Docs: @reformer/renderer-json.
 */
import { CheckboxField, FormField, InputField, SelectField } from '@reformer/ui-kit';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { Step, Wizard } from './renderer.wizard';
import { cities } from './data-sources';

export function createRegistry(): ComponentRegistry {
  return defineRegistry((reg) => {
    // Системная обёртка поля: label + ошибки вокруг каждого листа.
    reg.component(FIELD_WRAPPER, FormField);
    // Контейнеры: визард и тела шагов.
    reg.component('Wizard', Wizard);
    reg.component('Step', Step);
    // Поля: имя в схеме → компонент ui-kit.
    reg.component('Input', InputField);
    reg.component('Select', SelectField);
    reg.component('Checkbox', CheckboxField);
    // Справочники: имя в \`$dataSource(...)\` → значение из data-sources.ts.
    reg.dataSource('cities', cities);
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
import type { FormShape } from './types';

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
import type { FormShape } from './types';

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
 * Поведение UI формы «${formName}» — правила над деревом рендера по selector'ам из
 * renderer.schema.json.
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
import { submitForm } from './api';
import type { FormShape } from './types';

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
      // Бэкенд — только через api.ts: поведение не знает ни про fetch, ни про эндпоинты.
      const result = await submitForm(values);
      // eslint-disable-next-line no-console
      if (!result.success) console.error('[${formName}] submit failed', result.error);
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
 * шаги и layout живут в renderer.schema.json, типы — в types.ts, значения/поведение/валидация —
 * в model.ts / form.behavior.ts / validation.ts / renderer.behavior.ts, справочники — в
 * data-sources.ts, запросы — в api.ts, навигация и кнопки — в ui-kit FormWizard
 * (адаптер renderer.wizard.tsx).
 *
 * Подключение в react-playground: \`import ${Comp} from './pages/examples/<папка>';\`
 * + \`<Route element={<${Comp} />} />\`.
 */
import { useFormValidation } from '@reformer/core';
import {
  JsonFormRenderer,
  JsonRendererProvider,
  createJsonForm,
  useJsonForm,
  type JsonFormSchema,
} from '@reformer/renderer-json';
import rawSchema from './renderer.schema.json';
import { createRegistry } from './registry';
import { initialFormModel } from './model';
import type { FormShape } from './types';
import { formBehavior } from './form.behavior';
import { formValidation, validationOptions } from './validation';
import { createRenderBehavior } from './renderer.behavior';

// В чистом JSON операторы типизируются как \`string\` — приведение = сценарий «схема пришла с сервера».
const schema = rawSchema as unknown as JsonFormSchema<FormShape>;

export default function ${Comp}() {
  // Сборка ОДНИМ вызовом: model + form + registry + behavior + render-behavior из одной схемы.
  // useJsonForm (ленивый useState) зовёт фабрику ровно один раз — ссылка на поведение стабильна.
  const jsonForm = useJsonForm(() =>
    createJsonForm<FormShape>({
      schema,
      registry: createRegistry(),
      initial: { ...initialFormModel },
      behavior: formBehavior,
      renderBehavior: (form, model) => createRenderBehavior(form, model),
    })
  );

  // Стратегия запуска валидации — из validation.ts (её же читает превью билдера). Полный прогон
  // на submit визарда делает render-behavior; здесь армится live-фаза выбранной стратегии.
  useFormValidation({ model: jsonForm.model, schema: formValidation, ...validationOptions });

  return (
    <div className="mx-auto max-w-2xl p-6">
      <JsonRendererProvider settings={{ registry: jsonForm.registry }}>
        <JsonFormRenderer<FormShape>
          form={jsonForm}
          validateSchema={import.meta.env.DEV}
        />
      </JsonRendererProvider>
    </div>
  );
}
`;
}
