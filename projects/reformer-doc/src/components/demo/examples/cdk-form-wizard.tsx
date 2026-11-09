import { useState } from 'react';
import { createForm, type FormGroup, type FormModel, type FormSchemaNode } from '@reformer/core';
import { useFormBundle, useFormFlow } from '@reformer/core/react';
import { defineValidation, validate } from '@reformer/core/validation';
import { defineIssueMessages } from '@reformer/core/i18n';
import { email, required } from '@reformer/core/validators';
import { ValidationMessagesProvider } from '@reformer/cdk';
import { FormWizard } from '@reformer/cdk/form-wizard';
import { FormField, Input, InputMask, Button } from '@reformer/ui-kit';
import type { ComponentDocConfig } from '../types';

type WForm = { name: string; email: string; phone: string };

/** Шаги для индикатора: номер с единицы и подпись. */
const STEPS = [
  { number: 1, title: 'Контакт' },
  { number: 2, title: 'Телефон' },
];

const wizardSchema = (model: FormModel<WForm>): FormSchemaNode => ({
  children: [
    { model: model.$.name, component: Input, componentProps: { label: 'Имя' } },
    { model: model.$.email, component: Input, componentProps: { label: 'Email', type: 'email' } },
    {
      model: model.$.phone,
      component: InputMask,
      componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
    },
  ],
});

// Правила шагов — отдельные наборы (@reformer/core/validation), константы модуля.
const contactRules = defineValidation<WForm>(({ model }) => {
  validate(model.$.name, [required({ code: 'name.required' })]);
  validate(model.$.email, [required({ code: 'email.required' }), email()]);
});
const phoneRules = defineValidation<WForm>(({ model }) => {
  validate(model.$.phone, [required({ code: 'phone.required' })]);
});

/** Тексты замечаний: правила несут код, строку по коду даёт словарь формы. */
const WIZARD_MESSAGES = defineIssueMessages({
  'name.required': 'Введите имя',
  'email.required': 'Введите email',
  email: 'Неверный формат email',
  'phone.required': 'Введите телефон',
});

/** Сборка: поток шагов — «Далее» проверяет правила текущего шага. */
function useWizardBundle() {
  return useFormBundle(() =>
    createForm<WForm>({
      initial: { name: '', email: '', phone: '' },
      schema: wizardSchema,
      flow: {
        steps: [
          { id: 'contact', rules: contactRules },
          { id: 'phone', rules: phoneRules },
        ],
      },
    })
  );
}

/** Имитация сервера: ответ через 600 мс. */
const sendApplication = (values: WForm) =>
  new Promise<WForm>((resolve) => setTimeout(() => resolve(values), 600));

const ContactStep = ({ control }: { control: FormGroup<WForm> }) => (
  <div style={{ display: 'grid', gap: 8 }}>
    <FormField control={control.name} />
    <FormField control={control.email} />
  </div>
);
const PhoneStep = ({ control }: { control: FormGroup<WForm> }) => (
  <FormField control={control.phone} />
);

const WRAP: React.CSSProperties = { maxWidth: 460, width: '100%' };
const MUTED: React.CSSProperties = { fontSize: 13, color: 'var(--ifm-color-emphasis-700)' };
const ROW: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  marginTop: 14,
};

function RenderPropsDemo() {
  const bundle = useWizardBundle();
  const [sent, setSent] = useState<string | null>(null);

  return (
    <ValidationMessagesProvider messages={WIZARD_MESSAGES}>
      <div style={WRAP}>
        <FormWizard form={bundle.form} flow={bundle.flow} scrollToTop={false}>
          <FormWizard.Progress>
            {({ current, total, percent }) => (
              <div style={{ marginBottom: 12 }}>
                <div style={{ ...MUTED, marginBottom: 4 }}>
                  Шаг {current} из {total}
                </div>
                <div
                  style={{
                    height: 4,
                    borderRadius: 2,
                    background: 'var(--ifm-color-emphasis-200)',
                  }}
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

          <FormWizard.Step component={ContactStep} control={bundle.form} />
          <FormWizard.Step component={PhoneStep} control={bundle.form} />

          {/* Вне контекста сборки визард зовёт onSubmit по нажатию — проверку делает submission. */}
          <FormWizard.Actions
            onSubmit={async () => {
              const outcome = await bundle.submission.submit(sendApplication);
              if (outcome.status === 'submitted') setSent(outcome.result.name);
            }}
          >
            {({ prev, next, submit, isLastStep }) => (
              <div style={ROW}>
                <Button variant="outline" size="sm" onClick={prev.onClick} disabled={prev.disabled}>
                  Назад
                </Button>
                {!isLastStep ? (
                  <Button size="sm" onClick={next.onClick} disabled={next.disabled}>
                    Далее
                  </Button>
                ) : (
                  <Button size="sm" onClick={submit.onClick} disabled={submit.disabled}>
                    {submit.isSubmitting ? 'Отправка…' : 'Отправить'}
                  </Button>
                )}
              </div>
            )}
          </FormWizard.Actions>
        </FormWizard>
        {sent && <p style={{ ...MUTED, marginTop: 10 }}>Заявка отправлена: {sent}</p>}
      </div>
    </ValidationMessagesProvider>
  );
}

function IndicatorDemo() {
  const bundle = useWizardBundle();
  const [sent, setSent] = useState(false);

  return (
    <ValidationMessagesProvider messages={WIZARD_MESSAGES}>
      <div style={WRAP}>
        <FormWizard form={bundle.form} flow={bundle.flow} scrollToTop={false}>
          <FormWizard.Indicator steps={STEPS}>
            {({ steps, goToStep }) => (
              <nav style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                {steps.map((s) => (
                  <button
                    key={s.number}
                    type="button"
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

          <FormWizard.Step component={ContactStep} control={bundle.form} />
          <FormWizard.Step component={PhoneStep} control={bundle.form} />

          <FormWizard.Actions
            onSubmit={async () => {
              const outcome = await bundle.submission.submit(sendApplication);
              setSent(outcome.status === 'submitted');
            }}
            style={ROW}
          >
            <FormWizard.Prev asChild>
              <Button variant="outline" size="sm">
                Назад
              </Button>
            </FormWizard.Prev>
            <FormWizard.Next asChild>
              <Button size="sm">Далее</Button>
            </FormWizard.Next>
            <FormWizard.Submit asChild loadingText="Отправка…">
              <Button size="sm">Отправить</Button>
            </FormWizard.Submit>
          </FormWizard.Actions>
        </FormWizard>
        {sent && <p style={{ ...MUTED, marginTop: 10 }}>Заявка отправлена.</p>}
      </div>
    </ValidationMessagesProvider>
  );
}

/** Управление снаружи визарда: тот же поток сборки, без ref. */
function ExternalToolbar({ bundle }: { bundle: ReturnType<typeof useWizardBundle> }) {
  const flow = bundle.flow!;
  const { current, index } = useFormFlow(flow);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <span style={{ ...MUTED, flex: 1 }}>
        Шаг {index + 1} из {flow.steps.length}: {current}
      </span>
      <Button size="sm" variant="outline" onClick={() => flow.reset()}>
        В начало
      </Button>
    </div>
  );
}

function ExternalDemo() {
  const bundle = useWizardBundle();

  return (
    <ValidationMessagesProvider messages={WIZARD_MESSAGES}>
      <div style={WRAP}>
        <ExternalToolbar bundle={bundle} />
        <FormWizard form={bundle.form} flow={bundle.flow} scrollToTop={false}>
          <FormWizard.Step component={ContactStep} control={bundle.form} />
          <FormWizard.Step component={PhoneStep} control={bundle.form} />
          <FormWizard.Actions style={ROW}>
            <FormWizard.Prev asChild>
              <Button variant="outline" size="sm">
                Назад
              </Button>
            </FormWizard.Prev>
            <FormWizard.Next asChild>
              <Button size="sm">Далее</Button>
            </FormWizard.Next>
          </FormWizard.Actions>
        </FormWizard>
      </div>
    </ValidationMessagesProvider>
  );
}

export const formWizardDocConfig: ComponentDocConfig = {
  name: 'FormWizard',
  importFrom: '@reformer/cdk/form-wizard',
  description:
    'Headless многошаговая форма. Шаги и их правила — поток шагов сборки createForm({ flow }); визард рисует его и зовёт его переходы.',
  variants: [
    {
      id: 'render-props',
      title: 'Progress и кнопки через render-props',
      description:
        'Прогресс сверху, кнопки — своя разметка. «Далее» проверяет правила текущего шага и не пускает дальше, пока у шага есть замечания.',
      render: RenderPropsDemo,
      code: `const bundle = useFormBundle(() =>
  createForm<WForm>({
    initial: { name: '', email: '', phone: '' },
    schema: wizardSchema,
    flow: {
      steps: [
        { id: 'contact', rules: contactRules },
        { id: 'phone', rules: phoneRules },
      ],
    },
  })
);

<FormWizard form={bundle.form} flow={bundle.flow} scrollToTop={false}>
  <FormWizard.Progress>
    {({ current, total, percent }) => <Bar label={\`Шаг \${current} из \${total}\`} percent={percent} />}
  </FormWizard.Progress>

  <FormWizard.Step component={ContactStep} control={bundle.form} />
  <FormWizard.Step component={PhoneStep} control={bundle.form} />

  <FormWizard.Actions
    onSubmit={async () => {
      await bundle.submission.submit(sendApplication); // полная проверка + обработчик
    }}
  >
    {({ prev, next, submit, isLastStep }) => (
      <>
        <button onClick={prev.onClick} disabled={prev.disabled}>Назад</button>
        {!isLastStep ? (
          <button onClick={next.onClick} disabled={next.disabled}>Далее</button>
        ) : (
          <button onClick={submit.onClick} disabled={submit.disabled}>
            {submit.isSubmitting ? 'Отправка…' : 'Отправить'}
          </button>
        )}
      </>
    )}
  </FormWizard.Actions>
</FormWizard>`,
    },
  ],
  examples: [
    {
      id: 'indicator',
      title: 'Индикатор шагов и готовые кнопки',
      description:
        'Индикатор пускает только на пройденные шаги и на следующий за ними. Prev, Next и Submit внутри Actions сами отключаются на краях: «Назад» — на первом шаге, «Далее» — на последнем, «Отправить» — до последнего.',
      render: IndicatorDemo,
      code: `<FormWizard.Indicator steps={STEPS}>
  {({ steps, goToStep }) => (
    <nav>
      {steps.map((s) => (
        <button
          key={s.number}
          type="button"
          onClick={() => goToStep(s.number)}
          disabled={!s.canNavigate}
          aria-current={s.isCurrent ? 'step' : undefined}
        >
          {s.isCompleted ? '✓' : s.number} {s.title}
        </button>
      ))}
    </nav>
  )}
</FormWizard.Indicator>

<FormWizard.Actions onSubmit={async () => { await bundle.submission.submit(sendApplication); }}>
  <FormWizard.Prev asChild><Button variant="outline">Назад</Button></FormWizard.Prev>
  <FormWizard.Next asChild><Button>Далее</Button></FormWizard.Next>
  <FormWizard.Submit asChild loadingText="Отправка…"><Button>Отправить</Button></FormWizard.Submit>
</FormWizard.Actions>`,
    },
    {
      id: 'external',
      title: 'Управление снаружи визарда',
      description:
        'Ref у визарда нет: код снаружи работает с тем же потоком сборки. useFormFlow перерисовывает панель при смене шага, flow.reset() возвращает на первый шаг.',
      render: ExternalDemo,
      code: `import { useFormFlow } from '@reformer/core/react';

function Toolbar({ bundle }: { bundle: FormBundle<WForm> }) {
  const flow = bundle.flow!;
  const { current, index } = useFormFlow(flow);
  return (
    <div>
      Шаг {index + 1} из {flow.steps.length}: {current}
      <button onClick={() => flow.reset()}>В начало</button>
    </div>
  );
}

<Toolbar bundle={bundle} />
<FormWizard form={bundle.form} flow={bundle.flow} scrollToTop={false}>
  …
</FormWizard>`,
    },
  ],
  props: [
    {
      name: 'FormWizard',
      type: 'form?; flow?; onStepChange?; scrollToTop?',
      default: 'scrollToTop: true',
      description:
        'Корень. flow — поток шагов сборки (bundle.flow); без него — сборка из FormBundleContext, без неё — поток по числу Step без правил. onStepChange(step) получает номер с единицы после переходов самого визарда; scrollToTop прокручивает страницу к началу.',
    },
    {
      name: 'FormWizard.Step',
      type: 'component + control | children',
      description:
        'Содержимое шага. N-й Step виден, когда поток на N-м шаге: число и порядок Step совпадают с flow.steps.',
    },
    {
      name: 'FormWizard.Indicator',
      type: 'steps: { number, title, icon? }[]; children: (props) => ReactNode',
      description:
        'Индикатор шагов. props: steps (с isCurrent, isCompleted, canNavigate), goToStep(n), currentStep, totalSteps, completedSteps.',
    },
    {
      name: 'FormWizard.Actions',
      type: 'onSubmit?; children: ReactNode | (props) => ReactNode; className?; style?',
      description:
        'Кнопки навигации. props: prev, next, submit ({ onClick, disabled }, у submit ещё isSubmitting), isFirstStep, isLastStep, isValidating, isSubmitting. prev.disabled учитывает первый шаг, next.disabled — последний. Внутри сборки onSubmit зовётся после успешной проверки всей формы, вне её — по нажатию.',
    },
    {
      name: 'FormWizard.Prev / Next / Submit',
      type: 'children; asChild?; disabled?; loadingText? (Submit)',
      description:
        'Готовые кнопки внутри Actions. Отключаются сами на краях и во время проверки или отправки; data-first-step, data-last-step, data-not-last-step, data-submitting — для стилей. Все три — type="button": отправка только через submit визарда.',
    },
    {
      name: 'FormWizard.Progress',
      type: 'children: (props) => ReactNode',
      description:
        'Прогресс. props: current, total, percent, completedCount, isFirstStep, isLastStep.',
    },
    {
      name: 'useFormWizard()',
      type: '→ { form, flow, currentStep, totalSteps, completedSteps, isFirstStep, isLastStep, isValidating, isSubmitting, goToNextStep, goToPreviousStep, goToStep, submit }',
      description: 'Состояние и переходы визарда для любого потомка; номера шагов — с единицы.',
    },
  ],
};
