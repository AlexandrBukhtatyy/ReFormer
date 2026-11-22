/**
 * Baseline кредита: разметка всего визарда на общих примитивах, без библиотеки форм, без
 * валидации, вычислений, API и отправки. Точка отсчёта байтов, heap и DOM — и визуальный шаблон:
 * порядок полей, секции, подписи и вычисляемые поля каждой реализации — как здесь.
 *
 * Состояние — только номер шага и число строк массивов; поля неконтролируемые (значения шага при
 * переходе теряются — логики нет). Условные секции показаны по начальным значениям (потребительский
 * кредит, работа по найму, адреса совпадают); `?all=1` показывает все — шаблон для просмотра.
 * Опции регионов и типов имущества — статикой из данных «сервера» (реализации берут их из API).
 */
import { useState, type ReactNode } from 'react';
import { FieldFrame, controlAttrs } from '../../../shared/ui/FieldFrame';
import {
  Checkbox,
  DateInput,
  MaskedInput,
  NumberInput,
  RadioGroup,
  ReadonlyValue,
  Select,
  TextInput,
  Textarea,
} from '../../../shared/ui/controls';
import { ArrayFrame, ArrayRow, Section } from '../../../shared/ui/array';
import { WizardShell } from '../../../shared/ui/wizard';
import { Page } from '../../../shared/ui/layout';
import {
  COMPUTED_LABELS,
  CREDIT_ARRAYS,
  CREDIT_INITIAL,
  CREDIT_STEPS,
  SECTION_TITLES,
  fieldMeta,
  toDomPath,
  type CreditArrayKey,
  type CreditComputed,
  type Option,
} from '../../../shared/domain/credit';
import { DICTIONARIES, REGIONS } from '../../../shared/api/credit-fixtures';

const SHOW_ALL = new URLSearchParams(location.search).has('all');

/** Начальное значение поля по конкретному пути (`properties.0.type` — из фабрики строки). */
function initialOf(path: string): unknown {
  const [head, ...rest] = path.split('.');
  let value: unknown =
    head in CREDIT_ARRAYS
      ? CREDIT_ARRAYS[head as CreditArrayKey].empty()
      : CREDIT_INITIAL[head as keyof typeof CREDIT_INITIAL];
  for (const seg of head in CREDIT_ARRAYS ? rest.slice(1) : rest) {
    value = (value as Record<string, unknown>)[seg];
  }
  return value;
}

const DYNAMIC_OPTIONS: Record<string, readonly Option[]> = {
  regions: REGIONS,
  propertyTypes: DICTIONARIES.propertyTypes,
};

/** Поле по пути: `FieldFrame` + примитив из метаданных (`CREDIT_FIELDS`). */
function field(path: string): ReactNode {
  const meta = fieldMeta(path);
  const p = toDomPath(path);
  const attrs = controlAttrs(p);
  const initial = initialOf(path);
  const text = initial == null ? '' : String(initial);
  const options =
    meta.options ?? (meta.optionsFrom ? (DYNAMIC_OPTIONS[meta.optionsFrom] ?? []) : []);
  let control: ReactNode;
  switch (meta.control) {
    case 'text':
    case 'email':
      control = (
        <TextInput
          type={meta.control}
          name={path}
          placeholder={meta.placeholder}
          defaultValue={text}
          {...attrs}
        />
      );
      break;
    case 'textarea':
      control = (
        <Textarea name={path} placeholder={meta.placeholder} defaultValue={text} {...attrs} />
      );
      break;
    case 'number':
      control = (
        <NumberInput name={path} placeholder={meta.placeholder} defaultValue={text} {...attrs} />
      );
      break;
    case 'date':
      control = <DateInput name={path} defaultValue={text} {...attrs} />;
      break;
    case 'masked':
      control = (
        <MaskedInput
          mask={meta.mask ?? ''}
          name={path}
          placeholder={meta.placeholder}
          defaultValue={text}
          {...attrs}
        />
      );
      break;
    case 'select':
      control = (
        <Select
          name={path}
          options={options}
          placeholder={meta.placeholder}
          defaultValue={text}
          {...attrs}
        />
      );
      break;
    case 'radio':
      control = <RadioGroup name={path} options={options} defaultValue={text} {...attrs} />;
      break;
    case 'checkbox':
      control = <Checkbox name={path} defaultChecked={initial === true} {...attrs} />;
      break;
  }
  return (
    <FieldFrame key={p} path={p} label={meta.label} inline={meta.control === 'checkbox'}>
      {control}
    </FieldFrame>
  );
}

const fields = (...paths: string[]) => paths.map(field);

function computed(key: keyof CreditComputed): ReactNode {
  return (
    <ReadonlyValue key={key} path={key} label={COMPUTED_LABELS[key]} value={CREDIT_INITIAL[key]} />
  );
}

function LoanStep() {
  return (
    <>
      {fields('loanType', 'loanAmount', 'loanTerm', 'loanPurpose')}
      {SHOW_ALL ? (
        <Section title={SECTION_TITLES.mortgage}>
          {field('propertyValue')}
          {computed('initialPayment')}
        </Section>
      ) : null}
      {SHOW_ALL ? (
        <Section title={SECTION_TITLES.car}>
          {fields('carBrand', 'carModel', 'carYear', 'carPrice')}
        </Section>
      ) : null}
      <Section title={SECTION_TITLES.calculation}>
        {computed('interestRate')}
        {computed('monthlyPayment')}
      </Section>
    </>
  );
}

function PersonalStep() {
  return (
    <>
      <Section title={SECTION_TITLES.personalData}>
        {fields(
          'personalData.lastName',
          'personalData.firstName',
          'personalData.middleName',
          'personalData.birthDate',
          'personalData.gender',
          'personalData.birthPlace'
        )}
        {computed('fullName')}
        {computed('age')}
      </Section>
      <Section title={SECTION_TITLES.passportData}>
        {fields(
          'passportData.series',
          'passportData.number',
          'passportData.issueDate',
          'passportData.issuedBy',
          'passportData.departmentCode'
        )}
      </Section>
      {fields('inn', 'snils')}
    </>
  );
}

const address = (prefix: string) =>
  fields(
    `${prefix}.region`,
    `${prefix}.city`,
    `${prefix}.street`,
    `${prefix}.house`,
    `${prefix}.apartment`,
    `${prefix}.postalCode`
  );

function ContactsStep() {
  return (
    <>
      {fields('phoneMain', 'phoneAdditional', 'email', 'sameEmail', 'emailAdditional')}
      <Section title={SECTION_TITLES.registrationAddress}>{address('registrationAddress')}</Section>
      {field('sameAsRegistration')}
      {SHOW_ALL ? (
        <Section title={SECTION_TITLES.residenceAddress}>{address('residenceAddress')}</Section>
      ) : null}
    </>
  );
}

function EmploymentStep() {
  return (
    <>
      {field('employmentStatus')}
      <Section title={SECTION_TITLES.employer}>
        {fields('companyName', 'companyInn', 'companyPhone', 'companyAddress', 'position')}
      </Section>
      {SHOW_ALL ? (
        <Section title={SECTION_TITLES.business}>
          {fields('businessType', 'businessInn', 'businessActivity')}
        </Section>
      ) : null}
      {fields('workExperienceTotal', 'workExperienceCurrent')}
      <Section title={SECTION_TITLES.income}>
        {fields('monthlyIncome', 'additionalIncome', 'additionalIncomeSource')}
        {computed('totalIncome')}
        {computed('paymentToIncomeRatio')}
      </Section>
    </>
  );
}

type Rows = Record<CreditArrayKey, number>;

/** Флаг массива + массив: включение даёт одну строку, выключение очищает (число строк — состояние). */
function ArrayBlock({
  array,
  rows,
  setRows,
  children,
}: {
  array: CreditArrayKey;
  rows: Rows;
  setRows: (update: (rows: Rows) => Rows) => void;
  children?: ReactNode;
}) {
  const meta = CREDIT_ARRAYS[array];
  const count = rows[array];
  const p = toDomPath(meta.flag);
  const set = (n: number) => setRows((r) => ({ ...r, [array]: n }));
  const rowFields = CREDIT_STEPS[4].fields.filter((f) => f.startsWith(`${array}[]`));
  return (
    <>
      <FieldFrame path={p} label={fieldMeta(meta.flag).label} inline>
        <Checkbox
          name={meta.flag}
          checked={count > 0}
          onChange={(e) => set(e.target.checked ? 1 : 0)}
          {...controlAttrs(p)}
        />
      </FieldFrame>
      {count > 0 ? (
        <ArrayFrame
          path={array}
          title={meta.title}
          addLabel={meta.addLabel}
          onAdd={() => set(count + 1)}
        >
          {Array.from({ length: count }, (_, i) => (
            <ArrayRow
              key={i}
              path={array}
              index={i}
              title={meta.rowTitle}
              onRemove={() => set(count - 1)}
            >
              {rowFields.map((f) => field(f.replace('[]', `.${i}`)))}
            </ArrayRow>
          ))}
        </ArrayFrame>
      ) : null}
      {count > 0 ? children : null}
    </>
  );
}

function AdditionalStep({
  rows,
  setRows,
}: {
  rows: Rows;
  setRows: (u: (r: Rows) => Rows) => void;
}) {
  return (
    <>
      {fields('maritalStatus', 'dependents', 'education')}
      <ArrayBlock array="properties" rows={rows} setRows={setRows} />
      <ArrayBlock array="existingLoans" rows={rows} setRows={setRows} />
      <ArrayBlock array="coBorrowers" rows={rows} setRows={setRows}>
        {computed('coBorrowersIncome')}
      </ArrayBlock>
    </>
  );
}

function ConfirmationStep() {
  return (
    <>
      {fields(
        'agreePersonalData',
        'agreeCreditHistory',
        'agreeMarketing',
        'agreeTerms',
        'confirmAccuracy',
        'electronicSignature'
      )}
    </>
  );
}

export function CreditForm() {
  const [step, setStep] = useState(1);
  const [rows, setRows] = useState<Rows>(() => {
    const n = SHOW_ALL ? 1 : 0;
    return { properties: n, existingLoans: n, coBorrowers: n };
  });
  return (
    <Page title="Заявка на кредит">
      <form noValidate onSubmit={(e) => e.preventDefault()}>
        <WizardShell
          step={step}
          steps={CREDIT_STEPS}
          onPrev={() => setStep((s) => Math.max(1, s - 1))}
          onNext={() => setStep((s) => Math.min(CREDIT_STEPS.length, s + 1))}
        >
          {step === 1 ? <LoanStep /> : null}
          {step === 2 ? <PersonalStep /> : null}
          {step === 3 ? <ContactsStep /> : null}
          {step === 4 ? <EmploymentStep /> : null}
          {step === 5 ? <AdditionalStep rows={rows} setRows={setRows} /> : null}
          {step === 6 ? <ConfirmationStep /> : null}
        </WizardShell>
      </form>
    </Page>
  );
}
