/**
 * Прокси группы — её лицо {@link FormGroup}: члены {@link FormNode} плюс ноды полей по именам.
 *
 * Порядок поиска имени: пространство `$` (все поля) → член контракта {@link FormNode} → поле
 * данных → прочее у сырого узла (символы, внутренние методы). Поэтому поле данных затеняют только
 * члены контракта, а не внутренности класса: `form.id`, `form.status`, `form.fields` — поля.
 *
 * @internal
 * @module form/form-proxy-builder
 */

import type { FormGroup, FormNode } from './types/nodes';
import { RAW_NODE, kindOf, type InternalFormNode } from './nodes/node-kind';

/** Члены контракта {@link FormNode}: их имя у группы — член ноды, а не поле. */
const NODE_MEMBERS = [
  'value',
  'valid',
  'invalid',
  'pending',
  'disabled',
  'touched',
  'dirty',
  'issues',
  'getValue',
  'setValue',
  'reset',
  'markAsTouched',
  'markAsUntouched',
  'enable',
  'disable',
  'setIssues',
  'clearIssues',
] as const satisfies readonly (keyof FormNode<unknown>)[];

// Список обязан покрывать контракт целиком: новый член FormNode без записи здесь — ошибка сборки.
type MissingMember = Exclude<keyof FormNode<unknown>, (typeof NODE_MEMBERS)[number]>;
const exhaustive: [MissingMember] extends [never] ? true : MissingMember = true;
void exhaustive;

const MEMBER_NAMES: ReadonlySet<PropertyKey> = new Set(NODE_MEMBERS);

/** Имя пространства всех полей: `form.$.value` — поле, затенённое членом ноды. */
const FIELDS_NAMESPACE = '$';

/** Лицо ноды ребёнка: у группы — её прокси, у поля и массива — сама нода. */
function faceOf(node: InternalFormNode): unknown {
  return kindOf(node) === 'group' ? (node as unknown as { proxy: unknown }).proxy : node;
}

/**
 * Прокси группы над её сырым узлом.
 *
 * @param target - Сырой узел группы
 * @param children - Сырые ноды полей по именам
 */
export function buildFormProxy<T>(
  target: InternalFormNode<T>,
  children: ReadonlyMap<string, InternalFormNode>
): FormGroup<T> {
  let fields: Record<string, unknown> | undefined;
  const fieldsRecord = (): Record<string, unknown> => {
    if (!fields) {
      const record: Record<string, unknown> = {};
      children.forEach((child, key) => {
        record[key] = faceOf(child);
      });
      fields = Object.freeze(record);
    }
    return fields;
  };
  // Методы привязаны к сырому узлу: `this` внутри метода — класс, а не прокси с полями.
  const bound = new Map<PropertyKey, unknown>();
  const memberOf = (prop: PropertyKey): unknown => {
    const member = Reflect.get(target, prop, target) as unknown;
    if (typeof member !== 'function') return member;
    let method = bound.get(prop);
    if (!method) {
      method = (member as (...args: unknown[]) => unknown).bind(target);
      bound.set(prop, method);
    }
    return method;
  };

  return new Proxy(target as object, {
    get: (_, prop) => {
      if (prop === RAW_NODE) return target;
      if (prop === FIELDS_NAMESPACE) return fieldsRecord();
      if (MEMBER_NAMES.has(prop)) return memberOf(prop);
      if (typeof prop === 'string' && children.has(prop)) return fieldsRecord()[prop];
      return memberOf(prop);
    },
    set: (_, prop, value) => {
      // Поля и члены контракта не присваиваются: значение пишут через setValue.
      if (prop === FIELDS_NAMESPACE || MEMBER_NAMES.has(prop)) return false;
      if (typeof prop === 'string' && children.has(prop)) return false;
      return Reflect.set(target, prop, value, target);
    },
    has: (_, prop) =>
      prop === FIELDS_NAMESPACE ||
      (typeof prop === 'string' && children.has(prop)) ||
      prop in target,
    ownKeys: () => [...new Set([...Reflect.ownKeys(target), ...children.keys()])],
    getOwnPropertyDescriptor: (_, prop) =>
      typeof prop === 'string' && children.has(prop)
        ? { enumerable: true, configurable: true, value: fieldsRecord()[prop] }
        : Reflect.getOwnPropertyDescriptor(target, prop),
  }) as FormGroup<T>;
}
