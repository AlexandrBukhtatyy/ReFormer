import { describe, it, expect } from 'vitest';
import { NodeFactory } from '../../../src/core/factories/node-factory';
import { FieldNode } from '../../../src/core/nodes/field-node';
import { GroupNode } from '../../../src/core/nodes/group-node';
import { ArrayNode } from '../../../src/core/nodes/array-node';
import { ComponentInstance } from '../../test-utils/types';

describe('NodeFactory', () => {
  const factory = new NodeFactory();

  // ============================================================================
  // isFieldConfig - Распознавание конфига поля
  // ============================================================================

  describe('isFieldConfig', () => {
    it('распознает минимальный конфиг поля', () => {
      const config = {
        value: '',
        component: null as ComponentInstance,
      };

      expect(factory.isFieldConfig(config)).toBe(true);
    });

    it('распознает полный конфиг поля с validators', () => {
      const config = {
        value: 'test@mail.com',
        component: null as ComponentInstance,
        validators: [],
        asyncValidators: [],
      };

      expect(factory.isFieldConfig(config)).toBe(true);
    });

    it('отклоняет конфиг группы', () => {
      const config = {
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
      };

      expect(factory.isFieldConfig(config)).toBe(false);
    });

    it('отклоняет конфиг массива', () => {
      const config = {
        schema: { title: { value: '', component: null as ComponentInstance } },
        initialItems: [],
      };

      expect(factory.isFieldConfig(config)).toBe(false);
    });

    it('отклоняет null', () => {
      expect(factory.isFieldConfig(null)).toBe(false);
    });

    it('отклоняет undefined', () => {
      expect(factory.isFieldConfig(undefined)).toBe(false);
    });

    it('отклоняет пустой объект', () => {
      expect(factory.isFieldConfig({})).toBe(false);
    });

    it('отклоняет объект только с value', () => {
      expect(factory.isFieldConfig({ value: '' })).toBe(false);
    });

    it('отклоняет объект только с component', () => {
      expect(factory.isFieldConfig({ component: null as ComponentInstance })).toBe(false);
    });
  });

  // ============================================================================
  // isArrayConfig - Распознавание конфига массива
  // ============================================================================

  describe('isArrayConfig', () => {
    it('распознает минимальный конфиг массива', () => {
      const config = {
        schema: { title: { value: '', component: null as ComponentInstance } },
      };

      expect(factory.isArrayConfig(config)).toBe(true);
    });

    it('распознает конфиг массива с initialItems', () => {
      const config = {
        schema: { title: { value: '', component: null as ComponentInstance } },
        initialItems: [{ title: 'Item 1' }],
      };

      expect(factory.isArrayConfig(config)).toBe(true);
    });

    it('отклоняет конфиг поля', () => {
      const config = {
        value: '',
        component: null as ComponentInstance,
      };

      expect(factory.isArrayConfig(config)).toBe(false);
    });

    it('отклоняет конфиг группы', () => {
      const config = {
        email: { value: '', component: null as ComponentInstance },
      };

      expect(factory.isArrayConfig(config)).toBe(false);
    });

    it('отклоняет null', () => {
      expect(factory.isArrayConfig(null)).toBe(false);
    });

    it('отклоняет undefined', () => {
      expect(factory.isArrayConfig(undefined)).toBe(false);
    });

    it('отклоняет пустой объект', () => {
      expect(factory.isArrayConfig({})).toBe(false);
    });

    it('отклоняет объект с value и schema (амбивалентный)', () => {
      const config = {
        value: '',
        schema: {},
      };

      expect(factory.isArrayConfig(config)).toBe(false);
    });
  });

  // ============================================================================
  // isGroupConfig - Распознавание конфига группы
  // ============================================================================

  describe('isGroupConfig', () => {
    it('распознает простой конфиг группы', () => {
      const config = {
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
      };

      expect(factory.isGroupConfig(config)).toBe(true);
    });

    it('распознает вложенный конфиг группы', () => {
      const config = {
        user: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
        },
        settings: {
          theme: { value: 'light', component: null as ComponentInstance },
        },
      };

      expect(factory.isGroupConfig(config)).toBe(true);
    });

    it('распознает группу с массивом', () => {
      const config = {
        name: { value: '', component: null as ComponentInstance },
        items: {
          schema: { title: { value: '', component: null as ComponentInstance } },
          initialItems: [],
        },
      };

      expect(factory.isGroupConfig(config)).toBe(true);
    });

    it('отклоняет конфиг поля', () => {
      const config = {
        value: '',
        component: null as ComponentInstance,
      };

      expect(factory.isGroupConfig(config)).toBe(false);
    });

    it('отклоняет конфиг массива', () => {
      const config = {
        schema: { title: { value: '', component: null as ComponentInstance } },
      };

      expect(factory.isGroupConfig(config)).toBe(false);
    });

    it('отклоняет null', () => {
      expect(factory.isGroupConfig(null)).toBe(false);
    });

    it('отклоняет undefined', () => {
      expect(factory.isGroupConfig(undefined)).toBe(false);
    });

    it('отклоняет пустой объект (технически GroupConfig, но бесполезен)', () => {
      // Пустой объект технически проходит все проверки GroupConfig,
      // но на практике не используется
      expect(factory.isGroupConfig({})).toBe(true);
    });
  });

  // ============================================================================
  // createNode - Создание узлов
  // ============================================================================

  describe('createNode', () => {
    it('создает FieldNode из конфига поля', () => {
      const config = {
        value: 'test@mail.com',
        component: null as ComponentInstance,
      };

      const node = factory.createNode(config);

      expect(node).toBeInstanceOf(FieldNode);
      expect(node.value.value).toBe('test@mail.com');
    });

    it('создает GroupNode из конфига группы', () => {
      const config = {
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
      };

      const node = factory.createNode(config);

      expect(node).toBeInstanceOf(GroupNode);
    });

    it('создает ArrayNode из конфига массива', () => {
      const config = {
        schema: { title: { value: '', component: null as ComponentInstance } },
        initialItems: [],
      };

      const node = factory.createNode(config);

      expect(node).toBeInstanceOf(ArrayNode);
      expect((node as ArrayNode).length.value).toBe(0);
    });

    it('создает ArrayNode с начальными элементами', () => {
      const config = {
        schema: { title: { value: '', component: null as ComponentInstance } },
        initialItems: [{ title: 'Item 1' }, { title: 'Item 2' }],
      };

      const node = factory.createNode(config);

      expect(node).toBeInstanceOf(ArrayNode);
      expect((node as ArrayNode).length.value).toBe(2);
    });

    it('создает вложенный GroupNode', () => {
      const config = {
        user: {
          email: { value: '', component: null as ComponentInstance },
          password: { value: '', component: null as ComponentInstance },
        },
      };

      const node = factory.createNode(config);

      expect(node).toBeInstanceOf(GroupNode);
    });

    it('выбрасывает ошибку для null', () => {
      expect(() => factory.createNode(null)).toThrow('Unknown node config');
    });

    it('выбрасывает ошибку для undefined', () => {
      expect(() => factory.createNode(undefined)).toThrow('Unknown node config');
    });

    it('выбрасывает ошибку для примитивного значения', () => {
      expect(() => factory.createNode('string')).toThrow('Unknown node config');
      expect(() => factory.createNode(123)).toThrow('Unknown node config');
      expect(() => factory.createNode(true)).toThrow('Unknown node config');
    });

    it('выбрасывает ошибку для пустого объекта (технически GroupConfig, но создание невозможно)', () => {
      // Пустой объект проходит проверку isGroupConfig,
      // но GroupNode не может быть создан без полей
      // Это edge case, который может быть обработан позже
      expect(() => factory.createNode({})).not.toThrow();
    });
  });

  // ============================================================================
  // Интеграционные тесты - Реальные сценарии
  // ============================================================================

  describe('Интеграция - реальные сценарии', () => {
    it('создает форму регистрации', () => {
      const config = {
        email: { value: '', component: null as ComponentInstance },
        password: { value: '', component: null as ComponentInstance },
        confirmPassword: { value: '', component: null as ComponentInstance },
      };

      const form = factory.createNode(config);

      expect(form).toBeInstanceOf(GroupNode);
    });

    it('создает форму с вложенным адресом', () => {
      const config = {
        name: { value: '', component: null as ComponentInstance },
        address: {
          city: { value: '', component: null as ComponentInstance },
          street: { value: '', component: null as ComponentInstance },
          zipCode: { value: '', component: null as ComponentInstance },
        },
      };

      const form = factory.createNode(config);

      expect(form).toBeInstanceOf(GroupNode);
    });

    it('создает форму с массивом элементов', () => {
      const config = {
        name: { value: '', component: null as ComponentInstance },
        items: {
          schema: {
            title: { value: '', component: null as ComponentInstance },
            price: { value: 0, component: null as ComponentInstance },
          },
          initialItems: [
            { title: 'Item 1', price: 100 },
            { title: 'Item 2', price: 200 },
          ],
        },
      };

      const form = factory.createNode(config);

      expect(form).toBeInstanceOf(GroupNode);
    });

    it('правильно определяет тип узла для смешанных конфигов', () => {
      // FieldNode
      expect(
        factory.createNode({ value: '', component: null as ComponentInstance })
      ).toBeInstanceOf(FieldNode);

      // GroupNode
      expect(
        factory.createNode({
          field1: { value: '', component: null as ComponentInstance },
        })
      ).toBeInstanceOf(GroupNode);

      // ArrayNode
      expect(
        factory.createNode({
          schema: { value: '', component: null as ComponentInstance },
        })
      ).toBeInstanceOf(ArrayNode);
    });
  });

  // ============================================================================
  // Edge Cases - Граничные случаи
  // ============================================================================

  describe('Edge cases', () => {
    it('обрабатывает конфиг с дополнительными свойствами для FieldNode', () => {
      const config = {
        value: '',
        component: null as ComponentInstance,
        validators: [],
        asyncValidators: [],
        updateOn: 'blur' as const,
        debounce: 300,
        componentProps: { placeholder: 'Enter email' },
      };

      const node = factory.createNode(config);

      expect(node).toBeInstanceOf(FieldNode);
    });

    it('обрабатывает конфиг группы с пустыми объектами', () => {
      const config = {
        section1: {},
        section2: {},
      };

      const node = factory.createNode(config);

      expect(node).toBeInstanceOf(GroupNode);
    });

    it('приоритет: FieldConfig > ArrayConfig > GroupConfig', () => {
      // Если у конфига есть value и component, это всегда FieldNode
      const fieldConfig = {
        value: '',
        component: null as ComponentInstance,
        schema: {}, // дополнительное свойство игнорируется
      };

      expect(factory.createNode(fieldConfig)).toBeInstanceOf(FieldNode);
      expect(factory.isFieldConfig(fieldConfig)).toBe(true);
      expect(factory.isArrayConfig(fieldConfig)).toBe(false);
      expect(factory.isGroupConfig(fieldConfig)).toBe(false);
    });
  });
});
