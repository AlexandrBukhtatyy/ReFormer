/**
 * Credit application wizard on React Hook Form + zod (zodResolver). Same markup and primitives as the
 * baseline page; see ../README.md for the docs behind every pattern used here.
 *
 * One `useForm` holds all six steps (RHF multi-step guide, "one form, several steps"): inactive steps
 * are unmounted and keep their values (`shouldUnregister: false`); "Далее" validates the current
 * step with `trigger(stepFields)`; "Отправить" is `handleSubmit`, which validates the whole form.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { FormProvider, useForm, type FieldErrors } from 'react-hook-form';
import { creditApi } from '../../../shared/api/credit-client';
import { serverConfig } from '../../../shared/api/server';
import {
  CREDIT_INITIAL_INPUT,
  CREDIT_STEPS,
  toCreditPayload,
  type CreditInput,
} from '../../../shared/domain/credit';
import { WizardShell } from '../../../shared/ui/wizard';
import { Page, SubmitResult } from '../../../shared/ui/layout';
import { creditResolver } from './schema';
import {
  AdditionalStep,
  ConfirmationStep,
  ContactsStep,
  EmploymentStep,
  LoanStep,
  PersonalStep,
  type Dictionaries,
} from './steps';

/**
 * Default values: empty, or — `?application=1` — an async `defaultValues` function loading the saved
 * application. A rejected promise would leave `isLoading` stuck, so a failed load falls back to the
 * empty form (useForm docs, `defaultValues`).
 */
function creditDefaults(applicationId: string | null): CreditInput | (() => Promise<CreditInput>) {
  if (!applicationId) return CREDIT_INITIAL_INPUT;
  return async () => {
    try {
      return await creditApi.getApplication(applicationId);
    } catch {
      return CREDIT_INITIAL_INPUT;
    }
  };
}

const defaultValues = creditDefaults(serverConfig.application);

const NO_DICTIONARIES: Dictionaries = { regions: [], propertyTypes: [] };

/** Region and property-type options: loaded once at start, in parallel with the application. */
function useDictionaries(): Dictionaries {
  const [dictionaries, setDictionaries] = useState(NO_DICTIONARIES);
  useEffect(() => {
    let current = true;
    Promise.all([creditApi.getDictionaries(), creditApi.getRegions()]).then(
      ([{ propertyTypes }, regions]) => {
        if (current) setDictionaries({ regions, propertyTypes });
      },
      () => {}
    );
    return () => {
      current = false;
    };
  }, []);
  return dictionaries;
}

/** First step (1-based) holding one of `errors`' fields; `0` — none. */
const firstStepWith = (errors: FieldErrors<CreditInput>): number =>
  CREDIT_STEPS.findIndex((s) => s.keys.some((key) => key in errors)) + 1;

export function CreditForm() {
  const [step, setStep] = useState(1);
  /** Steps where "Далее" was pressed at least once: their fields re-validate on every change. */
  const [checkedSteps, setCheckedSteps] = useState<ReadonlySet<number>>(() => new Set());
  const [result, setResult] = useState<string | null>(null);
  const { regions, propertyTypes } = useDictionaries();

  const methods = useForm<CreditInput>({
    defaultValues,
    resolver: creditResolver,
    // Contract "afterFirstSubmit" per step: quiet until the step's first "Далее" (`onSubmit` does not
    // validate before a submit), then every change re-validates (`onChange`). `mode` is reactive.
    // After the final submit `reValidateMode: 'onChange'` (default) keeps all steps live.
    mode: checkedSteps.has(step) ? 'onChange' : 'onSubmit',
    shouldUnregister: false,
    shouldFocusError: false,
  });
  const {
    handleSubmit,
    trigger,
    formState: { isLoading },
  } = methods;
  const isLast = step === CREDIT_STEPS.length;

  const next = async () => {
    // `trigger` validates with the whole schema but updates only this step's fields.
    const valid = await trigger(CREDIT_STEPS[step - 1].keys);
    setCheckedSteps((steps) => (steps.has(step) ? steps : new Set(steps).add(step)));
    if (valid) setStep(step + 1);
  };

  const onNext = (event: FormEvent) => {
    event.preventDefault();
    void next();
  };

  const onValid = async (values: CreditInput) => {
    const { message } = await creditApi.submitApplication(toCreditPayload(values));
    setResult(message);
  };

  // A field of an earlier step can fail a cross-step rule: show the first step with an error.
  const onInvalid = (errors: FieldErrors<CreditInput>) => {
    const first = firstStepWith(errors);
    if (first) setStep(first);
  };

  return (
    <Page title="Заявка на кредит">
      {/* Async defaults: controlled fields must not mount with `undefined` (useController docs). */}
      {isLoading ? null : (
        <FormProvider {...methods}>
          <form noValidate onSubmit={isLast ? handleSubmit(onValid, onInvalid) : onNext}>
            <WizardShell step={step} steps={CREDIT_STEPS} onPrev={() => setStep(step - 1)}>
              {step === 1 ? <LoanStep /> : null}
              {step === 2 ? <PersonalStep /> : null}
              {step === 3 ? <ContactsStep regions={regions} /> : null}
              {step === 4 ? <EmploymentStep /> : null}
              {step === 5 ? <AdditionalStep propertyTypes={propertyTypes} /> : null}
              {step === 6 ? <ConfirmationStep /> : null}
            </WizardShell>
            {result ? <SubmitResult>{result}</SubmitResult> : null}
          </form>
        </FormProvider>
      )}
    </Page>
  );
}
