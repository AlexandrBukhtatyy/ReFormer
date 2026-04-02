import * as React from 'react';
import { useMemo } from 'react';
import { createForm, type FieldPath } from '@reformer/core';
import {
  FormRenderer,
  Box,
  Section,
  Collapsible,
  FormArray,
  type RenderSchemaFn,
  type RenderNode,
} from '@reformer/renderer-react';
import { required, email, minLength } from '@reformer/core/validators';
import {
  FormArrayAddButton,
  FormArrayRemoveButton,
  FormArrayItemIndex,
  FormArrayEmpty,
} from '@reformer/ui/form-array';
import type { SelectorRenderNode } from '@reformer/renderer-react';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

// ============================================================================
// Компоненты для selector-based FormArray
// ============================================================================

/**
 * Header секции адресов - использует FormArrayAddButton из контекста
 */
const AddressArrayHeader: React.FC<{ className?: string }> = ({ className }) => (
  <div className={className}>
    <h3 className="text-lg font-semibold text-gray-800">Адреса</h3>
    <FormArrayAddButton className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600 transition-colors">
      + Добавить адрес
    </FormArrayAddButton>
  </div>
);

/**
 * Пустое состояние массива адресов
 */
const AddressArrayEmpty: React.FC<{ className?: string }> = ({ className }) => (
  <FormArrayEmpty>
    <div className={className}>
      <div>Адреса не добавлены</div>
      <div className="text-sm mt-1">Нажмите кнопку выше, чтобы добавить адрес</div>
    </div>
  </FormArrayEmpty>
);

/**
 * Header элемента массива с индексом и кнопкой удаления
 */
const AddressItemHeader: React.FC<{ className?: string }> = ({ className }) => (
  <div className={className}>
    <span className="text-sm text-gray-600">
      Адрес #<FormArrayItemIndex />
    </span>
    <FormArrayRemoveButton className="text-red-500 hover:text-red-700 text-sm">
      Удалить
    </FormArrayRemoveButton>
  </div>
);

// FormField как обёртка для полей (передаётся в FormRenderer)
// Компонент Input/Textarea берётся из FieldNode.component

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
// RenderSchema - структура страницы (полностью декларативно)
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

      // Секция: Адреса (selector-based API для полной гибкости)
      {
        component: FormArray,
        componentProps: {
          array: path.addresses,
          className: 'bg-white p-4 rounded-lg shadow',

          // Selector-based children - каждый элемент определяет свою часть массива
          children: [
            // Header с заголовком и кнопкой добавления
            {
              selector: 'header',
              component: AddressArrayHeader,
              componentProps: {
                className: 'flex justify-between items-center mb-4',
              },
            },

            // Пустое состояние
            {
              selector: 'empty',
              component: AddressArrayEmpty,
              componentProps: {
                className:
                  'text-gray-500 text-center py-4 border-2 border-dashed border-gray-200 rounded-lg',
              },
            },

            // Элемент массива с вложенными селекторами
            {
              selector: 'item',
              component: Box,
              componentProps: {
                className: 'p-4 border border-gray-200 rounded-lg bg-gray-50 mb-4',
                children: [
                  // Header элемента с индексом и кнопкой удаления
                  {
                    selector: 'item:header',
                    component: AddressItemHeader,
                    componentProps: {
                      className: 'flex justify-between items-center mb-2',
                    },
                  },
                  // Контент элемента - сами поля
                  {
                    selector: 'item:content',
                    render: (itemPath: FieldPath<Address>) => ({
                      component: Box,
                      componentProps: {
                        className: 'grid grid-cols-3 gap-4',
                        children: [
                          { component: itemPath.city },
                          { component: itemPath.street },
                          { component: itemPath.zipCode },
                        ],
                      },
                    }),
                  },
                ],
              },
            },
          ] as SelectorRenderNode<ContactForm, Address>[],
        },
      },
    ] as RenderNode<ContactForm>[],
  },
});

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
      {/* Вся форма через RenderSchema с глобальной обёрткой для полей */}
      <FormRenderer form={form} render={renderSchema} fieldWrapper={FormField} />

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

          <h3 className="text-md font-semibold mt-4 mb-2">
            Массивы в RenderSchema (Selector API):
          </h3>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>
              <code className="bg-gray-100 px-1">FormArray</code> — компонент для массивов
            </li>
            <li>
              <code className="bg-gray-100 px-1">selector: &apos;header&apos;</code> — заголовок и
              кнопка добавления
            </li>
            <li>
              <code className="bg-gray-100 px-1">selector: &apos;empty&apos;</code> — пустое
              состояние
            </li>
            <li>
              <code className="bg-gray-100 px-1">selector: &apos;item&apos;</code> — обёртка
              элемента
            </li>
            <li>
              <code className="bg-gray-100 px-1">selector: &apos;item:header&apos;</code> —
              заголовок элемента (индекс, кнопка удаления)
            </li>
            <li>
              <code className="bg-gray-100 px-1">selector: &apos;item:content&apos;</code> — контент
              элемента (поля формы)
            </li>
          </ul>

          <h3 className="text-md font-semibold mt-4 mb-2">Marker-компоненты (@reformer/ui):</h3>
          <ul className="list-disc list-inside text-gray-600 space-y-1">
            <li>
              <code className="bg-gray-100 px-1">FormArrayAddButton</code> — кнопка добавления
              (использует контекст)
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArrayRemoveButton</code> — кнопка удаления
              элемента
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArrayItemIndex</code> — индекс текущего
              элемента
            </li>
            <li>
              <code className="bg-gray-100 px-1">FormArrayEmpty</code> — условный рендер при пустом
              массиве
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
