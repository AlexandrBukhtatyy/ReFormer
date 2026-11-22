/**
 * Сигнал состояния ноды, который снаружи только читается.
 *
 * Механика — общий {@link BaseOwnedSignal} модели; здесь только текст ошибки: снаружи состояние
 * ноды меняют её методы.
 *
 * @internal
 * @module form/nodes/state/owned-signal
 */

import { OwnedSignal as BaseOwnedSignal } from '../../../model/owned-signal';

export class OwnedSignal<T> extends BaseOwnedSignal<T> {
  protected override readonlyMessage(): string {
    return 'Состояние ноды формы только для чтения: его меняют методы ноды (setValue, markAsTouched, disable…).';
  }
}
