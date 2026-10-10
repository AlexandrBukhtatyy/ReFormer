/**
 * Тексты замечаний кредитной заявки — словарь формы.
 *
 * Правила (`validation/*.ts`) несут только код и параметры; строку по коду даёт этот словарь.
 * Его подключает `ValidationMessagesProvider messages` на корне каждого варианта формы, поэтому
 * тексты одни и те же в ручном React, renderer-react, renderer-json и в реестре форм. Код поля —
 * `<поле>.<правило>`, у подформ — с префиксом подформы (`coBorrower.birthDate.minAge`).
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const creditApplicationMessages = defineIssueMessages({
  // validation/common/rules.ts — ФИО: обязательность у каждого поля своя, род разный
  'lastName.required': 'Фамилия обязательна',
  'firstName.required': 'Имя обязательно',
  'middleName.required': 'Отчество обязательно',
  'ruName.minLength': 'Минимум 2 символа',
  'ruName.maxLength': 'Максимум 50 символов',
  'ruName.pattern': 'Только русские буквы, пробелы и дефис',
  'phoneFormat.pattern': 'Формат: +7 (___) ___-__-__',
  'emailFormat.email': 'Введите корректный email',
  'emailRequired.required': 'Email обязателен',
  'nonNegative.min': 'Не может быть отрицательным',
  'max10mRub.max': 'Максимум 10 000 000 ₽',

  // validation/loan.ts
  'loanType.required': 'Выберите тип кредита',
  'loanAmount.required': 'Укажите сумму кредита',
  'loanAmount.min': 'Минимум 50 000 ₽',
  'loanTerm.required': 'Укажите срок кредита',
  'loanTerm.min': 'Минимум 6 месяцев',
  'loanTerm.max': 'Максимум 240 месяцев',
  'loanPurpose.required': 'Укажите цель кредита',
  'loanPurpose.minLength': 'Минимум 10 символов',
  'loanPurpose.maxLength': 'Не более 500 символов',
  'propertyValue.required': 'Укажите стоимость недвижимости',
  'propertyValue.min': 'Минимум 1 000 000 ₽',
  'initialPayment.required': 'Укажите первоначальный взнос',
  'carBrand.required': 'Укажите марку автомобиля',
  'carBrand.minLength': 'Минимум 2 символа',
  'carBrand.maxLength': 'Максимум 50 символов',
  'carModel.required': 'Укажите модель автомобиля',
  'carModel.minLength': 'Минимум 1 символ',
  'carModel.maxLength': 'Максимум 50 символов',
  'carYear.required': 'Укажите год выпуска',
  'carYear.min': 'Не ранее 2000',
  'carYear.max': 'Не позднее {max}',
  'carPrice.required': 'Укажите стоимость автомобиля',
  'carPrice.min': 'Минимум 300 000 ₽',
  initialPaymentTooHigh: 'Первоначальный взнос не может превышать стоимость недвижимости',
  initialPaymentTooLow: 'Первоначальный взнос не может быть меньше 20% от стоимости недвижимости',
  // Сумма с разрядами: шаблон печатает число без них, поэтому текст собирает функция.
  loanAmountExceedsMax: (params) =>
    `Сумма кредита не может превышать ${Number(params.maximumLoan).toLocaleString('ru-RU')} ₽ (стоимость минус взнос)`,

  // validation/applicant.ts
  'birthDate.required': 'Дата рождения обязательна',
  'birthDate.minAge': 'Заемщику должно быть не менее 18 лет',
  'birthDate.maxAge': 'Максимальный возраст заемщика: 70 лет',
  'gender.required': 'Выберите пол',
  'birthPlace.required': 'Место рождения обязательно',
  'birthPlace.minLength': 'Минимум 5 символов',
  'birthPlace.maxLength': 'Максимум 100 символов',
  'passportSeries.required': 'Серия паспорта обязательна',
  'passportSeries.pattern': 'Формат: 00 00',
  'passportNumber.required': 'Номер паспорта обязателен',
  'passportNumber.pattern': 'Номер должен содержать 6 цифр',
  'passportIssueDate.required': 'Дата выдачи обязательна',
  'passportIssueDate.pastDate': 'Дата выдачи не может быть в будущем',
  'passportIssuedBy.required': 'Кем выдан обязательно',
  'passportIssuedBy.minLength': 'Минимум 10 символов',
  'passportIssuedBy.maxLength': 'Максимум 200 символов',
  'passportDepartmentCode.required': 'Код подразделения обязателен',
  'passportDepartmentCode.pattern': 'Формат: 000-000',
  'inn.required': 'ИНН обязателен',
  'inn.pattern': 'ИНН должен содержать 12 цифр',
  'snils.required': 'СНИЛС обязателен',
  'snils.pattern': 'Формат: 000-000-000 00',
  passportIssuedBeforeMinAge: 'Паспорт не может быть выдан ранее достижения 14 лет',

  // validation/contacts.ts
  'phoneMain.required': 'Телефон обязателен',
  phoneDuplicate: 'Дополнительный телефон должен отличаться от основного',
  emailDuplicate: 'Дополнительный email должен отличаться от основного',

  // validation/employment.ts
  'employmentStatus.required': 'Укажите статус занятости',
  'companyName.required': 'Укажите название компании',
  'companyName.minLength': 'Минимум 3 символа',
  'companyName.maxLength': 'Максимум 200 символов',
  'companyInn.required': 'ИНН компании обязателен',
  'companyInn.pattern': 'ИНН компании — 10 цифр',
  'companyPhone.required': 'Телефон компании обязателен',
  'companyAddress.required': 'Адрес компании обязателен',
  'companyAddress.minLength': 'Минимум 10 символов',
  'companyAddress.maxLength': 'Максимум 300 символов',
  'position.required': 'Укажите должность',
  'position.minLength': 'Минимум 3 символа',
  'position.maxLength': 'Максимум 100 символов',
  'experienceYears.max': 'Максимум 60 лет',
  'workExperienceTotal.required': 'Укажите общий стаж',
  'workExperienceCurrent.required': 'Укажите стаж на текущем месте',
  'businessType.required': 'Укажите тип бизнеса',
  'businessInn.required': 'ИНН ИП обязателен',
  'businessInn.pattern': 'ИНН ИП — 12 цифр',
  'businessActivity.required': 'Укажите вид деятельности',
  'businessActivity.minLength': 'Минимум 10 символов',
  'businessActivity.maxLength': 'Максимум 300 символов',
  'monthlyIncome.required': 'Укажите ежемесячный доход',
  'monthlyIncome.min': 'Минимум 10 000 ₽',
  currentExperienceExceedsTotal: 'Стаж на текущем месте не может превышать общий стаж',
  additionalIncomeSourceRequired: 'Укажите источник дополнительного дохода',

  // validation/additional.ts
  'maritalStatus.required': 'Укажите семейное положение',
  'dependents.required': 'Укажите количество иждивенцев',
  'dependents.max': 'Максимум 10',
  'education.required': 'Укажите уровень образования',
  'properties.arrayEmpty': 'Добавьте хотя бы один объект имущества',
  'existingLoans.arrayEmpty': 'Добавьте информацию о кредите',
  'coBorrowers.arrayEmpty': 'Добавьте информацию о созаемщике',

  // validation/confirmation.ts
  'agreePersonalData.required': 'Согласие на обработку ПД обязательно',
  'agreeCreditHistory.required': 'Согласие на проверку кредитной истории обязательно',
  'agreeTerms.required': 'Согласие с условиями обязательно',
  'confirmAccuracy.required': 'Подтверждение точности обязательно',
  'electronicSignature.required': 'Введите код из СМС',
  'electronicSignature.minLength': 'Код — 6 символов',
  'electronicSignature.maxLength': 'Код — 6 символов',
  'electronicSignature.pattern': 'Только цифры',
  invalidSmsCode: 'Неверный код подтверждения. Для демо используйте: 123456',

  // validation/cross-step.ts
  paymentTooHigh:
    'Ежемесячный платеж не должен превышать 50% дохода (сейчас {paymentToIncomeRatio}%)',
  ageTooYoung: 'Заемщик должен быть старше 18 лет',
  ageTooOld: 'Заемщик должен быть младше 70 лет',
  highDebtLoad: 'Высокая долговая нагрузка. Рекомендуем уменьшить сумму или увеличить срок.',
  seniorAge: 'Могут потребоваться дополнительные гарантии в связи с возрастом.',
  lowWorkExperience: 'Малый стаж на текущем месте может повлиять на решение.',

  // validation/common/address.ts
  'address.region.required': 'Укажите регион',
  'address.region.minLength': 'Минимум 2 символа',
  'address.region.maxLength': 'Максимум 100 символов',
  'address.city.required': 'Укажите город',
  'address.city.minLength': 'Минимум 2 символа',
  'address.city.maxLength': 'Максимум 100 символов',
  'address.street.required': 'Укажите улицу',
  'address.street.minLength': 'Минимум 3 символа',
  'address.street.maxLength': 'Максимум 200 символов',
  'address.house.required': 'Укажите номер дома',
  'address.house.maxLength': 'Максимум 10 символов',
  'address.apartment.maxLength': 'Максимум 10 символов',
  'address.postalCode.required': 'Укажите почтовый индекс',
  'address.postalCode.pattern': 'Индекс должен содержать 6 цифр',

  // validation/common/property.ts
  'property.type.required': 'Укажите тип имущества',
  'property.description.required': 'Добавьте описание имущества',
  'property.description.minLength': 'Минимум 10 символов',
  'property.description.maxLength': 'Максимум 500 символов',
  'property.estimatedValue.required': 'Укажите оценочную стоимость',
  'property.estimatedValue.min': 'Минимальная стоимость: 10 000 ₽',

  // validation/common/existing-loan.ts
  'existingLoan.bank.required': 'Укажите название банка',
  'existingLoan.bank.minLength': 'Минимум 3 символа',
  'existingLoan.bank.maxLength': 'Максимум 100 символов',
  'existingLoan.type.required': 'Укажите тип кредита',
  'existingLoan.amount.required': 'Укажите сумму кредита',
  'existingLoan.amount.min': 'Минимум 1 000 ₽',
  'existingLoan.amount.max': 'Максимум 100 000 000 ₽',
  'existingLoan.remainingAmount.required': 'Укажите остаток долга',
  'existingLoan.monthlyPayment.required': 'Укажите ежемесячный платеж',
  'existingLoan.monthlyPayment.min': 'Минимум 100 ₽',
  'existingLoan.maturityDate.required': 'Укажите дату погашения',
  remainingExceedsAmount: 'Остаток долга не может превышать сумму кредита',
  maturityDateInPast: 'Дата погашения должна быть в будущем',

  // validation/common/co-borrower.ts
  'coBorrower.birthDate.required': 'Дата рождения обязательна',
  'coBorrower.birthDate.minAge': 'Созаемщику должно быть не менее 18 лет',
  'coBorrower.birthDate.maxAge': 'Созаемщику должно быть не более 80 лет',
  'coBorrower.phone.required': 'Телефон обязателен',
  'coBorrower.relationship.required': 'Укажите отношение к заемщику',
  'coBorrower.monthlyIncome.required': 'Укажите доход созаемщика',
  'coBorrower.monthlyIncome.min': 'Минимум 10 000 ₽',

  // Отбор файлов (FileUpload): коды отбора cdk, параметры — лимит и имя файла
  maxFiles: 'Максимум {maxFiles} файла(ов)',
  minFiles: 'Минимум {minFiles} файла(ов)',
  fileType: 'Недопустимый тип файла (разрешено: {accept})',
  maxFileSize: 'Файл больше 10 МБ',
  minFileSize: 'Файл пустой',
  maxTotalFileSize: 'Превышен суммарный размер файлов',
  fileExists: 'Файл {fileName} уже добавлен',
  uploadFailed: (params) => `Не удалось загрузить: ${String(params.reason ?? 'ошибка сети')}`,
  uploadAborted: 'Загрузка прервана',
});
