// @reformer-form-build ce84abaf8d4292f6 собран из form.intent.json; правка руками отсоединит файл от сборки
/**
 * Схема формы «Заявка на кредит» — одно дерево узлов на все способы реализации.
 *
 * Узел привязан к модели ключом `model`: поле, массив под-форм (`item`) или подформа
 * (`part`). По этому дереву сборка `createForm` строит форму, а `FormRenderer` рисует
 * разметку. Кто рисует разметку сам, в JSX, берёт из схемы только поля.
 */
import type { FormModel, FormSchemaNode } from '@reformer/core';
import { Step } from '@reformer/cdk/form-wizard';
import {
  Box,
  CheckboxWithLabel,
  FieldArray,
  FormWizard,
  Input,
  InputMask,
  InputNumber,
  RadioGroupOptions,
  Section,
  SelectAsync,
  Textarea,
} from '@reformer/ui-kit';
import { LOAN_TYPES } from './data-sources';
import type { CreditApplication, Property, ExistingLoan, CoBorrower } from './model';

/** Подформа: пути — от группы, к которой часть подключена. */
const address = (model: FormModel<CreditApplication['registrationAddress']>): FormSchemaNode => ({
  component: Box,
  children: [
    {
      selector: 'region',
      model: model.$.region,
      component: Input,
      componentProps: { placeholder: 'Введите регион', label: 'Регион' },
    },
    {
      selector: 'city',
      model: model.$.city,
      component: Input,
      componentProps: { placeholder: 'Введите город', label: 'Город' },
    },
    {
      selector: 'street',
      model: model.$.street,
      component: Input,
      componentProps: { placeholder: 'Введите улицу', label: 'Улица' },
    },
    {
      selector: 'house',
      model: model.$.house,
      component: Input,
      componentProps: { placeholder: '№', label: 'Дом' },
    },
    {
      selector: 'apartment',
      model: model.$.apartment,
      component: Input,
      componentProps: { placeholder: '№', label: 'Квартира' },
    },
    {
      selector: 'postalCode',
      model: model.$.postalCode,
      component: InputMask,
      componentProps: { mask: '999999', placeholder: '000000', label: 'Индекс' },
    },
  ],
});

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const propertiesRow = (model: FormModel<Property>): FormSchemaNode => ({
  component: 'div',
  children: [
    {
      selector: 'type',
      model: model.$.type,
      component: SelectAsync,
      componentProps: {
        placeholder: 'Выберите тип',
        options: [
          { value: 'apartment', label: 'Квартира' },
          { value: 'house', label: 'Дом' },
          { value: 'car', label: 'Автомобиль' },
          { value: 'land', label: 'Земельный участок' },
          { value: 'other', label: 'Другое' },
        ],
        label: 'Тип имущества',
        testId: 'properties-type',
      },
    },
    {
      selector: 'description',
      model: model.$.description,
      component: Textarea,
      componentProps: {
        placeholder: 'Опишите имущество',
        label: 'Описание',
        testId: 'properties-description',
      },
    },
    {
      selector: 'estimatedValue',
      model: model.$.estimatedValue,
      component: InputNumber,
      componentProps: { label: 'Оценочная стоимость', testId: 'properties-estimatedValue' },
    },
    {
      selector: 'hasEncumbrance',
      model: model.$.hasEncumbrance,
      component: CheckboxWithLabel,
      componentProps: {
        label: 'Имеется обременение (залог)',
        testId: 'properties-hasEncumbrance',
      },
    },
  ],
});

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const existingLoansRow = (model: FormModel<ExistingLoan>): FormSchemaNode => ({
  component: 'div',
  children: [
    {
      selector: 'bank',
      model: model.$.bank,
      component: Input,
      componentProps: {
        placeholder: 'Название банка',
        label: 'Банк',
        testId: 'existingLoans-bank',
      },
    },
    {
      selector: 'type',
      model: model.$.type,
      component: Input,
      componentProps: {
        placeholder: 'Тип кредита',
        label: 'Тип кредита',
        testId: 'existingLoans-type',
      },
    },
    {
      selector: 'amount',
      model: model.$.amount,
      component: InputNumber,
      componentProps: { label: 'Сумма кредита', testId: 'existingLoans-amount' },
    },
    {
      selector: 'remainingAmount',
      model: model.$.remainingAmount,
      component: InputNumber,
      componentProps: {
        label: 'Остаток задолженности',
        testId: 'existingLoans-remainingAmount',
      },
    },
    {
      selector: 'monthlyPayment',
      model: model.$.monthlyPayment,
      component: InputNumber,
      componentProps: { label: 'Ежемесячный платеж', testId: 'existingLoans-monthlyPayment' },
    },
    {
      selector: 'maturityDate',
      model: model.$.maturityDate,
      component: Input,
      componentProps: {
        type: 'date',
        label: 'Дата погашения',
        testId: 'existingLoans-maturityDate',
      },
    },
  ],
});

/** Строка массива: пути — от элемента. Шаблон нового элемента объявлен в `model.ts`. */
const coBorrowersRow = (model: FormModel<CoBorrower>): FormSchemaNode => ({
  component: 'div',
  children: [
    {
      selector: 'lastName',
      model: model.$.lastName,
      component: Input,
      componentProps: { label: 'Фамилия', testId: 'coBorrowers-lastName' },
    },
    {
      selector: 'firstName',
      model: model.$.firstName,
      component: Input,
      componentProps: { label: 'Имя', testId: 'coBorrowers-firstName' },
    },
    {
      selector: 'middleName',
      model: model.$.middleName,
      component: Input,
      componentProps: { label: 'Отчество', testId: 'coBorrowers-middleName' },
    },
    {
      selector: 'birthDate',
      model: model.$.birthDate,
      component: Input,
      componentProps: {
        type: 'date',
        label: 'Дата рождения',
        testId: 'coBorrowers-birthDate',
      },
    },
    {
      selector: 'phone',
      model: model.$.phone,
      component: InputMask,
      componentProps: {
        mask: '+7 (999) 999-99-99',
        placeholder: '+7 (___) ___-__-__',
        label: 'Телефон',
        testId: 'coBorrowers-phone',
      },
    },
    {
      selector: 'email',
      model: model.$.email,
      component: Input,
      componentProps: {
        type: 'email',
        placeholder: 'example@mail.com',
        label: 'Email',
        testId: 'coBorrowers-email',
      },
    },
    {
      selector: 'relationship',
      model: model.$.relationship,
      component: Input,
      componentProps: {
        placeholder: 'Укажите родство',
        label: 'Родство',
        testId: 'coBorrowers-relationship',
      },
    },
    {
      selector: 'monthlyIncome',
      model: model.$.monthlyIncome,
      component: InputNumber,
      componentProps: { label: 'Ежемесячный доход', testId: 'coBorrowers-monthlyIncome' },
    },
  ],
});

export const formSchema = (model: FormModel<CreditApplication>): FormSchemaNode => ({
  selector: 'wizard',
  component: FormWizard,
  componentProps: { submitLabel: 'Отправить заявку' },
  children: [
    {
      selector: 's1',
      component: Step,
      componentProps: { title: 'Кредит' },
      children: [
        {
          selector: 'loanType',
          model: model.$.loanType,
          component: SelectAsync,
          componentProps: {
            placeholder: 'Выберите тип кредита',
            label: 'Тип кредита',
            testId: 'loanType',
            options: LOAN_TYPES,
          },
        },
        {
          selector: 'loanAmount',
          model: model.$.loanAmount,
          component: InputNumber,
          componentProps: {
            placeholder: 'Введите сумму',
            step: 10000,
            label: 'Сумма кредита (₽)',
            testId: 'loanAmount',
          },
        },
        {
          selector: 'loanTerm',
          model: model.$.loanTerm,
          component: InputNumber,
          componentProps: {
            placeholder: 'Введите срок',
            label: 'Срок кредита (месяцев)',
            testId: 'loanTerm',
          },
        },
        {
          selector: 'loanPurpose',
          model: model.$.loanPurpose,
          component: Textarea,
          componentProps: {
            placeholder: 'Опишите, на что планируете потратить средства',
            maxLength: 500,
            label: 'Цель кредита',
            testId: 'loanPurpose',
          },
        },
        {
          selector: 'mortgage-section',
          component: Section,
          componentProps: { title: 'Ипотека' },
          children: [
            {
              selector: 'propertyValue',
              model: model.$.propertyValue,
              component: InputNumber,
              componentProps: {
                placeholder: 'Введите стоимость',
                label: 'Стоимость недвижимости (₽)',
                testId: 'propertyValue',
              },
            },
            {
              selector: 'initialPayment',
              model: model.$.initialPayment,
              disabled: true,
              component: InputNumber,
              componentProps: { label: 'Первоначальный взнос (₽)', testId: 'initialPayment' },
            },
          ],
        },
        {
          selector: 'car-section',
          component: Section,
          componentProps: { title: 'Автокредит' },
          children: [
            {
              selector: 'carBrand',
              model: model.$.carBrand,
              component: Input,
              componentProps: {
                placeholder: 'Например: Toyota',
                label: 'Марка автомобиля',
                testId: 'carBrand',
              },
            },
            {
              selector: 'carModel',
              model: model.$.carModel,
              component: Input,
              componentProps: {
                placeholder: 'Например: Camry',
                label: 'Модель автомобиля',
                testId: 'carModel',
              },
            },
            {
              selector: 'carYear',
              model: model.$.carYear,
              component: InputNumber,
              componentProps: { placeholder: '2020', label: 'Год выпуска', testId: 'carYear' },
            },
            {
              selector: 'carPrice',
              model: model.$.carPrice,
              component: InputNumber,
              componentProps: {
                placeholder: 'Введите стоимость',
                label: 'Стоимость автомобиля (₽)',
                testId: 'carPrice',
              },
            },
          ],
        },
        {
          selector: 'interestRate',
          model: model.$.interestRate,
          disabled: true,
          component: InputNumber,
          componentProps: { label: 'Процентная ставка (%)', testId: 'interestRate' },
        },
        {
          selector: 'monthlyPayment',
          model: model.$.monthlyPayment,
          disabled: true,
          component: InputNumber,
          componentProps: { label: 'Ежемесячный платеж (₽)', testId: 'monthlyPayment' },
        },
      ],
    },
    {
      selector: 's2',
      component: Step,
      componentProps: { title: 'Личные данные' },
      children: [
        {
          selector: 'personal-section',
          component: Section,
          componentProps: { title: 'Личные данные' },
          children: [
            {
              selector: 'personalData.lastName',
              model: model.$.personalData.lastName,
              component: Input,
              componentProps: {
                placeholder: 'Введите фамилию',
                label: 'Фамилия',
                testId: 'personalData-lastName',
              },
            },
            {
              selector: 'personalData.firstName',
              model: model.$.personalData.firstName,
              component: Input,
              componentProps: {
                placeholder: 'Введите имя',
                label: 'Имя',
                testId: 'personalData-firstName',
              },
            },
            {
              selector: 'personalData.middleName',
              model: model.$.personalData.middleName,
              component: Input,
              componentProps: {
                placeholder: 'Введите отчество',
                label: 'Отчество',
                testId: 'personalData-middleName',
              },
            },
            {
              selector: 'fullName',
              model: model.$.fullName,
              disabled: true,
              component: Input,
              componentProps: { label: 'Полное имя', testId: 'fullName' },
            },
            {
              selector: 'personalData.birthDate',
              model: model.$.personalData.birthDate,
              component: Input,
              componentProps: {
                type: 'date',
                label: 'Дата рождения',
                testId: 'personalData-birthDate',
              },
            },
            {
              selector: 'age',
              model: model.$.age,
              disabled: true,
              component: InputNumber,
              componentProps: { label: 'Возраст (лет)', testId: 'age' },
            },
            {
              selector: 'personalData.gender',
              model: model.$.personalData.gender,
              component: RadioGroupOptions,
              componentProps: {
                options: [
                  { value: 'male', label: 'Мужской' },
                  { value: 'female', label: 'Женский' },
                ],
                label: 'Пол',
                testId: 'personalData-gender',
              },
            },
            {
              selector: 'personalData.birthPlace',
              model: model.$.personalData.birthPlace,
              component: Input,
              componentProps: {
                placeholder: 'Введите место рождения',
                label: 'Место рождения',
                testId: 'personalData-birthPlace',
              },
            },
          ],
        },
        {
          selector: 'passport-section',
          component: Section,
          componentProps: { title: 'Паспортные данные' },
          children: [
            {
              selector: 'passportData.series',
              model: model.$.passportData.series,
              component: InputMask,
              componentProps: {
                mask: '99 99',
                placeholder: '12 34',
                label: 'Серия паспорта',
                testId: 'passportData-series',
              },
            },
            {
              selector: 'passportData.number',
              model: model.$.passportData.number,
              component: InputMask,
              componentProps: {
                mask: '999999',
                placeholder: '123456',
                label: 'Номер паспорта',
                testId: 'passportData-number',
              },
            },
            {
              selector: 'passportData.issueDate',
              model: model.$.passportData.issueDate,
              component: Input,
              componentProps: {
                type: 'date',
                label: 'Дата выдачи',
                testId: 'passportData-issueDate',
              },
            },
            {
              selector: 'passportData.issuedBy',
              model: model.$.passportData.issuedBy,
              component: Input,
              componentProps: {
                placeholder: 'Введите название органа',
                label: 'Кем выдан',
                testId: 'passportData-issuedBy',
              },
            },
            {
              selector: 'passportData.departmentCode',
              model: model.$.passportData.departmentCode,
              component: InputMask,
              componentProps: {
                mask: '999-999',
                placeholder: '123-456',
                label: 'Код подразделения',
                testId: 'passportData-departmentCode',
              },
            },
          ],
        },
        {
          selector: 'inn',
          model: model.$.inn,
          component: InputMask,
          componentProps: {
            mask: '999999999999',
            placeholder: '123456789012',
            label: 'ИНН',
            testId: 'inn',
          },
        },
        {
          selector: 'snils',
          model: model.$.snils,
          component: InputMask,
          componentProps: {
            mask: '999-999-999 99',
            placeholder: '123-456-789 00',
            label: 'СНИЛС',
            testId: 'snils',
          },
        },
      ],
    },
    {
      selector: 's3',
      component: Step,
      componentProps: { title: 'Контакты' },
      children: [
        {
          selector: 'phoneMain',
          model: model.$.phoneMain,
          component: InputMask,
          componentProps: {
            mask: '+7 (999) 999-99-99',
            placeholder: '+7 (___) ___-__-__',
            label: 'Основной телефон',
            testId: 'phoneMain',
          },
        },
        {
          selector: 'phoneAdditional',
          model: model.$.phoneAdditional,
          component: InputMask,
          componentProps: {
            mask: '+7 (999) 999-99-99',
            placeholder: '+7 (___) ___-__-__',
            label: 'Дополнительный телефон',
            testId: 'phoneAdditional',
          },
        },
        {
          selector: 'email',
          model: model.$.email,
          component: Input,
          componentProps: {
            type: 'email',
            placeholder: 'example@mail.com',
            label: 'Email',
            testId: 'email',
          },
        },
        {
          selector: 'sameEmail',
          model: model.$.sameEmail,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Дополнительный email совпадает с основным',
            testId: 'sameEmail',
          },
        },
        {
          selector: 'emailAdditional',
          model: model.$.emailAdditional,
          component: Input,
          componentProps: {
            type: 'email',
            placeholder: 'example@mail.com',
            label: 'Дополнительный email',
            testId: 'emailAdditional',
          },
        },
        {
          selector: 'reg-section',
          component: Section,
          componentProps: { title: 'Адрес регистрации' },
          children: [{ model: model.$.registrationAddress, part: address }],
        },
        {
          selector: 'sameAsRegistration',
          model: model.$.sameAsRegistration,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Адрес проживания совпадает с адресом регистрации',
            testId: 'sameAsRegistration',
          },
        },
        {
          selector: 'res-section',
          component: Section,
          componentProps: { title: 'Адрес проживания' },
          children: [{ model: model.$.residenceAddress, part: address }],
        },
      ],
    },
    {
      selector: 's4',
      component: Step,
      componentProps: { title: 'Работа' },
      children: [
        {
          selector: 'employmentStatus',
          model: model.$.employmentStatus,
          component: RadioGroupOptions,
          componentProps: {
            options: [
              { value: 'employed', label: 'Работаю по найму' },
              { value: 'selfEmployed', label: 'Самозанятый / ИП' },
              { value: 'unemployed', label: 'Не работаю' },
              { value: 'retired', label: 'Пенсионер' },
              { value: 'student', label: 'Студент' },
            ],
            label: 'Статус занятости',
            testId: 'employmentStatus',
          },
        },
        {
          selector: 'employed-section',
          component: Section,
          componentProps: { title: 'Работа по найму' },
          children: [
            {
              selector: 'companyName',
              model: model.$.companyName,
              component: Input,
              componentProps: {
                placeholder: 'Введите название',
                label: 'Название компании',
                testId: 'companyName',
              },
            },
            {
              selector: 'companyInn',
              model: model.$.companyInn,
              component: InputMask,
              componentProps: {
                mask: '9999999999',
                placeholder: '1234567890',
                label: 'ИНН компании',
                testId: 'companyInn',
              },
            },
            {
              selector: 'companyPhone',
              model: model.$.companyPhone,
              component: InputMask,
              componentProps: {
                mask: '+7 (999) 999-99-99',
                placeholder: '+7 (___) ___-__-__',
                label: 'Телефон компании',
                testId: 'companyPhone',
              },
            },
            {
              selector: 'companyAddress',
              model: model.$.companyAddress,
              component: Input,
              componentProps: {
                placeholder: 'Полный адрес',
                label: 'Адрес компании',
                testId: 'companyAddress',
              },
            },
            {
              selector: 'position',
              model: model.$.position,
              component: Input,
              componentProps: {
                placeholder: 'Ваша должность',
                label: 'Должность',
                testId: 'position',
              },
            },
          ],
        },
        {
          selector: 'self-section',
          component: Section,
          componentProps: { title: 'ИП' },
          children: [
            {
              selector: 'businessType',
              model: model.$.businessType,
              component: Input,
              componentProps: {
                placeholder: 'ИП, ООО и т.д.',
                label: 'Тип бизнеса',
                testId: 'businessType',
              },
            },
            {
              selector: 'businessInn',
              model: model.$.businessInn,
              component: InputMask,
              componentProps: {
                mask: '999999999999',
                placeholder: '123456789012',
                label: 'ИНН ИП',
                testId: 'businessInn',
              },
            },
            {
              selector: 'businessActivity',
              model: model.$.businessActivity,
              component: Textarea,
              componentProps: {
                placeholder: 'Опишите вид деятельности',
                label: 'Вид деятельности',
                testId: 'businessActivity',
              },
            },
          ],
        },
        {
          selector: 'workExperienceTotal',
          model: model.$.workExperienceTotal,
          component: InputNumber,
          componentProps: {
            placeholder: '0',
            label: 'Общий стаж работы (месяцев)',
            testId: 'workExperienceTotal',
          },
        },
        {
          selector: 'workExperienceCurrent',
          model: model.$.workExperienceCurrent,
          component: InputNumber,
          componentProps: {
            placeholder: '0',
            label: 'Стаж на текущем месте (месяцев)',
            testId: 'workExperienceCurrent',
          },
        },
        {
          selector: 'monthlyIncome',
          model: model.$.monthlyIncome,
          component: InputNumber,
          componentProps: {
            placeholder: '0',
            label: 'Ежемесячный доход (₽)',
            testId: 'monthlyIncome',
          },
        },
        {
          selector: 'additionalIncome',
          model: model.$.additionalIncome,
          component: InputNumber,
          componentProps: {
            placeholder: '0',
            label: 'Дополнительный доход (₽)',
            testId: 'additionalIncome',
          },
        },
        {
          selector: 'additionalIncomeSource',
          model: model.$.additionalIncomeSource,
          component: Input,
          componentProps: {
            placeholder: 'Опишите источник',
            label: 'Источник дополнительного дохода',
            testId: 'additionalIncomeSource',
          },
        },
        {
          selector: 'totalIncome',
          model: model.$.totalIncome,
          disabled: true,
          component: InputNumber,
          componentProps: { label: 'Общий доход (₽)', testId: 'totalIncome' },
        },
        {
          selector: 'paymentToIncomeRatio',
          model: model.$.paymentToIncomeRatio,
          disabled: true,
          component: InputNumber,
          componentProps: {
            label: 'Процент платежа от дохода (%)',
            testId: 'paymentToIncomeRatio',
          },
        },
      ],
    },
    {
      selector: 's5',
      component: Step,
      componentProps: { title: 'Дополнительно' },
      children: [
        {
          selector: 'maritalStatus',
          model: model.$.maritalStatus,
          component: RadioGroupOptions,
          componentProps: {
            options: [
              { value: 'single', label: 'Не женат / не замужем' },
              { value: 'married', label: 'Женат / замужем' },
              { value: 'divorced', label: 'Разведен(а)' },
              { value: 'widowed', label: 'Вдовец / вдова' },
            ],
            label: 'Семейное положение',
            testId: 'maritalStatus',
          },
        },
        {
          selector: 'dependents',
          model: model.$.dependents,
          component: InputNumber,
          componentProps: {
            placeholder: '0',
            label: 'Количество иждивенцев',
            testId: 'dependents',
          },
        },
        {
          selector: 'education',
          model: model.$.education,
          component: SelectAsync,
          componentProps: {
            placeholder: 'Выберите уровень образования',
            options: [
              { value: 'secondary', label: 'Среднее' },
              { value: 'specialized', label: 'Среднее специальное' },
              { value: 'higher', label: 'Высшее' },
              { value: 'postgraduate', label: 'Послевузовское' },
            ],
            label: 'Образование',
            testId: 'education',
          },
        },
        {
          selector: 'hasProperty',
          model: model.$.hasProperty,
          component: CheckboxWithLabel,
          componentProps: { label: 'У меня есть имущество', testId: 'hasProperty' },
        },
        {
          selector: 'properties-box',
          component: Box,
          children: [
            {
              selector: 'properties',
              model: model.$.properties,
              component: FieldArray,
              componentProps: {
                title: 'Имущество',
                addButtonLabel: '+ Добавить имущество',
                itemLabel: 'Имущество',
              },
              item: propertiesRow,
            },
          ],
        },
        {
          selector: 'hasExistingLoans',
          model: model.$.hasExistingLoans,
          component: CheckboxWithLabel,
          componentProps: { label: 'У меня есть другие кредиты', testId: 'hasExistingLoans' },
        },
        {
          selector: 'loans-box',
          component: Box,
          children: [
            {
              selector: 'existingLoans',
              model: model.$.existingLoans,
              component: FieldArray,
              componentProps: {
                title: 'Существующие кредиты',
                addButtonLabel: '+ Добавить кредит',
                itemLabel: 'Кредит',
              },
              item: existingLoansRow,
            },
          ],
        },
        {
          selector: 'hasCoBorrower',
          model: model.$.hasCoBorrower,
          component: CheckboxWithLabel,
          componentProps: { label: 'Добавить созаемщика', testId: 'hasCoBorrower' },
        },
        {
          selector: 'cob-box',
          component: Box,
          children: [
            {
              selector: 'coBorrowers',
              model: model.$.coBorrowers,
              component: FieldArray,
              componentProps: {
                title: 'Созаемщики',
                addButtonLabel: '+ Добавить созаемщика',
                itemLabel: 'Созаемщик',
              },
              item: coBorrowersRow,
            },
            {
              selector: 'coBorrowersIncome',
              model: model.$.coBorrowersIncome,
              disabled: true,
              component: InputNumber,
              componentProps: { label: 'Доход созаемщиков (₽)', testId: 'coBorrowersIncome' },
            },
          ],
        },
      ],
    },
    {
      selector: 's6',
      component: Step,
      componentProps: { title: 'Подтверждение' },
      children: [
        {
          selector: 'agreePersonalData',
          model: model.$.agreePersonalData,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Согласие на обработку персональных данных',
            testId: 'agreePersonalData',
          },
        },
        {
          selector: 'agreeCreditHistory',
          model: model.$.agreeCreditHistory,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Согласие на проверку кредитной истории',
            testId: 'agreeCreditHistory',
          },
        },
        {
          selector: 'agreeMarketing',
          model: model.$.agreeMarketing,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Согласие на получение маркетинговых материалов',
            testId: 'agreeMarketing',
          },
        },
        {
          selector: 'agreeTerms',
          model: model.$.agreeTerms,
          component: CheckboxWithLabel,
          componentProps: { label: 'Согласие с условиями кредитования', testId: 'agreeTerms' },
        },
        {
          selector: 'confirmAccuracy',
          model: model.$.confirmAccuracy,
          component: CheckboxWithLabel,
          componentProps: {
            label: 'Подтверждаю точность введенных данных',
            testId: 'confirmAccuracy',
          },
        },
        {
          selector: 'electronicSignature',
          model: model.$.electronicSignature,
          component: InputMask,
          componentProps: {
            mask: '999999',
            placeholder: '123456',
            label: 'Код подтверждения из СМС',
            testId: 'electronicSignature',
          },
        },
      ],
    },
  ],
});
