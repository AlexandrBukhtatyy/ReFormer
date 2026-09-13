/**
 * Служба диагностики: находки по ресурсу и уведомление об их смене.
 *
 * Здесь ОБЪЯВЛЕНИЕ. Сама служба живёт в оболочке билдера.
 *
 * @module @reformer/builder-plugin-api/services/diagnostics/service
 */

import type { Disposable } from '../../primitives/disposable';
import type { ResourceId } from '../../primitives/resource';
import { defineService } from '../../primitives/service';
import type { Diagnostic } from './types';

export interface DiagnosticsService {
  /**
   * Замещает результаты источника по ресурсу.
   *
   * Пустой список снимает всё, что этот источник публиковал раньше. Записи других
   * источников не затрагиваются: они сосуществуют и складываются в общий свод.
   */
  publish(resource: ResourceId, source: string, items: readonly Diagnostic[]): void;
  /**
   * Все диагностики ресурса: сначала по источнику (в алфавитном порядке), внутри источника —
   * в порядке публикации. Между изменениями — та же ссылка.
   */
  get(resource: ResourceId): readonly Diagnostic[];
  /**
   * Ресурсы, у которых сейчас есть находки, — в алфавитном порядке идентификатора.
   *
   * Без перечисления свод читается только по одному адресу, а панель проблем спрашивает
   * ровно обратное: «что вообще найдено». Собрать этот ответ снаружи нечем — обход открытых
   * вкладок дал бы другой список, потому что публикуют не только по открытым документам,
   * а перечисление источников не заменяет перечисления адресов.
   *
   * Порядок алфавитный по той же причине, по которой алфавитен порядок источников в {@link
   * DiagnosticsService.get}: «кто успел раньше» перескакивало бы при каждом перезапуске
   * валидаторов, и глаз терял бы строку, на которую смотрел. Между изменениями СОСТАВА —
   * та же ссылка: список читает `useSyncExternalStore`.
   */
  resources(): readonly ResourceId[];
  /** Свод ресурса изменился. Полезная нагрузка — какого именно. */
  onDidChange(cb: (resource: ResourceId) => void): Disposable;
}

export const DiagnosticsServiceToken = defineService<DiagnosticsService>('reformer.diagnostics');
