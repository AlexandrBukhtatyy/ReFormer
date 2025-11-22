/**
 * Примеры поведений (behaviors) с ReFormer
 * Демонстрирует computeFrom, enableWhen и условную логику
 */

import { useMemo } from 'react';
import { GroupNode, useFormControl, type GroupNodeWithControls, type FormSchema, type FieldNode, type FieldPath } from 'reformer';
import { required, min } from 'reformer/validators';
import { computeFrom, enableWhen, type BehaviorSchemaFn } from 'reformer/behaviors';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';

// Тип формы для демонстрации behaviors
interface BehaviorsDemoForm {
  // Калькулятор: цена × количество = итого
  price: number;
  quantity: number;
  total: number;

  // Условная активация
  country: string;
  city: string;

  // Условное отображение
  hasDiscount: boolean;
  discountPercent: number;
}

// Схема формы
const behaviorsFormSchema: FormSchema<BehaviorsDemoForm> = {
  price: {
    value: 100,
    component: Input,
    componentProps: {
      label: 'Цена',
      type: 'number',
      min: 0,
    },
  },
  quantity: {
    value: 1,
    component: Input,
    componentProps: {
      label: 'Количество',
      type: 'number',
      min: 1,
    },
  },
  total: {
    value: 100,
    component: Input,
    componentProps: {
      label: 'Итого',
      type: 'number',
      disabled: true,
    },
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
    componentProps: {
      label: 'Город',
      placeholder: 'Введите город',
    },
  },
  hasDiscount: {
    value: false,
    component: Checkbox,
    componentProps: {
      label: 'Применить скидку',
    },
  },
  discountPercent: {
    value: 0,
    component: Input,
    componentProps: {
      label: 'Процент скидки',
      type: 'number',
      min: 0,
      max: 100,
    },
  },
};

// Валидация - path это FieldPath<T>
const behaviorsFormValidation = (path: FieldPath<BehaviorsDemoForm>) => {
  required(path.price, { message: 'Укажите цену' });
  min(path.price, 0, { message: 'Цена не может быть отрицательной' });
  required(path.quantity, { message: 'Укажите количество' });
  min(path.quantity, 1, { message: 'Минимум 1' });
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
        value={value.value}
        onChange={(e) => control.setValue(Number(e.target.value) || 0)}
        disabled={disabled.value || readOnly}
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
        value={value.value ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled.value}
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
          checked={value.value}
          onChange={(e) => control.setValue(e.target.checked)}
          disabled={disabled.value}
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
        value={value.value}
        onChange={(e) => control.setValue(e.target.value)}
        disabled={disabled.value}
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

  // Читаем значения для условного рендеринга
  const hasDiscount = form.hasDiscount.value.value;
  const country = form.country.value.value;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-2">Примеры поведений (Behaviors)</h2>
      <p className="text-gray-600 mb-6">
        Демонстрация реактивных поведений ReFormer
      </p>

      {/* ComputeFrom Example */}
      <div className="mb-8 p-4 border rounded-lg bg-blue-50">
        <h3 className="text-lg font-semibold mb-2">
          🧮 computeFrom — Автоматический расчет
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Итого = Цена × Количество (вычисляется автоматически)
        </p>
        <div className="grid grid-cols-3 gap-4">
          <NumberField control={form.price} label="Цена" />
          <NumberField control={form.quantity} label="Количество" />
          <NumberField control={form.total} label="Итого" readOnly />
        </div>
        <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded mt-2 overflow-x-auto">
{`computeFrom(
  [path.price, path.quantity],
  path.total,
  (values) => values.price * values.quantity
)`}
        </pre>
      </div>

      {/* EnableWhen Example - Country/City */}
      <div className="mb-8 p-4 border rounded-lg bg-purple-50">
        <h3 className="text-lg font-semibold mb-2">
          🔒 enableWhen — Условная активация
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Поле города активно только если выбрана страна
        </p>
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
        <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded mt-2 overflow-x-auto">
{`enableWhen(
  path.city,
  (form) => Boolean(form.country),
  { resetOnDisable: true }
)`}
        </pre>
      </div>

      {/* EnableWhen Example - Discount */}
      <div className="mb-8 p-4 border rounded-lg bg-yellow-50">
        <h3 className="text-lg font-semibold mb-2">
          👁️ enableWhen — Условное отображение
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Поле скидки появляется только если включен чекбокс
        </p>
        <CheckboxField control={form.hasDiscount} label="Применить скидку" />
        {hasDiscount && (
          <NumberField control={form.discountPercent} label="Процент скидки" />
        )}
        <pre className="text-xs bg-gray-800 text-green-400 p-2 rounded mt-2 overflow-x-auto">
{`enableWhen(
  path.discountPercent,
  (form) => form.hasDiscount === true,
  { resetOnDisable: true }
)`}
        </pre>
      </div>

      {/* Other behaviors info */}
      <div className="mb-8 p-4 border rounded-lg bg-gray-50">
        <h3 className="text-lg font-semibold mb-2">
          📚 Другие behaviors
        </h3>
        <ul className="text-sm space-y-2">
          <li><code className="bg-gray-200 px-1 rounded">watchField</code> — Отслеживание изменений поля</li>
          <li><code className="bg-gray-200 px-1 rounded">copyFrom</code> — Копирование значения из другого поля</li>
          <li><code className="bg-gray-200 px-1 rounded">syncFields</code> — Синхронизация значений между полями</li>
          <li><code className="bg-gray-200 px-1 rounded">revalidateWhen</code> — Перевалидация при изменении зависимых полей</li>
          <li><code className="bg-gray-200 px-1 rounded">transformValue</code> — Трансформация значения (uppercase, trim)</li>
          <li><code className="bg-gray-200 px-1 rounded">resetWhen</code> — Сброс поля при определенном условии</li>
          <li><code className="bg-gray-200 px-1 rounded">showWhen</code> — Условное отображение поля</li>
        </ul>
      </div>

      {/* Reset Button */}
      <button
        onClick={() => form.reset()}
        className="px-4 py-2 bg-gray-200 rounded hover:bg-gray-300"
      >
        Сбросить форму
      </button>
    </div>
  );
}
