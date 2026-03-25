import * as React from 'react';
import { useMemo } from 'react';
import {
  createForm,
  useFormControl,
  FormRenderer,
  Box,
  Section,
  Collapsible,
  type RenderSchemaFn,
  type FieldNode,
  type FormProxy,
} from '@reformer/core';
import { required, email, minLength } from '@reformer/core/validators';
import { FormArray } from '@reformer/ui/form-array';

// ============================================================================
// Компоненты для полей
// ============================================================================

interface InputProps {
  control: FieldNode<string>;
  value?: string;
  errors?: Array<{ message: string }>;
  disabled?: boolean;
  shouldShowError?: boolean;
  componentProps?: Record<string, unknown>;
}

const Input: React.FC<InputProps> = ({ control, componentProps = {} }) => {
  const { value, errors, disabled, shouldShowError } = useFormControl(control);

  return (
    <div>
      {componentProps.label && (
        <label className="block mb-1 text-sm font-medium text-gray-700">
          {componentProps.label as string}
        </label>
      )}
      <input
        type="text"
        value={(value as string) ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        placeholder={componentProps.placeholder as string}
        disabled={disabled}
        className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {shouldShowError && errors[0] && (
        <span className="text-red-500 text-sm mt-1 block">{errors[0].message}</span>
      )}
    </div>
  );
};

interface TextareaProps {
  control: FieldNode<string>;
  value?: string;
  errors?: Array<{ message: string }>;
  disabled?: boolean;
  shouldShowError?: boolean;
  componentProps?: Record<string, unknown>;
}

const Textarea: React.FC<TextareaProps> = ({ control, componentProps = {} }) => {
  const { value, errors, disabled, shouldShowError } = useFormControl(control);

  return (
    <div>
      {componentProps.label && (
        <label className="block mb-1 text-sm font-medium text-gray-700">
          {componentProps.label as string}
        </label>
      )}
      <textarea
        value={(value as string) ?? ''}
        onChange={(e) => control.setValue(e.target.value)}
        onBlur={() => control.markAsTouched()}
        placeholder={componentProps.placeholder as string}
        disabled={disabled}
        rows={4}
        className="border rounded px-3 py-2 w-full focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {shouldShowError && errors[0] && (
        <span className="text-red-500 text-sm mt-1 block">{errors[0].message}</span>
      )}
    </div>
  );
};

// ============================================================================
// Типы формы
// ============================================================================

interface Address {
  city: string;
  street: string;
  zipCode: string;
}

interface ContactForm {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  message: string;
  notes: string;
  addresses: Address[];
}

// ============================================================================
// Создание формы
// ============================================================================

const createContactForm = () =>
  createForm<ContactForm>({
    form: {
      firstName: {
        value: '',
        component: Input,
        componentProps: { label: 'Имя', placeholder: 'Введите имя' },
      },
      lastName: {
        value: '',
        component: Input,
        componentProps: { label: 'Фамилия', placeholder: 'Введите фамилию' },
      },
      email: {
        value: '',
        component: Input,
        componentProps: { label: 'Email', placeholder: 'example@mail.com' },
      },
      phone: {
        value: '',
        component: Input,
        componentProps: { label: 'Телефон', placeholder: '+7 (999) 123-45-67' },
      },
      company: {
        value: '',
        component: Input,
        componentProps: { label: 'Компания', placeholder: 'Название компании' },
      },
      position: {
        value: '',
        component: Input,
        componentProps: { label: 'Должность', placeholder: 'Ваша должность' },
      },
      message: {
        value: '',
        component: Textarea,
        componentProps: { label: 'Сообщение', placeholder: 'Опишите ваш запрос...' },
      },
      notes: {
        value: '',
        component: Textarea,
        componentProps: {
          label: 'Дополнительные заметки',
          placeholder: 'Любая дополнительная информация...',
        },
      },
      // Массив адресов
      addresses: [
        {
          city: {
            value: '',
            component: Input,
            componentProps: { label: 'Город', placeholder: 'Москва' },
          },
          street: {
            value: '',
            component: Input,
            componentProps: { label: 'Улица', placeholder: 'ул. Пушкина, д. 10' },
          },
          zipCode: {
            value: '',
            component: Input,
            componentProps: { label: 'Индекс', placeholder: '123456' },
          },
        },
      ],
    },
    validation: (path) => {
      required(path.firstName, { message: 'Имя обязательно' });
      minLength(path.firstName, 2, { message: 'Минимум 2 символа' });
      required(path.lastName, { message: 'Фамилия обязательна' });
      minLength(path.lastName, 2, { message: 'Минимум 2 символа' });
      required(path.email, { message: 'Email обязателен' });
      email(path.email, { message: 'Некорректный email' });
      required(path.message, { message: 'Сообщение обязательно' });
      minLength(path.message, 10, { message: 'Минимум 10 символов' });
    },
  });

// ============================================================================
// RenderSchema - структура страницы (без массива)
// ============================================================================

const renderSchema: RenderSchemaFn<ContactForm> = (path) => ({
  component: Box,
  componentProps: {
    className: 'flex flex-col gap-6',
    children: [
      // Секция: Личные данные
      {
        component: Section,
        componentProps: {
          title: 'Личные данные',
          className: 'bg-white p-4 rounded-lg shadow',
          titleClassName: 'text-lg font-semibold text-gray-800 mb-4',
          children: [
            {
              component: Box,
              componentProps: {
                className: 'grid grid-cols-2 gap-4',
                children: [{ component: path.firstName }, { component: path.lastName }],
              },
            },
          ],
        },
      },

      // Секция: Контактная информация
      {
        component: Section,
        componentProps: {
          title: 'Контактная информация',
          className: 'bg-white p-4 rounded-lg shadow',
          titleClassName: 'text-lg font-semibold text-gray-800 mb-4',
          children: [
            {
              component: Box,
              componentProps: {
                className: 'grid grid-cols-2 gap-4',
                children: [{ component: path.email }, { component: path.phone }],
              },
            },
          ],
        },
      },

      // Секция: Рабочая информация (сворачиваемая)
      {
        component: Collapsible,
        componentProps: {
          title: 'Рабочая информация (опционально)',
          defaultOpen: false,
          className: 'bg-white p-4 rounded-lg shadow',
          titleClassName: 'text-lg font-semibold text-gray-800 cursor-pointer hover:text-blue-600',
          contentClassName: 'mt-4',
          children: [
            {
              component: Box,
              componentProps: {
                className: 'grid grid-cols-2 gap-4',
                children: [{ component: path.company }, { component: path.position }],
              },
            },
          ],
        },
      },

      // Секция: Сообщение
      {
        component: Section,
        componentProps: {
          title: 'Сообщение',
          className: 'bg-white p-4 rounded-lg shadow',
          titleClassName: 'text-lg font-semibold text-gray-800 mb-4',
          children: [{ component: path.message }],
        },
      },

      // Секция: Заметки (сворачиваемая)
      {
        component: Collapsible,
        componentProps: {
          title: 'Дополнительные заметки',
          defaultOpen: false,
          className: 'bg-white p-4 rounded-lg shadow',
          titleClassName: 'text-lg font-semibold text-gray-800 cursor-pointer hover:text-blue-600',
          contentClassName: 'mt-4',
          children: [{ component: path.notes }],
        },
      },
    ],
  },
});

// ============================================================================
// RenderSchema для элемента адреса
// ============================================================================

const addressItemRenderSchema: RenderSchemaFn<Address> = (path) => ({
  component: Box,
  componentProps: {
    className: 'grid grid-cols-3 gap-4',
    children: [{ component: path.city }, { component: path.street }, { component: path.zipCode }],
  },
});

// ============================================================================
// Компонент секции с массивом адресов (используя @reformer/ui)
// ============================================================================

interface AddressesSectionProps {
  form: ReturnType<typeof createContactForm>;
}

const AddressesSection: React.FC<AddressesSectionProps> = ({ form }) => {
  return (
    <section className="bg-white p-4 rounded-lg shadow">
      <FormArray.Root control={form.addresses}>
        {/* Заголовок с кнопкой добавления */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800">
            Адреса (<FormArray.Count />)
          </h3>
          <FormArray.AddButton className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Добавить адрес
          </FormArray.AddButton>
        </div>

        {/* Пустое состояние */}
        <FormArray.Empty>
          <p className="text-gray-500 text-sm italic py-4 text-center border-2 border-dashed border-gray-200 rounded-lg">
            Адреса не добавлены. Нажмите "Добавить адрес" чтобы начать.
          </p>
        </FormArray.Empty>

        {/* Список адресов */}
        <FormArray.List className="space-y-4">
          {({ control }: { control: FormProxy<Address> }) => (
            <div className="relative p-4 border border-gray-200 rounded-lg bg-gray-50 group">
              {/* Заголовок элемента с кнопкой удаления */}
              <div className="absolute top-2 right-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">
                  #<FormArray.ItemIndex offset={1} />
                </span>
                <FormArray.RemoveButton
                  className="p-1 text-red-500 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 rounded"
                  title="Удалить адрес"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </FormArray.RemoveButton>
              </div>

              {/* Поля адреса через FormRenderer */}
              <FormRenderer form={control} render={addressItemRenderSchema} />
            </div>
          )}
        </FormArray.List>
      </FormArray.Root>
    </section>
  );
};

// ============================================================================
// Компонент формы
// ============================================================================

function ContactFormWithRenderSchema() {
  const form = useMemo(() => createContactForm(), []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    form.markAsTouched();
    await form.validate();

    if (form.valid.value) {
      console.log('Отправка:', form.value.value);
      alert('Форма отправлена! Смотрите console.log');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl">
      {/* Основные поля через RenderSchema */}
      <FormRenderer form={form} render={renderSchema} />

      {/* Массив адресов - отдельный компонент с @reformer/ui */}
      <div className="mt-6">
        <AddressesSection form={form} />
      </div>

      <div className="mt-6 flex gap-4">
        <button
          type="submit"
          className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
        >
          Отправить
        </button>
        <button
          type="button"
          onClick={() => form.reset()}
          className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
        >
          Сбросить
        </button>
      </div>
    </form>
  );
}

// ============================================================================
// Страница примера
// ============================================================================

export default function RenderSchemaExample() {
  return (
    <div className="p-6 bg-gray-100 min-h-screen">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-2 text-gray-800">RenderSchema Example</h1>
        <p className="text-gray-600 mb-6">
          Декларативное описание структуры формы через RenderSchema. Включает динамический массив
          адресов с использованием <code className="bg-gray-200 px-1">@reformer/ui</code>.
        </p>

        <ContactFormWithRenderSchema />

        <div className="mt-8 p-4 bg-white rounded-lg shadow">
          <h2 className="text-lg font-semibold mb-2">Как это работает:</h2>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>
              <code className="bg-gray-100 px-1">RenderSchemaFn</code> — функция, описывающая
              структуру страницы
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormRenderer</code> — рекурсивно рендерит дерево
              узлов
            </li>
            <li>
              <code className="bg-gray-100 px-1">Box</code> — простой div-контейнер
            </li>
            <li>
              <code className="bg-gray-100 px-1">Section</code> — секция с заголовком
            </li>
            <li>
              <code className="bg-gray-100 px-1">Collapsible</code> — сворачиваемая секция
            </li>
          </ul>

          <h3 className="text-md font-semibold mt-4 mb-2">Массивы через @reformer/ui:</h3>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>
              <code className="bg-gray-100 px-1">FormArray.Root</code> — контекст для массива
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArray.List</code> — итерация по элементам
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArray.AddButton</code> — кнопка добавления
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArray.RemoveButton</code> — кнопка удаления
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArray.Empty</code> — пустое состояние
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArray.Count</code> — счётчик элементов
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArray.ItemIndex</code> — индекс элемента
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
