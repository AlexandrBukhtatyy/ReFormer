/* eslint-disable @typescript-eslint/no-explicit-any */
import type { ReactNode } from 'react';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormField as FieldRoot } from '@reformer/cdk/form-field';
import { FormField, Input } from '@reformer/ui-kit';
import { defineIssueMessages } from '@reformer/core/i18n';
import { required } from '@reformer/core/validators';
import { useDemoField } from '../harness';
import { fieldVariant } from '../field-snippet';
import type { ComponentDocConfig } from '../types';

// Цвета зон анатомии — насыщенные средние тона, различимые в светлой и тёмной теме.
const ZONE = {
  label: '#3b82f6',
  input: '#8b5cf6',
  hint: '#64748b',
  validation: '#ef4444',
} as const;

/** Тексты замечаний демо: правило несёт код, строку по коду даёт словарь формы. */
const EMAIL_MESSAGES = defineIssueMessages({ 'email.required': 'Введите email' });

const ANATOMY_PROPS = {
  label: 'Email',
  type: 'email',
  placeholder: 'you@example.com',
  description: 'Не передаём email третьим лицам',
};

/**
 * Обводит одну зону поля тонким пунктиром через `outline` (не влияет на раскладку) и выносит
 * подпись зоны вбок.
 */
function Zone({ name, color, children }: { name: string; color: string; children: ReactNode }) {
  return (
    <div style={{ position: 'relative' }}>
      <div style={{ outline: `1px dashed ${color}`, outlineOffset: 3, borderRadius: 4 }}>
        {children}
      </div>
      <span
        style={{
          position: 'absolute',
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          marginLeft: 18,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          color,
          whiteSpace: 'nowrap',
        }}
      >
        {name}
      </span>
    </div>
  );
}

/**
 * Анатомия поля: те же зоны, что рисует FormField кита, собраны из слотов cdk и обведены
 * пунктиром. Порядок сверху вниз — подпись → контрол → пояснение → замечание.
 */
function AnatomyField() {
  const { control } = useDemoField({
    initial: '',
    component: Input,
    componentProps: ANATOMY_PROPS,
    validators: [required({ code: 'email.required' })],
    messages: EMAIL_MESSAGES,
    touched: true,
  });

  return (
    // Ширина как у поля в форме; справа — запас под подписи зон.
    <div style={{ width: 300, paddingRight: 110 }}>
      <ValidationMessagesProvider messages={EMAIL_MESSAGES}>
        <FieldRoot.Root control={control as any} hasDescription>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Zone name="подпись" color={ZONE.label}>
              <FieldRoot.Label className="block text-sm font-medium" />
            </Zone>

            <Zone name="контрол" color={ZONE.input}>
              <FieldRoot.Control />
            </Zone>

            <Zone name="пояснение" color={ZONE.hint}>
              <FieldRoot.Description className="text-sm text-muted-foreground">
                {ANATOMY_PROPS.description}
              </FieldRoot.Description>
            </Zone>

            <Zone name="замечание" color={ZONE.validation}>
              <FieldRoot.Error className="text-destructive text-sm block" />
            </Zone>
          </div>
        </FieldRoot.Root>
      </ValidationMessagesProvider>
    </div>
  );
}

/** Тексты замечаний примера с предупреждением. */
const PASSWORD_MESSAGES = defineIssueMessages({
  'password.weak': 'Пароль простой — лучше от 8 символов',
  'password.required': 'Введите пароль',
});

/** Предупреждение не блокирует отправку: слабый пароль — совет, пустой — ошибка. */
const weakPassword = (value: string) =>
  value !== '' && value.length < 8 ? { code: 'password.weak', severity: 'warning' as const } : null;

/** Предупреждение рядом с ошибкой: первое поле валидно, второе — нет. */
function WarningUsage() {
  const { control: weak } = useDemoField({
    initial: 'qwerty',
    component: Input,
    componentProps: { label: 'Пароль' },
    validators: [required({ code: 'password.required' }), weakPassword],
    messages: PASSWORD_MESSAGES,
    touched: true,
  });
  const { control: empty } = useDemoField({
    initial: '',
    component: Input,
    componentProps: { label: 'Пароль ещё раз' },
    validators: [required({ code: 'password.required' }), weakPassword],
    messages: PASSWORD_MESSAGES,
    touched: true,
  });
  return (
    <div
      style={{ maxWidth: 380, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <ValidationMessagesProvider messages={PASSWORD_MESSAGES}>
        <FormField control={weak as any} />
        <FormField control={empty as any} />
      </ValidationMessagesProvider>
    </div>
  );
}

/** Подписи одной ширины: без неё контролы начинались бы каждый со своей позиции. */
const LABEL_COLUMN = '[&>[data-slot^=field-label]]:w-40';

/** direction="row" — подпись слева от контрола. */
function RowUsage() {
  const { control: emailControl } = useDemoField({
    initial: '',
    component: Input,
    componentProps: {
      label: 'Email',
      type: 'email',
      placeholder: 'you@example.com',
      description: 'Не передаём email третьим лицам',
    },
    validators: [required({ code: 'email.required' })],
    messages: EMAIL_MESSAGES,
    touched: true,
  });
  const { control: innControl } = useDemoField({
    initial: '',
    component: Input,
    componentProps: {
      label: 'ИНН организации',
      placeholder: '7700000000',
      labelTooltip: 'Нужен для выставления счёта',
    },
  });
  return (
    <div
      style={{ maxWidth: 460, width: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <ValidationMessagesProvider messages={EMAIL_MESSAGES}>
        <FormField control={emailControl as any} direction="row" className={LABEL_COLUMN} />
        <FormField control={innControl as any} direction="row" className={LABEL_COLUMN} />
      </ValidationMessagesProvider>
    </div>
  );
}

export const uiKitFormFieldDocConfig: ComponentDocConfig = {
  name: 'FormField',
  importFrom: '@reformer/ui-kit',
  description:
    'Обёртка поля: по ноде поля рисует подпись, контрол, пояснение и замечание и связывает их для скринридера.',
  variants: [
    {
      id: 'anatomy',
      title: 'Анатомия',
      description:
        'Сверху вниз: подпись → контрол → пояснение → замечание. Замечание появляется у тронутого или изменённого поля.',
      render: AnatomyField,
      code: `import { FormField, Input } from '@reformer/ui-kit';

// Что рисовать — задаёт узел поля в схеме формы:
{
  model: model.$.email,
  component: Input,                              // → контрол
  componentProps: {
    label: 'Email',                              // → подпись
    type: 'email',
    placeholder: 'you@example.com',
    description: 'Не передаём email третьим лицам', // → пояснение
  },
}

// Замечание — из правил поля и словаря сообщений:
validate(model.$.email, [required({ code: 'email.required' })]);
defineIssueMessages({ 'email.required': 'Введите email' });

// На экране — один компонент:
<FormField control={form.email} />`,
    },
    fieldVariant({
      id: 'required',
      title: 'Обязательное поле',
      description:
        'required: true ставит «*» у подписи и aria-required у контрола. Само правило required() задаётся в схеме валидации.',
      field: 'name',
      component: Input,
      componentName: 'Input',
      initial: '',
      props: { label: 'Имя', required: true },
      validators: [required({ code: 'name.required' })],
      rules: "required({ code: 'name.required' })",
      messages: { 'name.required': 'Введите имя' },
      touched: true,
    }),
  ],
  examples: [
    {
      id: 'warning',
      title: 'Предупреждение — не ошибка',
      description:
        "Правило вернуло замечание с severity: 'warning'. Оно показано под полем своим цветом и не блокирует отправку: рамки ошибки и aria-invalid нет. Ниже для сравнения — поле с ошибкой. Под полем одно замечание: первая ошибка, а без ошибок — первое предупреждение.",
      render: WarningUsage,
      code: `const weakPassword = (value: string) =>
  value !== '' && value.length < 8 ? { code: 'password.weak', severity: 'warning' } : null;

{ model: model.$.password, component: Input, componentProps: { label: 'Пароль' } }
{ model: model.$.passwordRepeat, component: Input, componentProps: { label: 'Пароль ещё раз' } }

validate(model.$.password, [required({ code: 'password.required' }), weakPassword]);
validate(model.$.passwordRepeat, [required({ code: 'password.required' }), weakPassword]);

defineIssueMessages({
  'password.weak': 'Пароль простой — лучше от 8 символов',
  'password.required': 'Введите пароль',
});

<FormField control={form.password} />
<FormField control={form.passwordRepeat} />`,
    },
    fieldVariant({
      id: 'tooltips',
      title: 'Подсказки-иконки (i)',
      description:
        'labelTooltip — иконка после подписи, её рисует FormField. tooltip — иконка внутри контрола, её рисует само поле. Подсказка открывается наведением, фокусом и нажатием, её текст попадает в aria-describedby поля.',
      field: 'inn',
      component: Input,
      componentName: 'Input',
      initial: '',
      props: {
        label: 'ИНН',
        placeholder: '7700000000',
        labelTooltip: 'Нужен для выставления счёта',
        tooltip: '10 цифр для юрлица, 12 — для ИП',
      },
    }),
    {
      id: 'direction',
      title: 'Подпись слева (direction="row")',
      description:
        'Подпись слева от контрола, пояснение и замечание — под контролом. Подпись выровнена по строке текста в поле и занимает не больше половины ряда. Общая ширина подписей задана через className.',
      render: RowUsage,
      code: `// direction — проп самого FormField, не componentProps. По умолчанию 'col' — подпись сверху.
const LABEL_COLUMN = '[&>[data-slot^=field-label]]:w-40'; // подписи одной ширины

<FormField control={form.email} direction="row" className={LABEL_COLUMN} />
<FormField control={form.inn} direction="row" className={LABEL_COLUMN} />

// В FormRenderer — своей обёрткой поля (константа модуля):
import type { FieldWrapperProps } from '@reformer/renderer-react';

const RowField = (props: FieldWrapperProps) => (
  <FormField {...props} direction="row" className={LABEL_COLUMN} />
);
<FormRenderer form={bundle} settings={{ fieldWrapper: RowField }} />`,
    },
  ],
  props: [
    {
      name: 'control',
      type: 'FormControl<T>',
      description:
        'Нода поля (form.email). Из неё берутся компонент, его пропсы, значение, замечания и состояние проверки.',
    },
    {
      name: 'direction',
      type: "'col' | 'row'",
      default: "'col'",
      description:
        'Подпись над контролом или слева от него. Пояснение и замечание всегда под контролом. У Checkbox и Switch верхней подписи нет — для них проп ничего не меняет.',
    },
    {
      name: 'testId',
      type: 'string',
      default: 'componentProps.testId',
      description:
        "Префикс data-testid: field-, label-, input-, error-<id>. Без него и без componentProps.testId — 'unknown'.",
    },
    {
      name: 'className',
      type: 'string',
      description: 'Класс корневого элемента поля.',
    },
    {
      name: 'children',
      type: 'ReactNode',
      description:
        'Свой контрол вместо компонента из узла. Получает id и aria-* поля; значение подключается по адаптеру поля этого компонента, у компонента без адаптера onChange должен принимать значение, а не событие.',
    },
    {
      name: 'label',
      type: 'string · componentProps',
      description: 'Подпись поля. У Checkbox и Switch её рисует сам контрол справа от себя.',
    },
    {
      name: 'required',
      type: 'boolean · componentProps',
      default: 'false',
      description:
        'Звёздочка у подписи и aria-required у контрола. Правило required() отдельно — в схеме валидации.',
    },
    {
      name: 'description',
      type: 'string · componentProps',
      description:
        'Пояснение под контролом, над замечанием. Связано с контролом через aria-describedby. Читается при первом показе поля.',
    },
    {
      name: 'labelTooltip',
      type: 'string · componentProps',
      description:
        'Иконка (i) с подсказкой после подписи. У Checkbox и Switch — справа от контрола. Читается при первом показе поля.',
    },
    {
      name: 'tooltip',
      type: 'string · componentProps',
      description:
        'Иконка (i) внутри контрола. Её рисует не FormField, а само поле: у Input и Select — справа внутри, у Checkbox и Switch — после текста.',
    },
    {
      name: 'testId',
      type: 'string · componentProps',
      description: 'То же, что проп testId FormField, но задаётся в узле схемы.',
    },
  ],
};
