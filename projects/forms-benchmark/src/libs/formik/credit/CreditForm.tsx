/**
 * Formik + Yup, credit application: Formik's MultistepWizard example. One `<Formik>` holds the
 * values of all six steps; its `validationSchema` is the current step's schema; «Далее» submits the
 * step and `onSubmit` moves on (only valid input passes), «Назад» just moves back. Only the current
 * step is mounted; values of the others stay in Formik. «Отправить» also re-checks the earlier
 * steps and sends the user back to the first invalid one.
 *
 * Errors are revealed per step (BENCH-CONTRACT §3): `StepAttempts` gives the kit the number of
 * submit attempts on the current step. Computed values C.1–C.8 live in Formik values and are kept
 * up to date by an effect (`CreditCalculations`). Dictionaries and regions are loaded once at
 * start, `?application=1` becomes the initial values (`enableReinitialize`), the server response is
 * kept in Formik `status`.
 */
import { Children, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Form, Formik, useFormikContext, validateYupSchema, type FormikHelpers } from 'formik';
import { ValidationError, type AnyObjectSchema } from 'yup';
import { creditApi, type SubmitApplicationResult } from '../../../shared/api/credit-client';
import { serverConfig } from '../../../shared/api/server';
import {
  COMPUTED_LABELS,
  CREDIT_INITIAL,
  CREDIT_STEPS,
  computeCredit,
  toCreditPayload,
  type CreditComputed,
  type CreditValues,
} from '../../../shared/domain/credit';
import { Page, SubmitResult } from '../../../shared/ui/layout';
import { WizardShell } from '../../../shared/ui/wizard';
import { SubmitAttempts } from '../kit/binding';
import { CreditOptions, type CreditOptionsValue } from './fields';
import { CREDIT_STEP_SCHEMAS } from './schema';
import {
  AdditionalStep,
  ConfirmationStep,
  ContactsStep,
  EmploymentStep,
  LoanStep,
  PersonalStep,
} from './steps';

// ── Wizard (Formik's MultistepWizard example) ────────────────────────────────
interface WizardStepProps {
  validationSchema: AnyObjectSchema;
  children: ReactNode;
}

/** A page of the wizard; `Wizard` reads its `validationSchema`. */
const WizardStep = ({ children }: WizardStepProps) => children;

interface WizardProps {
  initialValues: CreditValues;
  onSubmit: (values: CreditValues, bag: FormikHelpers<CreditValues>) => Promise<void>;
  children: ReactNode;
}

/**
 * Index of the first schema that rejects `values`, or -1. Each schema is checked through Formik's
 * own Yup adapter (`validateYupSchema`: `''` → `undefined`, `abortEarly: false`), so a step is
 * judged exactly as its `validationSchema` judges it.
 */
async function firstInvalid(values: CreditValues, schemas: AnyObjectSchema[]): Promise<number> {
  const valid = await Promise.all(
    schemas.map((schema) =>
      validateYupSchema(values, schema).then(
        () => true,
        (error: unknown) => {
          if (ValidationError.isError(error)) return false;
          throw error;
        }
      )
    )
  );
  return valid.indexOf(false);
}

function Wizard({ initialValues, onSubmit, children }: WizardProps) {
  const [stepNumber, setStepNumber] = useState(0);
  const steps = Children.toArray(children) as ReactElement<WizardStepProps>[];
  const step = steps[stepNumber];
  const isLastStep = stepNumber === steps.length - 1;
  /** Set when «Отправить» sends the user back to an invalid step: submit it once it is on screen. */
  const resubmit = useRef<FormikHelpers<CreditValues>['submitForm'] | null>(null);

  // A forward transition is a submit of the current step: Formik calls this only for valid input.
  const handleSubmit = async (values: CreditValues, bag: FormikHelpers<CreditValues>) => {
    if (!isLastStep) {
      setStepNumber(stepNumber + 1);
      return;
    }
    // «Отправить» checks every step (BENCH-CONTRACT §8): Formik has validated this one, the
    // earlier ones are checked with their own schemas — a cross-step rule may have gone stale.
    const invalid = await firstInvalid(
      values,
      steps.slice(0, stepNumber).map((s) => s.props.validationSchema)
    );
    if (invalid === -1) return onSubmit(values, bag);
    resubmit.current = bag.submitForm;
    setStepNumber(invalid);
  };

  // The step that failed is on screen with its own schema: submitting it is the «Далее» that
  // validates the step and reveals its errors (the kit's reveal rule counts submit attempts).
  useEffect(() => {
    const submit = resubmit.current;
    resubmit.current = null;
    submit?.().catch((reason: unknown) => console.warn(reason));
  }, [stepNumber]);

  return (
    <Formik
      initialValues={initialValues}
      enableReinitialize
      validationSchema={step.props.validationSchema}
      onSubmit={handleSubmit}
    >
      <Form noValidate>
        <StepAttempts step={stepNumber}>
          {/* No `onNext`: «Далее» is `type="submit"`, `<Form>` routes it to `handleSubmit`. */}
          <WizardShell
            step={stepNumber + 1}
            steps={CREDIT_STEPS}
            onPrev={() => setStepNumber(stepNumber - 1)}
          >
            {step}
          </WizardShell>
        </StepAttempts>
        <CreditCalculations />
        <CreditResult />
      </Form>
    </Formik>
  );
}

/**
 * Submit attempts on the current step, for the kit's reveal rule: errors appear after the first
 * «Далее» on THIS step. Formik's `submitCount` counts for the whole form, so its value at the
 * step's entry is subtracted (state adjusted while rendering when the step changes — react.dev,
 * «Adjusting some state when a prop changes»).
 */
function StepAttempts({ step, children }: { step: number; children: ReactNode }) {
  const { submitCount } = useFormikContext();
  const [entry, setEntry] = useState({ step, submitCount });
  if (entry.step !== step) setEntry({ step, submitCount });
  return (
    <SubmitAttempts.Provider value={submitCount - entry.submitCount}>
      {children}
    </SubmitAttempts.Provider>
  );
}

// ── Computed values ──────────────────────────────────────────────────────────
const COMPUTED_KEYS = Object.keys(COMPUTED_LABELS) as (keyof CreditComputed)[];

/**
 * C.1–C.8 (shared formulas) kept in Formik values, as in Formik's dependent-fields example: an
 * effect stores what changed with `setFieldValue(name, value, false)`. A computed value has no
 * rules of its own (the 50 % limit of C.7 is a rule of `monthlyIncome`), so it skips validation.
 */
function CreditCalculations() {
  const { values, setFieldValue } = useFormikContext<CreditValues>();
  const computed = computeCredit(values);
  useEffect(() => {
    for (const key of COMPUTED_KEYS) {
      if (values[key] !== computed[key]) void setFieldValue(key, computed[key], false);
    }
  });
  return null;
}

function CreditResult() {
  const { status } = useFormikContext<CreditValues>();
  const result = status as SubmitApplicationResult | undefined;
  return result ? <SubmitResult>{result.message}</SubmitResult> : null;
}

// ── Form ─────────────────────────────────────────────────────────────────────
async function submitApplication(
  values: CreditValues,
  { setStatus }: FormikHelpers<CreditValues>
): Promise<void> {
  setStatus(await creditApi.submitApplication(toCreditPayload(values)));
}

export function CreditForm() {
  const [initialValues, setInitialValues] = useState<CreditValues>(CREDIT_INITIAL);
  const [options, setOptions] = useState<CreditOptionsValue>({ regions: [], propertyTypes: [] });

  useEffect(() => {
    let active = true;
    void creditApi.getDictionaries().then(({ propertyTypes }) => {
      if (active) setOptions((o) => ({ ...o, propertyTypes }));
    });
    void creditApi.getRegions().then((regions) => {
      if (active) setOptions((o) => ({ ...o, regions }));
    });
    const { application } = serverConfig;
    if (application) {
      void creditApi.getApplication(application).then((values) => {
        if (active) setInitialValues(values);
      });
    }
    return () => {
      active = false;
    };
  }, []);

  return (
    <Page title="Заявка на кредит">
      <CreditOptions.Provider value={options}>
        <Wizard initialValues={initialValues} onSubmit={submitApplication}>
          <WizardStep validationSchema={CREDIT_STEP_SCHEMAS[0]}>
            <LoanStep />
          </WizardStep>
          <WizardStep validationSchema={CREDIT_STEP_SCHEMAS[1]}>
            <PersonalStep />
          </WizardStep>
          <WizardStep validationSchema={CREDIT_STEP_SCHEMAS[2]}>
            <ContactsStep />
          </WizardStep>
          <WizardStep validationSchema={CREDIT_STEP_SCHEMAS[3]}>
            <EmploymentStep />
          </WizardStep>
          <WizardStep validationSchema={CREDIT_STEP_SCHEMAS[4]}>
            <AdditionalStep />
          </WizardStep>
          <WizardStep validationSchema={CREDIT_STEP_SCHEMAS[5]}>
            <ConfirmationStep />
          </WizardStep>
        </Wizard>
      </CreditOptions.Provider>
    </Page>
  );
}
