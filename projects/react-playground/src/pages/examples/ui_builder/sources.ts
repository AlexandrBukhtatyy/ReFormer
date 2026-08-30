/**
 * Исходники демо-формы: ровно то, что человек правит на странице.
 *
 * Это НЕ модули приложения, а тексты, которые страница транспилирует и исполняет в браузере
 * тем же механизмом, что и билдер v2. Поэтому они строками, а не файлами: файл собрался бы
 * сборщиком заранее, и демонстрировать было бы нечего.
 *
 * Состав повторяет канонический каталог формы (`06-form-directory-layout`) в объёме, который
 * видно на одном экране: модель, валидация, поведение — плюс фикстура, лежащая в билдере
 * отдельным деревом `_generated/reformer/`.
 *
 * @module pages/examples/ui_builder/sources
 */

import type { JsonFormSchema } from '@reformer/renderer-json';

/** Схема формы. В билдере её правят на канве; здесь она задана и не меняется. */
export const DEMO_SCHEMA: JsonFormSchema = {
  root: {
    component: '$component(Stack)',
    componentProps: { className: 'flex flex-col gap-4' },
    children: [
      {
        value: '$model(customer.name)',
        component: '$component(Input)',
        componentProps: { label: 'Имя клиента', placeholder: 'Иван Иванов' },
      },
      {
        // Селектор нужен правилу видимости: `hideWhen` прячет УЗЕЛ, и адресуется он именно так.
        selector: 'city-field',
        value: '$model(customer.city)',
        component: '$component(Select)',
        componentProps: { label: 'Город', options: '$dataSource(CITY_LIST)' },
      },
      {
        value: '$model(price)',
        component: '$component(Input)',
        componentProps: { label: 'Цена', type: 'number' },
      },
      {
        value: '$model(quantity)',
        component: '$component(Input)',
        componentProps: { label: 'Количество', type: 'number' },
      },
      {
        value: '$model(total)',
        component: '$component(Input)',
        componentProps: { label: 'Итого (compute)', type: 'number', readOnly: true },
      },
      {
        // `selector` — адрес узла для поведения РЕНДЕРА (`schema.node('…')`). Это не путь
        // модели: `renderer.behavior.ts` работает с узлами схемы, а не со значениями.
        selector: 'submit-button',
        component: '$component(Button)',
        componentProps: { label: 'Отправить' },
      },
    ],
  },
} as unknown as JsonFormSchema;

/** Один файл каталога формы. */
export interface DemoFile {
  readonly name: string;
  readonly source: string;
  /** Зачем он здесь — подпись над редактором. */
  readonly hint: string;
}

/**
 * Начальные тексты.
 *
 * Импорты настоящие: `@reformer/core/behaviors` и `@reformer/core/validation` резолвятся
 * реестром модулей в ТЕ ЖЕ экземпляры, которыми пользуется страница. Второй экземпляр ядра
 * сломал бы связь сигналов с узлами формы — ради этого реестр и существует.
 */
export const DEMO_FILES: readonly DemoFile[] = [
  {
    name: 'model.ts',
    hint: 'начальные значения формы',
    source: `export const initialFormModel = {
  customer: { name: '', city: '' },
  price: 100,
  quantity: 2,
  total: 0,
};
`,
  },
  {
    name: 'form.behavior.ts',
    hint: 'поведение модели: compute пересчитывает «Итого»',
    source: `import { compute, defineFormBehavior } from '@reformer/core/behaviors';

export const formBehavior = defineFormBehavior(({ model }) => {
  compute(model.$.total, () => model.$.price.value * model.$.quantity.value);
});
`,
  },
  {
    name: 'validation.ts',
    hint: 'правила: имя обязательно, количество не меньше единицы',
    source: `import { defineValidationSchema, validate } from '@reformer/core/validation';
import { min, required } from '@reformer/core/validators';

// Колбэк РЕГИСТРИРУЕТ правила вызовами validate, а не возвращает объект: правило
// адресует сигнал модели, а не строковый путь.
export const formValidation = defineValidationSchema(({ model }) => {
  validate(model.$.customer.name, [required({ message: 'Без имени не отправим' })]);
  validate(model.$.quantity, [min(1, { message: 'Минимум одна штука' })]);
});
`,
  },
  {
    name: 'renderer.behavior.ts',
    hint: 'поведение РЕНДЕРА: submit, видимость узлов, события компонентов',
    source: `import { hideWhen, onComponentEvent } from '@reformer/renderer-react';
import { validateModel } from '@reformer/core/validation';
import { formValidation } from './validation';
import { submitForm } from './api';

export function createJsonRenderBehavior(form, model, options = {}) {
  return (schema) => {
    // Видимость — свойство УЗЛА схемы, а не значения модели: поэтому она здесь,
    // а не в form.behavior.ts. Город появляется, когда введено имя.
    hideWhen(schema.node('city-field'), () => !form.customer.name.value.value);

    onComponentEvent(schema.node('submit-button'), 'onClick', async () => {
      // touch: true обязателен — ошибку показывают только у ТРОНУТОГО поля. Без него
      // нажатие на пустой форме выглядело бы так, будто кнопка не работает.
      if (!(await validateModel(model, formValidation, { touch: true }))) {
        options.onResult?.('Проверьте заполнение формы', false);
        return;
      }
      const result = await submitForm(model.get());
      options.onResult?.(result.success ? 'Отправлено: ' + result.data.id : result.error, result.success);
    });
  };
}
`,
  },
  {
    name: 'fixture.ts',
    hint: 'фикстура: данные, подстановка модулей и окружение — форма не пойдёт в сеть',
    source: `export const fixture = {
  // Слой 1 — данные. Старше model.ts: фикстуру пишут РАДИ проверки.
  model: { customer: { city: 'msk' } },
  dataSources: {
    CITY_LIST: [
      { value: 'msk', label: 'Москва' },
      { value: 'spb', label: 'Санкт-Петербург' },
    ],
  },

  // Слой 2 — модули. Подменяет импорт формы, даже если такой файл существует.
  modules: {
    './api': { submitForm: async () => ({ success: true, data: { id: 'DEMO-1' } }) },
  },

  // Слой 3 — окружение. Подставляется параметрами функции модуля, а не патчем globalThis.
  clock: { now: '2026-01-01T00:00:00Z', random: 0.42 },
};
`,
  },
];
