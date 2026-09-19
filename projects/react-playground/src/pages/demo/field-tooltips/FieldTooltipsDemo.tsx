/**
 * Подсказки-иконки (i) у полей — два независимых пропа в `componentProps`:
 *  - `labelTooltip` — иконка ПОСЛЕ подписи поля, рисует `FormField`;
 *  - `tooltip` — иконка В САМОМ контроле: у полей ввода и селектов внутри справа, у
 *    Checkbox/Switch/Radio — после текста, у остальных — справа от контрола.
 *
 * Страница — заодно стенд e2e (`tests/pages/field-tooltips`): порядок в правой зоне поля
 * «крестик очистки → (i) → родные элементы контрола» проверяется там по реальным координатам.
 */

import { createCoreForm, createModel, useFormBundle, type FormModel } from '@reformer/core';
import { FormRenderer, createReactForm, useReactForm } from '@reformer/renderer-react';
import type { ReactForm, RenderNode } from '@reformer/renderer-react';
import {
  Button,
  CheckboxWithLabel,
  ExampleCard,
  FormField,
  Input,
  InputPassword,
  RadioGroupOptions,
  SelectAsync,
  Slider,
  SwitchWithLabel,
  Textarea,
} from '@reformer/ui-kit';
// Combobox — тяжёлый компонент (cmdk), живёт только в сабпате, вне главного barrel.
import { Combobox } from '@reformer/ui-kit/combobox';

interface FieldTooltipsForm {
  email: string;
  inn: string;
  password: string;
  city: string | null;
  framework: string | null;
  comment: string;
  agree: boolean;
  notify: boolean;
  plan: string | null;
  volume: number | null;
}

const CITIES = [
  { value: 'msk', label: 'Москва' },
  { value: 'spb', label: 'Санкт-Петербург' },
  {
    value: 'long',
    label: 'Очень длинное название населённого пункта для проверки обрезки текста',
  },
];

const FRAMEWORKS = [
  { value: 'next', label: 'Next.js' },
  { value: 'remix', label: 'Remix' },
  { value: 'astro', label: 'Astro' },
];

const PLANS = [
  { value: 'basic', label: 'Базовый', tooltip: 'До 3 пользователей, без SLA' },
  { value: 'pro', label: 'Профи', tooltip: 'До 50 пользователей, ответ поддержки за 4 часа' },
  { value: 'custom', label: 'Индивидуальный' },
];

const INITIAL: FieldTooltipsForm = {
  email: '',
  inn: '',
  password: 'secret',
  city: 'msk',
  framework: 'next',
  comment: '',
  agree: false,
  notify: false,
  plan: null,
  volume: 40,
};

function buildSchema(model: FormModel<FieldTooltipsForm>) {
  return {
    fields: [
      {
        value: model.$.email,
        component: Input,
        componentProps: {
          label: 'Email',
          testId: 'email',
          placeholder: 'you@example.com',
          description: 'Текст под полем — обычный description.',
          labelTooltip: 'Нужен только для отправки чеков',
        },
      },
      {
        value: model.$.inn,
        component: Input,
        componentProps: {
          label: 'ИНН',
          testId: 'inn',
          tooltip: '10 цифр для юрлица, 12 — для ИП',
        },
      },
      {
        value: model.$.password,
        component: InputPassword,
        componentProps: {
          label: 'Пароль',
          testId: 'password',
          placeholder: 'Пароль',
          tooltip: 'Минимум 8 символов, буквы и цифры',
        },
      },
      {
        value: model.$.city,
        component: SelectAsync,
        componentProps: {
          label: 'Город',
          testId: 'city',
          options: CITIES,
          clearable: true,
          labelTooltip: 'Подсказка у подписи',
          tooltip: 'Город регистрации компании',
        },
      },
      {
        value: model.$.framework,
        component: Combobox,
        componentProps: {
          label: 'Фреймворк',
          testId: 'framework',
          options: FRAMEWORKS,
          clearable: true,
          tooltip: 'Можно выбрать только один',
        },
      },
      {
        value: model.$.comment,
        component: Textarea,
        componentProps: {
          label: 'Комментарий',
          testId: 'comment',
          tooltip: 'Увидит только менеджер',
        },
      },
      {
        value: model.$.agree,
        component: CheckboxWithLabel,
        componentProps: {
          label: 'Согласен с офертой',
          testId: 'agree',
          tooltip: 'Оферта действует с момента оплаты',
        },
      },
      {
        value: model.$.notify,
        component: SwitchWithLabel,
        componentProps: {
          label: 'Уведомления',
          testId: 'notify',
          labelTooltip: 'Иконку inline-контрола FormField ставит справа от него',
        },
      },
      {
        value: model.$.plan,
        component: RadioGroupOptions,
        componentProps: {
          label: 'Тариф',
          testId: 'plan',
          options: PLANS,
          labelTooltip: 'Тариф можно сменить в любой момент',
        },
      },
      {
        value: model.$.volume,
        component: Slider,
        componentProps: {
          label: 'Громкость',
          testId: 'volume',
          min: 0,
          max: 100,
          tooltip: 'У контрола без места внутри иконка встаёт справа',
        },
      },
    ],
  };
}

/** Тот же контракт в renderer-пути: props долетают до контрола мимо CDK-авто-рендера. */
interface RendererForm {
  phone: string;
  country: string | null;
}

function buildRendererSchema(model: FormModel<RendererForm>): RenderNode<RendererForm> {
  return {
    component: 'div',
    componentProps: { className: 'space-y-4' },
    children: [
      {
        value: model.$.phone,
        component: Input,
        componentProps: {
          label: 'Телефон',
          testId: 'r-phone',
          labelTooltip: 'Для связи курьера',
          tooltip: 'В международном формате',
        },
      },
      {
        value: model.$.country,
        component: SelectAsync,
        componentProps: {
          label: 'Страна',
          testId: 'r-country',
          options: [
            { value: 'ru', label: 'Россия' },
            { value: 'by', label: 'Беларусь' },
          ],
          clearable: true,
          tooltip: 'Страна доставки',
        },
      },
    ],
  };
}

function RendererSection({ rendererForm }: { rendererForm: ReactForm<RendererForm> }) {
  return (
    <div data-testid="renderer-section">
      <FormRenderer<RendererForm> form={rendererForm} settings={{ fieldWrapper: FormField }} />
    </div>
  );
}

export default function FieldTooltipsDemo() {
  const { form } = useFormBundle(() =>
    createCoreForm<FieldTooltipsForm>({ initial: { ...INITIAL }, schema: buildSchema })
  );
  // Форма карточки renderer-react живёт здесь же: кнопки «Выключить/Включить» управляют обеими.
  const rendererForm = useReactForm(() =>
    createReactForm<RendererForm>({
      model: createModel<RendererForm>({ phone: '', country: 'ru' }),
      schema: buildRendererSchema,
    })
  );
  const setDisabled = (disabled: boolean) => {
    for (const target of [form, rendererForm.form]) {
      if (disabled) target.disable();
      else target.enable();
    }
  };

  return (
    <div className="mx-auto p-6">
      <h2 className="mb-2 text-2xl font-bold">Подсказки-иконки (i)</h2>
      <p className="mb-6 text-gray-600">
        Два независимых пропа: <code>labelTooltip</code> — иконка после подписи (рисует FormField),{' '}
        <code>tooltip</code> — иконка в самом контроле. Открывается по наведению, фокусу и
        клику/тапу.
      </p>

      <div className="mb-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          data-testid="disable-all"
          onClick={() => setDisabled(true)}
        >
          Выключить поля
        </Button>
        <Button
          type="button"
          variant="outline"
          data-testid="enable-all"
          onClick={() => setDisabled(false)}
        >
          Включить поля
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <ExampleCard
          title="labelTooltip + description"
          description="Иконка после подписи живёт снаружи <label>; текст под полем остаётся как был"
          bgColor="bg-white"
          code={`componentProps: {
  label: 'Email',
  description: 'Текст под полем',
  labelTooltip: 'Нужен только для отправки чеков',
}`}
        >
          <FormField control={form.email} />
        </ExampleCard>

        <ExampleCard
          title="tooltip внутри Input / InputPassword"
          description="У пароля (i) встаёт левее глаза; пока глаза нет — у правого края"
          bgColor="bg-white"
          code={`componentProps: { label: 'ИНН', tooltip: '10 цифр для юрлица' }`}
        >
          <div className="space-y-4">
            <FormField control={form.inn} />
            <FormField control={form.password} />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Select / Combobox: крестик → (i) → шеврон"
          description="Кластер прижат вправо: при появлении крестика иконка не сдвигается"
          bgColor="bg-white"
          code={`componentProps: {
  options: CITIES,
  clearable: true,
  labelTooltip: 'Подсказка у подписи',
  tooltip: 'Город регистрации компании',
}`}
        >
          <div className="space-y-4">
            <FormField control={form.city} />
            <FormField control={form.framework} />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Textarea и Slider"
          description="Textarea — правый верхний угол; у Slider места внутри нет — иконка справа"
          bgColor="bg-white"
          code={`componentProps: { label: 'Громкость', tooltip: '…' }`}
        >
          <div className="space-y-4">
            <FormField control={form.comment} />
            <FormField control={form.volume} />
          </div>
        </ExampleCard>

        <ExampleCard
          title="Checkbox / Switch / RadioGroup"
          description="Иконка после текста и снаружи <label>: клик по ней контрол не переключает"
          bgColor="bg-white"
          code={`// у каждого варианта — своя подсказка
options: [
  { value: 'basic', label: 'Базовый', tooltip: 'До 3 пользователей' },
  { value: 'pro', label: 'Профи', tooltip: 'До 50 пользователей' },
]`}
        >
          <div className="space-y-4">
            <FormField control={form.agree} />
            <FormField control={form.notify} />
            <FormField control={form.plan} />
          </div>
        </ExampleCard>

        <ExampleCard
          title="renderer-react"
          description="Те же props через FormRenderer с fieldWrapper: FormField"
          bgColor="bg-white"
          code={`<FormRenderer form={form} settings={{ fieldWrapper: FormField }} />`}
        >
          <RendererSection rendererForm={rendererForm} />
        </ExampleCard>
      </div>
    </div>
  );
}
