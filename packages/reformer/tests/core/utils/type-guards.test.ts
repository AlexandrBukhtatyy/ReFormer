/**
 * Unit tests for FormNode type guards
 *
 * Tests isFieldNode, isGroupNode, isArrayNode type guards
 */

import { describe, it, expect } from 'vitest';
import { FieldNode } from '../../../src/core/nodes/field-node';
import { GroupNode } from '../../../src/core/nodes/group-node';
import { ArrayNode } from '../../../src/core/nodes/array-node';
import { FormNode } from '../../../src/core/nodes/form-node';
import { makeForm } from '../../../src/core/utils/create-form';
import { isArrayNode, isFieldNode, isGroupNode } from '../../../src/core/utils/type-guards';
import { ComponentInstance } from '../../test-utils/types';

describe('FormNode Type Guards', () => {
  describe('isFieldNode()', () => {
    it('should return true for FieldNode', () => {
      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
      });

      expect(isFieldNode(field as unknown)).toBe(true);
    });

    it('should return false for GroupNode', () => {
      const group = new GroupNode({
        name: { value: '', component: null as ComponentInstance },
      });

      expect(isFieldNode(group as unknown)).toBe(false);
    });

    it('should return false for ArrayNode', () => {
      const array = new ArrayNode({
        name: { value: '', component: null as ComponentInstance },
      });

      expect(isFieldNode(array as unknown)).toBe(false);
    });

    it('should allow TypeScript type narrowing', () => {
      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
      });

      if (isFieldNode(field as unknown)) {
        // TypeScript должен знать, что это FieldNode
        field.markAsTouched();
        field.markAsDirty();
        expect(field.touched.value).toBe(true);
      }
    });
  });

  describe('isGroupNode()', () => {
    it('should return true for GroupNode', () => {
      const group = new GroupNode({
        name: { value: '', component: null as ComponentInstance },
        email: { value: '', component: null as ComponentInstance },
      });

      expect(isGroupNode(group)).toBe(true);
    });

    it('should return false for FieldNode', () => {
      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
      });

      expect(isGroupNode(field as unknown)).toBe(false);
    });

    it('should return false for ArrayNode', () => {
      const array = new ArrayNode({
        name: { value: '', component: null as ComponentInstance },
      });

      expect(isGroupNode(array as unknown)).toBe(false);
    });

    it('should allow TypeScript type narrowing', () => {
      const group = new GroupNode({
        name: { value: 'John', component: null as ComponentInstance },
      });

      if (isGroupNode(group)) {
        // TypeScript должен знать, что это GroupNode
        const value = group.getValue();
        expect(value.name).toBe('John');
      }
    });
  });

  describe('isArrayNode()', () => {
    it('should return true for ArrayNode', () => {
      const array = new ArrayNode({
        name: { value: '', component: null as ComponentInstance },
        age: { value: 0, component: null as ComponentInstance },
      });

      expect(isArrayNode(array)).toBe(true);
    });

    it('should return false for FieldNode', () => {
      const field = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
      });

      expect(isArrayNode(field as unknown)).toBe(false);
    });

    it('should return false for GroupNode', () => {
      const group = new GroupNode({
        name: { value: '', component: null as ComponentInstance },
      });

      expect(isArrayNode(group as unknown)).toBe(false);
    });

    it('should allow TypeScript type narrowing', () => {
      const array = new ArrayNode({
        name: { value: '', component: null as ComponentInstance },
      });

      if (isArrayNode(array)) {
        // TypeScript должен знать, что это ArrayNode
        array.push({ name: 'Item 1' });
        expect(array.length.value).toBe(1);
      }
    });
  });

  describe('Mixed usage', () => {
    it('should correctly identify nested nodes', () => {
      interface Form {
        user: {
          name: string;
          email: string;
        };
        tags: Array<{ label: string }>;
      }

      const form = makeForm<Form>({
        user: {
          name: { value: '', component: null as ComponentInstance },
          email: { value: '', component: null as ComponentInstance },
        },
        tags: [
          {
            label: { value: '', component: null as ComponentInstance },
          },
        ],
      });

      // Root form - GroupNode
      expect(isGroupNode(form)).toBe(true);
      expect(isFieldNode(form)).toBe(false);
      expect(isArrayNode(form)).toBe(false);

      // Nested group - GroupNode
      expect(isGroupNode(form.user)).toBe(true);
      expect(isFieldNode(form.user)).toBe(false);
      expect(isArrayNode(form.user)).toBe(false);

      // Nested field - FieldNode
      expect(isFieldNode(form.user.name)).toBe(true);
      expect(isGroupNode(form.user.name)).toBe(false);
      expect(isArrayNode(form.user.name)).toBe(false);

      // Array - ArrayNode
      expect(isArrayNode(form.tags)).toBe(true);
      expect(isFieldNode(form.tags)).toBe(false);
      expect(isGroupNode(form.tags)).toBe(false);
    });

    it('should handle type guards in conditional logic', () => {
      const nodes: Array<FieldNode<unknown> | GroupNode<unknown> | ArrayNode<unknown>> = [
        new FieldNode({ value: 'test', component: null as ComponentInstance }),
        new GroupNode({ name: { value: '', component: null as ComponentInstance } }),
        new ArrayNode({ name: { value: '', component: null as ComponentInstance } }),
      ];

      let fieldCount = 0;
      let groupCount = 0;
      let arrayCount = 0;

      nodes.forEach((node) => {
        if (isFieldNode(node)) {
          fieldCount++;
        } else if (isGroupNode(node)) {
          groupCount++;
        } else if (isArrayNode(node)) {
          arrayCount++;
        }
      });

      expect(fieldCount).toBe(1);
      expect(groupCount).toBe(1);
      expect(arrayCount).toBe(1);
    });
  });

  describe('Edge cases', () => {
    it('should handle null', () => {
      expect(isFieldNode(null as unknown)).toBe(false);
      expect(isGroupNode(null as unknown)).toBe(false);
      expect(isArrayNode(null as unknown)).toBe(false);
    });

    it('should handle undefined', () => {
      expect(isFieldNode(undefined as unknown)).toBe(false);
      expect(isGroupNode(undefined as unknown)).toBe(false);
      expect(isArrayNode(undefined as unknown)).toBe(false);
    });

    it('should handle plain objects', () => {
      const plainObject = { value: 'test' };

      expect(isFieldNode(plainObject as unknown)).toBe(false);
      expect(isGroupNode(plainObject as unknown)).toBe(false);
      expect(isArrayNode(plainObject as unknown)).toBe(false);
    });

    it('should handle arrays', () => {
      const plainArray = [1, 2, 3];

      expect(isFieldNode(plainArray as unknown)).toBe(false);
      expect(isGroupNode(plainArray as unknown)).toBe(false);
      expect(isArrayNode(plainArray as unknown)).toBe(false);
    });
  });

  describe('TypeScript type narrowing', () => {
    it('should narrow union types correctly', () => {
      type FormNodeUnion = FieldNode<string> | GroupNode<unknown> | ArrayNode<unknown>;

      const node: FormNodeUnion = new FieldNode({
        value: 'test',
        component: null as ComponentInstance,
      });

      if (isFieldNode(node as unknown)) {
        // TypeScript знает, что node - FieldNode<string>
        const value: string = node.value.value;
        expect(value).toBe('test');
      }
    });

    it('should work with generic functions', () => {
      function processNode<T>(node: FormNode<T>): string {
        if (isFieldNode(node)) {
          return 'field';
        } else if (isGroupNode(node)) {
          return 'group';
        } else if (isArrayNode(node)) {
          return 'array';
        }
        return 'unknown';
      }

      const field = new FieldNode({ value: 'test', component: null as ComponentInstance });
      const group = new GroupNode({ name: { value: '', component: null as ComponentInstance } });
      const array = new ArrayNode({ name: { value: '', component: null as ComponentInstance } });

      expect(processNode(field)).toBe('field');
      expect(processNode(group)).toBe('group');
      expect(processNode(array)).toBe('array');
    });
  });
});
