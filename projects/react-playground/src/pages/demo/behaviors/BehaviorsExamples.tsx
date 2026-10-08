/**
 * Примеры поведений (behaviors) с ReFormer.
 * Поведения работают на ручках модели (`model.$.x`); ноды (form.x) отражают изменения.
 */

import {
  createForm,
  useFormBundle,
  useFormControl,
  useFormControlValue,
  type FieldNode,
  type FormModel,
  type ValidationError,
} from '@reformer/core';
import {
  computeFrom,
  copyFrom,
  defineFormBehavior,
  disableWhen,
  enableWhen,
  onChange,
  resetWhen,
  revalidateWhen,
  syncFields,
  transformValue,
} from '@reformer/core/behaviors';
import { validate, defineValidationSchema, validateModel } from '@reformer/core/validation';
import { required, min } from '@reformer/core/validators';
import { ExampleCard } from '@reformer/ui-kit';

interface BehaviorsDemoForm {
  price: number;
  quantity: number;
  total: number;
  country: string;
  city: string;
  hasDiscount: boolean;
  discountPercent: number;
  isConfirmed: boolean;
  editableField: string;
  useShippingAsBilling: boolean;
  shippingAddress: string;
  billingAddress: string;
  watchedField: string;
  uppercaseField: string;
  paymentType: string;
  cardNumber: string;
  syncField1: string;
  syncField2: string;
  maxAmount: number;
  amount: number;
}

const INITIAL: BehaviorsDemoForm = {
  price: 100,
  quantity: 1,
  total: 100,
  country: '',
  city: '',
  hasDiscount: false,
  discountPercent: 0,
  isConfirmed: false,
  editableField: 'Редактируемый текст',
  useShippingAsBilling: false,
  shippingAddress: '',
  billingAddress: '',
  watchedField: '',
  uppercaseField: '',
  paymentType: '',
  cardNumber: '',
  syncField1: '',
  syncField2: '',
  maxAmount: 1000,
  amount: 0,
};

// amount не больше maxAmount — cross-field правило (читает снапшот формы),
// поэтому в поведении навешан revalidateWhen на maxAmount.
const amountWithinMax = (f: BehaviorsDemoForm): ValidationError | null =>
  f.amount > f.maxAmount ? { code: 'max', message: 'Превышен лимит' } : null;

// Схема формы: только поля ({ model }), без валидаторов — правила живут в amountValidation.
function buildSchema(model: FormModel<BehaviorsDemoForm>) {
  // Поля рендерятся кастомными компонентами (raw <input>), поэтому component не задаём.
  return {
    children: [
      { model: model.$.price },
      { model: model.$.quantity },
      { model: model.$.total },
      { model: model.$.country },
      { model: model.$.city },
      { model: model.$.hasDiscount },
      { model: model.$.discountPercent },
      { model: model.$.isConfirmed },
      { model: model.$.editableField },
      { model: model.$.useShippingAsBilling },
      { model: model.$.shippingAddress },
      { model: model.$.billingAddress },
      { model: model.$.watchedField },
      { model: model.$.uppercaseField },
      { model: model.$.paymentType },
      { model: model.$.cardNumber },
      { model: model.$.syncField1 },
      { model: model.$.syncField2 },
      { model: model.$.maxAmount },
      { model: model.$.amount },
    ],
  };
}

// VALIDATION-схема (стабильный module-level const — важно для отмены устаревших прогонов).
// Прогоняется через validateModel; правила те же, что раньше жили в схеме.
const amountValidation = defineValidationSchema<BehaviorsDemoForm>(({ model, cross }) => {
  validate(model.$.price, [
    required({ message: 'Укажите цену' }),
    min(0, { message: 'Не отрицательное' }),
  ]);
  validate(model.$.quantity, [
    required({ message: 'Укажите количество' }),
    min(1, { message: 'Минимум 1' }),
  ]);
  cross(model.$.amount, amountWithinMax);
});

// ── Кастомные поля (raw HTML + useFormControl) ──────────────────────────────
function NumberField({
  control,
  label,
  readOnly = false,
  testId,
}: {
  control: FieldNode<number>;
  label: string;
  readOnly?: boolean;
  testId?: string;
}) {
  const { value, disabled } = useFormControl(control);
  return (
    <div className="mb-4" data-testid={testId ? `field-${testId}` : undefined}>
      <label
        className="block text-sm font-medium mb-1"
        data-testid={testId ? `label-${testId}` : undefined}
      >
        {label}
      </label>
      <input
        type="number"
        value={value}
        onChange={(e) => control.setValue(Number(e.target.value) || 0)}
        disabled={disabled || readOnly}
        className="w-full p-2 border rounded border-gray-300 disabled:bg-gray-100"
        data-testid={testId ? `input-${testId}` : undefined}
      />
    </div>
  );
}

function TextField({
  control,
  label,
  placeholder = '',
  testId,
}: {
  control: FieldNode<string>;
  label: string;
  placeholder?: string;
  testId?: string;
}) {
  const { value, disabled } = useFormControl(control);
  return (
    <div className="mb-4" data-testid={testId ? `field-${testId}` : undefined}>
      <label
        className="block text-sm font-medium mb-1"
        data-testid={testId ? `label-${testId}` : undefined}
      >
        {label}
      </label>
      <input
        type="text"
        value={value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full p-2 border rounded border-gray-300 disabled:bg-gray-100"
        data-testid={testId ? `input-${testId}` : undefined}
      />
    </div>
  );
}

function CheckboxField({
  control,
  label,
  testId,
}: {
  control: FieldNode<boolean>;
  label: string;
  testId?: string;
}) {
  const { value, disabled } = useFormControl(control);
  return (
    <div className="mb-4" data-testid={testId ? `field-${testId}` : undefined}>
      <label
        className="flex items-center gap-2"
        data-testid={testId ? `label-${testId}` : undefined}
      >
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => control.setValue(e.target.checked)}
          disabled={disabled}
          className="w-4 h-4"
          data-testid={testId ? `input-${testId}` : undefined}
        />
        <span className="text-sm font-medium">{label}</span>
      </label>
    </div>
  );
}

function SelectField({
  control,
  label,
  options,
  testId,
}: {
  control: FieldNode<string>;
  label: string;
  options: { value: string; label: string }[];
  testId?: string;
}) {
  const { value, disabled } = useFormControl(control);
  return (
    <div className="mb-4" data-testid={testId ? `field-${testId}` : undefined}>
      <label
        className="block text-sm font-medium mb-1"
        data-testid={testId ? `label-${testId}` : undefined}
      >
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled}
        className="w-full p-2 border rounded border-gray-300 disabled:bg-gray-100"
        data-testid={testId ? `input-${testId}` : undefined}
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

// Поведение формы: операторы сами регистрируются в схеме поведения, жизненным циклом владеет
// форма — очистка при её снятии происходит без ручного списка отписок.
const demoBehavior = defineFormBehavior<BehaviorsDemoForm>(({ model }) => {
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price: number, quantity: number) => (price || 0) * (quantity || 0)
  );
  enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true });
  enableWhen(model.$.discountPercent, () => model.hasDiscount === true, {
    resetOnDisable: true,
  });
  disableWhen(model.$.editableField, () => model.isConfirmed === true);
  copyFrom(model.$.shippingAddress, model.$.billingAddress, {
    when: () => model.useShippingAsBilling === true,
  });
  onChange(model.$.watchedField, () => {});
  transformValue(model.$.uppercaseField, (value) => (value ?? '').toUpperCase());
  resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' });
  syncFields(model.$.syncField1, model.$.syncField2);
  revalidateWhen([model.$.maxAmount], () => {
    void validateModel(model, amountValidation);
  });
});

export default function BehaviorsExamples() {
  // Сборка одним вызовом: модель, форма и поведение.
  const { form } = useFormBundle(() =>
    createForm<BehaviorsDemoForm>({
      initial: { ...INITIAL },
      schema: buildSchema,
      behavior: demoBehavior,
    })
  );

  const hasDiscount = useFormControlValue(form.hasDiscount) as boolean;
  const country = useFormControlValue(form.country) as string;
  const paymentType = useFormControlValue(form.paymentType) as string;

  return (
    <div className="mx-auto">
      <h2 className="text-2xl font-bold mb-2">Примеры поведений (Behaviors)</h2>
      <p className="text-gray-600 mb-6">Демонстрация реактивных поведений ReFormer</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ExampleCard
          title="computeFrom"
          description="Итого = Цена × Количество"
          bgColor="bg-white"
          code={`computeFrom([model.$.price, model.$.quantity], model.$.total, (p, q) => p * q)`}
        >
          <div className="grid grid-cols-3 gap-4">
            <NumberField control={form.price} label="Цена" testId="price" />
            <NumberField control={form.quantity} label="Количество" testId="quantity" />
            <NumberField control={form.total} label="Итого" readOnly testId="total" />
          </div>
        </ExampleCard>

        <ExampleCard
          title="enableWhen"
          description="Город активен только если выбрана страна"
          bgColor="bg-white"
          code={`enableWhen(model.$.city, () => Boolean(model.country), { resetOnDisable: true })`}
        >
          <SelectField
            control={form.country}
            label="Страна"
            testId="country"
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
            testId="city"
          />
        </ExampleCard>

        <ExampleCard
          title="enableWhen"
          description="Скидка активна только при включённом чекбоксе"
          bgColor="bg-white"
          code={`enableWhen(model.$.discountPercent, () => model.hasDiscount, { resetOnDisable: true })`}
        >
          <CheckboxField control={form.hasDiscount} label="Применить скидку" testId="hasDiscount" />
          {hasDiscount && (
            <NumberField
              control={form.discountPercent}
              label="Процент скидки"
              testId="discountPercent"
            />
          )}
        </ExampleCard>

        <ExampleCard
          title="disableWhen"
          description="Поле блокируется при подтверждении"
          bgColor="bg-white"
          code={`disableWhen(model.$.editableField, () => model.isConfirmed)`}
        >
          <TextField
            control={form.editableField}
            label="Редактируемое поле"
            placeholder="Введите текст..."
            testId="editableField"
          />
          <CheckboxField
            control={form.isConfirmed}
            label="Подтвердить (заблокировать)"
            testId="isConfirmed"
          />
        </ExampleCard>

        <ExampleCard
          title="copyFrom"
          description="Адрес доставки → адрес оплаты"
          bgColor="bg-white"
          code={`copyFrom(model.$.shippingAddress, model.$.billingAddress, { when: () => model.useShippingAsBilling })`}
        >
          <TextField
            control={form.shippingAddress}
            label="Адрес доставки"
            placeholder="Введите адрес..."
            testId="shippingAddress"
          />
          <CheckboxField
            control={form.useShippingAsBilling}
            label="Использовать для оплаты"
            testId="useShippingAsBilling"
          />
          <TextField
            control={form.billingAddress}
            label="Адрес оплаты"
            placeholder="Будет скопирован..."
            testId="billingAddress"
          />
        </ExampleCard>

        <ExampleCard
          title="onChange"
          description="Отслеживание изменений поля"
          bgColor="bg-white"
          code={`onChange(model.$.watchedField, (value) => { ... })`}
        >
          <TextField
            control={form.watchedField}
            label="Отслеживаемое поле"
            placeholder="Введите что-нибудь..."
            testId="watchedField"
          />
        </ExampleCard>

        <ExampleCard
          title="transformValue"
          description="Автопреобразование в uppercase"
          bgColor="bg-white"
          code={`transformValue(model.$.uppercaseField, (v) => v.toUpperCase())`}
        >
          <TextField
            control={form.uppercaseField}
            label="Код (uppercase)"
            placeholder="будет преобразован..."
            testId="uppercaseField"
          />
        </ExampleCard>

        <ExampleCard
          title="resetWhen"
          description="Сброс номера карты при смене способа оплаты"
          bgColor="bg-white"
          code={`resetWhen(model.$.cardNumber, () => model.paymentType !== 'card', { resetValue: '' })`}
        >
          <SelectField
            control={form.paymentType}
            label="Способ оплаты"
            testId="paymentType"
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
              testId="cardNumber"
            />
          )}
          {paymentType === 'cash' && <p className="text-sm text-gray-500">Номер карты сброшен</p>}
        </ExampleCard>

        <ExampleCard
          title="syncFields"
          description="Двусторонняя синхронизация"
          bgColor="bg-white"
          code={`syncFields(model.$.syncField1, model.$.syncField2)`}
        >
          <TextField
            control={form.syncField1}
            label="Поле 1"
            placeholder="Введите текст..."
            testId="syncField1"
          />
          <TextField
            control={form.syncField2}
            label="Поле 2 (синхронизировано)"
            placeholder="Синхронизировано..."
            testId="syncField2"
          />
        </ExampleCard>

        <ExampleCard
          title="revalidateWhen"
          description="Перевалидация amount при изменении maxAmount"
          bgColor="bg-white"
          code={`revalidateWhen([model.$.maxAmount], () => validateModel(model, amountValidation))`}
        >
          <NumberField control={form.maxAmount} label="Макс. сумма" testId="maxAmount" />
          <NumberField control={form.amount} label="Сумма (≤ макс.)" testId="amount" />
        </ExampleCard>
      </div>

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
