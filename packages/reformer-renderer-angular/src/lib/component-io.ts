/**
 * Раскладка плоского объекта props по каналам компонента Angular.
 *
 * Ядро отдаёт рендереру один объект props узла — так же, как рендерерам на React и Vue. У
 * компонента Angular каналов три: входы, выходы и атрибуты хоста. Какие ключи куда идут, решает
 * описание компонента (`reflectComponentType`), а не имя ключа: необъявленный вход Angular
 * отвергает ошибкой, поэтому всё, чего компонент не объявил, уходит на его хост-элемент.
 *
 * @module renderer-angular/component-io
 */

import { reflectComponentType, type Type } from '@angular/core';

/** Входы и выходы компонента по именам, которыми их называет шаблон. */
export interface ComponentIo {
  /** Имена входов (с учётом псевдонима). */
  readonly inputs: ReadonlySet<string>;
  /** Имя выхода в шаблоне → свойство экземпляра, которое его несёт. */
  readonly outputs: ReadonlyMap<string, string>;
}

const cache = new WeakMap<Type<unknown>, ComponentIo>();

const EMPTY_IO: ComponentIo = { inputs: new Set(), outputs: new Map() };

/** Описание каналов компонента; для класса, который не компонент, — пустое. */
export function componentIoOf(type: Type<unknown>): ComponentIo {
  const cached = cache.get(type);
  if (cached) return cached;
  const mirror = reflectComponentType(type);
  const io: ComponentIo = mirror
    ? {
        inputs: new Set(mirror.inputs.map((input) => input.templateName)),
        outputs: new Map(mirror.outputs.map((output) => [output.templateName, output.propName])),
      }
    : EMPTY_IO;
  cache.set(type, io);
  return io;
}

/** Props узла, разложенные по каналам компонента. */
export interface SplitProps {
  /** Значения входов по именам шаблона. */
  inputs: Record<string, unknown>;
  /** Слушатели выходов по именам шаблона. */
  outputs: Record<string, (payload: unknown) => void>;
  /** Остальное — атрибуты и слушатели DOM хост-элемента. */
  host: Record<string, unknown>;
}

/** `onValueChange` → `valueChange`: имя выхода, которому соответствует ключ-обработчик. */
function outputNameOf(key: string): string | undefined {
  if (key.length < 3 || !key.startsWith('on')) return undefined;
  const head = key[2];
  if (head !== head.toUpperCase() || head === head.toLowerCase()) return undefined;
  return head.toLowerCase() + key.slice(3);
}

/**
 * Примет ли компонент проп своим каналом: объявленный вход либо обработчик объявленного выхода.
 * Проп, которого компонент не принимает, {@link splitProps} отдаёт хост-элементу.
 */
export function acceptsProp(io: ComponentIo, key: string, value: unknown): boolean {
  if (io.inputs.has(key)) return true;
  if (typeof value !== 'function') return false;
  const output = io.outputs.has(key) ? key : outputNameOf(key);
  return output !== undefined && io.outputs.has(output);
}

/**
 * Разложить props по каналам компонента.
 *
 * - ключ совпал с объявленным входом — вход;
 * - функция под именем объявленного выхода (`valueChange`) или под ключом-обработчиком
 *   (`onValueChange`) — слушатель выхода;
 * - всё остальное — хост-элемент: атрибуты (`data-testid`, `class`, `aria-*`) и слушатели DOM.
 *
 * @example
 * ```ts
 * splitProps(componentIoOf(TextInput), {
 *   value: 'a',
 *   onValueChange: (next) => field.setValue(next),
 *   'data-testid': 'input-name',
 * });
 * // → { inputs: { value: 'a' }, outputs: { valueChange: fn }, host: { 'data-testid': 'input-name' } }
 * ```
 */
export function splitProps(io: ComponentIo, props: Record<string, unknown>): SplitProps {
  const split: SplitProps = { inputs: {}, outputs: {}, host: {} };
  for (const [key, value] of Object.entries(props)) {
    if (io.inputs.has(key)) {
      split.inputs[key] = value;
      continue;
    }
    if (typeof value === 'function') {
      const output = io.outputs.has(key) ? key : outputNameOf(key);
      if (output !== undefined && io.outputs.has(output)) {
        split.outputs[output] = value as (payload: unknown) => void;
        continue;
      }
    }
    split.host[key] = value;
  }
  return split;
}
