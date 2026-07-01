/**
 * Типы для Proxy-доступа к полям формы
 *
 * Решает проблему типизации, когда GroupNode<T> использует Proxy для прямого доступа к полям.
 * TypeScript не может автоматически определить правильные типы для вложенных форм и массивов.
 *
 * @group Types
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
 * const form = createForm<MyForm>({ model, schema });
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

// Type-only импорты узлов — стираются при компиляции, runtime-цикла не создают.
// Циклические type-only ссылки (nodes ↔ form-proxy) TypeScript разрешает корректно.
import type { FieldNode } from '../nodes/field-node';
import type { GroupNode } from '../nodes/group-node';
import type { ArrayNode } from '../nodes/array-node';

/**
 * Признак «объект-группа» — обычный объект, который нужно обернуть в под-форму.
 *
 * Исключает массивы, спец-объекты (`Date`/`File`/`Blob`) и примитивы.
 * Используется как дискриминатор вместо `extends FormFields` (`Record<string, FormValue>`):
 * пользовательские модели почти всегда объявлены через `interface`, который НЕ assignable
 * к Record-типу (у интерфейса нет неявной index signature), и потому ошибочно проваливался
 * бы в ветку `FieldNode`. Проверка `extends object` корректно ловит и `interface`, и `type`.
 *
 * @internal
 */
type IsGroupObject<V> =
  V extends ReadonlyArray<unknown>
    ? false
    : V extends Date | File | Blob
      ? false
      : V extends object
        ? true
        : false;

/**
 * Мапит тип модели данных T на правильные типы узлов формы
 *
 * Рекурсивно определяет типы узлов на основе структуры данных:
 * - `T[K] extends Array<infer U>` где U - объект → `FormArrayProxy<U>`
 * - `T[K] extends Array<infer U>` где U - примитив → `FieldNode<T[K]>` (массив как обычное поле)
 * - `T[K] extends object` → `FormProxy<T[K]>` (вложенная форма с типизацией)
 * - `T[K]` примитив → `FieldNode<T[K]>` (простое поле)
 *
 * Использует NonNullable для правильной обработки опциональных полей
 *
 * @group Types
 * @category Proxy Types
 *
 * @template T - Тип модели данных формы
 */
export type FormControlsProxy<T> = {
  // `-?` снимает опциональность: для каждого поля схемы прокси всегда содержит узел
  // (включая опциональные поля — у них узел существует, опционально лишь значение).
  // Без этого `control.optionalField` имел бы тип `FieldNode<...> | undefined`.
  [K in keyof T]-?: NonNullable<T[K]> extends ReadonlyArray<infer U>
    ? IsGroupObject<U> extends true
      ? FormArrayProxy<U & object> // Массив объектов → FormArrayProxy
      : FieldNode<T[K]> // Массив примитивов → FieldNode
    : IsGroupObject<NonNullable<T[K]>> extends true
      ? FormProxy<NonNullable<T[K]>> // Обычный объект → FormProxy (рекурсивно!)
      : FieldNode<T[K]>; // Примитивы и спец-объекты (Date/File/Blob) → FieldNode
};

/**
 * Комбинированный тип для GroupNode с Proxy доступом к полям
 *
 * Объединяет методы и свойства GroupNode с типизированными полями формы.
 * Это позволяет использовать как API GroupNode, так и прямой доступ к полям.
 *
 * @group Types
 * @category Proxy Types
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
 * const form = createForm<UserForm>(schema);
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
export type FormProxy<T> = GroupNode<T> & FormControlsProxy<T>;

/**
 * Комбинированный тип для ArrayNode с Proxy доступом к элементам
 *
 * Объединяет методы и свойства ArrayNode с типизированным доступом к элементам массива.
 *
 * @group Types
 * @category Proxy Types
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
 * const todos: FormArrayProxy<TodoItem> = new ArrayNode(schema);
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
export type FormArrayProxy<T extends object> = ArrayNode<T> & {
  /**
   * Безопасный доступ к элементу массива по индексу
   * Возвращает GroupNode с типизированными полями или undefined
   */
  at(index: number): FormProxy<T> | undefined;

  /**
   * Итерация по элементам массива с типизированными элементами
   */
  forEach(callback: (item: FormProxy<T>, index: number) => void): void;

  /**
   * Маппинг элементов массива с типизированными элементами
   */
  map<R>(callback: (item: FormProxy<T>, index: number) => R): R[];
};
