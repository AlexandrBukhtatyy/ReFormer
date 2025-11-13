/**
 * Сегмент пути к полю формы
 *
 * Представляет один сегмент в пути к полю, например:
 * - "email" → { key: 'email' }
 * - "items[0]" → { key: 'items', index: 0 }
 *
 * @example
 * ```typescript
 * // Путь "items[0].name" разбивается на:
 * [
 *   { key: 'items', index: 0 },
 *   { key: 'name' }
 * ]
 * ```
 */
export interface PathSegment {
  /**
   * Ключ поля
   */
  key: string;

  /**
   * Индекс в массиве (опционально)
   * Присутствует только для сегментов вида "items[0]"
   */
  index?: number;
}

/**
 * Навигация по путям к полям формы
 *
 * Централизует логику парсинга и навигации по путям к полям формы.
 * Используется в ValidationContext, BehaviorContext, GroupNode для единообразной
 * обработки путей вида "address.city" или "items[0].name".
 *
 * Устраняет дублирование логики парсинга путей в 4 местах кодовой базы.
 *
 * @example
 * ```typescript
 * const navigator = new FieldPathNavigator();
 *
 * // Парсинг пути
 * const segments = navigator.parsePath('items[0].title');
 * // [{ key: 'items', index: 0 }, { key: 'title' }]
 *
 * // Получение значения из объекта
 * const obj = { items: [{ title: 'Item 1' }] };
 * const value = navigator.getValueByPath(obj, 'items[0].title');
 * // 'Item 1'
 *
 * // Получение узла формы
 * const titleNode = navigator.getNodeByPath(form, 'items[0].title');
 * titleNode?.setValue('New Title');
 * ```
 */
export class FieldPathNavigator {
  /**
   * Парсит путь в массив сегментов
   *
   * Поддерживаемые форматы:
   * - Простые пути: "name", "email"
   * - Вложенные пути: "address.city", "user.profile.avatar"
   * - Массивы: "items[0]", "items[0].name", "tags[1][0]"
   * - Комбинации: "orders[0].items[1].price"
   *
   * @param path Путь к полю (строка с точками и квадратными скобками)
   * @returns Массив сегментов пути
   *
   * @example
   * ```typescript
   * navigator.parsePath('email');
   * // [{ key: 'email' }]
   *
   * navigator.parsePath('address.city');
   * // [{ key: 'address' }, { key: 'city' }]
   *
   * navigator.parsePath('items[0].name');
   * // [{ key: 'items', index: 0 }, { key: 'name' }]
   * ```
   */
  parsePath(path: string): PathSegment[] {
    const segments: PathSegment[] = [];
    let currentPart = '';
    let inBrackets = false;

    for (let i = 0; i < path.length; i++) {
      const char = path[i];

      if (char === '[') {
        inBrackets = true;
        currentPart += char;
      } else if (char === ']') {
        inBrackets = false;
        currentPart += char;
      } else if (char === '.' && !inBrackets) {
        // Разделитель найден, обрабатываем накопленную часть
        if (currentPart) {
          this.addSegment(segments, currentPart);
          currentPart = '';
        }
      } else {
        currentPart += char;
      }
    }

    // Добавляем последнюю часть
    if (currentPart) {
      this.addSegment(segments, currentPart);
    }

    return segments;
  }

  /**
   * Добавляет сегмент в массив, обрабатывая массивы
   * @private
   */
  private addSegment(segments: PathSegment[], part: string): void {
    // Проверка на массив: items[0]
    const arrayMatch = part.match(/^(.+)\[(\d+)\]$/);

    if (arrayMatch) {
      segments.push({
        key: arrayMatch[1],
        index: parseInt(arrayMatch[2], 10),
      });
    } else {
      segments.push({ key: part });
    }
  }

  /**
   * Получает значение по пути из объекта
   *
   * Проходит по всем сегментам пути и возвращает конечное значение.
   * Если путь не найден, возвращает undefined.
   *
   * @param obj Объект для навигации
   * @param path Путь к значению
   * @returns Значение или undefined, если путь не найден
   *
   * @example
   * ```typescript
   * const obj = {
   *   email: 'test@mail.com',
   *   address: { city: 'Moscow' },
   *   items: [{ title: 'Item 1' }]
   * };
   *
   * navigator.getValueByPath(obj, 'email');
   * // 'test@mail.com'
   *
   * navigator.getValueByPath(obj, 'address.city');
   * // 'Moscow'
   *
   * navigator.getValueByPath(obj, 'items[0].title');
   * // 'Item 1'
   *
   * navigator.getValueByPath(obj, 'invalid.path');
   * // undefined
   * ```
   */
  getValueByPath(obj: any, path: string): any {
    const segments = this.parsePath(path);
    let current = obj;

    for (const segment of segments) {
      if (current == null) return undefined;

      current = current[segment.key];

      if (segment.index !== undefined) {
        if (!Array.isArray(current)) return undefined;
        current = current[segment.index];
      }
    }

    return current;
  }

  /**
   * Устанавливает значение по пути в объекте (мутирует объект)
   *
   * Создает промежуточные объекты, если они не существуют.
   * Выбрасывает ошибку, если ожидается массив, но его нет.
   *
   * @param obj Объект для модификации
   * @param path Путь к значению
   * @param value Новое значение
   *
   * @throws {Error} Если ожидается массив по пути, но его нет
   *
   * @example
   * ```typescript
   * const obj = { address: { city: '' } };
   * navigator.setValueByPath(obj, 'address.city', 'Moscow');
   * // obj.address.city === 'Moscow'
   *
   * const obj2: any = {};
   * navigator.setValueByPath(obj2, 'address.city', 'Moscow');
   * // Создаст { address: { city: 'Moscow' } }
   *
   * const obj3 = { items: [{ title: 'Old' }] };
   * navigator.setValueByPath(obj3, 'items[0].title', 'New');
   * // obj3.items[0].title === 'New'
   * ```
   */
  setValueByPath(obj: any, path: string, value: any): void {
    const segments = this.parsePath(path);

    if (segments.length === 0) {
      throw new Error('Cannot set value: empty path');
    }

    let current = obj;

    // Проходим до предпоследнего сегмента
    for (let i = 0; i < segments.length - 1; i++) {
      const segment = segments[i];
      let next = current[segment.key];

      if (segment.index !== undefined) {
        // Доступ к массиву: items[0]
        if (!Array.isArray(next)) {
          throw new Error(`Expected array at path segment: ${segment.key}, but got ${typeof next}`);
        }
        current = next[segment.index];
      } else {
        // Доступ к объекту: address
        if (next == null) {
          // Создаем объект, если его нет
          current[segment.key] = {};
          next = current[segment.key];
        }
        current = next;
      }
    }

    // Устанавливаем значение в последнем сегменте
    const lastSegment = segments[segments.length - 1];
    if (lastSegment.index !== undefined) {
      const arr = current[lastSegment.key];
      if (!Array.isArray(arr)) {
        throw new Error(
          `Expected array at path segment: ${lastSegment.key}, but got ${typeof arr}`
        );
      }
      arr[lastSegment.index] = value;
    } else {
      current[lastSegment.key] = value;
    }
  }

  /**
   * Получить значение из FormNode по пути
   *
   * Автоматически извлекает значение из FormNode (через .value.value).
   * Используется в ValidationContext и BehaviorContext для единообразного
   * доступа к значениям полей формы.
   *
   * @param form Корневой узел формы (обычно GroupNode)
   * @param path Путь к полю
   * @returns Значение поля или undefined, если путь не найден
   *
   * @example
   * ```typescript
   * const form = new GroupNode({
   *   email: { value: 'test@mail.com', component: Input },
   *   address: {
   *     city: { value: 'Moscow', component: Input }
   *   },
   *   items: [{ title: { value: 'Item 1', component: Input } }]
   * });
   *
   * navigator.getFormNodeValue(form, 'email');
   * // 'test@mail.com'
   *
   * navigator.getFormNodeValue(form, 'address.city');
   * // 'Moscow'
   *
   * navigator.getFormNodeValue(form, 'items[0].title');
   * // 'Item 1'
   *
   * navigator.getFormNodeValue(form, 'invalid.path');
   * // undefined
   * ```
   */
  getFormNodeValue(form: any, path: string): any {
    const node = this.getNodeByPath(form, path);

    if (node == null) {
      return undefined;
    }

    // FormNode возвращает .value.value
    if (this.isFormNode(node)) {
      return node.value.value;
    }

    // Для обычных объектов возвращаем как есть
    return node;
  }

  /**
   * Type guard для проверки, является ли объект FormNode
   *
   * Проверяет наличие характерных свойств FormNode:
   * - value (Signal)
   * - value.value (значение Signal)
   *
   * @param obj Объект для проверки
   * @returns true, если объект является FormNode
   * @private
   */
  private isFormNode(obj: any): boolean {
    return (
      obj &&
      typeof obj === 'object' &&
      'value' in obj &&
      typeof obj.value === 'object' &&
      'value' in obj.value
    );
  }

  /**
   * Получает узел формы по пути
   *
   * Навигирует по структуре FormNode (GroupNode/FieldNode/ArrayNode)
   * и возвращает узел по указанному пути.
   *
   * Поддерживает:
   * - Доступ к полям GroupNode через fields Map
   * - Доступ к элементам ArrayNode через индекс
   * - Proxy-доступ к полям (для обратной совместимости)
   *
   * @param form Корневой узел формы (обычно GroupNode)
   * @param path Путь к узлу
   * @returns Узел формы или null, если путь не найден
   *
   * @example
   * ```typescript
   * const form = new GroupNode({
   *   email: { value: '', component: Input },
   *   address: {
   *     city: { value: '', component: Input }
   *   },
   *   items: [{ title: { value: '', component: Input } }]
   * });
   *
   * const emailNode = navigator.getNodeByPath(form, 'email');
   * // FieldNode
   *
   * const cityNode = navigator.getNodeByPath(form, 'address.city');
   * // FieldNode
   *
   * const itemNode = navigator.getNodeByPath(form, 'items[0]');
   * // GroupNode
   *
   * const titleNode = navigator.getNodeByPath(form, 'items[0].title');
   * // FieldNode
   *
   * const invalidNode = navigator.getNodeByPath(form, 'invalid.path');
   * // null
   * ```
   */
  getNodeByPath(form: any, path: string): any | null {
    const segments = this.parsePath(path);
    let current: any = form;

    for (const segment of segments) {
      if (current == null) return null;

      // Для GroupNode: доступ через fields Map
      if (current.fields && current.fields instanceof Map) {
        current = current.fields.get(segment.key);
      }
      // Для ArrayNode: доступ через items и индекс
      else if (segment.index !== undefined && current.items) {
        const items = current.items.value || current.items;
        if (!Array.isArray(items)) return null;
        current = items[segment.index];
      }
      // Proxy-доступ (для обратной совместимости)
      else {
        current = current[segment.key];
      }

      // Если нашли ArrayNode и есть индекс, получаем элемент массива
      if (current && segment.index !== undefined && current.items) {
        const items = current.items.value || current.items;
        if (!Array.isArray(items)) return null;
        current = items[segment.index];
      }

      if (current == null) return null;
    }

    return current;
  }
}
