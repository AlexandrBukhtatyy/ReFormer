/**
 * Примеры поведений (behaviors) с ReFormer
 * Демонстрирует все доступные behaviors
 */

import { useMemo } from 'react';
import { GroupNode, useFormControl, type GroupNodeWithControls, type FormSchema, type FieldNode, type FieldPath } from 'reformer';
import { required, min, max } from 'reformer/validators';
import {
  computeFrom,
  enableWhen,
  disableWhen,
  copyFrom,
  watchField,
  transformValue,
  resetWhen,
  syncFields,
  revalidateWhen,
  type BehaviorSchemaFn
} from 'reformer/behaviors';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ExampleCard } from '@/components/ui/example-card';

// Тип формы для демонстрации behaviors
interface BehaviorsDemoForm {
  // computeFrom: цена × количество = итого
  price: number;
  quantity: number;
  total: number;

  // enableWhen: страна -> город
  country: string;
  city: string;

  // enableWhen: чекбокс -> скидка
  hasDiscount: boolean;
  discountPercent: number;

  // disableWhen: readonly когда confirmed
  isConfirmed: boolean;
  editableField: string;

  // copyFrom: копирование адреса
  useShippingAsBilling: boolean;
  shippingAddress: string;
  billingAddress: string;

  // watchField: лог изменений
  watchedField: string;

  // transformValue: uppercase
  uppercaseField: string;

  // resetWhen: сброс при смене типа
  paymentType: string;
  cardNumber: string;

  // syncFields: синхронизация полей
  syncField1: string;
  syncField2: string;

  // revalidateWhen: перевалидация
  maxAmount: number;
  amount: number;
}

// Схема формы
const behaviorsFormSchema: FormSchema<BehaviorsDemoForm> = {
  price: {
    value: 100,
    component: Input,
    componentProps: { label: 'Цена', type: 'number', min: 0 },
  },
  quantity: {
    value: 1,
    component: Input,
    componentProps: { label: 'Количество', type: 'number', min: 1 },
  },
  total: {
    value: 100,
    component: Input,
    componentProps: { label: 'Итого', type: 'number', disabled: true },
  },
  country: {
    value: '',
    component: Select,
    componentProps: {
      label: 'Страна',
      placeholder: 'Выберите страну',
      options: [
        { value: 'ru', label: 'Россия' },
        { value: 'us', label: 'США' },
        { value: 'de', label: 'Германия' },
      ],
    },
  },
  city: {
    value: '',
    component: Input,
    componentProps: { label: 'Город', placeholder: 'Введите город' },
  },
  hasDiscount: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Применить скидку' },
  },
  discountPercent: {
    value: 0,
    component: Input,
    componentProps: { label: 'Процент скидки', type: 'number', min: 0, max: 100 },
  },
  isConfirmed: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Подтвердить' },
  },
  editableField: {
    value: 'Редактируемый текст',
    component: Input,
    componentProps: { label: 'Поле', placeholder: 'Введите текст' },
  },
  useShippingAsBilling: {
    value: false,
    component: Checkbox,
    componentProps: { label: 'Использовать адрес доставки' },
  },
  shippingAddress: {
    value: '',
    component: Input,
    componentProps: { label: 'Адрес доставки', placeholder: 'Введите адрес доставки' },
  },
  billingAddress: {
    value: '',
    component: Input,
    componentProps: { label: 'Адрес оплаты', placeholder: 'Введите адрес оплаты' },
  },
  watchedField: {
    value: '',
    component: Input,
    componentProps: { label: 'Отслеживаемое поле', placeholder: 'Введите что-нибудь' },
  },
  uppercaseField: {
    value: '',
    component: Input,
    componentProps: { label: 'Текст (в uppercase)', placeholder: 'Будет преобразован' },
  },
  paymentType: {
    value: '',
    component: Select,
    componentProps: {
      label: 'Способ оплаты',
      placeholder: 'Выберите способ',
      options: [
        { value: 'card', label: 'Карта' },
        { value: 'cash', label: 'Наличные' },
      ],
    },
  },
  cardNumber: {
    value: '',
    component: Input,
    componentProps: { label: 'Номер карты', placeholder: '0000 0000 0000 0000' },
  },
  syncField1: {
    value: '',
    component: Input,
    componentProps: { label: 'Поле 1', placeholder: 'Введите текст' },
  },
  syncField2: {
    value: '',
    component: Input,
    componentProps: { label: 'Поле 2', placeholder: 'Синхронизировано' },
  },
  maxAmount: {
    value: 1000,
    component: Input,
    componentProps: { label: 'Макс. сумма', type: 'number' },
  },
  amount: {
    value: 0,
    component: Input,
    componentProps: { label: 'Сумма', type: 'number' },
  },
};

// Валидация
const behaviorsFormValidation = (path: FieldPath<BehaviorsDemoForm>) => {
  required(path.price, { message: 'Укажите цену' });
  min(path.price, 0, { message: 'Цена не может быть отрицательной' });
  required(path.quantity, { message: 'Укажите количество' });
  min(path.quantity, 1, { message: 'Минимум 1' });

  // Динамическая валидация: amount <= maxAmount
  max(path.amount, 1000, { message: 'Превышен лимит' });
};

// Behavior схема
const behaviorsFormBehavior: BehaviorSchemaFn<BehaviorsDemoForm> = (path) => {
  // computeFrom: автоматический расчет total = price × quantity
  computeFrom(
    [path.price, path.quantity],
    path.total,
    (values) => ((values.price as number) || 0) * ((values.quantity as number) || 0)
  );

  // enableWhen: активировать поле города только если выбрана страна
  enableWhen(path.city, (form) => Boolean(form.country), {
    resetOnDisable: true,
  });

  // enableWhen: показывать поле скидки только если hasDiscount = true
  enableWhen(path.discountPercent, (form) => form.hasDiscount === true, {
    resetOnDisable: true,
  });

  // disableWhen: деактивировать поле когда подтверждено
  disableWhen(path.editableField, (form) => form.isConfirmed === true);

  // copyFrom: копировать адрес доставки в адрес оплаты
  copyFrom(path.shippingAddress, path.billingAddress, {
    when: (form) => form.useShippingAsBilling === true,
  });

  // watchField: отслеживание изменений (пример использует внешний callback)
  watchField(path.watchedField, (_value, _ctx) => {
    // Callback вызывается при каждом изменении
    // Можно обновлять UI, загружать данные и т.д.
  });

  // transformValue: преобразовать в uppercase
  transformValue(path.uppercaseField, (value) => value?.toUpperCase() ?? '');

  // resetWhen: сбросить номер карты когда способ оплаты != карта
  resetWhen(path.cardNumber, (form) => form.paymentType !== 'card', {
    resetValue: '',
  });

  // syncFields: синхронизация двух полей
  syncFields(path.syncField1, path.syncField2);

  // revalidateWhen: перевалидировать amount при изменении maxAmount
  revalidateWhen(path.amount, [path.maxAmount]);
};

function createBehaviorsForm(): GroupNodeWithControls<BehaviorsDemoForm> {
  return new GroupNode<BehaviorsDemoForm>({
    form: behaviorsFormSchema,
    validation: behaviorsFormValidation,
    behavior: behaviorsFormBehavior,
  });
}

// Компонент числового поля
function NumberField({
  control,
  label,
  readOnly = false,
}: {
  control: FieldNode<number>;
  label: string;
  readOnly?: boolean;
}) {
  const { value, disabled } = useFormControl(control);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => control.setValue(Number(e.target.value) || 0)}
        disabled={disabled || readOnly}
        className="w-full p-2 border rounded border-gray-300 disabled:bg-gray-100"
      />
    </div>
  );
}

// Компонент текстового поля
function TextField({
  control,
  label,
  placeholder = '',
}: {
  control: FieldNode<string>;
  label: string;
  placeholder?: string;
}) {
  const { value, disabled } = useFormControl(control);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full p-2 border rounded border-gray-300 disabled:bg-gray-100"
      />
    </div>
  );
}

// Компонент чекбокса
function CheckboxField({
  control,
  label,
}: {
  control: FieldNode<boolean>;
  label: string;
}) {
  const { value, disabled } = useFormControl(control);

  return (
    <div className="mb-4">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => control.setValue(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4"
        />
        <span className="text-sm font-medium">{label}</span>
      </label>
    </div>
  );
}

// Компонент select
function SelectField({
  control,
  label,
  options,
}: {
  control: FieldNode<string>;
  label: string;
  options: { value: string; label: string }[];
}) {
  const { value, disabled } = useFormControl(control);

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
        className="w-full p-2 border rounded border-gray-300 disabled:bg-gray-100"
      >
        <option value="">Выберите...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function BehaviorsExamples() {
  const form = useMemo(() => createBehaviorsForm(), []);

  // Подписываемся на изменения для условного рендеринга
  const { value: hasDiscount } = useFormControl(form.hasDiscount);
  const { value: country } = useFormControl(form.country);
  const { value: paymentType } = useFormControl(form.paymentType);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">Примеры поведений (Behaviors)</h2>
      <p className="text-gray-600 mb-6">
        Демонстрация реактивных поведений ReFormer
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ComputeFrom Example */}
        <ExampleCard
          title="computeFrom"
          description="Автоматический расчет: Итого = Цена × Количество"
          bgColor="bg-white"
          code={`computeFrom(
  [path.price, path.quantity],
  path.total,
  (values) => values.price * values.quantity
)`}
        >
          <div className="grid grid-cols-3 gap-4">
            <NumberField control={form.price} label="Цена" />
            <NumberField control={form.quantity} label="Количество" />
            <NumberField control={form.total} label="Итого" readOnly />
          </div>
        </ExampleCard>

        {/* EnableWhen Example - Country/City */}
        <ExampleCard
          title="enableWhen"
          description="Поле города активно только если выбрана страна"
          bgColor="bg-white"
          code={`enableWhen(
  path.city,
  (form) => Boolean(form.country),
  { resetOnDisable: true }
)`}
        >
          <SelectField
            control={form.country}
            label="Страна"
            options={[
              { value: 'ru', label: 'Россия' },
              { value: 'us', label: 'США' },
              { value: 'de', label: 'Германия' },
            ]}
          />
          <TextField
            control={form.city}
            label={`Город ${!country ? '(выберите страну)' : ''}`}
            placeholder="Введите город..."
          />
        </ExampleCard>

        {/* EnableWhen Example - Discount */}
        <ExampleCard
          title="enableWhen"
          description="Поле скидки активно только если включен чекбокс"
          bgColor="bg-white"
          code={`enableWhen(
  path.discountPercent,
  (form) => form.hasDiscount === true,
  { resetOnDisable: true }
)`}
        >
          <CheckboxField control={form.hasDiscount} label="Применить скидку" />
          {hasDiscount && (
            <NumberField control={form.discountPercent} label="Процент скидки" />
          )}
        </ExampleCard>

        {/* DisableWhen Example */}
        <ExampleCard
          title="disableWhen"
          description="Поле блокируется при подтверждении"
          bgColor="bg-white"
          code={`disableWhen(
  path.editableField,
  (form) => form.isConfirmed === true
)`}
        >
          <TextField
            control={form.editableField}
            label="Редактируемое поле"
            placeholder="Введите текст..."
          />
          <CheckboxField control={form.isConfirmed} label="Подтвердить (заблокировать поле)" />
        </ExampleCard>

        {/* CopyFrom Example */}
        <ExampleCard
          title="copyFrom"
          description="Копирование адреса доставки в адрес оплаты"
          bgColor="bg-white"
          code={`copyFrom(
  path.shippingAddress,
  path.billingAddress,
  { when: (form) => form.useShippingAsBilling }
)`}
        >
          <TextField
            control={form.shippingAddress}
            label="Адрес доставки"
            placeholder="Введите адрес..."
          />
          <CheckboxField control={form.useShippingAsBilling} label="Использовать для оплаты" />
          <TextField
            control={form.billingAddress}
            label="Адрес оплаты"
            placeholder="Будет скопирован..."
          />
        </ExampleCard>

        {/* WatchField Example */}
        <ExampleCard
          title="watchField"
          description="Отслеживание изменений поля с callback"
          bgColor="bg-white"
          code={`watchField(
  path.watchedField,
  (value, ctx) => {
    console.log('Новое значение:', value);
    // Можно делать API запросы, обновлять UI...
  }
)`}
        >
          <TextField
            control={form.watchedField}
            label="Отслеживаемое поле"
            placeholder="Введите что-нибудь..."
          />
          <p className="text-xs text-gray-500 mt-2">
            Смотрите консоль браузера для логов
          </p>
        </ExampleCard>

        {/* TransformValue Example */}
        <ExampleCard
          title="transformValue"
          description="Автоматическое преобразование текста в uppercase"
          bgColor="bg-white"
          code={`transformValue(
  path.uppercaseField,
  (value) => value?.toUpperCase() ?? ''
)`}
        >
          <TextField
            control={form.uppercaseField}
            label="Код (uppercase)"
            placeholder="Будет преобразован в uppercase..."
          />
        </ExampleCard>

        {/* ResetWhen Example */}
        <ExampleCard
          title="resetWhen"
          description="Сброс поля при смене условия"
          bgColor="bg-white"
          code={`resetWhen(
  path.cardNumber,
  (form) => form.paymentType !== 'card',
  { resetValue: '' }
)`}
        >
          <SelectField
            control={form.paymentType}
            label="Способ оплаты"
            options={[
              { value: 'card', label: 'Карта' },
              { value: 'cash', label: 'Наличные' },
            ]}
          />
          {paymentType === 'card' && (
            <TextField
              control={form.cardNumber}
              label="Номер карты"
              placeholder="0000 0000 0000 0000"
            />
          )}
          {paymentType === 'cash' && (
            <p className="text-sm text-gray-500">Номер карты сброшен</p>
          )}
        </ExampleCard>

        {/* SyncFields Example */}
        <ExampleCard
          title="syncFields"
          description="Двусторонняя синхронизация полей"
          bgColor="bg-white"
          code={`syncFields(
  path.syncField1,
  path.syncField2
)`}
        >
          <TextField
            control={form.syncField1}
            label="Поле 1"
            placeholder="Введите текст..."
          />
          <TextField
            control={form.syncField2}
            label="Поле 2 (синхронизировано)"
            placeholder="Синхронизировано с полем 1..."
          />
        </ExampleCard>

        {/* RevalidateWhen Example */}
        <ExampleCard
          title="revalidateWhen"
          description="Перевалидация при изменении зависимого поля"
          bgColor="bg-white"
          code={`revalidateWhen(
  path.amount,
  [path.maxAmount],
  { debounce: 300 }
)`}
        >
          <NumberField control={form.maxAmount} label="Макс. сумма" />
          <NumberField control={form.amount} label="Сумма (валидация: <= макс.)" />
          <p className="text-xs text-gray-500 mt-2">
            Измените макс. сумму — поле суммы перевалидируется
          </p>
        </ExampleCard>
      </div>

      {/* Reset Button */}
      <div className="mt-6">
        <button
          onClick={() => form.reset()}
          className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
        >
          Сбросить форму
        </button>
      </div>
    </div>
  );
}
