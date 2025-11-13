import { describe, it, expect } from 'vitest';
import { FieldPathNavigator } from '../../src/core/utils/field-path-navigator';

describe('FieldPathNavigator', () => {
  const navigator = new FieldPathNavigator();

  describe('parsePath', () => {
    it('парсит простой путь', () => {
      expect(navigator.parsePath('email')).toEqual([{ key: 'email' }]);
    });

    it('парсит вложенный путь', () => {
      expect(navigator.parsePath('address.city')).toEqual([{ key: 'address' }, { key: 'city' }]);
    });

    it('парсит глубоко вложенный путь', () => {
      expect(navigator.parsePath('user.profile.avatar.url')).toEqual([
        { key: 'user' },
        { key: 'profile' },
        { key: 'avatar' },
        { key: 'url' },
      ]);
    });

    it('парсит путь с массивом', () => {
      expect(navigator.parsePath('items[0]')).toEqual([{ key: 'items', index: 0 }]);
    });

    it('парсит путь с массивом и вложенным полем', () => {
      expect(navigator.parsePath('items[0].name')).toEqual([
        { key: 'items', index: 0 },
        { key: 'name' },
      ]);
    });

    it('парсит путь с несколькими массивами', () => {
      expect(navigator.parsePath('orders[0].items[1].price')).toEqual([
        { key: 'orders', index: 0 },
        { key: 'items', index: 1 },
        { key: 'price' },
      ]);
    });

    it('парсит путь с большим индексом', () => {
      expect(navigator.parsePath('items[123]')).toEqual([{ key: 'items', index: 123 }]);
    });

    it('возвращает пустой массив для пустой строки', () => {
      expect(navigator.parsePath('')).toEqual([]);
    });

    it('корректно обрабатывает путь с точкой в квадратных скобках', () => {
      // Например, items[0] не должен разбиваться на несколько сегментов
      expect(navigator.parsePath('items[0].tags[1]')).toEqual([
        { key: 'items', index: 0 },
        { key: 'tags', index: 1 },
      ]);
    });
  });

  describe('getValueByPath', () => {
    const obj = {
      email: 'test@mail.com',
      password: '12345',
      address: {
        city: 'Moscow',
        street: 'Lenina',
        building: {
          number: 10,
        },
      },
      items: [
        { title: 'Item 1', price: 100 },
        { title: 'Item 2', price: 200 },
      ],
      orders: [
        {
          id: 1,
          items: [
            { name: 'Product 1', qty: 2 },
            { name: 'Product 2', qty: 3 },
          ],
        },
      ],
    };

    it('получает простое значение', () => {
      expect(navigator.getValueByPath(obj, 'email')).toBe('test@mail.com');
      expect(navigator.getValueByPath(obj, 'password')).toBe('12345');
    });

    it('получает вложенное значение', () => {
      expect(navigator.getValueByPath(obj, 'address.city')).toBe('Moscow');
      expect(navigator.getValueByPath(obj, 'address.street')).toBe('Lenina');
    });

    it('получает глубоко вложенное значение', () => {
      expect(navigator.getValueByPath(obj, 'address.building.number')).toBe(10);
    });

    it('получает значение из массива', () => {
      expect(navigator.getValueByPath(obj, 'items[0].title')).toBe('Item 1');
      expect(navigator.getValueByPath(obj, 'items[1].price')).toBe(200);
    });

    it('получает значение из вложенных массивов', () => {
      expect(navigator.getValueByPath(obj, 'orders[0].items[0].name')).toBe('Product 1');
      expect(navigator.getValueByPath(obj, 'orders[0].items[1].qty')).toBe(3);
    });

    it('получает сам массив', () => {
      const items = navigator.getValueByPath(obj, 'items');
      expect(Array.isArray(items)).toBe(true);
      expect(items).toHaveLength(2);
    });

    it('получает объект', () => {
      const address = navigator.getValueByPath(obj, 'address');
      expect(address).toEqual({
        city: 'Moscow',
        street: 'Lenina',
        building: { number: 10 },
      });
    });

    it('возвращает undefined для несуществующего пути', () => {
      expect(navigator.getValueByPath(obj, 'foo.bar')).toBeUndefined();
      expect(navigator.getValueByPath(obj, 'address.zipCode')).toBeUndefined();
    });

    it('возвращает undefined для несуществующего индекса массива', () => {
      expect(navigator.getValueByPath(obj, 'items[10]')).toBeUndefined();
      expect(navigator.getValueByPath(obj, 'items[100].title')).toBeUndefined();
    });

    it('возвращает undefined если путь ведет через null', () => {
      const objWithNull = { user: null };
      expect(navigator.getValueByPath(objWithNull, 'user.name')).toBeUndefined();
    });

    it('возвращает undefined если путь ведет через undefined', () => {
      const objWithUndefined = { user: undefined };
      expect(navigator.getValueByPath(objWithUndefined, 'user.name')).toBeUndefined();
    });

    it('возвращает сам объект для пустого пути', () => {
      expect(navigator.getValueByPath(obj, '')).toBe(obj);
    });

    it('возвращает undefined если обращение к массиву, но это не массив', () => {
      expect(navigator.getValueByPath(obj, 'email[0]')).toBeUndefined();
    });
  });

  describe('setValueByPath', () => {
    it('устанавливает простое значение', () => {
      const obj = { email: '' };
      navigator.setValueByPath(obj, 'email', 'new@mail.com');
      expect(obj.email).toBe('new@mail.com');
    });

    it('устанавливает вложенное значение', () => {
      const obj = { address: { city: '' } };
      navigator.setValueByPath(obj, 'address.city', 'Moscow');
      expect(obj.address.city).toBe('Moscow');
    });

    it('устанавливает глубоко вложенное значение', () => {
      const obj = { user: { profile: { avatar: { url: '' } } } };
      navigator.setValueByPath(obj, 'user.profile.avatar.url', 'http://...');
      expect(obj.user.profile.avatar.url).toBe('http://...');
    });

    it('устанавливает значение в массиве', () => {
      const obj = { items: [{ title: 'Old' }] };
      navigator.setValueByPath(obj, 'items[0].title', 'New');
      expect(obj.items[0].title).toBe('New');
    });

    it('устанавливает значение во вложенных массивах', () => {
      const obj = {
        orders: [{ items: [{ name: 'Old' }] }],
      };
      navigator.setValueByPath(obj, 'orders[0].items[0].name', 'New');
      expect(obj.orders[0].items[0].name).toBe('New');
    });

    it('создает объект, если его нет', () => {
      const obj: any = {};
      navigator.setValueByPath(obj, 'address.city', 'Moscow');
      expect(obj.address).toBeDefined();
      expect(obj.address.city).toBe('Moscow');
    });

    it('создает вложенные объекты, если их нет', () => {
      const obj: any = {};
      navigator.setValueByPath(obj, 'user.profile.avatar.url', 'http://...');
      expect(obj.user).toBeDefined();
      expect(obj.user.profile).toBeDefined();
      expect(obj.user.profile.avatar).toBeDefined();
      expect(obj.user.profile.avatar.url).toBe('http://...');
    });

    it('выбрасывает ошибку, если ожидается массив, но его нет', () => {
      const obj = { items: 'not an array' };
      expect(() => {
        navigator.setValueByPath(obj, 'items[0].title', 'New');
      }).toThrow('Expected array at path segment: items');
    });

    it('выбрасывает ошибку для пустого пути', () => {
      const obj = {};
      expect(() => {
        navigator.setValueByPath(obj, '', 'value');
      }).toThrow('Cannot set value: empty path');
    });

    it('перезаписывает существующее значение', () => {
      const obj = { email: 'old@mail.com' };
      navigator.setValueByPath(obj, 'email', 'new@mail.com');
      expect(obj.email).toBe('new@mail.com');
    });

    it('работает с числовыми значениями', () => {
      const obj = { age: 0 };
      navigator.setValueByPath(obj, 'age', 25);
      expect(obj.age).toBe(25);
    });

    it('работает с булевыми значениями', () => {
      const obj = { active: false };
      navigator.setValueByPath(obj, 'active', true);
      expect(obj.active).toBe(true);
    });

    it('работает с null значениями', () => {
      const obj = { value: 'something' };
      navigator.setValueByPath(obj, 'value', null);
      expect(obj.value).toBe(null);
    });
  });

  describe('getNodeByPath', () => {
    // Мок для GroupNode
    class MockGroupNode {
      public fields = new Map();

      constructor(config: Record<string, any>) {
        for (const [key, value] of Object.entries(config)) {
          if (value instanceof MockFieldNode || value instanceof MockGroupNode) {
            this.fields.set(key, value);
          } else {
            this.fields.set(key, new MockFieldNode(value));
          }
        }
      }
    }

    // Мок для FieldNode
    class MockFieldNode {
      public value: any;

      constructor(value: any) {
        this.value = { value };
      }

      setValue(val: any) {
        this.value.value = val;
      }
    }

    // Мок для ArrayNode
    class MockArrayNode {
      public items: any;

      constructor(items: any[]) {
        this.items = { value: items };
      }
    }

    it('получает FieldNode по простому пути', () => {
      const form = new MockGroupNode({
        email: new MockFieldNode('test@mail.com'),
      });

      const node = navigator.getNodeByPath(form, 'email');
      expect(node).toBeInstanceOf(MockFieldNode);
      expect(node.value.value).toBe('test@mail.com');
    });

    it('получает FieldNode по вложенному пути', () => {
      const addressGroup = new MockGroupNode({
        city: new MockFieldNode('Moscow'),
      });

      const form = new MockGroupNode({
        address: addressGroup,
      });

      const node = navigator.getNodeByPath(form, 'address.city');
      expect(node).toBeInstanceOf(MockFieldNode);
      expect(node.value.value).toBe('Moscow');
    });

    it('получает GroupNode по пути', () => {
      const addressGroup = new MockGroupNode({
        city: new MockFieldNode('Moscow'),
      });

      const form = new MockGroupNode({
        address: addressGroup,
      });

      const node = navigator.getNodeByPath(form, 'address');
      expect(node).toBeInstanceOf(MockGroupNode);
    });

    it('получает элемент ArrayNode по индексу', () => {
      const itemNodes = [
        new MockGroupNode({ title: new MockFieldNode('Item 1') }),
        new MockGroupNode({ title: new MockFieldNode('Item 2') }),
      ];

      const arrayNode = new MockArrayNode(itemNodes);

      const form = new MockGroupNode({
        items: arrayNode as any,
      });

      const node = navigator.getNodeByPath(form, 'items[0]');
      expect(node).toBeInstanceOf(MockGroupNode);
    });

    it('получает FieldNode из элемента ArrayNode', () => {
      const itemNodes = [
        new MockGroupNode({ title: new MockFieldNode('Item 1') }),
        new MockGroupNode({ title: new MockFieldNode('Item 2') }),
      ];

      const arrayNode = new MockArrayNode(itemNodes);

      const form = new MockGroupNode({
        items: arrayNode as any,
      });

      const node = navigator.getNodeByPath(form, 'items[0].title');
      expect(node).toBeInstanceOf(MockFieldNode);
      expect(node.value.value).toBe('Item 1');
    });

    it('возвращает null для несуществующего пути', () => {
      const form = new MockGroupNode({
        email: new MockFieldNode('test@mail.com'),
      });

      const node = navigator.getNodeByPath(form, 'invalid.path');
      expect(node).toBeNull();
    });

    it('возвращает null для несуществующего индекса массива', () => {
      const itemNodes = [new MockGroupNode({ title: new MockFieldNode('Item 1') })];
      const arrayNode = new MockArrayNode(itemNodes);

      const form = new MockGroupNode({
        items: arrayNode as any,
      });

      const node = navigator.getNodeByPath(form, 'items[10]');
      expect(node).toBeNull();
    });

    it('возвращает null если обращение к массиву, но это не массив', () => {
      const form = new MockGroupNode({
        email: new MockFieldNode('test@mail.com'),
      });

      const node = navigator.getNodeByPath(form, 'email[0]');
      expect(node).toBeNull();
    });

    it('работает с глубоко вложенной структурой', () => {
      const buildingGroup = new MockGroupNode({
        number: new MockFieldNode(10),
      });

      const addressGroup = new MockGroupNode({
        city: new MockFieldNode('Moscow'),
        building: buildingGroup,
      });

      const form = new MockGroupNode({
        user: new MockGroupNode({
          profile: new MockGroupNode({
            address: addressGroup,
          }),
        }),
      });

      const node = navigator.getNodeByPath(form, 'user.profile.address.building.number');
      expect(node).toBeInstanceOf(MockFieldNode);
      expect(node.value.value).toBe(10);
    });
  });

  describe('интеграционные тесты', () => {
    it('parsePath → getValueByPath работают вместе', () => {
      const obj = { items: [{ title: 'Test' }] };
      const path = 'items[0].title';

      const segments = navigator.parsePath(path);
      expect(segments).toHaveLength(2);

      const value = navigator.getValueByPath(obj, path);
      expect(value).toBe('Test');
    });

    it('parsePath → setValueByPath работают вместе', () => {
      const obj: any = {};
      const path = 'address.city';

      const segments = navigator.parsePath(path);
      expect(segments).toHaveLength(2);

      navigator.setValueByPath(obj, path, 'Moscow');
      expect(obj.address.city).toBe('Moscow');
    });

    it('setValueByPath → getValueByPath работают вместе', () => {
      const obj: any = {};
      const path = 'items[0].title';

      // Создаем структуру вручную
      obj.items = [{}];
      navigator.setValueByPath(obj, path, 'New Title');

      const value = navigator.getValueByPath(obj, path);
      expect(value).toBe('New Title');
    });
  });
});
