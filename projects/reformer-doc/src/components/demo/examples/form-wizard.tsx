/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
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
    void bundle.submit(async (values) => setDone('✅ Отправлено: ' + JSON.stringify(values)));
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
    void bundle
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

export const uiKitFormWizardDocConfig: ComponentDocConfig = {
  name: 'FormWizard',
  importFrom: '@reformer/ui-kit/form-wizard',
  description:
    'Стилизованный многошаговый визард поверх headless @reformer/cdk/form-wizard: декларативный список steps, индикатор шагов, кнопки Назад/Далее/Отправить и пошаговая валидация из коробки. Шаги и их правила — поток сборки createForm({ flow }), отправка — bundle.submit.',
  variants: [
    {
      id: 'steps',
      title: 'Декларативные steps',
      description:
        'Массив steps ({ number, title, icon?, body }) + поток сборки. «Далее» блокируется, пока текущий шаг невалиден; индикатор и кнопки рендерятся автоматически.',
      render: WizardSteps,
      code: `import { createForm } from '@reformer/core';
import { useFormBundle } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

const step1Validation = defineValidation<WForm>(({ model }) => {
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});

const bundle = useFormBundle(() =>
  createForm<WForm>({
    initial,
    schema,
    flow: {
      steps: [
        { id: 'contact', rules: step1Validation },
        { id: 'phone', rules: step2Validation },
        { id: 'done' },
      ],
    },
  })
);

const STEPS: FormWizardStep<WForm>[] = [
  { number: 1, title: 'Контакт', icon: '👤', body: ContactStep },
  { number: 2, title: 'Телефон', icon: '📞', body: PhoneStep },
  { number: 3, title: 'Готово', icon: '✓', body: <p>Проверьте данные и отправьте.</p> },
];

<FormWizard
  form={bundle.form}
  flow={bundle.flow}
  steps={STEPS}
  onSubmit={() => void bundle.submit(api.send)} // один прогон всех правил
/>`,
    },
  ],
  examples: [
    {
      id: 'external-control',
      title: 'Внешнее управление через поток + ReactNode-шаг',
      description:
        'Поток шагов сборки (flow.next / goTo) и bundle.submit управляют визардом снаружи дерева; body шага полиморфно — компонент, ReactNode или узел схемы.',
      render: WizardExternalControl,
      code: `<FormWizard form={bundle.form} flow={bundle.flow} steps={STEPS} onSubmit={send} />

// снаружи дерева:
await bundle.flow?.next(); // проверяет правила текущего шага и идёт дальше
const result = await bundle.submit((values) => api.submit(values)); // один прогон всех правил
if (result.status === 'invalid') showHint('Проверьте поля формы');`,
    },
  ],
  props: [
    {
      name: 'form / flow',
      type: 'FormGroup<T> / FormFlow',
      description:
        'Форма и поток шагов сборки (bundle.form, bundle.flow). В схеме формы оба берутся из сборки.',
    },
    {
      name: 'steps',
      type: 'FormWizardStep<T>[]',
      description:
        '{ number (1-based), title, icon?, body }. body полиморфно: FC<{control}> | ReactNode | RenderNode<T>.',
    },
    {
      name: 'onSubmit',
      type: '(values: T) => void | Promise<void>',
      description:
        'Кнопка отправки последнего шага. Внутри сборки — через bundle.submit (после успешной проверки), без сборки — по нажатию.',
    },
    {
      name: 'onStepChange / className',
      type: '(step: number) => void / string',
      description: 'Колбэк смены шага и внешний класс контейнера.',
    },
    {
      name: 'bundle.flow / bundle.submit',
      type: 'next(), previous(), goTo(id) / submit(handler)',
      description:
        'Управление снаружи дерева (шапка страницы, breadcrumbs) — через сам поток и сборку.',
    },
    {
      name: 'FormWizard.Indicator / .Step / .Actions / .Progress',
      type: 'compound-слоты',
      description: 'Headless-слоты из cdk для полностью кастомной раскладки.',
    },
    {
      name: 'StepIndicator / FormWizardActions / FormWizardProgress',
      type: 'презентационные слоты',
      description: 'Стилизованные части визарда — переиспользуются отдельно.',
    },
  ],
};
