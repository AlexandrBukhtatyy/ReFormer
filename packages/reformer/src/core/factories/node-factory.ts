/**
 * NodeFactory - фабрика для создания узлов формы
 *
 * Инкапсулирует логику определения типа конфига и создания соответствующего узла.
 * Используется в GroupNode и ArrayNode для создания дочерних узлов.
 *
 * Паттерн Factory Method упрощает создание узлов и делает код более читаемым:
 * - Вместо if-else в GroupNode/ArrayNode
 * - Единая точка для создания узлов
 * - Легко добавлять новые типы узлов
 *
 * @example
 * ```typescript
 * const factory = new NodeFactory();
 *
 * // Создание FieldNode
 * const field = factory.createNode({ value: '', component: Input });
 *
 * // Создание GroupNode
 * const group = factory.createNode({
 *   email: { value: '', component: Input },
 *   password: { value: '', component: Input }
 * });
 *
 * // Создание ArrayNode
 * const array = factory.createNode({
 *   schema: { title: { value: '', component: Input } },
 *   initialItems: []
 * });
 * ```
 */

import { FieldNode } from '../nodes/field-node';
import { GroupNode } from '../nodes/group-node';
import { ArrayNode } from '../nodes/array-node';
import type { FormNode } from '../nodes/form-node';
import type { ConfigWithSchema, ConfigWithValue, UnknownRecord } from '../types';

/**
 * Фабрика для создания узлов формы
 *
 * Определяет тип конфига и создает соответствующий узел (FieldNode, GroupNode, ArrayNode)
 */
export class NodeFactory {
  /**
   * Создает узел формы на основе конфигурации
   *
   * ✅ ОБНОВЛЕНО: Теперь поддерживает массивы напрямую
   *
   * Автоматически определяет тип узла:
   * - FieldNode: имеет value и component
   * - ArrayNode: массив [schema, ...items] или { schema, initialItems }
   * - GroupNode: объект без value, component, schema
   *
   * @param config Конфигурация узла
   * @returns Экземпляр FieldNode, GroupNode или ArrayNode
   * @throws Error если конфиг не соответствует ни одному типу
   *
   * @example
   * ```typescript
   * const factory = new NodeFactory();
   *
   * // FieldNode
   * const field = factory.createNode({
   *   value: 'test@mail.com',
   *   component: Input,
   *   validators: [required, email]
   * });
   *
   * // GroupNode
   * const group = factory.createNode({
   *   email: { value: '', component: Input },
   *   password: { value: '', component: Input }
   * });
   *
   * // ArrayNode (объект)
   * const array = factory.createNode({
   *   schema: { title: { value: '', component: Input } },
   *   initialItems: [{ title: 'Item 1' }]
   * });
   *
   * // ArrayNode (массив) - новый формат
   * const array2 = factory.createNode([
   *   { title: { value: '', component: Input } }, // schema
   *   { title: 'Item 1' }, // initial item 1
   *   { title: 'Item 2' }  // initial item 2
   * ]);
   * ```
   */
  createNode<T>(config: unknown): FormNode<T> {
    // 0. ✅ НОВОЕ: Проверка массива (приоритет: специфический формат)
    if (Array.isArray(config) && config.length >= 1) {
      return this.createArrayNodeFromArray(config) as unknown as FormNode<T>;
    }

    // 1. Проверка FieldConfig (приоритет: самый специфичный тип)
    if (this.isFieldConfig(config)) {
      return new FieldNode(config as unknown as never) as unknown as FormNode<T>;
    }

    // 2. Проверка ArrayConfig
    if (this.isArrayConfig(config)) {
      const arrayConfig = config as ConfigWithSchema;
      return new ArrayNode(
        arrayConfig.schema as unknown as never,
        arrayConfig.initialItems as unknown as never
      ) as unknown as FormNode<T>;
    }

    // 3. Проверка GroupConfig (самый общий тип)
    if (this.isGroupConfig(config)) {
      return new GroupNode(config as unknown as never) as unknown as FormNode<T>;
    }

    // Неизвестный конфиг
    throw new Error(
      `NodeFactory: Unknown node config. Expected FieldConfig, GroupConfig, or ArrayConfig, but got: ${JSON.stringify(
        config
      )}`
    );
  }

  /**
   * Создать ArrayNode из массива [schema, ...initialItems]
   *
   * ✅ НОВОЕ: Извлечено из GroupNode для централизации логики
   *
   * Формат: [itemSchema, ...initialItems]
   * - Первый элемент - схема элемента массива
   * - Остальные элементы - начальные значения
   *
   * @param config Массив с схемой и начальными элементами
   * @returns ArrayNode
   *
   * @example
   * ```typescript
   * const factory = new NodeFactory();
   *
   * // Массив с начальными элементами
   * const array = factory.createArrayNodeFromArray([
   *   { title: { value: '', component: Input } }, // schema
   *   { title: 'Item 1' }, // initial value
   *   { title: 'Item 2' }  // initial value
   * ]);
   * ```
   * @private
   */
  private createArrayNodeFromArray(config: unknown[]): ArrayNode<object> {
    const [itemSchema, ...restItems] = config;

    // Обработка начальных элементов:
    // Если элемент - схема группы, извлечь значения
    const initialItems: unknown[] = [];

    //  ИСПРАВЛЕНИЕ: Первый элемент является и схемой, и первым элементом данных
    // Если первый элемент имеет значения (GroupConfig с value), добавляем его как первый item
    if (this.isGroupConfig(itemSchema)) {
      initialItems.push(this.extractValues(itemSchema));
    }

    // Добавляем остальные элементы
    for (const item of restItems) {
      if (this.isGroupConfig(item)) {
        initialItems.push(this.extractValues(item));
      } else {
        initialItems.push(item);
      }
    }

    return new ArrayNode(itemSchema as object, initialItems as object[]);
  }

  /**
   * Извлечь значения из схемы (рекурсивно)
   *
   * ✅ НОВОЕ: Извлечено из GroupNode для централизации логики
   *
   * Преобразует схему формы в объект со значениями:
   * - { name: { value: 'John', component: Input } } → { name: 'John' }
   * - Поддерживает вложенные группы
   * - Поддерживает массивы
   *
   * @param schema Схема формы
   * @returns Объект со значениями полей
   *
   * @example
   * ```typescript
   * const factory = new NodeFactory();
   *
   * const schema = {
   *   name: { value: 'John', component: Input },
   *   age: { value: 30, component: Input },
   *   address: {
   *     city: { value: 'Moscow', component: Input }
   *   }
   * };
   *
   * factory.extractValues(schema);
   * // { name: 'John', age: 30, address: { city: 'Moscow' } }
   * ```
   */
  extractValues(schema: unknown): unknown {
    // 1. FieldConfig - вернуть value
    if (this.isFieldConfig(schema)) {
      return (schema as ConfigWithValue).value;
    }

    // 2. Массив - рекурсивно обработать элементы
    if (Array.isArray(schema)) {
      return schema.map((item) => this.extractValues(item));
    }

    // 3. GroupConfig - рекурсивно извлечь значения всех полей
    if (this.isGroupConfig(schema)) {
      const result: UnknownRecord = {};

      for (const [key, config] of Object.entries(schema as UnknownRecord)) {
        result[key] = this.extractValues(config);
      }

      return result;
    }

    // 4. Примитивное значение - вернуть как есть
    return schema;
  }

  /**
   * Проверяет, является ли конфиг конфигурацией поля (FieldConfig)
   *
   * FieldConfig имеет обязательные свойства:
   * - value: начальное значение поля
   * - component: React-компонент для отображения
   *
   * @param config Проверяемая конфигурация
   * @returns true если config является FieldConfig
   *
   * @example
   * ```typescript
   * const factory = new NodeFactory();
   *
   * factory.isFieldConfig({ value: '', component: Input }); // true
   * factory.isFieldConfig({ email: { value: '' } }); // false
   * factory.isFieldConfig(null); // false
   * ```
   */
  isFieldConfig(config: unknown): boolean {
    return (
      config != null && typeof config === 'object' && 'value' in config && 'component' in config
    );
  }

  /**
   * Проверяет, является ли конфиг конфигурацией массива (ArrayConfig)
   *
   * ArrayConfig имеет обязательное свойство:
   * - schema: схема для элементов массива
   *
   * И НЕ имеет:
   * - value (отличие от FieldConfig)
   *
   * @param config Проверяемая конфигурация
   * @returns true если config является ArrayConfig
   *
   * @example
   * ```typescript
   * const factory = new NodeFactory();
   *
   * factory.isArrayConfig({ schema: {}, initialItems: [] }); // true
   * factory.isArrayConfig({ value: '', component: Input }); // false
   * factory.isArrayConfig({ email: { value: '' } }); // false
   * ```
   */
  isArrayConfig(config: unknown): boolean {
    return (
      config != null && typeof config === 'object' && 'schema' in config && !('value' in config)
    );
  }

  /**
   * Проверяет, является ли конфиг конфигурацией группы (GroupConfig)
   *
   * GroupConfig - это объект, который:
   * - НЕ является FieldConfig (нет value/component)
   * - НЕ является ArrayConfig (нет schema)
   * - Содержит вложенные конфиги полей/групп/массивов
   *
   * @param config Проверяемая конфигурация
   * @returns true если config является GroupConfig
   *
   * @example
   * ```typescript
   * const factory = new NodeFactory();
   *
   * factory.isGroupConfig({
   *   email: { value: '', component: Input },
   *   password: { value: '', component: Input }
   * }); // true
   *
   * factory.isGroupConfig({ value: '', component: Input }); // false
   * factory.isGroupConfig({ schema: {} }); // false
   * factory.isGroupConfig(null); // false
   * ```
   */
  isGroupConfig(config: unknown): boolean {
    return (
      config != null &&
      typeof config === 'object' &&
      !this.isFieldConfig(config) &&
      !this.isArrayConfig(config)
    );
  }
}
