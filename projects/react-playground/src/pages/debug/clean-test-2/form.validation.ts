// @reformer-form-build 533d0efc057aca67 собран из form.intent.json; правка руками отсоединит файл от сборки
/**
 * Валидация формы «Заявка на кредит» — правила над МОДЕЛЬЮ, не в схеме разметки.
 * Правила шагов уходят в поток `formFlow` (form.flow.ts), правила вне шагов — сюда.
 * Подключение: createForm({ …, validation: formValidation, flow: formFlow }).
 */
import type { FormValidation } from '@reformer/core';
import { applyEach, defineValidation, validate, validateWhen } from '@reformer/core/validation';
import { email, max, maxLength, min, minLength, required } from '@reformer/core/validators';
import type { CreditApplication, Property, ExistingLoan, CoBorrower } from './model';

/** Правила строки массива `properties`: пути — от элемента. */
const propertiesRowRules = defineValidation<Property>(({ model }) => {
  validate(model.$.description, [required({ code: 'prop.desc.required' })]);
  validate(model.$.estimatedValue, [
    required({ code: 'prop.val.required' }),
    min(0, { code: 'prop.val.min' }),
  ]);
});

/** Правила строки массива `existingLoans`: пути — от элемента. */
const existingLoansRowRules = defineValidation<ExistingLoan>(({ model, cross }) => {
  validate(model.$.bank, [required({ code: 'loan.bank.required' })]);
  validate(model.$.type, [required({ code: 'loan.type.required' })]);
  validate(model.$.amount, [
    required({ code: 'loan.amount.required' }),
    min(0, { code: 'loan.amount.min' }),
  ]);
  validate(model.$.remainingAmount, [
    required({ code: 'loan.rem.required' }),
    min(0, { code: 'loan.rem.min' }),
  ]);
  cross(model.$.remainingAmount, (values) =>
    (values.remainingAmount ?? 0) <= (values.amount ?? 0) ? null : { code: 'loan.rem.gt' }
  );
  validate(model.$.monthlyPayment, [
    required({ code: 'loan.mp.required' }),
    min(0, { code: 'loan.mp.min' }),
  ]);
  validate(model.$.maturityDate, [required({ code: 'loan.md.required' })]);
});

/** Правила строки массива `coBorrowers`: пути — от элемента. */
const coBorrowersRowRules = defineValidation<CoBorrower>(({ model }) => {
  validate(model.$.lastName, [required({ code: 'cb.ln.required' })]);
  validate(model.$.firstName, [required({ code: 'cb.fn.required' })]);
  validate(model.$.middleName, [required({ code: 'cb.mn.required' })]);
  validate(model.$.birthDate, [required({ code: 'cb.bd.required' })]);
  validate(model.$.phone, [required({ code: 'cb.phone.required' })]);
  validate(model.$.email, [
    required({ code: 'cb.email.required' }),
    email({ code: 'cb.email.format' }),
  ]);
  validate(model.$.relationship, [required({ code: 'cb.rel.required' })]);
  validate(model.$.monthlyIncome, [
    required({ code: 'cb.inc.required' }),
    min(0, { code: 'cb.inc.min' }),
  ]);
});

/** Правила шага `s1` — их проверяет `next()` потока. */
export const s1Rules = defineValidation<CreditApplication>(({ model, cross }) => {
  validate(model.$.loanType, [required({ code: 'loanType.required' })]);
  validate(model.$.loanAmount, [
    required({ code: 'loanAmount.required' }),
    min(50000, { code: 'loanAmount.min' }),
    max(10000000, { code: 'loanAmount.max' }),
  ]);
  validate(model.$.loanTerm, [
    required({ code: 'loanTerm.required' }),
    min(6, { code: 'loanTerm.min' }),
    max(240, { code: 'loanTerm.max' }),
  ]);
  validate(model.$.loanPurpose, [
    required({ code: 'loanPurpose.required' }),
    minLength(10, { code: 'loanPurpose.min' }),
    maxLength(500, { code: 'loanPurpose.max' }),
  ]);
  validateWhen(
    () => model.loanType === 'mortgage',
    () => {
      validate(model.$.propertyValue, [
        required({ code: 'propertyValue.required' }),
        min(1000000, { code: 'propertyValue.min' }),
      ]);
    }
  );
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carBrand, [
        required({ code: 'carBrand.required' }),
        minLength(2, { code: 'carBrand.min' }),
        maxLength(50, { code: 'carBrand.max' }),
      ]);
    }
  );
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carModel, [
        required({ code: 'carModel.required' }),
        maxLength(50, { code: 'carModel.max' }),
      ]);
    }
  );
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carYear, [
        required({ code: 'carYear.required' }),
        min(2000, { code: 'carYear.min' }),
        max(new Date().getFullYear() + 1, { code: 'carYear.max' }),
      ]);
    }
  );
  validateWhen(
    () => model.loanType === 'car',
    () => {
      validate(model.$.carPrice, [
        required({ code: 'carPrice.required' }),
        min(300000, { code: 'carPrice.min' }),
        max(10000000, { code: 'carPrice.max' }),
      ]);
    }
  );
  cross(model.$.loanAmount, (values) =>
    values.loanType !== 'mortgage' ||
    values.propertyValue == null ||
    (values.loanAmount ?? 0) <= values.propertyValue - (values.initialPayment ?? 0)
      ? null
      : { code: 'loanAmount.mortgage' }
  );
});

/** Правила шага `s2` — их проверяет `next()` потока. */
export const s2Rules = defineValidation<CreditApplication>(({ model, cross }) => {
  validate(model.$.personalData.lastName, [required({ code: 'ln.required' })]);
  validate(model.$.personalData.firstName, [required({ code: 'fn.required' })]);
  validate(model.$.personalData.middleName, [required({ code: 'mn.required' })]);
  validate(model.$.personalData.birthDate, [required({ code: 'bd.required' })]);
  validate(model.$.personalData.gender, [required({ code: 'gender.required' })]);
  validate(model.$.personalData.birthPlace, [required({ code: 'bp.required' })]);
  validate(model.$.passportData.series, [required({ code: 'ps.required' })]);
  validate(model.$.passportData.number, [required({ code: 'pn.required' })]);
  validate(model.$.passportData.issueDate, [required({ code: 'pi.required' })]);
  validate(model.$.passportData.issuedBy, [required({ code: 'pb.required' })]);
  validate(model.$.passportData.departmentCode, [required({ code: 'pd.required' })]);
  validate(model.$.inn, [required({ code: 'inn.required' })]);
  validate(model.$.snils, [required({ code: 'snils.required' })]);
  cross(model.$.age, (values) =>
    values.age == null || (values.age >= 18 && values.age <= 70) ? null : { code: 'age.range' }
  );
  cross(model.$.age, (values) =>
    values.age == null || values.age <= 60 ? null : { code: 'age.warn', severity: 'warning' }
  );
});

/** Правила шага `s3` — их проверяет `next()` потока. */
export const s3Rules = defineValidation<CreditApplication>(({ model }) => {
  validate(model.$.phoneMain, [required({ code: 'phoneMain.required' })]);
  validate(model.$.email, [required({ code: 'email.required' }), email({ code: 'email.format' })]);
  validateWhen(
    () => !!model.emailAdditional,
    () => {
      validate(model.$.emailAdditional, [email({ code: 'emailAdd.format' })]);
    }
  );
  validate(model.$.registrationAddress.region, [required({ code: 'rr.required' })]);
  validate(model.$.registrationAddress.city, [required({ code: 'rc.required' })]);
  validate(model.$.registrationAddress.street, [required({ code: 'rs.required' })]);
  validate(model.$.registrationAddress.house, [required({ code: 'rh.required' })]);
  validate(model.$.registrationAddress.postalCode, [required({ code: 'rp.required' })]);
  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.region, [required({ code: 'sr.required' })]);
    }
  );
  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.city, [required({ code: 'sc.required' })]);
    }
  );
  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.street, [required({ code: 'ss.required' })]);
    }
  );
  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.house, [required({ code: 'sh.required' })]);
    }
  );
  validateWhen(
    () => model.sameAsRegistration === false,
    () => {
      validate(model.$.residenceAddress.postalCode, [required({ code: 'sp.required' })]);
    }
  );
});

/** Правила шага `s4` — их проверяет `next()` потока. */
export const s4Rules = defineValidation<CreditApplication>(({ model, cross }) => {
  validate(model.$.employmentStatus, [required({ code: 'es.required' })]);
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyName, [required({ code: 'cn.required' })]);
    }
  );
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.companyInn, [required({ code: 'ci.required' })]);
    }
  );
  validateWhen(
    () => model.employmentStatus === 'employed',
    () => {
      validate(model.$.position, [required({ code: 'pos.required' })]);
    }
  );
  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessType, [required({ code: 'bt.required' })]);
    }
  );
  validateWhen(
    () => model.employmentStatus === 'selfEmployed',
    () => {
      validate(model.$.businessInn, [required({ code: 'bi.required' })]);
    }
  );
  validate(model.$.workExperienceTotal, [
    required({ code: 'wet.required' }),
    min(0, { code: 'wet.min' }),
  ]);
  validate(model.$.workExperienceCurrent, [
    required({ code: 'wec.required' }),
    min(0, { code: 'wec.min' }),
  ]);
  validate(model.$.monthlyIncome, [
    required({ code: 'mi.required' }),
    min(10000, { code: 'mi.min' }),
  ]);
  validateWhen(
    () => model.additionalIncome != null,
    () => {
      validate(model.$.additionalIncome, [min(0, { code: 'ai.min' })]);
    }
  );
  validateWhen(
    () => (model.additionalIncome ?? 0) > 0,
    () => {
      validate(model.$.additionalIncomeSource, [required({ code: 'ais.required' })]);
    }
  );
  cross(model.$.workExperienceCurrent, (values) =>
    (values.workExperienceCurrent ?? 0) <= (values.workExperienceTotal ?? 0)
      ? null
      : { code: 'wec.gtTotal' }
  );
  cross(model.$.paymentToIncomeRatio, (values) =>
    values.paymentToIncomeRatio == null || values.paymentToIncomeRatio <= 50
      ? null
      : { code: 'ratio.max' }
  );
  cross(model.$.paymentToIncomeRatio, (values) =>
    values.paymentToIncomeRatio == null || values.paymentToIncomeRatio <= 40
      ? null
      : { code: 'ratio.warn', severity: 'warning' }
  );
  cross(model.$.workExperienceCurrent, (values) =>
    values.workExperienceCurrent == null || values.workExperienceCurrent >= 3
      ? null
      : { code: 'wec.warn', severity: 'warning' }
  );
});

/** Правила шага `s5` — их проверяет `next()` потока. */
export const s5Rules = defineValidation<CreditApplication>(({ model }) => {
  validate(model.$.maritalStatus, [required({ code: 'ms.required' })]);
  validate(model.$.dependents, [
    required({ code: 'dep.required' }),
    min(0, { code: 'dep.min' }),
    max(10, { code: 'dep.max' }),
  ]);
  validate(model.$.education, [required({ code: 'edu.required' })]);
  applyEach(model.$.properties, propertiesRowRules);
  applyEach(model.$.existingLoans, existingLoansRowRules);
  applyEach(model.$.coBorrowers, coBorrowersRowRules);
});

/** Правила шага `s6` — их проверяет `next()` потока. */
export const s6Rules = defineValidation<CreditApplication>(({ model, cross }) => {
  cross(model.$.agreePersonalData, (values) =>
    values.agreePersonalData === true ? null : { code: 'ag1.true' }
  );
  cross(model.$.agreeCreditHistory, (values) =>
    values.agreeCreditHistory === true ? null : { code: 'ag2.true' }
  );
  cross(model.$.agreeTerms, (values) => (values.agreeTerms === true ? null : { code: 'ag3.true' }));
  cross(model.$.confirmAccuracy, (values) =>
    values.confirmAccuracy === true ? null : { code: 'conf.true' }
  );
  validate(model.$.electronicSignature, [required({ code: 'sig.required' })]);
});

/** Правил вне шагов нет: все правила — у шагов потока. */
export const formValidation: FormValidation<CreditApplication> = {};
