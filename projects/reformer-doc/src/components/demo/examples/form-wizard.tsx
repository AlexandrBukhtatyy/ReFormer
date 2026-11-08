/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import { useFormBundle } from '@reformer/core/react';
import { Step } from '@reformer/cdk/form-wizard';
import { FormRenderer } from '@reformer/renderer-react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { FormField, Input, InputMask, Button } from '@reformer/ui-kit';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { defineIssueMessages } from '@reformer/core/i18n';
import type { ComponentDocConfig } from '../types';

type WForm = { name: string; email: string; phone: string };

// Правила — отдельные validation-схемы (@reformer/core/validation), по одной на шаг.
const step1Validation = defineValidation<WForm>(({ model }) => {
  validate(model.$.name, [required({ code: 'name.required' })]);
  validate(model.$.email, [required(), email()]);
});
const step2Validation = defineValidation<WForm>(({ model }) => {
  validate(model.$.phone, [required({ code: 'phone.required' })]);
});
/** Тексты замечаний демо: правила несут код, строку по коду даёт словарь формы. */
const WIZARD_MESSAGES = defineIssueMessages({
  'name.required': 'Введите имя',
  'phone.required': 'Введите телефон',
});

/** Сборка визарда: разметка полей и поток шагов — шаг проверяет свои правила. */
function useWizardBundle() {
  return useFormBundle(() =>
    createForm<WForm>({
      initial: { name: '', email: '', phone: '' },
      schema: (model) => ({
        children: [
          { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
          {
            model: model.$.email,
            component: Input,
            componentProps: { label: 'Email', type: 'email' },
          },
          {
            model: model.$.phone,
            component: InputMask,
            componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
          },
        ],
      }),
      flow: {
        steps: [
          { id: 'contact', rules: step1Validation },
          { id: 'phone', rules: step2Validation },
          { id: 'done' },
        ],
      },
    })
  );
}

const ContactStep = ({ control }: { control: any }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.name} />
    <FormField control={control.email} />
  </div>
);
const PhoneStep = ({ control }: { control: any }) => <FormField control={control.phone} />;

function WizardSteps() {
  const bundle = useWizardBundle();
  const [done, setDone] = useState<string | null>(null);
  const steps = useMemo(
    () => [
      { number: 1, title: 'Контакт', icon: '👤', body: ContactStep },
      { number: 2, title: 'Телефон', icon: '📞', body: PhoneStep },
      { number: 3, title: 'Готово', icon: '✓', body: <p>Проверьте данные и отправьте.</p> },
    ],
    []
  );
  // Отправка — через сборку: один прогон всех правил, при замечаниях обработчик не вызывается.
  const send = () =>
    void bundle.submission.submit(async (values) =>
      setDone('✅ Отправлено: ' + JSON.stringify(values))
    );
  return (
    <ValidationMessagesProvider messages={WIZARD_MESSAGES}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <FormWizard form={bundle.form} flow={bundle.flow} steps={steps as any} onSubmit={send} />
        {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
      </div>
    </ValidationMessagesProvider>
  );
}

function WizardExternalControl() {
  const bundle = useWizardBundle();
  const [status, setStatus] = useState<string | null>(null);
  const send = (label: string) =>
    void bundle.submission
      .submit(async () => setStatus(label))
      .then((result) => result.status === 'invalid' && setStatus('Проверьте поля формы'));
  const steps = useMemo(
    () => [
      { number: 1, title: 'Контакт', icon: '👤', body: ContactStep },
      { number: 2, title: 'Телефон', icon: '📞', body: PhoneStep },
      {
        number: 3,
        title: 'Готово',
        icon: '✓',
        // Полиморфное body: ReactNode вместо компонента шага.
        body: (
          <p style={{ fontSize: 14, color: 'var(--ifm-color-emphasis-700)' }}>
            Проверьте данные и нажмите «Отправить» — или используйте внешнюю кнопку под визардом.
          </p>
        ),
      },
    ],
    []
  );
  return (
    <ValidationMessagesProvider messages={WIZARD_MESSAGES}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <FormWizard
          form={bundle.form}
          flow={bundle.flow}
          steps={steps as any}
          onSubmit={() => send('✅ Отправлено')}
        />
        <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => void bundle.flow?.next()}>
            Далее (извне)
          </Button>
          <Button size="sm" onClick={() => send('✅ Отправлено извне')}>
            Отправить (извне)
          </Button>
          {status && <span style={{ fontSize: 13 }}>{status}</span>}
        </div>
      </div>
    </ValidationMessagesProvider>
  );
}

/** Визард в схеме формы: шаги — дочерние узлы, `selector` шага совпадает с `id` шага потока. */
const wizardSchema = (model: FormModel<WForm>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  componentProps: { submitLabel: 'Отправить заявку' },
  children: [
    {
      selector: 'contact',
      component: Step,
      componentProps: { title: 'Контакт', icon: '👤' },
      children: [
        { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
        {
          model: model.$.email,
          component: Input,
          componentProps: { label: 'Email', type: 'email' },
        },
      ],
    },
    {
      selector: 'phone',
      component: Step,
      componentProps: { title: 'Телефон', icon: '📞' },
      children: [
        {
          model: model.$.phone,
          component: InputMask,
          componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
        },
      ],
    },
  ],
});

function WizardSchema() {
  const [done, setDone] = useState<string | null>(null);
  const bundle = useFormBundle(() =>
    createForm<WForm>({
      initial: { name: '', email: '', phone: '' },
      schema: wizardSchema,
      // Обработчик кнопки отправки получает значения только после проверки всей формы.
      behavior: defineFormBehavior<WForm>(({ schema }) => {
        onComponentEvent(schema.node('wizard'), 'onSubmit', (values: WForm) =>
          setDone('✅ Отправлено: ' + JSON.stringify(values))
        );
      }),
      flow: {
        steps: [
          { id: 'contact', rules: step1Validation },
          { id: 'phone', rules: step2Validation },
        ],
      },
    })
  );
  return (
    <ValidationMessagesProvider messages={WIZARD_MESSAGES}>
      <div style={{ maxWidth: 480, width: '100%' }}>
        <FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />
        {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
      </div>
    </ValidationMessagesProvider>
  );
}

export const uiKitFormWizardDocConfig: ComponentDocConfig = {
  name: 'FormWizard',
  importFrom: '@reformer/ui-kit/form-wizard',
  description:
    'Многошаговая форма: индикатор шагов, тело текущего шага, кнопки «Назад», «Далее», «Отправить» и прогресс. Шаги и их правила задаёт поток шагов сборки.',
  variants: [
    {
      id: 'steps',
      title: 'Шаги в разметке',
      description:
        'Массив steps ({ number, title, icon?, body }) и поток сборки. «Далее» проверяет правила текущего шага и не пускает дальше, пока у шага есть замечания.',
      render: WizardSteps,
      code: `import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

const step1Validation = defineValidation<WForm>(({ model }) => {
  validate(model.$.name, [required({ code: 'name.required' })]);
  validate(model.$.email, [required(), email()]);
});
const step2Validation = defineValidation<WForm>(({ model }) => {
  validate(model.$.phone, [required({ code: 'phone.required' })]);
});

const bundle = useFormBundle(() =>
  createForm<WForm>({
    initial: { name: '', email: '', phone: '' },
    schema, // узлы полей name, email, phone
    flow: {
      steps: [
        { id: 'contact', rules: step1Validation },
        { id: 'phone', rules: step2Validation },
        { id: 'done' }, // шаг без правил
      ],
    },
  })
);

const ContactStep = ({ control }: { control: FormGroup<WForm> }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.name} />
    <FormField control={control.email} />
  </div>
);
const PhoneStep = ({ control }: { control: FormGroup<WForm> }) => (
  <FormField control={control.phone} />
);

const STEPS: FormWizardStep<WForm>[] = [
  { number: 1, title: 'Контакт', icon: '👤', body: ContactStep },
  { number: 2, title: 'Телефон', icon: '📞', body: PhoneStep },
  { number: 3, title: 'Готово', icon: '✓', body: <p>Проверьте данные и отправьте.</p> },
];

// В разметке onSubmit зовётся по нажатию — проверку и отправку делает сборка.
<FormWizard
  form={bundle.form}
  flow={bundle.flow}
  steps={STEPS}
  onSubmit={() => void bundle.submission.submit(send)}
/>`,
    },
    {
      id: 'schema',
      title: 'Шаги в схеме формы',
      description:
        'Визард — узел схемы, шаги — его дочерние узлы Step. Форму и поток он берёт из сборки, отправку ловит поведение формы.',
      render: WizardSchema,
      code: `import { createForm, type FormModel, type FormSchemaNode } from '@reformer/core';
import { defineFormBehavior, onComponentEvent } from '@reformer/core/behaviors';
import { useFormBundle } from '@reformer/core/react';
import { Step } from '@reformer/cdk/form-wizard';
import { FormRenderer } from '@reformer/renderer-react';
import { FormField, Input, InputMask } from '@reformer/ui-kit';
import { FormWizard } from '@reformer/ui-kit/form-wizard';

const wizardSchema = (model: FormModel<WForm>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  componentProps: { submitLabel: 'Отправить заявку' },
  children: [
    {
      selector: 'contact', // = id шага в потоке
      component: Step,
      componentProps: { title: 'Контакт', icon: '👤' },
      children: [
        { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
        { model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
      ],
    },
    {
      selector: 'phone',
      component: Step,
      componentProps: { title: 'Телефон', icon: '📞' },
      children: [
        { model: model.$.phone, component: InputMask, componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' } },
      ],
    },
  ],
});

const bundle = useFormBundle(() =>
  createForm<WForm>({
    initial: { name: '', email: '', phone: '' },
    schema: wizardSchema,
    // обработчик получает значения только после проверки всей формы
    behavior: defineFormBehavior<WForm>(({ schema }) => {
      onComponentEvent(schema.node('wizard'), 'onSubmit', (values: WForm) => send(values));
    }),
    flow: {
      steps: [
        { id: 'contact', rules: step1Validation },
        { id: 'phone', rules: step2Validation },
      ],
    },
  })
);

<FormRenderer form={bundle} settings={{ fieldWrapper: FormField }} />`,
    },
  ],
  examples: [
    {
      id: 'external-control',
      title: 'Управление снаружи',
      description:
        'Кнопки под визардом двигают поток (flow.next) и отправляют форму (bundle.submission.submit) мимо кнопок визарда. Тело третьего шага — просто ReactNode.',
      render: WizardExternalControl,
      code: `const send = (label: string) =>
  void bundle.submission
    .submit(async () => setStatus(label))
    .then((result) => result.status === 'invalid' && setStatus('Проверьте поля формы'));

<FormWizard
  form={bundle.form}
  flow={bundle.flow}
  steps={STEPS}
  onSubmit={() => send('✅ Отправлено')}
/>

// снаружи визарда:
<Button variant="outline" size="sm" onClick={() => void bundle.flow?.next()}>
  Далее (извне)
</Button>
<Button size="sm" onClick={() => send('✅ Отправлено извне')}>
  Отправить (извне)
</Button>`,
    },
  ],
  props: [
    {
      name: 'form',
      type: 'FormGroup<T>',
      description:
        'Форма (bundle.form). Обязательна в разметке; в схеме формы визард берёт её из сборки.',
    },
    {
      name: 'flow',
      type: 'FormFlow',
      description:
        'Поток шагов (bundle.flow). В схеме формы берётся из сборки. Без потока визард идёт по шагам без правил.',
    },
    {
      name: 'steps',
      type: 'FormWizardStep<T>[]',
      description:
        'Шаги в разметке: { number (с 1), title, icon?, body }. body — компонент ({ control }) => …, ReactNode или узел схемы (его рисует renderStepBody). В схеме формы вместо steps — дочерние узлы.',
    },
    {
      name: 'onSubmit',
      type: '(values: T) => void | Promise<void>',
      description:
        'Кнопка отправки на последнем шаге. В разметке зовётся по нажатию — проверку делает bundle.submission.submit. В схеме формы — только после успешной проверки всей формы; ловится onComponentEvent(…, "onSubmit", …).',
    },
    {
      name: 'submitLabel',
      type: 'string',
      default: 'kit.formWizard.submit',
      description: 'Текст кнопки отправки. По умолчанию — из словаря кита.',
    },
    {
      name: 'onStepChange',
      type: '(step: number) => void',
      description:
        'Вызывается после перехода, номер шага — с 1. Удобное место, чтобы перевести фокус.',
    },
    {
      name: 'scrollToTop',
      type: 'boolean',
      default: 'true',
      description: 'Прокручивать окно к началу при смене шага.',
    },
    {
      name: 'className',
      type: 'string',
      description:
        'Класс карточки с телом шага. Сливается с классами по умолчанию: bg-white или p-6 заменяют фон и отступы.',
    },
    {
      name: 'renderStepBody',
      type: '(body, form) => ReactNode',
      description:
        'Как рисовать тело шага, которое не компонент и не ReactNode (например, узел схемы в разметке).',
    },
    {
      name: 'FormWizard.Indicator / .Step / .Actions / .Progress',
      type: 'слоты cdk',
      description: 'Части без оформления для своей раскладки — те же, что у FormWizard из cdk.',
    },
    {
      name: 'StepIndicator, FormWizardActions, FormWizardProgress',
      type: 'оформленные части',
      description:
        'Индикатор, кнопки и прогресс по отдельности. У FormWizardActions — prevLabel, nextLabel, submitLabel, validatingLabel, submittingLabel; у StepIndicator — navAriaLabel, stepAriaLabel; у FormWizardProgress — format.',
    },
  ],
};
