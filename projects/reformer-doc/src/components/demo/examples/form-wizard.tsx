/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useRef, useState } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, apply, validateModel } from '@reformer/core/validation';
import { required, email } from '@reformer/core/validators';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import type { FormWizardHandle } from '@reformer/cdk/form-wizard';
import { FormField, InputField, InputMaskField, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type WForm = { name: string; email: string; phone: string };

// Правила — отдельные validation-схемы (@reformer/core/validation), по одной на шаг.
const step1Validation = defineValidationSchema<WForm>(({ model }) => {
  validate(model.$.name, [required({ message: 'Введите имя' })]);
  validate(model.$.email, [required(), email()]);
});
const step2Validation = defineValidationSchema<WForm>(({ model }) => {
  validate(model.$.phone, [required({ message: 'Введите телефон' })]);
});
const fullValidation = defineValidationSchema<WForm>(() => apply(step1Validation, step2Validation));

/** M1-форма визарда: layout без валидаторов + config поверх validateModel. */
function useWizardForm() {
  return useMemo(() => {
    const model = createModel<WForm>({ name: '', email: '', phone: '' });
    const schema = {
      name: { value: model.$.name, component: InputField, componentProps: { label: 'Имя' } },
      email: {
        value: model.$.email,
        component: InputField,
        componentProps: { label: 'Email', type: 'email' },
      },
      phone: {
        value: model.$.phone,
        component: InputMaskField,
        componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
      },
    } as any;
    const form = createForm<WForm>({ model, schema }) as any;
    const config = {
      validateStep: (step: number) =>
        validateModel(model, step === 1 ? step1Validation : step2Validation),
      validateAll: () => validateModel(model, fullValidation),
    };
    return { model, form, config };
  }, []);
}

const ContactStep = ({ control }: { control: any }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.name} />
    <FormField control={control.email} />
  </div>
);
const PhoneStep = ({ control }: { control: any }) => <FormField control={control.phone} />;

function WizardSteps() {
  const { model, form, config } = useWizardForm();
  const [done, setDone] = useState<string | null>(null);
  const steps = useMemo(
    () => [
      { number: 1, title: 'Контакт', icon: '👤', body: ContactStep },
      { number: 2, title: 'Телефон', icon: '📞', body: PhoneStep },
    ],
    []
  );
  return (
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FormWizard
        form={form}
        config={config}
        steps={steps as any}
        onSubmit={() => setDone('✅ Отправлено: ' + JSON.stringify(model.get()))}
      />
      {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
    </div>
  );
}

function WizardRefHandle() {
  const { model, form, config } = useWizardForm();
  const navRef = useRef<FormWizardHandle<WForm>>(null);
  const [status, setStatus] = useState<string | null>(null);
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
    <div style={{ maxWidth: 480, width: '100%' }}>
      <FormWizard
        ref={navRef}
        form={form}
        config={config}
        steps={steps as any}
        onSubmit={() => setStatus('✅ Отправлено: ' + JSON.stringify(model.get()))}
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 12, alignItems: 'center' }}>
        <Button variant="outline" size="sm" onClick={() => navRef.current?.goToNextStep()}>
          Далее (извне)
        </Button>
        <Button
          size="sm"
          onClick={() => void navRef.current?.submit(async () => setStatus('✅ Отправлено извне'))}
        >
          Отправить (извне)
        </Button>
        {status && <span style={{ fontSize: 13 }}>{status}</span>}
      </div>
    </div>
  );
}

export const uiKitFormWizardDocConfig: ComponentDocConfig = {
  name: 'FormWizard',
  importFrom: '@reformer/ui-kit/form-wizard',
  description:
    'Стилизованный многошаговый визард поверх headless @reformer/cdk/form-wizard: декларативный список steps, индикатор шагов, кнопки Назад/Далее/Отправить и пошаговая валидация из коробки. config — пара колбэков validateStep / validateAll поверх внешнего раннера validateModel.',
  variants: [
    {
      id: 'steps',
      title: 'Декларативные steps',
      description:
        'Массив steps ({ number, title, icon?, body }) + config. «Далее» блокируется, пока текущий шаг невалиден; индикатор и кнопки рендерятся автоматически.',
      render: WizardSteps,
      code: `import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';
import { defineValidationSchema, validate, apply, validateModel } from '@reformer/core/validation';

const step1Validation = defineValidationSchema<WForm>(({ model }) => {
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});
const fullValidation = defineValidationSchema<WForm>(() => apply(step1Validation, step2Validation));

const STEPS: FormWizardStep<WForm>[] = [
  { number: 1, title: 'Контакт', icon: '👤', body: ContactStep },
  { number: 2, title: 'Телефон', icon: '📞', body: PhoneStep },
];

const config = {
  validateStep: (step) => validateModel(model, step === 1 ? step1Validation : step2Validation),
  validateAll: () => validateModel(model, fullValidation),
};

<FormWizard form={form} config={config} steps={STEPS} onSubmit={handleSubmit} />`,
    },
  ],
  examples: [
    {
      id: 'ref-handle',
      title: 'Внешнее управление через ref + ReactNode-шаг',
      description:
        'FormWizardHandle (goToNextStep / submit) управляет визардом снаружи дерева; body шага полиморфно — компонент, ReactNode или RenderNode.',
      render: WizardRefHandle,
      code: `import type { FormWizardHandle } from '@reformer/cdk/form-wizard';

const navRef = useRef<FormWizardHandle<WForm>>(null);

const STEPS: FormWizardStep<WForm>[] = [
  { number: 1, title: 'Контакт', icon: '👤', body: ContactStep },
  { number: 2, title: 'Телефон', icon: '📞', body: PhoneStep },
  { number: 3, title: 'Готово', icon: '✓', body: <p>Проверьте данные и отправьте.</p> },
];

<FormWizard ref={navRef} form={form} config={config} steps={STEPS} onSubmit={handleSubmit} />

// снаружи дерева:
navRef.current?.goToNextStep();          // валидирует текущий шаг и идёт дальше
navRef.current?.submit((values) => api.submit(values)); // validateAll + submit`,
    },
  ],
  props: [
    {
      name: 'form / config',
      type: 'FormProxy<T> / { validateStep?, validateAll? }',
      description:
        'Форма и колбэки валидации (boolean | Promise<boolean>) — обычно обёртки над validateModel(model, schema).',
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
      description: 'Вызывается на последнем шаге после успешной validateAll.',
    },
    {
      name: 'onStepChange / className',
      type: '(step: number) => void / string',
      description: 'Колбэк смены шага и внешний класс контейнера.',
    },
    {
      name: 'ref: FormWizardHandle<T>',
      type: 'goToNextStep(), goToStep(n), submit(fn)',
      description: 'Императивное управление снаружи дерева (шапка страницы, breadcrumbs).',
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
