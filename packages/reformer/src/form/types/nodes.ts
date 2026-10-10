/**
 * Публичные контракты нод формы: {@link FormNode}, {@link FormControl}, {@link FormGroup},
 * {@link FormArray}.
 *
 * Ноды строит сборка (`createForm`); прикладной код работает с ними через эти интерфейсы, а классы
 * реализации — внутренние. Поля группы доступны точкой (`form.email`), а поле, имя которого занято
 * членом {@link FormNode} (`value`, `issues`, `reset`, …), — через пространство `form.$`.
 *
 * @group Types
 * @module form/types/nodes
 */

import type { ReadonlySignal } from '@preact/signals-core';
import type { ValidationIssue } from './contracts';
import type { ComponentRef } from './schema-node';

/**
 * Общий контракт ноды формы — поля, группы и массива под-форм.
 *
 * Значением нода не владеет: источник истины — модель (`model.$.<путь>`), нода держит состояние
 * взаимодействия (`touched`, `dirty`), доступность и замечания валидации.
 *
 * @typeParam T - Значение ноды
 *
 * @example
 * ```typescript
 * const { form } = createForm<{ email: string }>({ initial: { email: '' } });
 * form.email.setValue('user@mail.com');
 * form.email.markAsTouched();
 * form.valid.value; // true — замечаний нет
 * ```
 */
export interface FormNode<T> {
  /** Текущее значение. */
  readonly value: ReadonlySignal<T>;
  /** Замечаний, которые блокируют отправку, нет; нода включена и не ждёт проверки. */
  readonly valid: ReadonlySignal<boolean>;
  /** Есть блокирующие замечания; нода включена и не ждёт проверки. */
  readonly invalid: ReadonlySignal<boolean>;
  /** Идёт асинхронная проверка. */
  readonly pending: ReadonlySignal<boolean>;
  /** Нода отключена: её замечания сняты, в проверку она не входит. */
  readonly disabled: ReadonlySignal<boolean>;
  /** Пользователь взаимодействовал с нодой. */
  readonly touched: ReadonlySignal<boolean>;
  /** Значение меняли после создания или сброса. */
  readonly dirty: ReadonlySignal<boolean>;
  /** Замечания ноды; у группы и массива — свои и всех детей. */
  readonly issues: ReadonlySignal<readonly ValidationIssue[]>;

  /** Значение без подписки. */
  getValue(): T;
  /** Записать значение в модель. */
  setValue(value: T): void;
  /** Вернуть значение и состояние к начальным; с аргументом — к переданному значению. */
  reset(value?: T): void;
  markAsTouched(): void;
  markAsUntouched(): void;
  enable(): void;
  disable(): void;
  /** Поставить замечания извне (ответ сервера, своя проверка). */
  setIssues(issues: readonly ValidationIssue[]): void;
  clearIssues(): void;
}

/**
 * Поле формы: нода над листом модели и состояние его компонента.
 *
 * @typeParam T - Значение поля
 */
export interface FormControl<T> extends FormNode<T> {
  /** Компонент поля из узла схемы. */
  readonly component: ComponentRef | undefined;
  /** Пропсы компонента: из узла схемы и правок {@link FormControl.updateComponentProps}. */
  readonly componentProps: ReadonlySignal<Readonly<Record<string, unknown>>>;
  /** Показывать ли замечание: поле невалидно и его трогали или меняли. */
  readonly shouldShowError: ReadonlySignal<boolean>;
  /** Слить правку в пропсы компонента (например, опции после загрузки справочника). */
  updateComponentProps(patch: Record<string, unknown>): void;
}

/**
 * Массив под-форм: строка — {@link FormGroup} над элементом массива модели.
 *
 * Данными массив не владеет: мутации уходят в массив модели, формы строк держатся за под-модели
 * и при `move`/`swap` не пересоздаются.
 *
 * @typeParam T - Элемент массива
 */
export interface FormArray<T extends object> extends FormNode<T[]> {
  /** Число строк; чтение в эффекте или `computed` подписывает на изменения. */
  readonly length: number;
  at(index: number): FormGroup<T> | undefined;
  map<R>(callback: (row: FormGroup<T>, index: number) => R): R[];
  forEach(callback: (row: FormGroup<T>, index: number) => void): void;
  /** Стабильный ключ строки: держится за элемент модели и не меняется при `move` и `swap`. */
  keyAt(index: number): string;
  /** Добавить строку; без значения — по шаблону массива модели (`arrayOf(blank)`). */
  push(item?: T): void;
  insert(index: number, item?: T): void;
  removeAt(index: number): void;
  move(from: number, to: number): void;
  swap(first: number, second: number): void;
  clear(): void;
}

/**
 * Признак «объект-группа»: обычный объект, а не массив, дата, файл, функция или примитив.
 * `extends object` ловит и `interface`, и `type` (интерфейс не приводится к `Record`).
 * Значение неизвестной формы (`unknown`, `{}`) — поле: у него нет известных полей, и словарь
 * `Record<string, unknown>` остаётся группой полей, а не группой групп — иначе такая группа не
 * приводилась бы к `FormGroup<any>` внутри обобщённых типов (контекст React, элементы списка).
 *
 * @internal
 */
type IsGroupObject<V> =
  V extends ReadonlyArray<unknown>
    ? false
    : V extends Date | File | Blob
      ? false
      : V extends (...args: never[]) => unknown
        ? false
        : V extends object
          ? Record<never, never> extends V
            ? false
            : true
          : false;

/** `T` — это `any`. @internal */
type IsAny<T> = 0 extends 1 & T ? true : false;

/**
 * Ноды полей группы по именам полей данных: массив объектов — {@link FormArray}, объект —
 * {@link FormGroup}, остальное (примитивы, массивы примитивов, даты, файлы) — {@link FormControl}.
 * Опциональность снята: нода есть у каждого поля, опционально лишь значение.
 *
 * `FormFields<any>` — нестрогий словарь: так группа любой формы приводится к `FormGroup<any>`
 * (контекст React, обобщённые компоненты), а не упирается в отображение полей типа `any`.
 *
 * @typeParam T - Значение группы
 */
export type FormFields<T> =
  IsAny<T> extends true
    ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
      Record<string, any>
    : {
        [K in keyof T]-?: NonNullable<T[K]> extends ReadonlyArray<infer U>
          ? IsGroupObject<U> extends true
            ? FormArray<U & object>
            : FormControl<T[K]>
          : IsGroupObject<NonNullable<T[K]>> extends true
            ? FormGroup<NonNullable<T[K]>>
            : FormControl<T[K]>;
      };

/**
 * Группа полей: нода над группой модели и доступ к нодам полей.
 *
 * `form.email` — нода поля; поле с именем члена {@link FormNode} (`value`, `issues`, `reset`, …)
 * недостижимо точкой и доступно через `form.$`: `form.$.value`. Остальные имена полей данных
 * (`id`, `status`, `fields`, `submit`, …) ничем не затенены.
 *
 * @typeParam T - Значение группы
 *
 * @example
 * ```typescript
 * interface Order { status: string; value: number; customer: { name: string } }
 * const { form } = createForm<Order>({ initial: { status: 'new', value: 0, customer: { name: '' } } });
 * form.status.setValue('paid');      // поле данных
 * form.$.value.setValue(100);        // поле, затенённое членом ноды
 * form.customer.name.markAsTouched();
 * ```
 */
export type FormGroup<T> = FormNode<T> &
  Omit<FormFields<T>, keyof FormNode<T>> & {
    /** Ноды всех полей по имени, включая затенённые членами {@link FormNode}. */
    readonly $: FormFields<T>;
  };
