/**
 * Credit application on RJSF 6 + ajv8, bench theme — a six-step wizard.
 *
 * RJSF has no wizard: each step is its own `<Form>` (own schema, uiSchema, validation hooks) over
 * that step's slice of the page values, remounted per step (`key`), so inactive steps are unmounted
 * and the values live in the page. «Далее» is the step form's submit: `onSubmit` (the step's rules
 * passed) moves on, `onError` stays. The form is controlled (`formData` + `onChange(data, id)`): the
 * page merges the step's data back and applies the shared behaviour tables — dependent resets,
 * copies, computed values — which the next render hands back to the form.
 *
 * - Validation reveal per step: quiet until the step's first «Далее», then `liveValidate="onChange"`.
 *   A field that comes on screen in the live phase stays quiet until changed or the next «Далее»
 *   (`formContext.quiet`, read by the theme).
 * - Server data: dictionaries and regions once at start (with the application for
 *   `?application=1`); cities and car models when the region / brand changes — all through
 *   `creditApi` (it debounces and caches itself), handed to the widgets in `formContext.options`.
 * - SMS code: the server check is the documented `extraErrors`, blocking with
 *   `extraErrorsBlockSubmit`; submit waits for it, then posts `toCreditPayload(values)`.
 * - «Отправить» checks all steps (BENCH-CONTRACT §8): the earlier, unmounted steps through the
 *   validator (`firstInvalidStep`); the first one with errors is opened and its Form validated with
 *   `validateForm()`, nothing is posted.
 */
import { useEffect, useRef, useState } from 'react';
import type Form from '@rjsf/core';
import type { IChangeEvent } from '@rjsf/core';
import type {
  CustomValidator,
  ErrorSchema,
  RJSFSchema,
  RJSFValidationError,
  UiSchema,
} from '@rjsf/utils';
import { ErrorSchemaBuilder } from '@rjsf/utils';
import validator from '@rjsf/validator-ajv8';
import { creditApi } from '../../../shared/api/credit-client';
import { serverConfig } from '../../../shared/api/server';
import {
  CREDIT_INITIAL_INPUT,
  CREDIT_STEPS,
  toCreditPayload,
  type CreditInput,
  type Option,
} from '../../../shared/domain/credit';
import { msg } from '../../../shared/messages/credit';
import { Page, SubmitResult } from '../../../shared/ui/layout';
import { StepIndicator, WizardNav } from '../../../shared/ui/wizard';
import { BenchForm, type BenchFormContext } from '../theme';
import {
  applyStepData,
  initialFormData,
  nextQuiet,
  revealStep,
  stepData,
  stepKeys,
  type CreditFormData,
  type StepData,
} from './data';
import {
  additionalSchema,
  confirmationSchema,
  contactsSchema,
  employmentSchema,
  loanSchema,
  personalSchema,
} from './schemas';
import {
  additionalUi,
  confirmationUi,
  contactsUi,
  employmentUi,
  loanUi,
  personalUi,
} from './uiSchemas';
import {
  fieldOf,
  transformErrors,
  validateAdditional,
  validateEmployment,
  validateLoan,
  validatePersonal,
} from './validation';

interface StepForm {
  schema: RJSFSchema;
  uiSchema: UiSchema;
  customValidate?: CustomValidator<StepData>;
}

/** The step forms in order (`CREDIT_STEPS[i]` — titles, fields, keys). */
const STEP_FORMS: readonly StepForm[] = [
  { schema: loanSchema, uiSchema: loanUi, customValidate: validateLoan },
  { schema: personalSchema, uiSchema: personalUi, customValidate: validatePersonal },
  { schema: contactsSchema, uiSchema: contactsUi },
  { schema: employmentSchema, uiSchema: employmentUi, customValidate: validateEmployment },
  { schema: additionalSchema, uiSchema: additionalUi, customValidate: validateAdditional },
  { schema: confirmationSchema, uiSchema: confirmationUi },
];
const STEP_KEYS = CREDIT_STEPS.map(stepKeys);
const LAST_STEP = CREDIT_STEPS.length;

/**
 * «Отправить» checks every step (BENCH-CONTRACT §8): the first earlier step whose rules fail on the
 * current values, or `undefined`. The earlier steps are unmounted, so each is validated the way its
 * `<Form>` validates on submit — `validateFormData` of the shared validator with the step's schema,
 * `customValidate`, `transformErrors` and uiSchema, on data with absent fields dropped (as
 * `Form.validate` does). The page keeps C.1–C.8 current for all steps, so a cross-step rule that
 * went stale (step 4's payment ratio after step 5 changed the rate) fails here.
 */
function firstInvalidStep(values: CreditFormData): number | undefined {
  for (let i = 0; i < LAST_STEP - 1; i++) {
    const { schema, uiSchema, customValidate } = STEP_FORMS[i];
    const data = JSON.parse(JSON.stringify(stepData(values, STEP_KEYS[i]))) as StepData;
    const { errors } = validator.validateFormData(
      data,
      schema,
      customValidate,
      transformErrors,
      uiSchema
    );
    if (errors.length > 0) return i + 1;
  }
  return undefined;
}

/** The SMS code — the one server-checked field (step 6), and its server verdict as `extraErrors`. */
const SMS_INVALID = msg('electronicSignature.invalid');
const SMS_ERRORS = new ErrorSchemaBuilder().addErrors(
  SMS_INVALID,
  'electronicSignature'
).ErrorSchema;

/** The code passed its sync rules: the errors RJSF reports, without the server's own (stale) verdict. */
const smsPassesSyncRules = (errors: RJSFValidationError[]) =>
  !errors.some((e) => fieldOf(e) === 'electronicSignature' && e.message !== SMS_INVALID);

/** Contract path of an RJSF field id (`idPrefix` `root`, `idSeparator` `-`). */
const pathOfId = (id: string | undefined) => id?.slice('root-'.length);

const NO_OPTIONS: Option[] = [];
const NOTHING = new Set<never>();

interface Dictionaries {
  regions: Option[];
  propertyTypes: Option[];
}

/**
 * Options loaded for `key` (a region, a car brand); `[]` while none. `load` is the shared client —
 * `undefined` from it means «superseded by a newer value», which leaves the list alone.
 */
function useRemoteOptions(
  key: string,
  load: (key: string) => Promise<Option[] | undefined>
): Option[] {
  const [loaded, setLoaded] = useState<{ key: string; options: Option[] }>();
  useEffect(() => {
    if (!key) return;
    let active = true;
    void load(key).then((options) => {
      if (active && options) setLoaded({ key, options });
    });
    return () => {
      active = false;
    };
  }, [key, load]);
  return loaded?.key === key ? loaded.options : NO_OPTIONS;
}

/** Loads the dictionaries (and the application) once; the wizard mounts with its initial values. */
export function CreditForm() {
  const { application } = serverConfig;
  const [initial, setInitial] = useState(() =>
    application ? undefined : initialFormData(CREDIT_INITIAL_INPUT)
  );
  const [dictionaries, setDictionaries] = useState<Dictionaries>({
    regions: NO_OPTIONS,
    propertyTypes: NO_OPTIONS,
  });

  useEffect(() => {
    let active = true;
    void creditApi.getRegions().then((regions) => {
      if (active) setDictionaries((d) => ({ ...d, regions }));
    });
    void creditApi.getDictionaries().then(({ propertyTypes }) => {
      if (active) setDictionaries((d) => ({ ...d, propertyTypes }));
    });
    if (application) {
      void creditApi.getApplication(application).then((values) => {
        if (active) setInitial(initialFormData(values));
      });
    }
    return () => {
      active = false;
    };
  }, [application]);

  return (
    <Page title="Заявка на кредит">
      {initial ? <CreditWizard initial={initial} dictionaries={dictionaries} /> : null}
    </Page>
  );
}

function CreditWizard({
  initial,
  dictionaries,
}: {
  initial: CreditFormData;
  dictionaries: Dictionaries;
}) {
  const [values, setValues] = useState(initial);
  /** Latest values, ahead of the render: RJSF may report several changes before the page re-renders. */
  const latest = useRef(initial);
  const [step, setStep] = useState(1);
  /** Steps where «Далее» has been pressed: validation is live there. */
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(NOTHING);
  const [quiet, setQuiet] = useState<ReadonlySet<string>>(NOTHING);
  const [smsErrors, setSmsErrors] = useState<ErrorSchema>();
  const [result, setResult] = useState<string>();
  /** The mounted step's `<Form>`, for the documented `validateForm()`. */
  const formRef = useRef<Form<StepData>>(null);
  /** «Отправить» moved to an earlier step with errors: validate that step's Form once it has mounted. */
  const validateOnMount = useRef(false);

  useEffect(() => {
    if (!validateOnMount.current) return;
    validateOnMount.current = false;
    // Shows the step's errors and reports them to `onError`, as its own «Далее» would.
    formRef.current?.validateForm();
  }, [step]);

  const carModels = useRemoteOptions(values.carBrand ?? '', creditApi.getCarModels);
  const registrationCities = useRemoteOptions(
    values.registrationAddress?.region ?? '',
    creditApi.getCities
  );
  const residenceCities = useRemoteOptions(
    values.residenceAddress?.region ?? '',
    creditApi.getCities
  );

  const formContext: BenchFormContext = {
    options: {
      regions: dictionaries.regions,
      propertyTypes: dictionaries.propertyTypes,
      carModel: carModels,
      'registrationAddress.city': registrationCities,
      'residenceAddress.city': residenceCities,
    },
    quiet,
  };

  const current = CREDIT_STEPS[step - 1];
  const keys = STEP_KEYS[step - 1];
  const { schema, uiSchema, customValidate } = STEP_FORMS[step - 1];
  const live = revealed.has(step);

  /** Server check of the code; a verdict counts only while the code is still in the field. */
  const checkSms = async (code: string) => {
    const ok = await creditApi.verifySmsCode(code);
    // `undefined` — superseded by a newer code: no verdict.
    if (ok !== undefined && latest.current.electronicSignature === code) {
      setSmsErrors(ok ? undefined : SMS_ERRORS);
    }
    return ok !== false;
  };

  /** «Далее» (or «Отправить») was pressed on this step: its validation is live, nothing is quiet. */
  const reveal = () => {
    setRevealed((r) => (r.has(step) ? r : new Set(r).add(step)));
    setQuiet((q) => revealStep(q, current));
  };

  /** `id` — the field the user changed (the array's id for a row added or removed). */
  const handleChange = ({ formData = {}, errors }: IChangeEvent<StepData>, id?: string) => {
    const prev = latest.current;
    const next = applyStepData(prev, keys, formData);
    latest.current = next;
    setValues(next);
    if (!live) return;
    setQuiet((q) => nextQuiet(q, current, prev, next, pathOfId(id)));
    const code = next.electronicSignature;
    if (step === LAST_STEP && code !== prev.electronicSignature) {
      // The verdict belonged to the previous code.
      setSmsErrors(undefined);
      if (code !== undefined && smsPassesSyncRules(errors)) void checkSms(code);
    }
  };

  /**
   * «Отправить» checks every step: an earlier step with errors is opened and validated (its errors
   * shown) instead of submitting. `true` — moved there.
   */
  const toFirstInvalidStep = () => {
    const invalid = firstInvalidStep(latest.current);
    if (invalid === undefined) return false;
    validateOnMount.current = true;
    setStep(invalid);
    return true;
  };

  /** The step has errors (or a standing server verdict): show them; check the code if it is due. */
  const handleError = (errors: RJSFValidationError[]) => {
    reveal();
    if (step !== LAST_STEP || toFirstInvalidStep()) return;
    const code = latest.current.electronicSignature;
    if (code !== undefined && smsPassesSyncRules(errors)) void checkSms(code);
  };

  /**
   * The step's rules passed: next step, or — on the last — every earlier step valid, then wait for
   * the code check and submit.
   */
  const handleSubmit = async () => {
    reveal();
    if (step < LAST_STEP) {
      setStep(step + 1);
      return;
    }
    if (toFirstInvalidStep()) return;
    const code = latest.current.electronicSignature;
    if (code === undefined || !(await checkSms(code))) return;
    // The schemas have proved every visible field filled; the normalizer reads absent as empty.
    const payload = toCreditPayload(latest.current as unknown as CreditInput);
    const { message } = await creditApi.submitApplication(payload);
    setResult(message);
  };

  return (
    <>
      <StepIndicator step={step} steps={CREDIT_STEPS} />
      <BenchForm
        key={step}
        ref={formRef}
        schema={schema}
        uiSchema={uiSchema}
        validator={validator}
        formData={stepData(values, keys)}
        formContext={formContext}
        idSeparator="-"
        noHtml5Validate
        showErrorList={false}
        liveValidate={live ? 'onChange' : undefined}
        transformErrors={transformErrors}
        customValidate={customValidate}
        extraErrors={step === LAST_STEP ? smsErrors : undefined}
        extraErrorsBlockSubmit
        onChange={handleChange}
        onError={handleError}
        onSubmit={handleSubmit}
      >
        <WizardNav step={step} isLast={step === LAST_STEP} onPrev={() => setStep(step - 1)} />
      </BenchForm>
      {result ? <SubmitResult>{result}</SubmitResult> : null}
    </>
  );
}
