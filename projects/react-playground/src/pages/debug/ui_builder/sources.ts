/**
 * Исходники демо-формы: ровно то, что человек правит на странице.
 *
 * Это НЕ модули приложения, а тексты, которые страница транспилирует и исполняет в браузере
 * тем же механизмом, что и билдер. Поэтому они строками, а не файлами: файл собрался бы
 * сборщиком заранее, и демонстрировать было бы нечего.
 *
 * ## Раскладка — папки по ролям
 *
 * Имена файлов — те, что печатает кодоген конструктора (`06-form-directory-layout`):
 *
 * ```text
 * <форма>/
 * ├── types/order.ts            тип формы
 * ├── model/initial-value.ts    начальные значения   → createInitialValues
 * ├── behavior/index.ts         поведение            → behaviorRules, formBehavior
 * ├── validation/form.ts        валидация            → formRules, formValidation
 * ├── application/submit.ts     отправка             → wireSubmit
 * └── fixture.ts                фикстура — в корне модуля, рядом с папками ролей
 * ```
 *
 * Остальных файлов модуля в наборе нет намеренно. Документ формы (`schema/form.schema.json`)
 * задан здесь константой {@link DEMO_SCHEMA}, реестр (`schema/registry.ts`) и сборку
 * (`application/create.ts`) страница держит сама — как и превью билдера, которое страницу
 * модуля и его сборку не исполняет. Запросов к серверу (`api/index.ts`) нет вовсе: их
 * подставляет фикстура.
 *
 * @module pages/debug/ui_builder/sources
 */

import type { JsonFormSchema } from '@reformer/renderer-json';
import { FIXTURE_FILE } from '@reformer-domain/core/form-fixture';

import { ROLE_FILES } from './compile';

/**
 * Документ формы — формат 2: привязка к модели ключом `model`.
 *
 * В билдере его правят на канве; здесь он задан и не меняется.
 */
export const DEMO_SCHEMA: JsonFormSchema = {
  format: 2,
  version: '1.0',
  root: {
    component: '$component(Stack)',
    componentProps: { className: 'flex flex-col gap-4' },
    children: [
      {
        model: '$model(customer.name)',
        component: '$component(Input)',
        componentProps: { label: 'Имя клиента', placeholder: 'Иван Иванов' },
      },
      {
        // `selector` — адрес УЗЛА схемы для поведения формы (`schema.node('…')`), а не путь
        // модели: `hideWhen` прячет узел, и адресуется он именно так.
        selector: 'city-field',
        model: '$model(customer.city)',
        component: '$component(Select)',
        componentProps: { label: 'Город', options: '$dataSource(CITY_LIST)' },
      },
      {
        model: '$model(price)',
        component: '$component(Input)',
        componentProps: { label: 'Цена', type: 'number' },
      },
      {
        model: '$model(quantity)',
        component: '$component(Input)',
        componentProps: { label: 'Количество', type: 'number' },
      },
      {
        model: '$model(total)',
        component: '$component(Input)',
        componentProps: { label: 'Итого (compute)', type: 'number', readOnly: true },
      },
      {
        // Узел отправки: к нему `application/submit.ts` привязывает событие нажатия.
        selector: 'submit',
        component: '$component(Button)',
        componentProps: { label: 'Отправить' },
      },
    ],
  },
};

/** Один файл модуля формы. */
export interface DemoFile {
  /** Путь файла от корня модуля. */
  readonly name: string;
  readonly source: string;
  /** Зачем он здесь — подпись над редактором. */
  readonly hint: string;
}

/**
 * Начальные тексты — в том виде, в каком модуль формы печатает кодоген.
 *
 * Импорты настоящие: `@reformer/core/behaviors` и `@reformer/core/validation` резолвятся
 * реестром модулей в ТЕ ЖЕ экземпляры, которыми пользуется страница. Второй экземпляр ядра
 * сломал бы связь сигналов с узлами формы — ради этого реестр и существует.
 */
export const DEMO_FILES: readonly DemoFile[] = [
  {
    name: 'types/order.ts',
    hint: 'тип формы: транспилятор его стирает, нужен он текстам остальных файлов',
    source: `// types/order.ts — тип формы.

export type OrderForm = {
  customer: { name: string; city: string };
  price: number;
  quantity: number;
  total: number;
};
`,
  },
  {
    name: ROLE_FILES.initial,
    hint: 'начальные значения формы — фабрикой',
    source: `// model/initial-value.ts — начальные значения формы.

import type { OrderForm } from '../types/order';

/** Начальные значения: задают форму данных и снимок, к которому возвращает сброс. */
export function createInitialValues(): OrderForm {
  return {
    customer: { name: '', city: '' },
    price: 100,
    quantity: 2,
    total: 0,
  };
}
`,
  },
  {
    name: ROLE_FILES.behavior,
    hint: 'единственное поведение: связи над моделью («Итого») и правила узлов схемы («Город»)',
    source: `// behavior/index.ts — поведение формы: связи над моделью и правила узлов схемы.

import {
  computeFrom,
  defineFormBehavior,
  hideWhen,
  type BehaviorScope,
} from '@reformer/core/behaviors';
import type { OrderForm } from '../types/order';

/** Правила поведения формы. Функцией — чтобы сборка добавила к ним отправку. */
export function behaviorRules({ model, form, schema }: BehaviorScope<OrderForm>): void {
  // Связи над моделью
  computeFrom(
    [model.$.price, model.$.quantity],
    model.$.total,
    (price, quantity) => price * quantity
  );

  // Правила узлов схемы: город появляется, когда введено имя.
  hideWhen(schema.node('city-field'), () => !form.customer.name.value.value);
}

export const formBehavior = defineFormBehavior<OrderForm>(behaviorRules);
`,
  },
  {
    name: ROLE_FILES.validation,
    hint: 'правила: имя обязательно, количество не меньше единицы',
    source: `// validation/form.ts — валидация формы: поле validation сборки.

import type { FormValidation } from '@reformer/core';
import { defineValidation, validate } from '@reformer/core/validation';
import { min, required } from '@reformer/core/validators';
import type { OrderForm } from '../types/order';

/** Правила формы: проверяются при отправке. */
export const formRules = defineValidation<OrderForm>(({ model }) => {
  // Колбэк РЕГИСТРИРУЕТ правила вызовами validate: правило адресует сигнал модели,
  // а не строковый путь. Текст замечания — по коду правила из локали.
  validate(model.$.customer.name, [required()]);
  validate(model.$.quantity, [min(1)]);
});

/** Валидация формы — поле validation сборки. Сюда же — стратегия живой проверки (strategy). */
export const formValidation: FormValidation<OrderForm> = { rules: formRules };
`,
  },
  {
    name: ROLE_FILES.submit,
    hint: 'отправка над областью поведения: проверка → запрос → текст для человека',
    source: `// application/submit.ts — отправка формы: запрос → исход → текст для человека.

import { onComponentEvent, type BehaviorScope } from '@reformer/core/behaviors';
import { validateModel } from '@reformer/core/validation';
import { submitForm } from '../api';
import type { OrderForm } from '../types/order';
import { formRules } from '../validation/form';

/** Что отправке нужно от места подключения. */
export interface SubmitOptions {
  /** Показать итог: баннер на странице, тост, переход. */
  onResult?: (message: string, ok: boolean) => void;
}

/** Связать узел отправки схемы с отправкой формы. */
export function wireSubmit(
  { model, schema }: BehaviorScope<OrderForm>,
  { onResult }: SubmitOptions = {}
): void {
  onComponentEvent(schema.node('submit'), 'onClick', async () => {
    // touch: true обязателен — ошибку показывают только у ТРОНУТОГО поля. Без него
    // нажатие на пустой форме выглядело бы так, будто кнопка не работает.
    if (!(await validateModel(model, formRules, { touch: true }))) {
      onResult?.('Проверьте заполнение формы', false);
      return;
    }
    const result = await submitForm(model.get());
    onResult?.(result.success ? 'Отправлено: ' + result.data.id : result.error, result.success);
  });
}
`,
  },
  {
    name: FIXTURE_FILE,
    hint: 'фикстура: данные, подстановка модулей и окружение — форма не пойдёт в сеть',
    source: `export const fixture = {
  // Слой 1 — данные. Старше model/initial-value.ts: фикстуру пишут РАДИ проверки.
  model: { customer: { city: 'msk' } },
  dataSources: {
    CITY_LIST: [
      { value: 'msk', label: 'Москва' },
      { value: 'spb', label: 'Санкт-Петербург' },
    ],
  },

  // Слой 2 — модули. Ключ — строка импорта, как она НАПИСАНА в application/submit.ts.
  // Подменяет импорт формы, даже если такой файл существует.
  modules: {
    '../api': { submitForm: async () => ({ success: true, data: { id: 'DEMO-1' } }) },
  },

  // Слой 3 — окружение. Подставляется параметрами функции модуля, а не патчем globalThis.
  clock: { now: '2026-01-01T00:00:00Z', random: 0.42 },
};
`,
  },
];
