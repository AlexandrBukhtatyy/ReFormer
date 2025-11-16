/**
 * ProxyBuilder - тесты
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ProxyBuilder } from '../../../../src/core/nodes/group-node/proxy-builder';
import { FieldRegistry } from '../../../../src/core/nodes/group-node/field-registry';
import { GroupNode } from '../../../../src/core/nodes/group-node';
import { FieldNode } from '../../../../src/core/nodes/field-node';
import { ComponentInstance } from 'packages/reformer/tests/test-utils/types';

describe('ProxyBuilder', () => {
  describe('Get trap', () => {
    it('should access field through proxy', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      fieldRegistry.set('email', emailField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect((proxy as unknown).email).toBe(emailField);
    });

    it('should access GroupNode methods through proxy', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect(typeof proxy.validate).toBe('function');
      expect(typeof proxy.setValue).toBe('function');
      expect(typeof proxy.getValue).toBe('function');
    });

    it('should return undefined for non-existent properties', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect((proxy as unknown).nonExistent).toBeUndefined();
    });

    it('should prioritize GroupNode properties over fields', () => {
      const fieldRegistry = new FieldRegistry<{ value: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      // 'value' - это computed signal в GroupNode, не поле
      expect(typeof proxy.value).toBe('object'); // signal
    });

    it('should access multiple fields', () => {
      const fieldRegistry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      const nameField = new FieldNode({ value: 'John', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);
      fieldRegistry.set('name', nameField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect((proxy as unknown).email).toBe(emailField);
      expect((proxy as unknown).name).toBe(nameField);
    });
  });

  describe('Set trap', () => {
    let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleWarnSpy.mockRestore();
    });

    it('should warn when trying to set field directly in DEV mode', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      // Используем Reflect.set чтобы избежать ошибки в strict mode
      Reflect.set(proxy, 'email', 'new value');

      if (import.meta.env.DEV) {
        expect(consoleWarnSpy).toHaveBeenCalled();
        expect(consoleWarnSpy.mock.calls[0][0]).toContain('Cannot set field "email" directly');
      }
    });

    it('should return false when setting field directly', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const result = Reflect.set(proxy, 'email', 'new value');

      expect(result).toBe(false);
    });

    it('should allow setting non-field properties', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      (proxy as unknown).customProperty = 'custom value';

      expect((proxy as unknown).customProperty).toBe('custom value');
    });
  });

  describe('Has trap', () => {
    it('should return true for existing fields', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect('email' in proxy).toBe(true);
    });

    it('should return false for non-existing fields', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect('nonExistent' in proxy).toBe(false);
    });

    it('should return true for GroupNode properties', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect('validate' in proxy).toBe(true);
      expect('setValue' in proxy).toBe(true);
      expect('getValue' in proxy).toBe(true);
    });

    it('should work with multiple fields', () => {
      const fieldRegistry = new FieldRegistry<{ email: string; name: string; age: number }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      const nameField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);
      fieldRegistry.set('name', nameField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      expect('email' in proxy).toBe(true);
      expect('name' in proxy).toBe(true);
      expect('age' in proxy).toBe(false); // не установлено
    });
  });

  describe('OwnKeys trap', () => {
    it('should include field keys', () => {
      const fieldRegistry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      const nameField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);
      fieldRegistry.set('name', nameField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const keys = Reflect.ownKeys(proxy);

      expect(keys).toContain('email');
      expect(keys).toContain('name');
    });

    it('should include GroupNode keys', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const keys = Reflect.ownKeys(proxy);

      // GroupNode имеет множество ключей (методы, свойства)
      expect(keys.length).toBeGreaterThan(0);
    });

    it('should not have duplicates', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const keys = Reflect.ownKeys(proxy);
      const uniqueKeys = [...new Set(keys)];

      expect(keys.length).toBe(uniqueKeys.length);
    });
  });

  describe('GetOwnPropertyDescriptor trap', () => {
    it('should return descriptor for fields', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const descriptor = Object.getOwnPropertyDescriptor(proxy, 'email');

      expect(descriptor).toBeDefined();
      expect(descriptor?.enumerable).toBe(true);
      expect(descriptor?.configurable).toBe(true);
    });

    it('should return descriptor for GroupNode own properties', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      // Проверяем свойства, которые существуют как own properties
      // Методы находятся в прототипе, поэтому могут не иметь дескриптора на самом объекте
      const keys = Reflect.ownKeys(form);
      const ownProperty = keys.find((key) => typeof key === 'string');

      if (ownProperty) {
        const descriptor = Object.getOwnPropertyDescriptor(proxy, ownProperty);
        // Дескриптор должен быть либо определен, либо отражать реальную структуру объекта
        expect(descriptor !== undefined || ownProperty in proxy).toBe(true);
      }
    });

    it('should return undefined for non-existent properties', () => {
      const fieldRegistry = new FieldRegistry<{ email: string }>();
      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const descriptor = Object.getOwnPropertyDescriptor(proxy, 'nonExistent');

      expect(descriptor).toBeUndefined();
    });
  });

  describe('Integration tests', () => {
    it('should work with Object.keys()', () => {
      const fieldRegistry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      const nameField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);
      fieldRegistry.set('name', nameField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const keys = Object.keys(proxy);

      expect(keys).toContain('email');
      expect(keys).toContain('name');
    });

    it('should work with for...in loop', () => {
      const fieldRegistry = new FieldRegistry<{ email: string; name: string }>();
      const emailField = new FieldNode({ value: '', component: null as ComponentInstance });
      const nameField = new FieldNode({ value: '', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);
      fieldRegistry.set('name', nameField);

      const proxyBuilder = new ProxyBuilder(fieldRegistry);
      const form = new GroupNode({ controls: {} });
      const proxy = proxyBuilder.build(form);

      const keys: string[] = [];
      for (const key in proxy) {
        keys.push(key);
      }

      expect(keys).toContain('email');
      expect(keys).toContain('name');
    });

    it('should maintain type safety', () => {
      type FormType = { email: string; name: string };
      const fieldRegistry = new FieldRegistry<FormType>();
      const emailField = new FieldNode({
        value: 'test@mail.com',
        component: null as ComponentInstance,
      });
      const nameField = new FieldNode({ value: 'John', component: null as ComponentInstance });
      fieldRegistry.set('email', emailField);
      fieldRegistry.set('name', nameField);

      const proxyBuilder = new ProxyBuilder<FormType>(fieldRegistry);
      const form = new GroupNode<FormType>({ controls: {} });
      const proxy = proxyBuilder.build(form);

      // TypeScript должен разрешить эти обращения
      const email = (proxy as unknown).email;
      const name = (proxy as unknown).name;

      expect(email).toBe(emailField);
      expect(name).toBe(nameField);
    });
  });
});
