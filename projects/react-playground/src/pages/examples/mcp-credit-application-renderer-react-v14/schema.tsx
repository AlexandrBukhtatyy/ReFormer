import {
  createForm,
  type FieldConfig,
  type FormProxy,
  type FormSchema,
  type ValidationSchemaFn,
  type BehaviorSchemaFn,
} from '@reformer/core';
import {
  required,
  min,
  max,
  minLength,
  maxLength,
  email as emailValidator,
  applyWhen,
} from '@reformer/core/validators';
import { computeFrom } from '@reformer/core/behaviors';
import {
  Box,
  Input,
  Textarea,
  Checkbox,
  RadioGroup,
  Select,
} from '@reformer/ui-kit';
import { FormWizard } from '@reformer/ui-kit/form-wizard';
import { FormArraySection } from '@reformer/ui-kit/form-array';
import { createRenderSchema } from '@reformer/renderer-react';
import { PropertyItemForm } from './PropertyItemForm';

// ---------- Types (Recipe 2: type aliases, not interface) ----------

export type LoanType = 'consumer' | 'mortgage' | 'car' | 'business' | 'refinance';
export type EmploymentStatus = 'employed' | 'selfEmployed' | 'unemployed' | 'retired' | 'student';
export type PropertyType = 'apartment' | 'house' | 'land' | 'car';

export type PropertyItem = {
  type: PropertyType;
  description: string;
  estimatedValue: number | null;
};

export type CreditApplicationForm = {
  // Step 1
  loanType: LoanType;
  loanAmount: number | null;
  loanTerm: number | null;
  loanPurpose: string;
  // Step 2
  lastName: string;
  firstName: string;
  middleName: string;
  birthDate: string;
  fullName: string;
  // Step 3
  phoneMain: string;
  email: string;
  city: string;
  // Step 4
  employmentStatus: EmploymentStatus;
  monthlyIncome: number | null;
  additionalIncome: number | null;
  companyName: string;
  totalIncome: number;
  // Step 5
  hasProperty: boolean;
  properties: PropertyItem[];
  // Step 6
  agreePersonalData: boolean;
  agreeTerms: boolean;
  confirmAccuracy: boolean;
};

// ---------- Form schema (component + componentProps in fields) ----------

const formSchema = {
  // Step 1
  loanType: {
    value: 'consumer',
    component: Select,
    componentProps: {
      label: 'Тип кредита',
      placeholder: 'Выберите тип кредита',
      options: [
        { value: 'consumer', label: 'Потребительский' },
        { value: 'mortgage', label: 'Ипотека' },
        { value: 'car', label: 'Автокредит' },
        { value: 'business', label: 'Бизнес' },
        { value: 'refinance', label: 'Рефинансирование' },
      ],
    },
  } satisfies FieldConfig<LoanType>,
  loanAmount: {
    value: null,
    component: Input,
    componentProps: { label: 'Сумма кредита (₽)', type: 'number', placeholder: 'Введите сумму' },
  },
  loanTerm: {
    value: 12,
    component: Input,
    componentProps: { label: 'Срок кредита (месяцев)', type: 'number', placeholder: 'Введите срок' },
  },
  loanPurpose: {
    value: '',
    component: Textarea,
    componentProps: {
      label: 'Цель кредита',
      placeholder: 'Опишите, на что планируете потратить средства',
    },
  },
  // Step 2
  lastName: {
    value: '',
    component: Input,
    componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
  },
  firstName: {
    value: '',
    component: Input,
    componentProps: { label: 'Имя', placeholder: 'Введите имя' },
  },
  middleName: {
    value: '',
    component: Input,
    componentProps: { label: 'Отчество', placeholder: 'Введите отчество' },
  },
  birthDate: {
    value: '',
    component: Input,
    componentProps: { label: 'Дата рождения', type: 'date' },
  },
  fullName: {
    value: '',
    component: Input,
    componentProps: { label: 'Полное имя (auto)', readOnly: true, disabled: true },
  },
  // Step 3
  phoneMain: {
    value: '',
    component: Input,
    componentProps: { label: 'Основной телефон', placeholder: '+7 999 999 99 99' },
  },
  email: {
    value: '',
    component: Input,
    componentProps: { label: 'Email', type: 'email', placeholder: 'example@mail.com' },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
  },
  // Step 4
  employmentStatus: {
    value: 'employed',
    component: RadioGroup,
    componentProps: {
      label: 'Статус занятости',
      options: [
        { value: 'employed', label: 'Работаю по найму' },
        { value: 'selfEmployed', label: 'ИП / самозанятый' },
        { value: 'unemployed', label: 'Не работаю' },
        { value: 'retired', label: 'Пенсионер' },
        { value: 'student', label: 'Студент' },
      ],
    },
  } satisfies FieldConfig<EmploymentStatus>,
  monthlyIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Ежемесячный доход (₽)', type: 'number', placeholder: '0' },
  },
  additionalIncome: {
    value: null,
    component: Input,
    componentProps: { label: 'Дополнительный доход (₽)', type: 'number', placeholder: '0' },
  },
  companyName: {
    value: '',
    component: Input,
    componentProps: { label: 'Название компании', placeholder: 'Введите название' },
  },
  totalIncome: {
    value: 0,
    component: Input,
    componentProps: { label: 'Общий доход (₽, auto)', type: 'number', readOnly: true, disabled: true },
  },
  // Step 5
  hasProperty: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'У меня есть имущество' },
  },
  properties: [
    {
      type: {
        value: 'apartment',
        component: Select,
        componentProps: {
          label: 'Тип имущества',
          options: [
            { value: 'apartment', label: 'Квартира' },
            { value: 'house', label: 'Дом' },
            { value: 'land', label: 'Земельный участок' },
            { value: 'car', label: 'Автомобиль' },
          ],
        },
      } satisfies FieldConfig<PropertyType>,
      description: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Описание', placeholder: 'Опишите имущество' },
      },
      estimatedValue: {
        value: 0,
        component: Input,
        componentProps: { label: 'Оценочная стоимость (₽)', type: 'number' },
      },
    },
  ] satisfies [FormSchema<PropertyItem>],
  // Step 6
  agreePersonalData: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие на обработку персональных данных' },
  },
  agreeTerms: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Согласие с условиями кредитования' },
  },
  confirmAccuracy: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтверждаю точность введенных данных' },
  },
} satisfies FormSchema<CreditApplicationForm>;

// ---------- Validation (per-step + full) ----------

const step1Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.loanType, { message: 'Выберите тип кредита' });
  required(path.loanAmount, { message: 'Введите сумму кредита' });
  min(path.loanAmount, 50000, { message: 'Минимальная сумма 50 000 ₽' });
  max(path.loanAmount, 10000000, { message: 'Максимальная сумма 10 000 000 ₽' });
  required(path.loanTerm, { message: 'Введите срок' });
  min(path.loanTerm, 6, { message: 'Минимум 6 месяцев' });
  max(path.loanTerm, 240, { message: 'Максимум 240 месяцев' });
  required(path.loanPurpose, { message: 'Опишите цель кредита' });
  minLength(path.loanPurpose, 10, { message: 'Минимум 10 символов' });
  maxLength(path.loanPurpose, 500, { message: 'Максимум 500 символов' });
};

const step2Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.lastName, { message: 'Введите фамилию' });
  required(path.firstName, { message: 'Введите имя' });
  required(path.middleName, { message: 'Введите отчество' });
  required(path.birthDate, { message: 'Укажите дату рождения' });
};

const step3Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.phoneMain, { message: 'Введите телефон' });
  required(path.email, { message: 'Введите email' });
  emailValidator(path.email, { message: 'Некорректный email' });
  required(path.city, { message: 'Введите город' });
};

const step4Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.employmentStatus, { message: 'Выберите статус' });
  required(path.monthlyIncome, { message: 'Укажите доход' });
  min(path.monthlyIncome, 10000, { message: 'Минимум 10 000 ₽' });
  // Conditional: companyName required only when employed
  applyWhen(
    path.employmentStatus,
    (value) => value === 'employed',
    (p) => {
      required(p.companyName, { message: 'Укажите название компании' });
    }
  );
};

const step5Validation: ValidationSchemaFn<CreditApplicationForm> = () => {
  // hasProperty optional; properties array validated implicitly via item required
};

const step6Validation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  required(path.agreePersonalData, { message: 'Необходимо согласие' });
  required(path.agreeTerms, { message: 'Необходимо согласие с условиями' });
  required(path.confirmAccuracy, { message: 'Подтвердите точность данных' });
};

const fullValidation: ValidationSchemaFn<CreditApplicationForm> = (path) => {
  step1Validation(path);
  step2Validation(path);
  step3Validation(path);
  step4Validation(path);
  step5Validation(path);
  step6Validation(path);
};

const STEP_VALIDATIONS: Record<number, ValidationSchemaFn<CreditApplicationForm>> = {
  1: step1Validation,
  2: step2Validation,
  3: step3Validation,
  4: step4Validation,
  5: step5Validation,
  6: step6Validation,
};

// ---------- Behavior (computed fields) ----------

const behavior: BehaviorSchemaFn<CreditApplicationForm> = (path) => {
  // C.4 fullName = lastName + firstName + middleName
  computeFrom(
    [path.lastName, path.firstName, path.middleName],
    path.fullName,
    ({ lastName, firstName, middleName }: CreditApplicationForm) =>
      [lastName, firstName, middleName].filter(Boolean).join(' ').trim()
  );

  // C.6 totalIncome = monthlyIncome + additionalIncome
  computeFrom(
    [path.monthlyIncome, path.additionalIncome],
    path.totalIncome,
    ({ monthlyIncome, additionalIncome }: CreditApplicationForm) =>
      (monthlyIncome ?? 0) + (additionalIncome ?? 0)
  );
};

// ---------- Form factory ----------

export function createCreditApplicationForm() {
  return createForm<CreditApplicationForm>({
    form: formSchema,
    validation: fullValidation,
    behavior,
  });
}

// ---------- Render schema (createRenderSchema) ----------

export function createCreditApplicationRenderSchema(
  form: FormProxy<CreditApplicationForm>,
  onSubmit: () => void | Promise<void>,
) {
  return createRenderSchema<CreditApplicationForm>((path) => ({
    selector: 'wizard',
    component: FormWizard,
    componentProps: {
      form,
      config: { stepValidations: STEP_VALIDATIONS, fullValidation },
      onSubmit,
      steps: [
        {
          number: 1,
          title: 'Кредит',
          icon: '💰',
          body: {
            selector: 'step-1',
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { component: path.loanType },
              { component: path.loanAmount },
              { component: path.loanTerm },
              { component: path.loanPurpose },
            ],
          },
        },
        {
          number: 2,
          title: 'Личные данные',
          icon: '👤',
          body: {
            selector: 'step-2',
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { component: path.lastName },
              { component: path.firstName },
              { component: path.middleName },
              { component: path.birthDate },
              { component: path.fullName },
            ],
          },
        },
        {
          number: 3,
          title: 'Контакты',
          icon: '📞',
          body: {
            selector: 'step-3',
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { component: path.phoneMain },
              { component: path.email },
              { component: path.city },
            ],
          },
        },
        {
          number: 4,
          title: 'Работа',
          icon: '💼',
          body: {
            selector: 'step-4',
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { component: path.employmentStatus },
              { component: path.companyName },
              { component: path.monthlyIncome },
              { component: path.additionalIncome },
              { component: path.totalIncome },
            ],
          },
        },
        {
          number: 5,
          title: 'Доп. инфо',
          icon: '🏠',
          body: {
            selector: 'step-5',
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { component: path.hasProperty },
              {
                selector: 'properties-section',
                component: FormArraySection,
                componentProps: {
                  control: path.properties,
                  itemComponent: PropertyItemForm,
                  title: 'Список имущества',
                  addButtonLabel: '+ Добавить имущество',
                  emptyMessage: 'Нажмите «Добавить имущество», чтобы добавить запись',
                  hasItems: form.hasProperty.value.value,
                  initialValue: {
                    type: 'apartment',
                    description: '',
                    estimatedValue: 0,
                  } satisfies Partial<PropertyItem>,
                },
              },
            ],
          },
        },
        {
          number: 6,
          title: 'Подтверждение',
          icon: '✅',
          body: {
            selector: 'step-6',
            component: Box,
            componentProps: { className: 'space-y-4' },
            children: [
              { component: path.agreePersonalData },
              { component: path.agreeTerms },
              { component: path.confirmAccuracy },
            ],
          },
        },
      ],
    },
  }));
}
