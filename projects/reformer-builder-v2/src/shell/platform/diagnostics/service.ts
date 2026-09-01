/**
 * Служба диагностик — общий свод того, что валидаторы нашли в ресурсе.
 *
 * ## `publish` замещает результаты источника, а не добавляет
 *
 * Это главное свойство и главный дефект наивной реализации. Валидатор ходит на каждой правке
 * и каждый раз приносит полный список своих находок. Если складывать, то исправленная ошибка
 * останется висеть навсегда: убрать её было бы некому — валидатор про неё уже не знает,
 * а служба не знает, какая из накопленных записей чья. Замещение по источнику решает это
 * без единого дополнительного вызова: «вот всё, что я вижу сейчас» — и прошлое этого источника
 * исчезает. Пустой список — законная публикация: «у меня чисто».
 *
 * Отсюда же ограничение, которое надо принять: два прохода одного валидатора — быстрый
 * синхронный и дорогой отменяемый — обязаны публиковаться под **разными** источниками.
 * Под общим именем поздний дорогой результат стирал бы находки быстрого, хотя тот проверял
 * другое.
 *
 * ## `get` отдаёт кэшированный снимок
 *
 * Между изменениями возвращается **та же** ссылка. Это не оптимизация: снимок читает
 * `useSyncExternalStore`, который на новом массиве при каждом вызове падает с «The result of
 * getSnapshot should be cached». Тот же приём и по той же причине, что в
 * `host/primitives/extension-point`.
 *
 * @module shell/platform/diagnostics/service
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import { createEventBus, defineEvent } from '@/shell/platform/primitives/event';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import { defineService } from '@/shell/platform/primitives/service';
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

export const DiagnosticsServiceToken = defineService<DiagnosticsService>('host.diagnostics');

const DiagnosticsDidChange = defineEvent<ResourceId>('diagnostics.didChange');

/** Общий пустой свод: одна ссылка на все чистые ресурсы — см. требование к `get`. */
const EMPTY: readonly Diagnostic[] = Object.freeze([]);

/** Пустой состав: та же ссылка, пока находок нет ни у кого. */
const NO_RESOURCES: readonly ResourceId[] = Object.freeze([]);

interface ResourceState {
  /** Источник → его текущие находки. Ключ — тот, под которым источник публикуется. */
  readonly bySource: Map<string, readonly Diagnostic[]>;
  /** Сведённый снимок; `null` — устарел и будет пересчитан при первом чтении. */
  snapshot: readonly Diagnostic[] | null;
}

/**
 * Создаёт службу диагностик.
 *
 * Состояние — только в памяти: диагностика вычислима из содержимого и валидаторов, поэтому
 * хранить её между сессиями нечего, а хранение означало бы показ ошибок, которых в файле
 * уже нет.
 */
export function createDiagnosticsService(): DiagnosticsService {
  const resources = new Map<ResourceId, ResourceState>();
  const bus = createEventBus();
  /**
   * Снимок состава; `null` — устарел.
   *
   * Сбрасывается только при появлении и исчезновении РЕСУРСА, а не на каждой публикации:
   * от смены находок внутри одного ресурса список адресов не меняется, и пересобирать его
   * на каждой правке значило бы перерисовывать панель проблем на каждый набранный символ.
   */
  let names: readonly ResourceId[] | null = null;

  return {
    publish(resource: ResourceId, source: string, items: readonly Diagnostic[]): void {
      if (source.trim() === '') {
        throw new Error('diagnostics: идентификатор источника не может быть пустым');
      }
      // Расхождение `source` записи с источником публикации ловим здесь: иначе запись
      // замещалась бы по одному ключу, а в интерфейсе группировалась бы по другому —
      // и «исправленная ошибка не ушла» вернулось бы с другой стороны.
      for (const item of items) {
        if (item.source !== source) {
          throw new Error(
            `diagnostics: запись источника «${item.source}» опубликована как «${source}». ` +
              'Замещение идёт по источнику: публикуй чужие находки от их имени'
          );
        }
      }

      const state = resources.get(resource);

      if (items.length === 0) {
        // Ничего не было и ничего не стало — не уведомляем: валидатор с чистым результатом
        // ходит на каждой правке, и уведомление на каждый его проход означало бы перерисовку
        // дерева ресурсов при обычном наборе текста.
        if (state === undefined || !state.bySource.has(source)) return;
        state.bySource.delete(source);
        state.snapshot = null;
        // Пустой ресурс убираем целиком: иначе карта растёт на каждый файл, который когда-то
        // открывали, и это утечка ровно там, где её труднее всего заметить.
        if (state.bySource.size === 0) {
          resources.delete(resource);
          names = null;
        }
        bus.emit(DiagnosticsDidChange, resource);
        return;
      }

      const target = state ?? {
        bySource: new Map<string, readonly Diagnostic[]>(),
        snapshot: null,
      };
      // Копия: список принадлежит валидатору, и он вправе переиспользовать свой массив.
      target.bySource.set(source, Object.freeze([...items]));
      target.snapshot = null;
      if (state === undefined) {
        resources.set(resource, target);
        names = null;
      }
      bus.emit(DiagnosticsDidChange, resource);
    },

    get(resource: ResourceId): readonly Diagnostic[] {
      const state = resources.get(resource);
      if (state === undefined) return EMPTY;
      if (state.snapshot === null) {
        // Порядок источников — алфавитный, а не «кто успел раньше»: иначе список
        // перескакивал бы при каждом перезапуске валидаторов, и глаз терял бы строку,
        // на которую смотрел.
        state.snapshot = Object.freeze(
          [...state.bySource.keys()].sort().flatMap((source) => state.bySource.get(source) ?? EMPTY)
        );
      }
      return state.snapshot;
    },

    resources(): readonly ResourceId[] {
      names ??= resources.size === 0 ? NO_RESOURCES : Object.freeze([...resources.keys()].sort());
      return names;
    },

    onDidChange(cb: (resource: ResourceId) => void): Disposable {
      return bus.on(DiagnosticsDidChange, cb);
    },
  };
}
