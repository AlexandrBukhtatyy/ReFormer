/**
 * Тексты ошибок кредитной заявки — из эталонного демо (`complex-multy-step-form/validation/
 * messages.ts`), где они там есть. Ключ — `<путь-шаблон>.<правило>` (строки массивов — `[]`,
 * как в `CREDIT_FIELDS`); ключи поля идут в порядке проверки: показывается первое нарушенное
 * правило. Правила, которых здесь нет, у поля нет.
 *
 * Правила: `required` (строка не пустая / число не `null` / флаг `true`), `min`/`max` (число),
 * `minLength`/`maxLength` (длина строки), `pattern` (полное совпадение с маской — `maskPattern`),
 * `email` (штатный валидатор email библиотеки), остальное — кросс-правила из `domain/credit.ts`.
 * Правила необязательного поля проверяются, только когда оно не пустое.
 */
import { CAR_YEAR_MAX } from '../domain/credit';

const PHONE_FORMAT = 'Формат: +7 (___) ___-__-__';
const NON_NEGATIVE = 'Не может быть отрицательным';
const EMAIL_FORMAT = 'Введите корректный email';

/** Правила адреса — одинаковые для регистрации и проживания. */
function addressMessages<P extends string>(prefix: P) {
  return {
    [`${prefix}.region.required`]: 'Укажите регион',
    [`${prefix}.city.required`]: 'Укажите город',
    [`${prefix}.street.required`]: 'Укажите улицу',
    [`${prefix}.house.required`]: 'Укажите номер дома',
    [`${prefix}.postalCode.required`]: 'Укажите почтовый индекс',
    [`${prefix}.postalCode.pattern`]: 'Индекс должен содержать 6 цифр',
  } as Record<
    | `${P}.${'region' | 'city' | 'street' | 'house' | 'postalCode'}.required`
    | `${P}.postalCode.pattern`,
    string
  >;
}

export const CREDIT_MESSAGES = {
  // ── Шаг 1 ──
  'loanType.required': 'Выберите тип кредита',
  'loanAmount.required': 'Укажите сумму кредита',
  'loanAmount.min': 'Минимум 50 000 ₽',
  'loanAmount.max': 'Максимум 10 000 000 ₽',
  /** Только ипотека: `exceedsMortgageLimit`. */
  'loanAmount.maxMortgage':
    'Сумма кредита не может превышать стоимость недвижимости за вычетом первоначального взноса',
  'loanTerm.required': 'Укажите срок кредита',
  'loanTerm.min': 'Минимум 6 месяцев',
  'loanTerm.max': 'Максимум 240 месяцев',
  'loanPurpose.required': 'Укажите цель кредита',
  'loanPurpose.minLength': 'Минимум 10 символов',
  'loanPurpose.maxLength': 'Не более 500 символов',
  'propertyValue.required': 'Укажите стоимость недвижимости',
  'propertyValue.min': 'Минимум 1 000 000 ₽',
  'carBrand.required': 'Укажите марку автомобиля',
  'carBrand.minLength': 'Минимум 2 символа',
  'carBrand.maxLength': 'Максимум 50 символов',
  'carModel.required': 'Укажите модель автомобиля',
  'carModel.maxLength': 'Максимум 50 символов',
  'carYear.required': 'Укажите год выпуска',
  'carYear.min': 'Не ранее 2000',
  'carYear.max': `Не позднее ${CAR_YEAR_MAX}`,
  'carPrice.required': 'Укажите стоимость автомобиля',
  'carPrice.min': 'Минимум 300 000 ₽',
  'carPrice.max': 'Максимум 10 000 000 ₽',

  // ── Шаг 2 ──
  'personalData.lastName.required': 'Фамилия обязательна',
  'personalData.firstName.required': 'Имя обязательно',
  'personalData.middleName.required': 'Отчество обязательно',
  'personalData.birthDate.required': 'Дата рождения обязательна',
  /** `isTooYoung` / `isTooOld` — возраст C.5 вне 18–70. */
  'personalData.birthDate.minAge': 'Заемщику должно быть не менее 18 лет',
  'personalData.birthDate.maxAge': 'Максимальный возраст заемщика: 70 лет',
  'personalData.gender.required': 'Выберите пол',
  'personalData.birthPlace.required': 'Место рождения обязательно',
  'passportData.series.required': 'Серия паспорта обязательна',
  'passportData.series.pattern': 'Формат: 00 00',
  'passportData.number.required': 'Номер паспорта обязателен',
  'passportData.number.pattern': 'Номер должен содержать 6 цифр',
  'passportData.issueDate.required': 'Дата выдачи обязательна',
  'passportData.issuedBy.required': 'Кем выдан обязательно',
  'passportData.departmentCode.required': 'Код подразделения обязателен',
  'passportData.departmentCode.pattern': 'Формат: 000-000',
  'inn.required': 'ИНН обязателен',
  'inn.pattern': 'ИНН должен содержать 12 цифр',
  'snils.required': 'СНИЛС обязателен',
  'snils.pattern': 'Формат: 000-000-000 00',

  // ── Шаг 3 ──
  'phoneMain.required': 'Телефон обязателен',
  'phoneMain.pattern': PHONE_FORMAT,
  'phoneAdditional.pattern': PHONE_FORMAT,
  'email.required': 'Email обязателен',
  'email.email': EMAIL_FORMAT,
  'emailAdditional.email': EMAIL_FORMAT,
  ...addressMessages('registrationAddress'),
  /** Только при `sameAsRegistration = false`. */
  ...addressMessages('residenceAddress'),

  // ── Шаг 4 ──
  'employmentStatus.required': 'Укажите статус занятости',
  /** Работа по найму: только при `employmentStatus = 'employed'`. */
  'companyName.required': 'Укажите название компании',
  'companyInn.required': 'ИНН компании обязателен',
  'companyInn.pattern': 'ИНН компании — 10 цифр',
  'companyPhone.required': 'Телефон компании обязателен',
  'companyPhone.pattern': PHONE_FORMAT,
  'companyAddress.required': 'Адрес компании обязателен',
  'position.required': 'Укажите должность',
  /** ИП: только при `employmentStatus = 'selfEmployed'`. */
  'businessType.required': 'Укажите тип бизнеса',
  'businessInn.required': 'ИНН ИП обязателен',
  'businessInn.pattern': 'ИНН ИП — 12 цифр',
  'businessActivity.required': 'Укажите вид деятельности',
  'workExperienceTotal.required': 'Укажите общий стаж',
  'workExperienceTotal.min': NON_NEGATIVE,
  'workExperienceCurrent.required': 'Укажите стаж на текущем месте',
  'workExperienceCurrent.min': NON_NEGATIVE,
  /** `experienceExceedsTotal`. */
  'workExperienceCurrent.maxTotal': 'Стаж на текущем месте не может превышать общий стаж',
  'monthlyIncome.required': 'Укажите ежемесячный доход',
  'monthlyIncome.min': 'Минимум 10 000 ₽',
  /** `paymentRatioTooHigh` — C.7 > 50. */
  'monthlyIncome.paymentRatio': 'Ежемесячный платеж не должен превышать 50% дохода',
  'additionalIncome.min': NON_NEGATIVE,
  /** `needsIncomeSource(additionalIncome)`. */
  'additionalIncomeSource.required': 'Укажите источник дополнительного дохода',

  // ── Шаг 5 ──
  'maritalStatus.required': 'Укажите семейное положение',
  'dependents.required': 'Укажите количество иждивенцев',
  'dependents.min': NON_NEGATIVE,
  'dependents.max': 'Максимум 10',
  'education.required': 'Укажите уровень образования',
  'properties[].type.required': 'Укажите тип имущества',
  'properties[].description.required': 'Добавьте описание имущества',
  'properties[].estimatedValue.required': 'Укажите оценочную стоимость',
  'properties[].estimatedValue.min': NON_NEGATIVE,
  'existingLoans[].bank.required': 'Укажите название банка',
  'existingLoans[].type.required': 'Укажите тип кредита',
  'existingLoans[].amount.required': 'Укажите сумму кредита',
  'existingLoans[].amount.min': NON_NEGATIVE,
  'existingLoans[].remainingAmount.required': 'Укажите остаток долга',
  'existingLoans[].remainingAmount.min': NON_NEGATIVE,
  /** `remainingExceedsAmount` (в пределах строки). */
  'existingLoans[].remainingAmount.maxAmount': 'Остаток долга не может превышать сумму кредита',
  'existingLoans[].monthlyPayment.required': 'Укажите ежемесячный платеж',
  'existingLoans[].monthlyPayment.min': NON_NEGATIVE,
  'existingLoans[].maturityDate.required': 'Укажите дату погашения',
  'coBorrowers[].personalData.lastName.required': 'Фамилия обязательна',
  'coBorrowers[].personalData.firstName.required': 'Имя обязательно',
  'coBorrowers[].personalData.middleName.required': 'Отчество обязательно',
  'coBorrowers[].personalData.birthDate.required': 'Дата рождения обязательна',
  'coBorrowers[].phone.required': 'Телефон обязателен',
  'coBorrowers[].phone.pattern': PHONE_FORMAT,
  'coBorrowers[].email.required': 'Email обязателен',
  'coBorrowers[].email.email': EMAIL_FORMAT,
  'coBorrowers[].relationship.required': 'Укажите отношение к заемщику',
  'coBorrowers[].monthlyIncome.required': 'Укажите доход созаемщика',
  'coBorrowers[].monthlyIncome.min': NON_NEGATIVE,

  // ── Шаг 6 ──
  'agreePersonalData.required': 'Согласие на обработку ПД обязательно',
  'agreeCreditHistory.required': 'Согласие на проверку кредитной истории обязательно',
  'agreeTerms.required': 'Согласие с условиями обязательно',
  'confirmAccuracy.required': 'Подтверждение точности обязательно',
  'electronicSignature.required': 'Введите код из СМС',
  'electronicSignature.pattern': 'Код — 6 символов',
  /** Асинхронно: `creditApi.verifySmsCode` вернул `false`. Только если синхронные прошли. */
  'electronicSignature.invalid': 'Неверный код подтверждения. Для демо используйте: 123456',
} as const;

export type CreditMessageKey = keyof typeof CREDIT_MESSAGES;

export const msg = (key: CreditMessageKey): string => CREDIT_MESSAGES[key];

/** Текст подтверждения отправки (`submit-result`) — `message` ответа `submitApplication`. */
export const CREDIT_SUBMIT_MESSAGE = 'Заявка успешно создана';
