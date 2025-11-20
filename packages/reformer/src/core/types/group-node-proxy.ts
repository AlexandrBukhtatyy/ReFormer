/**
 * Типы для Proxy-доступа к полям GroupNode
 *
 * Решает проблему типизации, когда GroupNode<T> использует Proxy для прямого доступа к полям.
 * TypeScript не может автоматически определить правильные типы для вложенных форм и массивов.
 *
 * @example
 * ```typescript
 * interface MyForm {
 *   name: string;
 *   address: {
 *     city: string;
 *   };
 *   items: Array<{ title: string }>;
 * }
 *
 * const form: GroupNodeWithControls<MyForm> = new GroupNode(schema);
 *
 * //  TypeScript знает, что это FieldNode<string>
 * form.name.setValue('John');
 *
 * //  TypeScript знает, что это GroupNode<{city: string}>
 * form.address.city.setValue('Moscow');
 *
 * //  TypeScript знает, что это ArrayNode<{title: string}>
 * form.items.push({ title: 'New Item' });
 * ```
 */

import type { FormFields } from './index';

// Forward declarations для избежания циклических зависимостей
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FieldNode<_T> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GroupNode<_T> = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ArrayNode<_T> = any;

/**
 * Мапит тип модели данных T на правильные типы узлов формы
 *
 * Рекурсивно определяет типы узлов на основе структуры данных:
 * - `T[K] extends Array<infer U>` где U - объект → `ArrayNodeWithControls<U>`
 * - `T[K] extends Array<infer U>` где U - примитив → `FieldNode<T[K]>` (массив как обычное поле)
 * - `T[K] extends object` → `GroupNodeWithControls<T[K]>` (вложенная форма с типизацией)
 * - `T[K]` примитив → `FieldNode<T[K]>` (простое поле)
 *
 * Использует NonNullable для правильной обработки опциональных полей
 *
 * @template T - Тип модели данных формы
 */
export type FormNodeControls<T> = {
  [K in keyof T]: NonNullable<T[K]> extends Array<infer U>
    ? U extends FormFields
      ? ArrayNodeWithControls<U> // Массив объектов → ArrayNodeWithControls
      : FieldNode<T[K]> // Массив примитивов → FieldNode
    : NonNullable<T[K]> extends FormFields
      ? NonNullable<T[K]> extends Date | File | Blob
        ? FieldNode<T[K]> // Специальные объекты → FieldNode
        : GroupNodeWithControls<NonNullable<T[K]>> // Обычный объект → GroupNodeWithControls (рекурсивно!)
      : FieldNode<T[K]>; // Примитивные типы → FieldNode
};

/**
 * Комбинированный тип для GroupNode с Proxy доступом к полям
 *
 * Объединяет методы и свойства GroupNode с типизированными полями формы.
 * Это позволяет использовать как API GroupNode, так и прямой доступ к полям.
 *
 * @template T - Тип модели данных формы
 *
 * @example
 * ```typescript
 * interface UserForm {
 *   email: string;
 *   profile: {
 *     name: string;
 *     age: number;
 *   };
 * }
 *
 * const form: GroupNodeWithControls<UserForm> = new GroupNode(schema);
 *
 * // Доступ к методам GroupNode
 * await form.validate();
 * const values = form.getValue();
 * console.log(form.valid.value);
 *
 * // Прямой доступ к полям (через Proxy)
 * form.email.setValue('test@mail.com');
 * form.profile.name.setValue('John');
 * ```
 */
export type GroupNodeWithControls<T> = GroupNode<T> & FormNodeControls<T>;

/**
 * Комбинированный тип для ArrayNode с Proxy доступом к элементам
 *
 * Объединяет методы и свойства ArrayNode с типизированным доступом к элементам массива.
 *
 * @template T - Тип модели данных элемента массива
 *
 * @example
 * ```typescript
 * interface TodoItem {
 *   title: string;
 *   completed: boolean;
 * }
 *
 * const todos: ArrayNodeWithControls<TodoItem> = new ArrayNode(schema);
 *
 * // Доступ к методам ArrayNode
 * todos.push({ title: 'New todo', completed: false });
 * todos.removeAt(0);
 *
 * // Доступ к элементам (через Proxy)
 * todos.at(0)?.title.setValue('Updated title');
 *
 * // Итерация
 * todos.forEach((item, i) => {
 *   console.log(item.title.value.value);
 * });
 * ```
 */
export type ArrayNodeWithControls<T extends FormFields> = ArrayNode<T> & {
  /**
   * Безопасный доступ к элементу массива по индексу
   * Возвращает GroupNode с типизированными полями или undefined
   */
  at(index: number): GroupNodeWithControls<T> | undefined;

  /**
   * Итерация по элементам массива с типизированными элементами
   */
  forEach(callback: (item: GroupNodeWithControls<T>, index: number) => void): void;

  /**
   * Маппинг элементов массива с типизированными элементами
   */
  map<R>(callback: (item: GroupNodeWithControls<T>, index: number) => R): R[];
};
