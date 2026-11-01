/**
 * Тексты замечаний по кодам. Подключается через ValidationMessagesProvider в index.tsx.
 * Встроенные коды продублированы, чтобы текст не зависел от загрузки словаря локали.
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const applicationMessages = defineIssueMessages({
  required: 'Обязательное поле',
  min: 'Значение не меньше {min}',
  max: 'Значение не больше {max}',
  email: 'Введите корректный email',

  'agreement.required': 'Необходимо подтвердить',

  'startDate.past': 'Дата начала не может быть раньше сегодняшней',
  'coverageAmount.range': 'Страховая сумма — от 100 000 до 50 000 000 ₽',

  'phone.pattern': 'Телефон в формате +7 (999) 999-99-99',
  'companyData.inn.pattern': 'ИНН — 10 цифр',
  'companyData.ogrn.pattern': 'ОГРН — 13 цифр',
  'companyData.kpp.pattern': 'КПП — 9 цифр',
  'passportData.series.pattern': 'Серия паспорта в формате 12 34',
  'passportData.number.pattern': 'Номер паспорта — 6 цифр',
  'age.range': 'Возраст страхователя должен быть от 18 до 75 лет',

  'vehicle.vin.length': 'VIN — ровно 17 символов',
  'vehicle.year.range': 'Год выпуска — от 1990 до {max}',
  'property.yearBuilt.range': 'Год постройки — от 1800 до {max}',
  'coverage.atLeastOne': 'Выберите хотя бы один вариант покрытия',

  'health.bmi.risk': 'ИМТ {bmi} вне нормы (18–30): возможны повышенные риски и коэффициент',

  'travel.departureDate.past': 'Дата отъезда не может быть раньше сегодняшней',
  'travel.returnDate.order': 'Дата возвращения должна быть позже даты отъезда',
  'travelers.required': 'Добавьте хотя бы одного путешественника',

  'drivers.required': 'Добавьте хотя бы одного водителя или отметьте неограниченное количество',
  'driver.birthDate.minAge': 'Водителю должно быть не меньше {minAge} лет',
  'driver.licenseIssueDate.future': 'Дата выдачи не может быть в будущем',
  'minDriverAge.risk': 'Минимальный возраст водителя меньше 22 лет: коэффициент будет повышен',

  'beneficiaries.total': 'Сумма долей должна быть равна 100% (сейчас {total}%)',

  'claims.required': 'Добавьте хотя бы один страховой случай',

  'promoCode.invalid': 'Промокод недействителен или истёк. Можно продолжить без скидки',

  'electronicSignature.pattern': 'Введите 6-значный код из СМС',
  'electronicSignature.invalid': 'Неверный код. Неудачных попыток: {attempts} из {maxAttempts}',
  'electronicSignature.exhausted':
    'Неверный код, попытки исчерпаны ({attempts} из {maxAttempts}). Запросите новый код',
});
