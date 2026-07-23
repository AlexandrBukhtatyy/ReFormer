/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useState } from 'react';
import { createModel, createForm } from '@reformer/core';
import { defineValidationSchema, validate, apply, validateModel } from '@reformer/core/validation';
import { FormWizard } from '@reformer/cdk/form-wizard';
import { FormField, InputField, InputMaskField, Button } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';
import type { ComponentDocConfig } from '../types';

type WForm = { name: string; email: string; phone: string };

const STEPS = [
  { number: 1, title: 'Контакт' },
  { number: 2, title: 'Телефон' },
];

// Правила — отдельные validation-схемы (@reformer/core/validation), по одной на шаг.
const step1Validation = defineValidationSchema<WForm>(({ model }) => {
  validate(model.$.name, [required({ message: 'Введите имя' })]);
  validate(model.$.email, [required(), email()]);
});
const step2Validation = defineValidationSchema<WForm>(({ model }) => {
  validate(model.$.phone, [required({ message: 'Введите телефон' })]);
});
const fullValidation = defineValidationSchema<WForm>(() => apply(step1Validation, step2Validation));

function useWizard() {
  return useMemo(() => {
    const model = createModel<WForm>({ name: '', email: '', phone: '' });
    // Layout-схема без валидаторов — только component/componentProps.
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
    // config — колбэки поверх внешнего раннера validateModel (Promise<boolean>).
    const config = {
      validateStep: (step: number) =>
        validateModel(model, step === 1 ? step1Validation : step2Validation),
      validateAll: () => validateModel(model, fullValidation),
    };
    return { model, form, config };
  }, []);
}

const Step1 = ({ control }: { control: any }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.name} />
    <FormField control={control.email} />
  </div>
);
const Step2 = ({ control }: { control: any }) => <FormField control={control.phone} />;

function WizardRenderProps() {
  const { model, form, config } = useWizard();
  const [done, setDone] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 460, width: '100%' }}>
      <FormWizard form={form} config={config}>
        <FormWizard.Progress>
          {({ current, total, percent }: any) => (
            <div style={{ marginBottom: 12 }}>
              <div
                style={{ fontSize: 13, color: 'var(--ifm-color-emphasis-700)', marginBottom: 4 }}
              >
                Шаг {current} из {total}
              </div>
              <div
                style={{ height: 4, borderRadius: 2, background: 'var(--ifm-color-emphasis-200)' }}
              >
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    width: `${percent}%`,
                    background: 'var(--ifm-color-primary)',
                    transition: 'width .2s',
                  }}
                />
              </div>
            </div>
          )}
        </FormWizard.Progress>

        <FormWizard.Step component={Step1} control={form} />
        <FormWizard.Step component={Step2} control={form} />

        <FormWizard.Actions
          onSubmit={() => setDone('✅ Отправлено: ' + JSON.stringify(model.get()))}
        >
          {({ prev, next, submit, isFirstStep, isLastStep }: any) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 14 }}>
              <Button
                variant="outline"
                size="sm"
                onClick={prev.onClick}
                disabled={prev.disabled || isFirstStep}
              >
                Назад
              </Button>
              {!isLastStep ? (
                <Button size="sm" onClick={next.onClick} disabled={next.disabled}>
                  Далее
                </Button>
              ) : (
                <Button size="sm" onClick={submit.onClick} disabled={submit.disabled}>
                  Отправить
                </Button>
              )}
            </div>
          )}
        </FormWizard.Actions>
      </FormWizard>
      {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
    </div>
  );
}

function WizardCompound() {
  const { form, config } = useWizard();
  return (
    <div style={{ maxWidth: 460, width: '100%' }}>
      <FormWizard form={form} config={config}>
        <FormWizard.Indicator steps={STEPS}>
          {({ steps, goToStep }: any) => (
            <nav style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {steps.map((s: any) => (
                <button
                  key={s.number}
                  onClick={() => goToStep(s.number)}
                  disabled={!s.canNavigate}
                  aria-current={s.isCurrent ? 'step' : undefined}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 6,
                    border: '1px solid var(--ifm-toc-border-color)',
                    background: s.isCurrent ? 'var(--ifm-color-primary)' : 'transparent',
                    color: s.isCurrent ? '#fff' : 'inherit',
                    cursor: s.canNavigate ? 'pointer' : 'not-allowed',
                    fontSize: 13,
                  }}
                >
                  {s.isCompleted ? '✓' : s.number} {s.title}
                </button>
              ))}
            </nav>
          )}
        </FormWizard.Indicator>

        <FormWizard.Step component={Step1} control={form} />
        <FormWizard.Step component={Step2} control={form} />

        <FormWizard.Actions onSubmit={() => undefined} className="flex justify-between">
          <FormWizard.Prev>Назад</FormWizard.Prev>
          <FormWizard.Next>Далее</FormWizard.Next>
          <FormWizard.Submit loadingText="Отправка…">Отправить</FormWizard.Submit>
        </FormWizard.Actions>
      </FormWizard>
    </div>
  );
}

export const formWizardDocConfig: ComponentDocConfig = {
  name: 'FormWizard',
  importFrom: '@reformer/cdk/form-wizard',
  description:
    'Headless многошаговый визард с пошаговой валидацией. config — пара колбэков validateStep / validateAll.',
  variants: [
    {
      id: 'render-props',
      title: 'Progress + render-props Actions',
      description:
        'Прогресс сверху, навигация — через render-props. Далее блокируется, пока шаг невалиден.',
      render: WizardRenderProps,
      code: `import { defineValidationSchema, validate, apply, validateModel } from '@reformer/core/validation';

const step1Validation = defineValidationSchema<WForm>(({ model }) => {
  validate(model.$.name, [required()]);
  validate(model.$.email, [required(), email()]);
});
const fullValidation = defineValidationSchema<WForm>(() => apply(step1Validation, step2Validation));

const config: FormWizardConfig = {
  validateStep: (step) => validateModel(model, step === 1 ? step1Validation : step2Validation),
  validateAll: () => validateModel(model, fullValidation),
};

<FormWizard form={form} config={config}>
  <FormWizard.Progress>
    {({ current, total, percent }) => <Bar current={current} total={total} percent={percent} />}
  </FormWizard.Progress>
  <FormWizard.Step component={Step1} control={form} />
  <FormWizard.Step component={Step2} control={form} />
  <FormWizard.Actions onSubmit={handleSubmit}>
    {({ prev, next, submit, isLastStep }) => (
      <>
        <button onClick={prev.onClick} disabled={prev.disabled}>Назад</button>
        {!isLastStep
          ? <button onClick={next.onClick} disabled={next.disabled}>Далее</button>
          : <button onClick={submit.onClick} disabled={submit.disabled}>Отправить</button>}
      </>
    )}
  </FormWizard.Actions>
</FormWizard>`,
    },
  ],
  examples: [
    {
      id: 'indicator',
      title: 'Indicator + compound-кнопки',
      description: 'Кликабельный индикатор шагов и compound Prev/Next/Submit внутри Actions.',
      render: WizardCompound,
      code: `<FormWizard.Indicator steps={STEPS}>
  {({ steps, goToStep }) =>
    steps.map((s) => (
      <button key={s.number} onClick={() => goToStep(s.number)} disabled={!s.canNavigate}>
        {s.isCompleted ? '✓' : s.number} {s.title}
      </button>
    ))
  }
</FormWizard.Indicator>

<FormWizard.Actions onSubmit={handleSubmit}>
  <FormWizard.Prev>Назад</FormWizard.Prev>
  <FormWizard.Next>Далее</FormWizard.Next>
  <FormWizard.Submit loadingText="Отправка…">Отправить</FormWizard.Submit>
</FormWizard.Actions>`,
    },
  ],
  props: [
    {
      name: 'FormWizard',
      type: 'form, config',
      description:
        'Root-провайдер. config = { validateStep?, validateAll? } — колбэки, возвращающие boolean | Promise<boolean>.',
    },
    {
      name: 'FormWizard.Step',
      type: 'component, control',
      description: 'Рендерит компонент шага, когда шаг текущий.',
    },
    {
      name: 'FormWizard.Actions',
      type: 'onSubmit, children',
      description:
        'Навигация: render-props ({ prev, next, submit, isFirstStep, isLastStep }) или compound-кнопки.',
    },
    {
      name: 'FormWizard.Prev / Next / Submit',
      type: 'children',
      description: 'Compound-кнопки внутри Actions (читают его контекст).',
    },
    {
      name: 'FormWizard.Indicator',
      type: 'steps, children',
      description: 'Индикатор шагов (render-props: steps, goToStep, currentStep).',
    },
    {
      name: 'FormWizard.Progress',
      type: 'children',
      description: 'Прогресс (render-props: current, total, percent).',
    },
  ],
};
