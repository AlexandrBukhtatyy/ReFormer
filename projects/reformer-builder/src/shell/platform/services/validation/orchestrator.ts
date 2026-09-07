/**
 * Оркестратор валидации: кто, когда и подо что публикует находки.
 *
 * Валидатор — вклад плагина, и знать про подписку на документ, задержку, отмену и бухгалтерию
 * источников он не обязан. Это делает оркестратор, и делает одинаково для всех, потому что
 * иначе каждый плагин переизобретал бы дебаунс — по-своему и с разными ошибками.
 *
 * ```text
 * правка буфера ─┬─► быстрый уровень: СИНХРОННО, сразу, публикуется под `id` валидатора
 *                └─► дорогой уровень: через `delay`, прежний проход отменяется, под `id#async`
 * ```
 *
 * ## Почему быстрый уровень синхронен до самого конца
 *
 * На нём стоит гейт ассистента: {@link ValidationOrchestrator.validate} возвращает находки
 * тем же вызовом, а не промисом, поэтому ход можно отвергнуть ДО применения. Одна `await`
 * на этом пути сделала бы асинхронным весь цикл ассистента.
 *
 * ## Почему дорогой уровень отменяется, а не выстраивается в очередь
 *
 * Его результат относится к тексту, которого через 300 мс уже нет. Очередь означала бы
 * публикацию находок по устаревшему тексту поверх свежих — то есть подчёркивание там, где
 * человек уже всё исправил. Поэтому новая правка **отменяет** предыдущий проход: пришедший
 * после отмены ответ отбрасывается, даже если валидатор досчитал его до конца.
 *
 * ## Почему источник переставляется оркестратором
 *
 * `publish` требует, чтобы `source` записи совпадал с источником публикации, а у одного
 * валидатора источников два (быстрый и дорогой — см. `validation/types`). Требовать этого
 * от валидатора значит требовать помнить, в каком проходе он сейчас находится. Поэтому
 * оркестратор проставляет `source` сам, а валидатор пишет своё имя (или не пишет ничего
 * осмысленного — его перепишут).
 *
 * @module shell/platform/services/validation/orchestrator
 */

import type { Disposable } from '@/shell/platform/primitives/disposable';
import { toDisposable } from '@/shell/platform/primitives/disposable';
import type { ExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ResourceId } from '@/shell/platform/primitives/resource';
import type { Diagnostic } from '@/shell/platform/services/diagnostics/types';
import type { Document } from '@/shell/platform/workspace/document';
import { isModelDocument } from '@/shell/platform/workspace/model/model-document';
import {
  asyncSource,
  fastSource,
  ValidatorPoint,
  type ValidateContext,
  type ValidatorContribution,
} from './types';

/**
 * Куда уходят находки. Форма совпадает с `DiagnosticsService.publish`, и сам сервис сюда
 * присваивается: оркестратору нужна только запись, а `get`/`onDidChange` — дело интерфейса.
 */
export interface DiagnosticsSink {
  publish(resource: ResourceId, source: string, items: readonly Diagnostic[]): void;
}

/** Минимум реестра, нужный для чтения валидаторов: годится и корневой, и вид плагина. */
export type ValidatorSource = Pick<ExtensionRegistry, 'get'>;

/**
 * Отложенный запуск. Возвращает отмену.
 *
 * Параметр, а не `setTimeout` в теле: тест дорогого уровня обязан управлять временем, а
 * подмена глобального таймера в модуле, который живёт рядом с рабочей областью и хранилищем,
 * ловит вместе с собой чужие таймеры (см. шапку `workspace.test.ts`).
 */
export type Schedule = (run: () => void, ms: number) => () => void;

/** Задержка дорогого уровня по умолчанию: пауза в наборе, а не «каждые N мс». */
export const DEFAULT_ASYNC_DELAY_MS = 300;

export interface ValidationOrchestratorOptions {
  readonly extensions: ValidatorSource;
  readonly diagnostics: DiagnosticsSink;
  /** Задержка дорогого уровня, мс. По умолчанию {@link DEFAULT_ASYNC_DELAY_MS}. */
  readonly delay?: number;
  readonly schedule?: Schedule;
}

export interface ValidationOrchestrator {
  /**
   * Гейт: быстрый уровень по документу, синхронно.
   *
   * Публикует результат (как и проход по правке — иначе интерфейс и гейт видели бы разное)
   * и возвращает сведённые находки всех быстрых валидаторов. Документ не обязан быть под
   * наблюдением: ассистент проверяет и то, что человек не открывал.
   */
  validate(document: Document): readonly Diagnostic[];

  /**
   * Ставит документ под наблюдение: правка буфера и правка модели запускают быстрый уровень
   * синхронно, дорогой — с задержкой.
   *
   * Проверка идёт сразу, не дожидаясь первой правки: файл с ошибкой обязан быть помечен
   * в момент открытия.
   *
   * Повторный `watch` того же ресурса снимает прежнюю подписку: два наблюдателя означали бы
   * два прохода на каждую правку и две отмены на один дорогой проход.
   *
   * `dispose()` снимает подписки и **убирает опубликованное этим документом**: наблюдения
   * больше нет, а находки, которые никто не обновляет, — это ровно тот случай «исправленная
   * ошибка висит», ради которого `publish` замещает.
   */
  watch(document: Document): Disposable;

  /**
   * Перепроверяет все наблюдаемые документы, даже если сами они не менялись.
   *
   * Существует потому, что находка зависит не только от документа: сменился кит — сменился
   * каталог компонентов, включился плагин — появился валидатор. Ни то ни другое не приходит
   * событием документа, и без этого вызова красное подчёркивание держалось бы до следующего
   * нажатия клавиши. Зовёт тот, кто мир и поменял.
   */
  revalidate(): void;

  /** Снимает все наблюдения. */
  dispose(): void;
}

/** Состояние одного наблюдаемого документа. */
interface WatchState {
  /** Полный проход обоих уровней. Заполняется `watch`, зовётся {@link ValidationOrchestrator.revalidate}. */
  rerun: () => void;
  readonly subscriptions: Disposable[];
  /** Источники, под которыми по этому документу уже публиковали, — их и снимать при уходе. */
  readonly sources: Set<string>;
  /** Текст последнего быстрого прохода; `undefined` — прохода ещё не было. */
  lastText: string | undefined;
  /** Модель последнего быстрого прохода. Сравнивается по ссылке — на этом стоит `apply`. */
  lastModel: unknown;
  /** Находки последнего быстрого прохода: ответ гейта, когда состояние не изменилось. */
  fast: readonly Diagnostic[];
  /** Отмена запланированного дорогого прохода. */
  cancelPending: (() => void) | undefined;
  /** Идущий дорогой проход. Отменяется следующей правкой. */
  controller: AbortController | undefined;
}

const defaultSchedule: Schedule = (run, ms) => {
  const timer = setTimeout(run, ms);
  return () => {
    clearTimeout(timer);
  };
};

/**
 * Контекст прохода.
 *
 * `model()` отдаёт модель ТОЛЬКО согласованного документа: в расхождении она описывает текст,
 * который человек уже переписал, и диагностика по ней указывала бы на несуществующие узлы.
 */
function contextOf(document: Document): ValidateContext {
  return {
    doc: document,
    text: () => document.getText(),
    model: () =>
      isModelDocument(document) && document.getSyncState() === 'synced'
        ? document.getModel()
        : undefined,
  };
}

/** Переставляет источник записи. Копия только там, где он действительно другой. */
function stamp(items: readonly Diagnostic[], source: string): readonly Diagnostic[] {
  return items.map((item) => (item.source === source ? item : { ...item, source }));
}

export function createValidationOrchestrator(
  options: ValidationOrchestratorOptions
): ValidationOrchestrator {
  const { extensions, diagnostics } = options;
  const delay = options.delay ?? DEFAULT_ASYNC_DELAY_MS;
  const schedule = options.schedule ?? defaultSchedule;
  const watched = new Map<ResourceId, WatchState>();

  /**
   * Валидаторы, которые берутся за документ.
   *
   * Упавший `applies` не отменяет проверку остальными: один сломанный плагин иначе оставлял бы
   * файл вовсе непроверенным — и не сообщал бы об этом ничем. Та же политика, что у выбора
   * провайдера модели.
   */
  const validatorsFor = (document: Document): ValidatorContribution[] => {
    const out: ValidatorContribution[] = [];
    for (const contribution of extensions.get(ValidatorPoint)) {
      const validator = contribution.value;
      try {
        if (validator.applies(document)) out.push(validator);
      } catch (err) {
        console.error(`[validation] валидатор «${validator.id}» упал на applies; пропущен`, err);
      }
    }
    return out;
  };

  const publish = (
    document: Document,
    state: WatchState | undefined,
    source: string,
    items: readonly Diagnostic[]
  ): void => {
    state?.sources.add(source);
    diagnostics.publish(document.id, source, items);
  };

  const runFast = (
    document: Document,
    state?: WatchState,
    known?: readonly ValidatorContribution[]
  ): readonly Diagnostic[] => {
    const ctx = contextOf(document);
    const text = ctx.text();
    const model = ctx.model();

    // Тот же текст и та же модель — тот же ответ. Не оптимизация: правка модели перерисовывает
    // буфер, эхо буфера приходит вторым событием, и без этой проверки каждая структурная правка
    // шла бы двумя одинаковыми проходами и двумя публикациями.
    if (state !== undefined && state.lastText === text && state.lastModel === model) {
      return state.fast;
    }

    const collected: Diagnostic[] = [];
    for (const validator of known ?? validatorsFor(document)) {
      if (validator.validate === undefined) continue;
      const source = fastSource(validator.id);
      let items: readonly Diagnostic[];
      try {
        items = validator.validate(ctx);
      } catch (err) {
        // Прошлые находки этого валидатора не трогаем: они отражают последнее состояние,
        // в котором он справился, а пустая публикация выдала бы поломку за «здесь чисто».
        console.error(`[validation] валидатор «${validator.id}» упал на validate`, err);
        continue;
      }
      const stamped = stamp(items, source);
      publish(document, state, source, stamped);
      collected.push(...stamped);
    }

    if (state !== undefined) {
      state.lastText = text;
      state.lastModel = model;
      state.fast = collected;
    }
    return collected;
  };

  const runAsync = (document: Document, state: WatchState): void => {
    const validators = validatorsFor(document).filter((v) => v.validateAsync !== undefined);
    if (validators.length === 0) return;

    const controller = new AbortController();
    state.controller = controller;
    const ctx = contextOf(document);

    for (const validator of validators) {
      const source = asyncSource(validator.id);
      const validateAsync = validator.validateAsync;
      if (validateAsync === undefined) continue;
      let running: Promise<readonly Diagnostic[]>;
      try {
        running = validateAsync.call(validator, ctx, controller.signal);
      } catch (err) {
        console.error(`[validation] валидатор «${validator.id}» упал на validateAsync`, err);
        continue;
      }
      void running.then(
        (items) => {
          // Отменённый проход считал по тексту, которого уже нет: его находки не публикуются,
          // даже если валидатор досчитал их до конца.
          if (controller.signal.aborted) return;
          publish(document, state, source, stamp(items, source));
        },
        (err: unknown) => {
          if (controller.signal.aborted) return;
          console.error(`[validation] дорогой проход «${validator.id}» отказал`, err);
        }
      );
    }
  };

  const cancelAsync = (state: WatchState): void => {
    state.cancelPending?.();
    state.cancelPending = undefined;
    state.controller?.abort();
    state.controller = undefined;
  };

  const scheduleAsync = (
    document: Document,
    state: WatchState,
    known: readonly ValidatorContribution[]
  ): void => {
    cancelAsync(state);
    // Дорогих валидаторов нет — таймера нет вовсе: иначе каждое нажатие клавиши заводило бы
    // отложенный вызов, которому нечего делать. Состав вкладов перепроверяется в момент
    // запуска: плагин мог включиться, пока шла задержка.
    if (!known.some((validator) => validator.validateAsync !== undefined)) return;
    state.cancelPending = schedule(() => {
      state.cancelPending = undefined;
      runAsync(document, state);
    }, delay);
  };

  const unwatch = (document: Document): void => {
    const state = watched.get(document.id);
    if (state === undefined) return;
    watched.delete(document.id);
    cancelAsync(state);
    for (const subscription of state.subscriptions) subscription.dispose();
    for (const source of state.sources) diagnostics.publish(document.id, source, []);
  };

  return {
    validate(document) {
      return runFast(document, watched.get(document.id));
    },

    watch(document) {
      unwatch(document);

      const state: WatchState = {
        rerun: () => {},
        subscriptions: [],
        sources: new Set<string>(),
        lastText: undefined,
        lastModel: undefined,
        fast: [],
        cancelPending: undefined,
        controller: undefined,
      };
      watched.set(document.id, state);

      const revalidate = (): void => {
        // Состав валидаторов считается ОДИН раз на правку и достаётся обоим уровням:
        // `applies` обязан быть дешёвым, но звать его дважды на каждое нажатие — уже не «дёшево».
        const known = validatorsFor(document);
        runFast(document, state, known);
        scheduleAsync(document, state, known);
      };
      state.rerun = revalidate;

      state.subscriptions.push(document.onDidChangeContent(revalidate));
      if (isModelDocument(document)) {
        // Структурная правка не всегда доходит до буфера сразу: перерисовка откладывается,
        // пока текстовый редактор в фокусе. Без этой подписки форма, которую правят мышью,
        // проверялась бы только после ухода фокуса.
        state.subscriptions.push(document.onDidChangeModel(revalidate));
      }

      revalidate();

      return toDisposable(() => {
        unwatch(document);
      });
    },

    revalidate() {
      for (const state of [...watched.values()]) {
        // Память прохода сбрасывается: документ не менялся, и без сброса проход счёлся бы
        // повторным и не дал бы ничего.
        state.lastText = undefined;
        state.lastModel = undefined;
        state.rerun();
      }
    },

    dispose() {
      for (const [id, state] of [...watched]) {
        watched.delete(id);
        cancelAsync(state);
        for (const subscription of state.subscriptions) subscription.dispose();
        for (const source of state.sources) diagnostics.publish(id, source, []);
      }
    },
  };
}
