/**
 * Тексты заявки на кредит: словарь формы и локали приложения.
 *
 * Правила валидации несут только код и параметры; строку по коду собирает резолвер
 * (`resolveIssueMessage`): словарь формы → `validation.<код>` локали → встроенный английский → код.
 * - {@link loanIssueMessages} — словарь формы (русский, как у анкеты на одном языке): ICU `plural`
 *   и `select`, функции там, где числу нужны разряды, и свои коды правил анкеты;
 * - {@link loanRu} и {@link loanEn} — локали ядра, расширенные `extendLocale` ключами приложения
 *   (сводка визарда) и текстами своих кодов: без словаря формы английская локаль показывает
 *   замечания по-английски. Набор ключей у них один — его проверяет компилятор.
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
