import type { JsonFormSchema } from '@reformer/renderer-json';

export const jsonSchema: JsonFormSchema = {
  version: '1.0',
  root: {
    component: 'FormRoot',
    children: [
      // ── Step 1: Кредит ────────────────────────────────────────────────────
      {
        component: 'Section',
        componentProps: { title: 'Шаг 1: Основная информация о кредите' },
        children: [
          {
            model: 'step1.loanType',
            component: 'Select',
            componentProps: {
              label: 'Тип кредита',
              placeholder: 'Выберите тип кредита',
              options: [
                { value: 'consumer', label: 'Потребительский' },
                { value: 'mortgage', label: 'Ипотека' },
                { value: 'car', label: 'Автокредит' },
                { value: 'business', label: 'Бизнес' },
                { value: 'refinancing', label: 'Рефинансирование' },
              ],
            },
          },
          {
            model: 'step1.loanAmount',
            component: 'Input',
            componentProps: {
              label: 'Сумма кредита (₽)',
              type: 'number',
              placeholder: 'Введите сумму',
            },
          },
          {
            model: 'step1.loanTerm',
            component: 'Input',
            componentProps: {
              label: 'Срок кредита (месяцев)',
              type: 'number',
              placeholder: 'Введите срок',
            },
          },
          {
            model: 'step1.loanPurpose',
            component: 'Textarea',
            componentProps: {
              label: 'Цель кредита',
              placeholder: 'Опишите, на что планируете потратить средства',
            },
          },
          {
            model: 'step1.propertyValue',
            component: 'Input',
            componentProps: {
              label: 'Стоимость недвижимости (₽)',
              type: 'number',
              placeholder: 'Введите стоимость',
            },
          },
          {
            model: 'step1.initialPayment',
            component: 'Input',
            componentProps: { label: 'Первоначальный взнос (₽)', type: 'number' },
          },
          {
            model: 'step1.carBrand',
            component: 'Input',
            componentProps: { label: 'Марка автомобиля', placeholder: 'Например: Toyota' },
          },
          {
            model: 'step1.carModel',
            component: 'Input',
            componentProps: { label: 'Модель автомобиля', placeholder: 'Например: Camry' },
          },
          {
            model: 'step1.carYear',
            component: 'Input',
            componentProps: { label: 'Год выпуска', type: 'number', placeholder: '2020' },
          },
          {
            model: 'step1.carPrice',
            component: 'Input',
            componentProps: {
              label: 'Стоимость автомобиля (₽)',
              type: 'number',
              placeholder: 'Введите стоимость',
            },
          },
          {
            model: 'step1.interestRate',
            component: 'Input',
            componentProps: { label: 'Процентная ставка (%)', type: 'number' },
          },
          {
            model: 'step1.monthlyPayment',
            component: 'Input',
            componentProps: { label: 'Ежемесячный платеж (₽)', type: 'number' },
          },
        ],
      },

      // ── Step 2: Персональные данные ───────────────────────────────────────
      {
        component: 'Section',
        componentProps: { title: 'Шаг 2: Персональные данные' },
        children: [
          {
            model: 'step2.personalData.lastName',
            component: 'Input',
            componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
          },
          {
            model: 'step2.personalData.firstName',
            component: 'Input',
            componentProps: { label: 'Имя', placeholder: 'Введите имя' },
          },
          {
            model: 'step2.personalData.middleName',
            component: 'Input',
            componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
          },
          {
            model: 'step2.personalData.birthDate',
            component: 'Input',
            componentProps: { label: 'Дата рождения', type: 'date' },
          },
          {
            model: 'step2.personalData.gender',
            component: 'Select',
            componentProps: {
              label: 'Пол',
              options: [
                { value: 'male', label: 'Мужской' },
                { value: 'female', label: 'Женский' },
              ],
            },
          },
          {
            model: 'step2.personalData.birthPlace',
            component: 'Input',
            componentProps: { label: 'Место рождения', placeholder: 'Введите место рождения' },
          },
          {
            model: 'step2.passportData.series',
            component: 'Input',
            componentProps: { label: 'Серия паспорта', placeholder: '12 34' },
          },
          {
            model: 'step2.passportData.number',
            component: 'Input',
            componentProps: { label: 'Номер паспорта', placeholder: '123456' },
          },
          {
            model: 'step2.passportData.issueDate',
            component: 'Input',
            componentProps: { label: 'Дата выдачи', type: 'date' },
          },
          {
            model: 'step2.passportData.issuedBy',
            component: 'Input',
            componentProps: { label: 'Кем выдан', placeholder: 'Введите название органа' },
          },
          {
            model: 'step2.passportData.departmentCode',
            component: 'Input',
            componentProps: { label: 'Код подразделения', placeholder: '123-456' },
          },
          {
            model: 'step2.inn',
            component: 'Input',
            componentProps: { label: 'ИНН', placeholder: '123456789012' },
          },
          {
            model: 'step2.snils',
            component: 'Input',
            componentProps: { label: 'СНИЛС', placeholder: '123-456-789 00' },
          },
          {
            model: 'step2.fullName',
            component: 'Input',
            componentProps: { label: 'Полное имя' },
          },
          {
            model: 'step2.age',
            component: 'Input',
            componentProps: { label: 'Возраст (лет)', type: 'number' },
          },
        ],
      },

      // ── Step 3: Контакты ──────────────────────────────────────────────────
      {
        component: 'Section',
        componentProps: { title: 'Шаг 3: Контактная информация' },
        children: [
          {
            model: 'step3.phoneMain',
            component: 'Input',
            componentProps: { label: 'Основной телефон', placeholder: '+7 (___) ___-__-__' },
          },
          {
            model: 'step3.phoneAdditional',
            component: 'Input',
            componentProps: { label: 'Дополнительный телефон', placeholder: '+7 (___) ___-__-__' },
          },
          {
            model: 'step3.email',
            component: 'Input',
            componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
          },
          {
            model: 'step3.emailAdditional',
            component: 'Input',
            componentProps: {
              label: 'Дополнительный email',
              type: 'email',
              placeholder: 'example@mail.com',
            },
          },
          {
            model: 'step3.registrationAddress.region',
            component: 'Input',
            componentProps: { label: 'Регион (адрес регистрации)', placeholder: 'Введите регион' },
          },
          {
            model: 'step3.registrationAddress.city',
            component: 'Input',
            componentProps: { label: 'Город (адрес регистрации)', placeholder: 'Введите город' },
          },
          {
            model: 'step3.registrationAddress.street',
            component: 'Input',
            componentProps: { label: 'Улица (адрес регистрации)', placeholder: 'Введите улицу' },
          },
          {
            model: 'step3.registrationAddress.house',
            component: 'Input',
            componentProps: { label: 'Дом', placeholder: '№' },
          },
          {
            model: 'step3.registrationAddress.apartment',
            component: 'Input',
            componentProps: { label: 'Квартира', placeholder: '№' },
          },
          {
            model: 'step3.registrationAddress.postalCode',
            component: 'Input',
            componentProps: { label: 'Индекс', placeholder: '000000' },
          },
          {
            model: 'step3.sameAsRegistration',
            component: 'Checkbox',
            componentProps: { label: 'Адрес проживания совпадает с адресом регистрации' },
          },
          {
            model: 'step3.residenceAddress.region',
            component: 'Input',
            componentProps: { label: 'Регион (адрес проживания)', placeholder: 'Введите регион' },
          },
          {
            model: 'step3.residenceAddress.city',
            component: 'Input',
            componentProps: { label: 'Город (адрес проживания)', placeholder: 'Введите город' },
          },
          {
            model: 'step3.residenceAddress.street',
            component: 'Input',
            componentProps: { label: 'Улица (адрес проживания)', placeholder: 'Введите улицу' },
          },
          {
            model: 'step3.residenceAddress.house',
            component: 'Input',
            componentProps: { label: 'Дом (адрес проживания)', placeholder: '№' },
          },
          {
            model: 'step3.residenceAddress.apartment',
            component: 'Input',
            componentProps: { label: 'Квартира (адрес проживания)', placeholder: '№' },
          },
          {
            model: 'step3.residenceAddress.postalCode',
            component: 'Input',
            componentProps: { label: 'Индекс (адрес проживания)', placeholder: '000000' },
          },
        ],
      },

      // ── Step 4: Занятость ─────────────────────────────────────────────────
      {
        component: 'Section',
        componentProps: { title: 'Шаг 4: Информация о занятости' },
        children: [
          {
            model: 'step4.employmentStatus',
            component: 'Select',
            componentProps: {
              label: 'Статус занятости',
              options: [
                { value: 'employed', label: 'Работаю по найму' },
                { value: 'selfEmployed', label: 'Самозанятый / ИП' },
                { value: 'unemployed', label: 'Не работаю' },
                { value: 'retired', label: 'Пенсионер' },
                { value: 'student', label: 'Студент' },
              ],
            },
          },
          {
            model: 'step4.companyName',
            component: 'Input',
            componentProps: { label: 'Название компании', placeholder: 'Введите название' },
          },
          {
            model: 'step4.companyInn',
            component: 'Input',
            componentProps: { label: 'ИНН компании', placeholder: '1234567890' },
          },
          {
            model: 'step4.companyPhone',
            component: 'Input',
            componentProps: { label: 'Телефон компании', placeholder: '+7 (___) ___-__-__' },
          },
          {
            model: 'step4.companyAddress',
            component: 'Input',
            componentProps: { label: 'Адрес компании', placeholder: 'Полный адрес' },
          },
          {
            model: 'step4.position',
            component: 'Input',
            componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
          },
          {
            model: 'step4.workExperienceTotal',
            component: 'Input',
            componentProps: {
              label: 'Общий стаж работы (месяцев)',
              type: 'number',
              placeholder: '0',
            },
          },
          {
            model: 'step4.workExperienceCurrent',
            component: 'Input',
            componentProps: {
              label: 'Стаж на текущем месте (месяцев)',
              type: 'number',
              placeholder: '0',
            },
          },
          {
            model: 'step4.monthlyIncome',
            component: 'Input',
            componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', placeholder: '0' },
          },
          {
            model: 'step4.additionalIncome',
            component: 'Input',
            componentProps: { label: 'Дополнительный доход (₽)', type: 'number', placeholder: '0' },
          },
          {
            model: 'step4.additionalIncomeSource',
            component: 'Input',
            componentProps: {
              label: 'Источник дополнительного дохода',
              placeholder: 'Опишите источник',
            },
          },
          {
            model: 'step4.businessType',
            component: 'Input',
            componentProps: { label: 'Тип бизнеса', placeholder: 'ИП, ООО и т.д.' },
          },
          {
            model: 'step4.businessInn',
            component: 'Input',
            componentProps: { label: 'ИНН ИП', placeholder: '123456789012' },
          },
          {
            model: 'step4.businessActivity',
            component: 'Textarea',
            componentProps: { label: 'Вид деятельности', placeholder: 'Опишите вид деятельности' },
          },
          {
            model: 'step4.totalIncome',
            component: 'Input',
            componentProps: { label: 'Общий доход (₽)', type: 'number' },
          },
          {
            model: 'step4.paymentToIncomeRatio',
            component: 'Input',
            componentProps: { label: 'Процент платежа от дохода (%)', type: 'number' },
          },
        ],
      },

      // ── Step 5: Дополнительно ─────────────────────────────────────────────
      {
        component: 'Section',
        componentProps: { title: 'Шаг 5: Дополнительная информация' },
        children: [
          {
            model: 'step5.maritalStatus',
            component: 'Select',
            componentProps: {
              label: 'Семейное положение',
              options: [
                { value: 'single', label: 'Холост / Не замужем' },
                { value: 'married', label: 'Женат / Замужем' },
                { value: 'divorced', label: 'Разведен(а)' },
                { value: 'widowed', label: 'Вдовец / Вдова' },
              ],
            },
          },
          {
            model: 'step5.dependents',
            component: 'Input',
            componentProps: { label: 'Количество иждивенцев', type: 'number', placeholder: '0' },
          },
          {
            model: 'step5.education',
            component: 'Select',
            componentProps: {
              label: 'Образование',
              placeholder: 'Выберите уровень образования',
              options: [
                { value: 'secondary', label: 'Среднее' },
                { value: 'specialized', label: 'Среднее специальное' },
                { value: 'higher', label: 'Высшее' },
                { value: 'postgraduate', label: 'Аспирантура / Ученая степень' },
              ],
            },
          },
          {
            model: 'step5.hasProperty',
            component: 'Checkbox',
            componentProps: { label: 'У меня есть имущество' },
          },
          {
            model: 'step5.hasExistingLoans',
            component: 'Checkbox',
            componentProps: { label: 'У меня есть другие кредиты' },
          },
          {
            model: 'step5.hasCoBorrower',
            component: 'Checkbox',
            componentProps: { label: 'Добавить созаемщика' },
          },
          {
            model: 'step5.coBorrowersIncome',
            component: 'Input',
            componentProps: { label: 'Доход созаемщиков (₽)', type: 'number' },
          },
        ],
      },

      // ── Step 6: Подтверждение ─────────────────────────────────────────────
      {
        component: 'Section',
        componentProps: { title: 'Шаг 6: Подтверждение и согласия' },
        children: [
          {
            model: 'step6.agreePersonalData',
            component: 'Checkbox',
            componentProps: { label: 'Согласие на обработку персональных данных' },
          },
          {
            model: 'step6.agreeCreditHistory',
            component: 'Checkbox',
            componentProps: { label: 'Согласие на проверку кредитной истории' },
          },
          {
            model: 'step6.agreeMarketing',
            component: 'Checkbox',
            componentProps: { label: 'Согласие на получение маркетинговых материалов' },
          },
          {
            model: 'step6.agreeTerms',
            component: 'Checkbox',
            componentProps: { label: 'Согласие с условиями кредитования' },
          },
          {
            model: 'step6.confirmAccuracy',
            component: 'Checkbox',
            componentProps: { label: 'Подтверждаю точность введенных данных' },
          },
          {
            model: 'step6.electronicSignature',
            component: 'Input',
            componentProps: { label: 'Код подтверждения из СМС', placeholder: '123456' },
          },
        ],
      },
    ],
  },
};
