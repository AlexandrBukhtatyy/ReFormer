/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createModel, createForm, validateFormModel } from '@reformer/core';
import { FormWizard, type FormWizardHandle } from '@reformer/cdk/form-wizard';
import {
  FormWizard as UiWizard,
  StepIndicator,
  FormWizardActions as UiActions,
  FormWizardProgress as UiProgress,
  type FormWizardStep as UiStepDef,
} from '@reformer/ui-kit/form-wizard';
import { FormField, Input, InputMask, Button } from '@reformer/ui-kit';
import { required, email } from '@reformer/core/validators';
import type { ComponentDocConfig } from '../types';

type WForm = { name: string; email: string; phone: string };

// ─── Общая фабрика формы + конфиг валидации ─────────────────────────────────

/** Поднимает M1-форму мастера (3 поля) и её step-ноды. */
function makeWizardForm(initial: WForm) {
  const model = createModel<WForm>(initial);
  const name = {
    value: model.$.name,
    component: Input,
    componentProps: { label: 'Имя' },
    validators: [required({ message: 'Введите имя' })],
  };
  const emailNode = {
    value: model.$.email,
    component: Input,
    componentProps: { label: 'Email', type: 'email' },
    validators: [required(), email()],
  };
  const phone = {
    value: model.$.phone,
    component: InputMask,
    componentProps: { label: 'Телефон', mask: '+7 (999) 999-99-99' },
    validators: [required({ message: 'Введите телефон' })],
  };
  const full = { name, email: emailNode, phone } as any;
  const form = createForm<WForm>({ model, schema: full }) as any;
  return { model, form, nodes: { name, email: emailNode, phone } };
}

/** Пара колбэков config: пошаговая валидация + submit-валидация. */
function makeConfig(model: any, nodes: any) {
  const step1 = { name: nodes.name };
  const step2 = { email: nodes.email };
  const step3 = { phone: nodes.phone };
  const full = { name: nodes.name, email: nodes.email, phone: nodes.phone };
  return {
    validateStep: async (step: number) =>
      (await validateFormModel(model, step === 1 ? step1 : step === 2 ? step2 : step3)).valid,
    validateAll: async () => (await validateFormModel(model, full)).valid,
  };
}

/** Стабильная форма мастера: пустая или предзаполненная валидными значениями. */
function useWizard(mode: 'empty' | 'valid' = 'empty') {
  return useMemo(() => {
    const initial: WForm =
      mode === 'valid'
        ? { name: 'Иван Петров', email: 'ivan@mail.ru', phone: '+7 (999) 123-45-67' }
        : { name: '', email: '', phone: '' };
    const built = makeWizardForm(initial);
    const config = makeConfig(built.model, built.nodes);
    return { ...built, config };
  }, [mode]);
}

const STEPS = [
  { number: 1, title: 'Имя', icon: '👤' },
  { number: 2, title: 'Email', icon: '✉️' },
  { number: 3, title: 'Телефон', icon: '📞' },
];

const NameStep = ({ control }: { control: any }) => <FormField control={control.name} />;
const EmailStep = ({ control }: { control: any }) => <FormField control={control.email} />;
const PhoneStep = ({ control }: { control: any }) => <FormField control={control.phone} />;

const UI_STEPS = [
  { number: 1, title: 'Имя', icon: '👤', body: NameStep },
  { number: 2, title: 'Email', icon: '✉️', body: EmailStep },
  { number: 3, title: 'Телефон', icon: '📞', body: PhoneStep },
] as UiStepDef<WForm>[];

const POLY_STEPS = [
  { number: 1, title: 'Имя', icon: '👤', body: NameStep },
  { number: 2, title: 'Email', icon: '✉️', body: EmailStep },
  {
    number: 3,
    title: 'Готово',
    icon: '✓',
    body: <p style={{ fontSize: 14 }}>Проверьте данные и отправьте заявку.</p>,
  },
] as UiStepDef<WForm>[];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// ─── Хелпер авто-продвижения (для Examples, где нужен не-первый шаг) ─────────

/** Автопродвижение мастера до целевого шага через ref-handle (данные валидны). */
function useAdvance(navRef: React.RefObject<FormWizardHandle<WForm> | null>, target: number) {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    let cancelled = false;
    const tick = () => {
      if (cancelled) return;
      const h = navRef.current;
      if (!h) {
        setTimeout(tick, 40);
        return;
      }
      if (h.currentStep >= target) return;
      Promise.resolve(h.goToNextStep()).then(() => {
        if (!cancelled) setTimeout(tick, 40);
      });
    };
    setTimeout(tick, 40);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/** Единый layout собранного мастера (ui-kit sub-parts): Indicator + шаги + Actions + Progress. */
function WizardShell({
  form,
  config,
  navRef,
}: {
  form: any;
  config: any;
  navRef: React.RefObject<FormWizardHandle<WForm> | null>;
}) {
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard ref={navRef} form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(ind: any) => <StepIndicator {...ind} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions onSubmit={() => undefined}>
          {(a: any) => <UiActions {...a} className="mt-6" />}
        </FormWizard.Actions>
        <FormWizard.Progress>
          {(p: any) => <UiProgress {...p} className="mt-3" />}
        </FormWizard.Progress>
      </FormWizard>
    </div>
  );
}

// ─── Variants: структурные формы сборки мастера ──────────────────────────────

/**
 * Полная композиция (default): все четыре compound-слота —
 * Indicator + Step(×N) + Actions + Progress — собранные вручную.
 */
function FullComposition() {
  const { form, config } = useWizard('empty');
  const navRef = useRef<FormWizardHandle<WForm>>(null);
  return <WizardShell form={form} config={config} navRef={navRef} />;
}

/**
 * Декларативная ui-kit-обёртка: тот же мастер, но собран одним
 * `<FormWizard steps={...} onSubmit={...} />` — весь layout свёрнут в проп `steps`.
 */
function DeclarativeUiKit() {
  const { form, config } = useWizard('empty');
  const navRef = useRef<FormWizardHandle<WForm>>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 560, width: '100%' }}>
      <UiWizard
        ref={navRef}
        form={form}
        config={config}
        steps={UI_STEPS}
        onSubmit={() => {
          navRef.current?.submit((v) => {
            setDone('✅ ' + JSON.stringify(v));
            return v;
          });
        }}
      />
      {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
    </div>
  );
}

/** Минимальная композиция: только Step + Actions (без Indicator и Progress). */
function MinimalComposition() {
  const { model, form, nodes } = useWizard('empty');
  const config = useMemo(() => {
    const step1 = { name: nodes.name };
    const step2 = { email: nodes.email };
    const both = { name: nodes.name, email: nodes.email };
    return {
      validateStep: async (s: number) =>
        (await validateFormModel(model, s === 1 ? step1 : step2)).valid,
      validateAll: async () => (await validateFormModel(model, both)).valid,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <div style={{ maxWidth: 460, width: '100%' }}>
      <FormWizard form={form} config={config} scrollToTop={false}>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Actions
          onSubmit={() => undefined}
          className="flex gap-3"
          style={{ marginTop: 14 }}
        >
          <FormWizard.Prev>Назад</FormWizard.Prev>
          <FormWizard.Next>Далее</FormWizard.Next>
          <FormWizard.Submit>Готово</FormWizard.Submit>
        </FormWizard.Actions>
      </FormWizard>
    </div>
  );
}

// ─── Examples: возможности (wiring-приёмы) ──────────────────────────────────

function StepValidationDemo() {
  const { form, config } = useWizard('empty');
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => <StepIndicator {...i} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions onSubmit={() => undefined}>
          {(a: any) => <UiActions {...a} className="mt-6" />}
        </FormWizard.Actions>
      </FormWizard>
    </div>
  );
}

function IndicatorDemo() {
  const { form, config } = useWizard('empty');
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard form={form} config={config} scrollToTop={false}>
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
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions onSubmit={() => undefined}>
          {(a: any) => <UiActions {...a} className="mt-4" />}
        </FormWizard.Actions>
      </FormWizard>
    </div>
  );
}

function ProgressDemo() {
  const { form, config } = useWizard('empty');
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard form={form} config={config} scrollToTop={false}>
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
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions onSubmit={() => undefined}>
          {(a: any) => <UiActions {...a} className="mt-4" />}
        </FormWizard.Actions>
      </FormWizard>
    </div>
  );
}

function ActionsRenderPropsDemo() {
  const { model, form, config } = useWizard('empty');
  const [done, setDone] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => <StepIndicator {...i} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions
          onSubmit={() => setDone('✅ Отправлено: ' + JSON.stringify(model.get()))}
        >
          {({ prev, next, submit, isFirstStep, isLastStep, isValidating }: any) => (
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
                  {isValidating ? 'Проверка…' : 'Далее'}
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

function CompoundButtonsDemo() {
  const { form, config } = useWizard('empty');
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => <StepIndicator {...i} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions
          onSubmit={() => undefined}
          className="flex gap-3"
          style={{ marginTop: 16 }}
        >
          <FormWizard.Prev>← Назад</FormWizard.Prev>
          <FormWizard.Next>Далее →</FormWizard.Next>
          <FormWizard.Submit loadingText="Отправка…">Отправить</FormWizard.Submit>
        </FormWizard.Actions>
      </FormWizard>
    </div>
  );
}

function SubmitLoadingDemo() {
  const { form, config } = useWizard('valid');
  const navRef = useRef<FormWizardHandle<WForm>>(null);
  useAdvance(navRef, 3);
  const [done, setDone] = useState<string | null>(null);
  const handleSubmit = () => {
    navRef.current?.submit(async (v) => {
      await sleep(1600);
      setDone('✅ Заявка отправлена');
      return v;
    });
  };
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard ref={navRef} form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => <StepIndicator {...i} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions
          onSubmit={handleSubmit}
          className="flex gap-3"
          style={{ marginTop: 16 }}
        >
          <FormWizard.Prev>← Назад</FormWizard.Prev>
          <FormWizard.Next>Далее →</FormWizard.Next>
          <FormWizard.Submit loadingText="⏳ Отправка…">Отправить заявку</FormWizard.Submit>
        </FormWizard.Actions>
      </FormWizard>
      {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
    </div>
  );
}

function AsChildDemo() {
  const { form, config } = useWizard('valid');
  const navRef = useRef<FormWizardHandle<WForm>>(null);
  useAdvance(navRef, 2);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard ref={navRef} form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => <StepIndicator {...i} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions
          onSubmit={() => setDone('✅ Готово')}
          className="flex gap-3"
          style={{ marginTop: 16 }}
        >
          <FormWizard.Prev asChild>
            <Button variant="outline" size="sm">
              ← Назад
            </Button>
          </FormWizard.Prev>
          <FormWizard.Next asChild>
            <Button size="sm">Далее →</Button>
          </FormWizard.Next>
          <FormWizard.Submit asChild>
            <Button size="sm">Отправить</Button>
          </FormWizard.Submit>
        </FormWizard.Actions>
      </FormWizard>
      {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
    </div>
  );
}

function RefHandleDemo() {
  const { form, config } = useWizard('valid');
  const navRef = useRef<FormWizardHandle<WForm>>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const saveAndExit = () => {
    navRef.current?.submit((v) => {
      setMsg('💾 Черновик сохранён: ' + JSON.stringify(v));
      return v;
    });
  };
  return (
    <div style={{ maxWidth: 560, width: '100%' }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Button size="sm" variant="outline" onClick={() => navRef.current?.goToNextStep()}>
          Далее ▸ (из шапки)
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            const ok = navRef.current?.goToStep(3);
            if (!ok) setMsg('Сначала заполните предыдущие шаги');
          }}
        >
          К шагу 3
        </Button>
        <Button size="sm" onClick={saveAndExit}>
          Сохранить и выйти
        </Button>
      </div>
      <FormWizard ref={navRef} form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => <StepIndicator {...i} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Progress>
          {(p: any) => <UiProgress {...p} className="mt-3" />}
        </FormWizard.Progress>
      </FormWizard>
      {msg && <p style={{ marginTop: 10, fontSize: 13 }}>{msg}</p>}
    </div>
  );
}

function OnStepChangeDemo() {
  const { form, config } = useWizard('valid');
  const [log, setLog] = useState<number[]>([1]);
  return (
    <div style={{ maxWidth: 520, width: '100%' }}>
      <FormWizard
        form={form}
        config={config}
        scrollToTop={false}
        onStepChange={(s) => setLog((l) => [...l, s])}
      >
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => <StepIndicator {...i} className="mb-6" />}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions onSubmit={() => undefined}>
          {(a: any) => <UiActions {...a} className="mt-6" />}
        </FormWizard.Actions>
      </FormWizard>
      <p style={{ marginTop: 10, fontSize: 13, color: 'var(--ifm-color-emphasis-700)' }}>
        Переходы: {log.join(' → ')}
      </p>
    </div>
  );
}

function PolymorphicBodyDemo() {
  const { form, config } = useWizard('empty');
  const navRef = useRef<FormWizardHandle<WForm>>(null);
  const [done, setDone] = useState<string | null>(null);
  return (
    <div style={{ maxWidth: 560, width: '100%' }}>
      <UiWizard
        ref={navRef}
        form={form}
        config={config}
        steps={POLY_STEPS}
        onSubmit={() => {
          navRef.current?.submit((v) => {
            setDone('✅ Отправлено');
            return v;
          });
        }}
      />
      {done && <p style={{ marginTop: 10, fontSize: 13 }}>{done}</p>}
    </div>
  );
}

function UiKitLabelsDemo() {
  const { form, config } = useWizard('empty');
  return (
    <div style={{ maxWidth: 560, width: '100%' }}>
      <FormWizard form={form} config={config} scrollToTop={false}>
        <FormWizard.Indicator steps={STEPS}>
          {(i: any) => (
            <StepIndicator
              {...i}
              navAriaLabel="Этапы заявки"
              stepAriaLabel={(s: any) => `Этап ${s.number}: ${s.title}`}
              className="mb-6"
            />
          )}
        </FormWizard.Indicator>
        <FormWizard.Step component={NameStep} control={form} />
        <FormWizard.Step component={EmailStep} control={form} />
        <FormWizard.Step component={PhoneStep} control={form} />
        <FormWizard.Actions onSubmit={() => undefined}>
          {(a: any) => (
            <UiActions
              {...a}
              prevLabel="Назад"
              nextLabel="Продолжить"
              submitLabel="Оформить заявку"
              validatingLabel="Проверяем…"
              className="mt-6"
            />
          )}
        </FormWizard.Actions>
        <FormWizard.Progress>
          {(p: any) => (
            <UiProgress
              {...p}
              format={({ current, total }: any) => `Этап ${current} из ${total}`}
              className="mt-3"
            />
          )}
        </FormWizard.Progress>
      </FormWizard>
    </div>
  );
}

// ─── Doc config ─────────────────────────────────────────────────────────────

export const formWizardDocConfig: ComponentDocConfig = {
  name: 'FormWizard',
  importFrom: '@reformer/cdk/form-wizard',
  description:
    'Headless compound-оркестратор многошаговой формы. Variants — структурные формы сборки мастера (полная композиция слотов, минимальная композиция, декларативная ui-kit-обёртка); Examples — рецепты возможностей (config-валидация, render-props слоты, compound-кнопки, asChild, ref-handle, полиморфное тело шага, кастомные подписи).',
  variants: [
    {
      id: 'full-composition',
      title: 'Полная композиция (default)',
      description:
        'Дефолтная форма: все четыре compound-слота собраны вручную — Indicator + Step(×N) + Actions + Progress. Максимальный контроль над раскладкой мастера.',
      render: FullComposition,
      code: `<FormWizard form={form} config={config}>
  <FormWizard.Indicator steps={STEPS}>
    {(ind) => <StepIndicator {...ind} />}
  </FormWizard.Indicator>
  <FormWizard.Step component={NameStep} control={form} />
  <FormWizard.Step component={EmailStep} control={form} />
  <FormWizard.Step component={PhoneStep} control={form} />
  <FormWizard.Actions onSubmit={handleSubmit}>
    {(a) => <FormWizardActions {...a} />}
  </FormWizard.Actions>
  <FormWizard.Progress>
    {(p) => <FormWizardProgress {...p} />}
  </FormWizard.Progress>
</FormWizard>`,
    },
    {
      id: 'minimal-composition',
      title: 'Минимальная композиция',
      description:
        'Только Step + Actions, без Indicator и Progress — голый собранный мастер. Наличие степпера/прогресса — композиционная настройка, а не отдельный компонент.',
      render: MinimalComposition,
      code: `<FormWizard form={form} config={config}>
  <FormWizard.Step component={Step1} control={form} />
  <FormWizard.Step component={Step2} control={form} />
  <FormWizard.Actions onSubmit={handleSubmit}>
    <FormWizard.Prev>Назад</FormWizard.Prev>
    <FormWizard.Next>Далее</FormWizard.Next>
    <FormWizard.Submit>Готово</FormWizard.Submit>
  </FormWizard.Actions>
</FormWizard>`,
    },
    {
      id: 'declarative-uikit',
      title: 'Декларативная ui-kit-обёртка',
      description:
        'Та же форма мастера, собранная одним `<FormWizard steps={STEPS} onSubmit={...} />` из @reformer/ui-kit — весь layout (Indicator + Steps + Actions + Progress) свёрнут в проп-массив steps.',
      render: DeclarativeUiKit,
      code: `import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

const STEPS: FormWizardStep<WForm>[] = [
  { number: 1, title: 'Имя', icon: '👤', body: NameStep },
  { number: 2, title: 'Email', icon: '✉️', body: EmailStep },
  { number: 3, title: 'Телефон', icon: '📞', body: PhoneStep },
];

<FormWizard form={form} config={config} steps={STEPS} onSubmit={onSubmit} />`,
    },
  ],
  examples: [
    {
      id: 'step-validation',
      title: 'Пошаговая валидация (config)',
      description:
        '«Далее» не переводит, пока текущий шаг невалиден; submit проходит только после validateAll. Оба колбэка — из validateFormModel.',
      render: StepValidationDemo,
      code: `const config: FormWizardConfig = {
  validateStep: (step) =>
    validateFormModel(model, step === 1 ? step1Schema : step2Schema).then((r) => r.valid),
  validateAll: () => validateFormModel(model, fullSchema).then((r) => r.valid),
};

<FormWizard form={form} config={config}>
  <FormWizard.Step component={Step1} control={form} />
  <FormWizard.Step component={Step2} control={form} />
  <FormWizard.Actions onSubmit={handleSubmit}>{/* ... */}</FormWizard.Actions>
</FormWizard>`,
    },
    {
      id: 'indicator',
      title: 'Indicator — кастомный степпер',
      description:
        'Кликабельный индикатор из steps со статусами isCurrent / isCompleted / canNavigate и функцией goToStep.',
      render: IndicatorDemo,
      code: `<FormWizard.Indicator steps={STEPS}>
  {({ steps, goToStep }) =>
    steps.map((s) => (
      <button key={s.number} onClick={() => goToStep(s.number)} disabled={!s.canNavigate}
        aria-current={s.isCurrent ? 'step' : undefined}>
        {s.isCompleted ? '✓' : s.number} {s.title}
      </button>
    ))
  }
</FormWizard.Indicator>`,
    },
    {
      id: 'progress',
      title: 'Progress — кастомный прогресс-бар',
      description: 'Своя визуализация прогресса из current / total / percent / completedCount.',
      render: ProgressDemo,
      code: `<FormWizard.Progress>
  {({ current, total, percent }) => (
    <div>
      <div>Шаг {current} из {total}</div>
      <div className="track"><div className="bar" style={{ width: percent + '%' }} /></div>
    </div>
  )}
</FormWizard.Progress>`,
    },
    {
      id: 'actions-render-props',
      title: 'Actions в режиме render-props',
      description:
        'Полный контроль разметки кнопок из { prev, next, submit, isFirstStep, isLastStep, isValidating, isSubmitting }.',
      render: ActionsRenderPropsDemo,
      code: `<FormWizard.Actions onSubmit={handleSubmit}>
  {({ prev, next, submit, isFirstStep, isLastStep, isValidating }) => (
    <div className="row">
      <Button onClick={prev.onClick} disabled={prev.disabled || isFirstStep}>Назад</Button>
      {!isLastStep
        ? <Button onClick={next.onClick} disabled={next.disabled}>{isValidating ? 'Проверка…' : 'Далее'}</Button>
        : <Button onClick={submit.onClick} disabled={submit.disabled}>Отправить</Button>}
    </div>
  )}
</FormWizard.Actions>`,
    },
    {
      id: 'compound-buttons',
      title: 'Compound-кнопки Prev / Next / Submit',
      description:
        'Декларативные кнопки с авто-disabled логикой (первый / последний шаг, валидация, submit) без ручного wiring.',
      render: CompoundButtonsDemo,
      code: `<FormWizard.Actions onSubmit={handleSubmit} className="flex gap-3">
  <FormWizard.Prev>← Назад</FormWizard.Prev>
  <FormWizard.Next>Далее →</FormWizard.Next>
  <FormWizard.Submit loadingText="Отправка…">Отправить</FormWizard.Submit>
</FormWizard.Actions>`,
    },
    {
      id: 'submit-loading',
      title: 'Submit с индикатором отправки',
      description:
        'Во время isSubmitting контент Submit подменяется на loadingText (спиннер / «Отправка...»), кнопка disabled.',
      render: SubmitLoadingDemo,
      code: `const handleSubmit = () =>
  navRef.current?.submit(async (values) => {
    await api.submit(values); // isSubmitting = true на время запроса
  });

<FormWizard.Submit loadingText="⏳ Отправка…">Отправить заявку</FormWizard.Submit>`,
    },
    {
      id: 'as-child',
      title: 'asChild — своя кнопка навигации',
      description:
        'Проброс onClick / disabled / type в кастомный компонент кнопки (иконки, варианты, свой Button) через Slot.',
      render: AsChildDemo,
      code: `<FormWizard.Prev asChild>
  <Button variant="outline" size="sm">← Назад</Button>
</FormWizard.Prev>
<FormWizard.Next asChild>
  <Button size="sm">Далее →</Button>
</FormWizard.Next>
<FormWizard.Submit asChild>
  <Button size="sm">Отправить</Button>
</FormWizard.Submit>`,
    },
    {
      id: 'ref-handle',
      title: 'Внешнее управление через ref',
      description:
        'useRef<FormWizardHandle> — инициировать submit() / goToStep() / goToNextStep() из шапки или breadcrumbs вне дерева мастера.',
      render: RefHandleDemo,
      code: `const navRef = useRef<FormWizardHandle<WForm>>(null);

const saveAndExit = () => navRef.current?.submit((values) => api.saveDraft(values));

<header>
  <button onClick={() => navRef.current?.goToNextStep()}>Далее</button>
  <button onClick={saveAndExit}>Сохранить и выйти</button>
</header>
<FormWizard ref={navRef} form={form} config={config}>{/* ...шаги... */}</FormWizard>`,
    },
    {
      id: 'on-step-change',
      title: 'Реакция на смену шага + автоскролл',
      description:
        'onStepChange — хук на смену шага (аналитика, фокус-менеджмент); scrollToTop управляет автопрокруткой вверх.',
      render: OnStepChangeDemo,
      code: `<FormWizard
  form={form}
  config={config}
  scrollToTop={false}
  onStepChange={(step) => analytics.track('wizard_step', { step })}
>
  {/* ...шаги... */}
</FormWizard>`,
    },
    {
      id: 'polymorphic-body',
      title: 'Полиморфное тело шага (ui-kit)',
      description:
        'step.body может быть FC (control={form}), готовым ReactNode или RenderNode — один мастер покрывает TS-flow, renderer-react и renderer-json.',
      render: PolymorphicBodyDemo,
      code: `import { FormWizard, type FormWizardStep } from '@reformer/ui-kit/form-wizard';

const STEPS: FormWizardStep<WForm>[] = [
  { number: 1, title: 'Имя', icon: '👤', body: NameStep },        // ComponentType<{ control }>
  { number: 2, title: 'Email', icon: '✉️', body: EmailStep },     // FC
  { number: 3, title: 'Готово', icon: '✓', body: <Summary /> },   // ReactNode
];

<FormWizard form={form} config={config} steps={STEPS} onSubmit={onSubmit} />`,
    },
    {
      id: 'uikit-labels',
      title: 'Кастомные подписи и aria (ui-kit)',
      description:
        'Переопределение user-facing строк кнопок (prevLabel / nextLabel / submitLabel), формата прогресса (format) и a11y-меток индикатора (navAriaLabel / stepAriaLabel).',
      render: UiKitLabelsDemo,
      code: `<FormWizard.Indicator steps={STEPS}>
  {(ind) => <StepIndicator {...ind} navAriaLabel="Этапы заявки" stepAriaLabel={(s) => \`Этап \${s.number}: \${s.title}\`} />}
</FormWizard.Indicator>

<FormWizard.Actions onSubmit={onSubmit}>
  {(a) => <FormWizardActions {...a} prevLabel="Назад" nextLabel="Продолжить" submitLabel="Оформить заявку" />}
</FormWizard.Actions>

<FormWizard.Progress>
  {(p) => <FormWizardProgress {...p} format={({ current, total }) => \`Этап \${current} из \${total}\`} />}
</FormWizard.Progress>`,
    },
  ],
  props: [
    {
      name: 'FormWizard',
      type: 'form, config, onStepChange?, scrollToTop?',
      description:
        'Root-провайдер. config = { validateStep?, validateAll? } — колбэки, возвращающие boolean | Promise<boolean>. ref → FormWizardHandle (submit / goToStep / …).',
    },
    {
      name: 'FormWizard.Step',
      type: 'component, control | children',
      description: 'Рендерит компонент шага (или children), когда шаг текущий.',
    },
    {
      name: 'FormWizard.Actions',
      type: 'onSubmit, children',
      description:
        'Навигация: render-props ({ prev, next, submit, isFirstStep, isLastStep, isValidating, isSubmitting }) или compound-кнопки.',
    },
    {
      name: 'FormWizard.Prev / Next / Submit',
      type: 'children, asChild?, disabled?, loadingText?',
      description:
        'Compound-кнопки внутри Actions с авто-disabled. asChild пробрасывает props в свой элемент через Slot; loadingText (Submit) — контент во время отправки.',
    },
    {
      name: 'FormWizard.Indicator',
      type: 'steps, children',
      description:
        'Headless индикатор (render-props: steps со статусами isCurrent / isCompleted / canNavigate, goToStep, currentStep, totalSteps, completedSteps).',
    },
    {
      name: 'FormWizard.Progress',
      type: 'children',
      description:
        'Headless прогресс (render-props: current, total, percent, completedCount, isFirstStep, isLastStep).',
    },
    {
      name: 'FormWizardHandle (ref)',
      type: 'submit, goToStep, goToNextStep, goToPreviousStep, validateCurrentStep, …',
      description: 'Императивный API для управления мастером снаружи его дерева.',
    },
  ],
};
