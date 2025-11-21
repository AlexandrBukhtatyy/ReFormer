/**
 * Реализация единого FormContext
 *
 * Используется как базовая реализация для behavior и validation контекстов
 */

import type { GroupNode } from '../nodes/group-node';
import type { FormContext } from '../types/form-context';
import type { GroupNodeWithControls } from '../types/group-node-proxy';

/**
 * Базовая реализация FormContext
 *
 * Предоставляет:
 * - `form` - типизированный Proxy-доступ к форме
 * - `setFieldValue` - безопасная установка значения (emitEvent: false)
 */
export class FormContextImpl<TForm> implements FormContext<TForm> {
  /**
   * Форма с типизированным Proxy-доступом к полям
   */
  public readonly form: GroupNodeWithControls<TForm>;

  protected readonly _groupNode: GroupNode<TForm>;

  constructor(groupNode: GroupNode<TForm>) {
    this._groupNode = groupNode;
    // Используем _proxyInstance если доступен, иначе fallback
    this.form = ((groupNode as unknown as { _proxyInstance?: GroupNodeWithControls<TForm> })
      ._proxyInstance || groupNode.getProxy()) as GroupNodeWithControls<TForm>;
  }

  /**
   * Безопасно установить значение поля по строковому пути
   *
   * Автоматически использует emitEvent: false для предотвращения циклов
   */
  setFieldValue(path: string, value: unknown): void {
    const node = this._groupNode.getFieldByPath(path);
    if (node) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      node.setValue(value as any, { emitEvent: false });
    }
  }
}
