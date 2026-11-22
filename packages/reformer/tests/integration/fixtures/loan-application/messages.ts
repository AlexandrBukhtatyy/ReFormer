/**
 * Тексты заявки на кредит: словарь формы и локали приложения.
 *
 * Правила валидации несут только код и параметры; строку по коду собирает резолвер
 * (`resolveIssueMessage`): словарь формы → `validation.<код>` локали → встроенный английский → код.
 * - {@link loanIssueMessages} — словарь формы (русский, как у анкеты на одном языке): ICU `plural`
 *   и `select`, функции там, где числу нужны разряды, и свои коды правил анкеты;
 * - {@link loanRu} и {@link loanEn} — локали ядра, расширенные `extendLocale` ключами приложения
 *   (сводка визарда) и текстами своих кодов: без словаря формы английская локаль показывает
 *   замечания по-английски. Набор ключей у них один — его проверяет компилятор;
 * - {@link loanLocales} — те же локали с текстами ВСЕХ своих кодов правил, а
 *   {@link LOAN_APP_MESSAGES} — их словари приложения без ядра (файлы `/locales/<код>.json`): с ними
 *   каждое замечание правил шагов получает текст на обоих языках и без словаря формы.
 */

import { defineIssueMessages, extendLocale, type FormLocale } from '../../../../src/i18n';
import { en } from '../../../../src/locale/en';
import { ru } from '../../../../src/locale/ru';

/** Словарь формы: код замечания → текст поля. */
export const loanIssueMessages = defineIssueMessages({
  // Свои коды — `<поле>.<правило>`.
  'loan.type.required': 'Выберите вид кредита',
  'loan.amount.required': 'Укажите сумму кредита',
  // Шаблон печатает число без разрядов — сумму с разрядами по языку собирает функция.
  'loan.amount.min': (params, i18n) => `Минимальная сумма — ${i18n.number(Number(params.min))} ₽`,
  'loan.amount.max':
    'Для {loanType, select, mortgage{ипотеки} car{автокредита} other{потребительского кредита}} — не больше {max} ₽',
  'loan.amount.step': 'Сумма кратна {multipleOf} ₽',
  'loan.term.min': 'Срок — не меньше {min} месяцев',
  'loan.paymentTooHigh': (params, i18n) =>
    `Платёж — ${i18n.number(Number(params.ratio))} % дохода, допустимо не больше ${String(params.limit)} %`,
  'loan.highDebtLoad': 'Платёж — {ratio} % дохода: нагрузка высокая',
  'loan.initialPayment.tooHigh': (params, i18n) =>
    `Взнос больше стоимости залога (${i18n.number(Number(params.propertyValue))} ₽)`,
  'loan.initialPayment.tooLow': 'Взнос — не меньше {minShare} % стоимости залога',
  'applicant.birthDate.minAge': 'Кредит выдаётся с {minAge} лет',
  'applicant.inn.notFound': 'ИНН {inn} не найден в реестре налоговой',
  'applicant.passport.issuedTooEarly': 'Паспорт выдают с 14 лет — проверьте даты',
  'coBorrowers.empty': 'Добавьте созаёмщика или снимите отметку',
  'coBorrower.phones.required': 'Укажите хотя бы один телефон созаёмщика',
  'documents.minFiles':
    'Приложено {actualCount, plural, one{# документ} few{# документа} many{# документов} other{# документа}} из {minFiles}',
  'interests.tooMany': 'Не больше {maxLength} продуктов',
  'consent.personalData.required': 'Без согласия на обработку данных заявку не рассмотрят',
});

/** Ключи приложения и тексты своих кодов — русская локаль. */
const RU_MESSAGES = {
  'loan.wizard.title': 'Заявка на кредит',
  'loan.summary.term': '{term, plural, one{# месяц} few{# месяца} many{# месяцев} other{# месяца}}',
  'loan.summary.type':
    '{type, select, consumer{потребительский кредит} mortgage{ипотека} car{автокредит} other{кредит}}',
  'validation.applicant.inn.notFound': 'ИНН {inn} не найден в реестре налоговой',
  'validation.loan.collateralTooLow': 'Кредит — не больше {maxShare} % стоимости залога',
  'validation.documents.minFiles':
    'Нужно не меньше {minFiles, plural, one{# документа} other{# документов}}',
} as const;

/** Те же ключи по-английски: пропущенный или лишний ключ — ошибка компиляции. */
const EN_MESSAGES: Record<keyof typeof RU_MESSAGES, string> = {
  'loan.wizard.title': 'Loan application',
  'loan.summary.term': '{term, plural, one{# month} other{# months}}',
  'loan.summary.type':
    '{type, select, consumer{consumer loan} mortgage{mortgage} car{car loan} other{loan}}',
  'validation.applicant.inn.notFound': 'TIN {inn} is not in the tax register',
  'validation.loan.collateralTooLow':
    'The loan must not exceed {maxShare}% of the collateral value',
  'validation.documents.minFiles':
    'At least {minFiles, plural, one{# document is} other{# documents are}} required',
};

/** Русская локаль заявки: локаль ядра и ключи приложения. */
export const loanRu: FormLocale = extendLocale(ru, { messages: RU_MESSAGES });

/** Английская локаль заявки. */
export const loanEn: FormLocale = extendLocale(en, { messages: EN_MESSAGES });

// ─── Тексты всех своих кодов ─────────────────────────────────────────────────────────────────

/**
 * Тексты своих кодов правил по-русски — ключами `validation.<код>` локали, поэтому их переводит
 * смена языка. Словарь формы перекрывает часть из них для анкеты на одном языке; у остальных
 * кодов текстов в локалях выше нет, и резолвер показал бы пользователю сам код.
 */
const RU_ISSUE_TEXTS = {
  // Кредит.
  'validation.loan.type.required': 'Выберите вид кредита',
  'validation.loan.amount.required': 'Укажите сумму кредита',
  'validation.loan.amount.min': 'Сумма — не меньше {min} ₽',
  'validation.loan.amount.max':
    'Сумма {loanType, select, mortgage{ипотеки} car{автокредита} other{кредита}} — не больше {max} ₽',
  'validation.loan.amount.step': 'Сумма должна быть кратна {multipleOf} ₽',
  'validation.loan.term.required': 'Укажите срок кредита',
  'validation.loan.term.min':
    'Срок — не меньше {min, plural, one{# месяца} few{# месяцев} many{# месяцев} other{# месяца}}',
  'validation.loan.term.max':
    'Срок — не больше {max, plural, one{# месяца} few{# месяцев} many{# месяцев} other{# месяца}}',
  'validation.loan.firstPaymentDate.max': 'Первый платёж — не позже {maxDate}',
  'validation.loan.promoCode.format': 'Промокод — от 4 до 12 латинских букв и цифр',
  'validation.loan.propertyValue.required': 'Укажите стоимость недвижимости',
  'validation.loan.propertyValue.min': 'Стоимость недвижимости — не меньше {min} ₽',
  'validation.loan.initialPayment.required': 'Укажите первоначальный взнос',
  'validation.loan.initialPayment.tooHigh': 'Взнос больше стоимости залога ({propertyValue} ₽)',
  'validation.loan.initialPayment.tooLow': 'Взнос — не меньше {minShare} % стоимости залога',
  'validation.loan.paymentTooHigh': 'Платёж — {ratio} % дохода, допустимо не больше {limit} %',
  'validation.loan.highDebtLoad': 'Платёж — {ratio} % дохода: нагрузка высокая',
  // Заёмщик.
  'validation.name.cyrillic': 'Только русские буквы, пробел и дефис',
  'validation.applicant.birthDate.required': 'Укажите дату рождения',
  'validation.applicant.birthDate.minAge': 'Кредит выдаётся с {minAge} лет',
  'validation.applicant.birthDate.maxAge': 'Кредит выдаётся до {maxAge} лет',
  'validation.applicant.inn.required': 'Укажите ИНН',
  'validation.applicant.inn.format': 'ИНН — 12 цифр',
  'validation.applicant.passport.issuedTooEarly': 'Паспорт выдают с 14 лет — проверьте даты',
  'validation.passport.series.format': 'Серия паспорта — 4 цифры',
  'validation.passport.number.format': 'Номер паспорта — 6 цифр',
  'validation.passport.issueDate.min': 'Паспорт нового образца выдаётся с {minDate}',
  // Контакты и адреса.
  'validation.phone.required': 'Укажите телефон',
  'validation.email.required': 'Укажите email',
  'validation.address.region.required': 'Выберите регион',
  'validation.address.city.required': 'Выберите город',
  'validation.address.street.required': 'Укажите улицу и дом',
  'validation.address.postalCode.required': 'Укажите индекс',
  'validation.address.postalCode.format': 'Индекс — 6 цифр',
  // Работа.
  'validation.employment.companyName.required': 'Укажите организацию',
  'validation.employment.position.required': 'Укажите должность',
  'validation.employment.companySite.url': 'Введите адрес сайта работодателя',
  'validation.employment.monthlyIncome.required': 'Укажите доход',
  'validation.employment.monthlyIncome.min': 'Доход — не меньше {min} ₽ в месяц',
  'validation.previousJob.company.required': 'Укажите организацию',
  // Созаёмщики.
  'validation.coBorrowers.empty': 'Добавьте созаёмщика или снимите отметку',
  'validation.coBorrower.fullName.required': 'Укажите ФИО созаёмщика',
  'validation.coBorrower.relation.required': 'Укажите, кем приходится созаёмщик',
  'validation.coBorrower.monthlyIncome.required': 'Укажите доход созаёмщика',
  'validation.coBorrower.monthlyIncome.min': 'Доход созаёмщика — не меньше {min} ₽ в месяц',
  'validation.coBorrower.share.min': 'Доля — не меньше {min} %',
  'validation.coBorrower.phones.required': 'Укажите хотя бы один телефон созаёмщика',
  // Документы и согласия.
  'validation.documents.required': 'Приложите паспорт и справку о доходах',
  'validation.interests.tooMany':
    'Не больше {maxLength, plural, one{# продукта} few{# продуктов} many{# продуктов} other{# продукта}}',
  'validation.consent.personalData.required': 'Нужно согласие на обработку персональных данных',
  'validation.consent.creditBureau.required': 'Нужно согласие на запрос в бюро кредитных историй',
  'validation.consent.smsPhone.required': 'Укажите телефон для кода подписи',
} as const;

/** Те же тексты по-английски: набор ключей проверяет компилятор, подстановки — `validateLocale`. */
const EN_ISSUE_TEXTS: Record<keyof typeof RU_ISSUE_TEXTS, string> = {
  'validation.loan.type.required': 'Choose a loan type',
  'validation.loan.amount.required': 'Enter the loan amount',
  'validation.loan.amount.min': 'The amount must be at least {min} RUB',
  'validation.loan.amount.max':
    'A {loanType, select, mortgage{mortgage} car{car loan} other{consumer loan}} is limited to {max} RUB',
  'validation.loan.amount.step': 'The amount must be a multiple of {multipleOf} RUB',
  'validation.loan.term.required': 'Enter the loan term',
  'validation.loan.term.min':
    'The term must be at least {min, plural, one{# month} other{# months}}',
  'validation.loan.term.max':
    'The term must be at most {max, plural, one{# month} other{# months}}',
  'validation.loan.firstPaymentDate.max': 'The first payment must be no later than {maxDate}',
  'validation.loan.promoCode.format': 'A promo code is 4 to 12 Latin letters and digits',
  'validation.loan.propertyValue.required': 'Enter the property value',
  'validation.loan.propertyValue.min': 'The property value must be at least {min} RUB',
  'validation.loan.initialPayment.required': 'Enter the down payment',
  'validation.loan.initialPayment.tooHigh':
    'The down payment exceeds the collateral value ({propertyValue} RUB)',
  'validation.loan.initialPayment.tooLow':
    'The down payment must be at least {minShare}% of the collateral value',
  'validation.loan.paymentTooHigh':
    'The payment is {ratio}% of income; at most {limit}% is allowed',
  'validation.loan.highDebtLoad': 'The payment is {ratio}% of income: the debt load is high',
  'validation.name.cyrillic': 'Use Cyrillic letters, spaces and hyphens only',
  'validation.applicant.birthDate.required': 'Enter the date of birth',
  'validation.applicant.birthDate.minAge': 'Loans are available from the age of {minAge}',
  'validation.applicant.birthDate.maxAge': 'Loans are available up to the age of {maxAge}',
  'validation.applicant.inn.required': 'Enter the TIN',
  'validation.applicant.inn.format': 'A TIN is 12 digits',
  'validation.applicant.passport.issuedTooEarly':
    'Passports are issued from the age of 14: check the dates',
  'validation.passport.series.format': 'A passport series is 4 digits',
  'validation.passport.number.format': 'A passport number is 6 digits',
  'validation.passport.issueDate.min': 'Current passports are issued since {minDate}',
  'validation.phone.required': 'Enter a phone number',
  'validation.email.required': 'Enter an email address',
  'validation.address.region.required': 'Choose a region',
  'validation.address.city.required': 'Choose a city',
  'validation.address.street.required': 'Enter the street and building',
  'validation.address.postalCode.required': 'Enter the postal code',
  'validation.address.postalCode.format': 'A postal code is 6 digits',
  'validation.employment.companyName.required': 'Enter the employer',
  'validation.employment.position.required': 'Enter the position',
  'validation.employment.companySite.url': 'Enter the website of the employer',
  'validation.employment.monthlyIncome.required': 'Enter the monthly income',
  'validation.employment.monthlyIncome.min': 'The income must be at least {min} RUB a month',
  'validation.previousJob.company.required': 'Enter the employer',
  'validation.coBorrowers.empty': 'Add a co-borrower or clear the checkbox',
  'validation.coBorrower.fullName.required': 'Enter the full name of the co-borrower',
  'validation.coBorrower.relation.required': 'Choose how the co-borrower is related to you',
  'validation.coBorrower.monthlyIncome.required': 'Enter the income of the co-borrower',
  'validation.coBorrower.monthlyIncome.min':
    'The income of the co-borrower must be at least {min} RUB a month',
  'validation.coBorrower.share.min': 'The share must be at least {min}%',
  'validation.coBorrower.phones.required': 'Add at least one phone number of the co-borrower',
  'validation.documents.required': 'Attach the passport and the income statement',
  'validation.interests.tooMany':
    'Choose no more than {maxLength, plural, one{# product} other{# products}}',
  'validation.consent.personalData.required': 'Consent to personal data processing is required',
  'validation.consent.creditBureau.required': 'Consent to a credit bureau inquiry is required',
  'validation.consent.smsPhone.required': 'Enter the phone number for the signing code',
};

/**
 * Подписи кнопок визарда — ключи встроенной английской таблицы React-оболочки (`react.tsx`,
 * `useMessages`): локаль их переводит, а без ключа в локали оболочка говорит по-английски.
 */
const RU_WIZARD_TEXTS = {
  'loan.wizard.back': 'Назад',
  'loan.wizard.next': 'Далее',
} as const;

const EN_WIZARD_TEXTS: Record<keyof typeof RU_WIZARD_TEXTS, string> = {
  'loan.wizard.back': 'Back',
  'loan.wizard.next': 'Next',
};

/**
 * Словари приложения по языкам — содержимое файлов `/locales/<код>.json` на сервере: ключи заявки
 * и тексты всех своих кодов. Словаря ядра в них нет: его даёт `loadCoreLocale`.
 */
export const LOAN_APP_MESSAGES: Readonly<Record<'ru' | 'en', FormLocale['messages']>> = {
  ru: { ...RU_MESSAGES, ...RU_ISSUE_TEXTS, ...RU_WIZARD_TEXTS },
  en: { ...EN_MESSAGES, ...EN_ISSUE_TEXTS, ...EN_WIZARD_TEXTS },
};

/**
 * Локали заявки с текстами всех своих кодов: каждое замечание правил шагов получает текст на
 * языке локали и без словаря формы. Это та же локаль, что собирает загрузчик из `loadCoreLocale`
 * и словаря приложения с сервера ({@link LOAN_APP_MESSAGES}).
 */
export const loanLocales: Readonly<Record<'ru' | 'en', FormLocale>> = {
  ru: extendLocale(ru, { messages: LOAN_APP_MESSAGES.ru }),
  en: extendLocale(en, { messages: LOAN_APP_MESSAGES.en }),
};
