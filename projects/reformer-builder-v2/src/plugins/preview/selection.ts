/**
 * Выбор поверхности превью: чистое правило, из которого интерфейс делает переключатель.
 *
 * ## Почему правило, а не «поверхность по умолчанию» константой
 *
 * Точка расширения открыта: поверхностей может стать больше, и они могут прийти из чужого
 * плагина. Константа «по умолчанию рантайм» означала бы, что новая, более способная поверхность
 * не выбирается никогда, пока не поправят эту строку. Поэтому умолчание вычисляется
 * из ОБЪЯВЛЕННЫХ возможностей ({@link surfaceRank}) — тот же приём, которым выбирается редактор
 * по приоритету `canOpen`, только приоритет здесь не назначают, а выводят.
 *
 * ## Ранг считается по возможностям, а не по имени
 *
 * Порядок ценности для человека, открывшего форму: увидеть, как отрабатывает его КОД (сайдкары),
 * иначе — как форма выглядит и ведёт себя ВЖИВУЮ, иначе — хотя бы её структуру. Отсюда веса:
 * исполнение кода > интерактивность > выбор узла кликом. Веса степенные, чтобы более ценный
 * признак не перебивался суммой мелких: поверхность, исполняющая код, обязана выигрывать
 * у интерактивной с хит-тестом, а не сравниваться с ней.
 *
 * ## Отказ по источнику меняет выбор, но не прячет причину
 *
 * Недоступная поверхность остаётся в списке ({@link SurfaceOption.available} = `false`),
 * а выбор откатывается на лучшую доступную с заполненным {@link SurfaceChoice.fallback}.
 * Тихая подмена режима запрещена контрактом Э8, и именно поэтому причина — часть результата,
 * а не журнальная запись.
 *
 * @module plugins/preview/selection
 */

import type { DocumentRef } from '@/sdk';
import type { PreviewCapabilities, PreviewSurface } from './contract';
import type { PreviewSourceCapabilities } from './host';
import { canMountSurface, type PreviewRefusalReason } from './source-guard';

/** Вес исполнения кода: сайдкары видит только он. */
const WEIGHT_EXECUTES_CODE = 4;
/** Вес интерактивности: форму можно потрогать. */
const WEIGHT_INTERACTIVE = 2;
/** Вес выбора узла кликом: превью связано с редактором. */
const WEIGHT_HIT_TEST = 1;

/**
 * Ранг поверхности — «насколько много она показывает».
 *
 * `dragSource` и `sameRealm` в ранг НЕ входят: первый про палитру (это про правку, а не про
 * показ), второй — про устройство, а не про ценность. Поверхность в чужом realm может быть
 * ровно так же полезна, как своя, и ранжировать её ниже за это было бы неверно.
 */
export function surfaceRank(capabilities: PreviewCapabilities): number {
  return (
    (capabilities.executesCode ? WEIGHT_EXECUTES_CODE : 0) +
    (capabilities.interactive ? WEIGHT_INTERACTIVE : 0) +
    (capabilities.hitTest ? WEIGHT_HIT_TEST : 0)
  );
}

/** Пункт переключателя: поверхность вместе с ответом «доступна ли она сейчас». */
export interface SurfaceOption {
  readonly surface: PreviewSurface;
  readonly available: boolean;
  /** Причина недоступности; `null` у доступной. */
  readonly refusal: PreviewRefusalReason | null;
}

/** Почему показана не та поверхность, которую просили. */
export type FallbackReason =
  /** Просили поверхность, которой нет среди вкладов. */
  | 'unknown-surface'
  /** Просили поверхность, которая за такой документ не берётся. */
  | 'not-applicable'
  /** Просили поверхность, которой отказал источник. */
  | PreviewRefusalReason;

/** Отказ от запрошенного выбора. */
export interface SurfaceFallback {
  /** Что просили. */
  readonly requested: string;
  readonly reason: FallbackReason;
}

/** Что показывать и что сказать про выбор. */
export interface SurfaceChoice {
  /** Выбранная поверхность; `null` — показывать нечем. */
  readonly surface: PreviewSurface | null;
  /** Все применимые поверхности в порядке убывания ранга — это и есть переключатель. */
  readonly options: readonly SurfaceOption[];
  /** Заполнен, если выбор отличается от запрошенного. */
  readonly fallback: SurfaceFallback | null;
}

export interface SurfaceChoiceInput {
  /** Вклады в точку расширения, в порядке реестра. */
  readonly surfaces: readonly PreviewSurface[];
  readonly doc: DocumentRef;
  readonly source: PreviewSourceCapabilities | null;
  /** Выбор человека; `null`/`undefined` — решает правило. */
  readonly preferred?: string | null;
}

/**
 * Выбирает поверхность.
 *
 * Порядок пунктов — убывание ранга; при равенстве выигрывает тот, кто раньше в реестре
 * (сортировка устойчива, реестр уже упорядочен по `order` вклада). Это же делает выбор
 * ВОСПРОИЗВОДИМЫМ: одинаковый набор вкладов даёт одинаковый ответ независимо от того,
 * в каком порядке плагины активировались.
 *
 * Неприменимые к документу поверхности в `options` не попадают вовсе: переключатель, где
 * половина пунктов не работает, хуже короткого списка.
 */
export function chooseSurface(input: SurfaceChoiceInput): SurfaceChoice {
  const { surfaces, doc, source, preferred } = input;

  const applicable = surfaces.filter((surface) => applies(surface, doc));
  const options: readonly SurfaceOption[] = applicable
    .map((surface) => {
      const decision = canMountSurface(surface.capabilities, source);
      return {
        surface,
        available: decision.allowed,
        refusal: decision.allowed ? null : decision.reason,
      };
    })
    .sort((a, b) => surfaceRank(b.surface.capabilities) - surfaceRank(a.surface.capabilities));

  const best = options.find((option) => option.available)?.surface ?? null;

  if (preferred === undefined || preferred === null) {
    return { surface: best, options, fallback: null };
  }

  const chosen = options.find((option) => option.surface.id === preferred);
  if (chosen !== undefined && chosen.available) {
    return { surface: chosen.surface, options, fallback: null };
  }

  const reason: FallbackReason =
    chosen !== undefined
      ? // `available: false` всегда несёт причину — она и есть ответ «почему не смонтировали».
        (chosen.refusal ?? 'not-applicable')
      : surfaces.some((surface) => surface.id === preferred)
        ? 'not-applicable'
        : 'unknown-surface';

  return { surface: best, options, fallback: { requested: preferred, reason } };
}

/**
 * Упавший `applies` означает «не берусь».
 *
 * Политика та же, что у предиката панели и у `canOpen` редактора: сломанный кандидат
 * пропускается, остальные спрашиваются дальше. Иначе один плохой вклад лишал бы превью целиком,
 * не сообщая об этом ничем, кроме пустоты.
 */
function applies(surface: PreviewSurface, doc: DocumentRef): boolean {
  try {
    return surface.applies(doc);
  } catch (error) {
    console.error(`[preview] поверхность «${surface.id}»: applies бросил`, error);
    return false;
  }
}

/**
 * Следующая ДОСТУПНАЯ поверхность по кругу — то, что делает команда переключения.
 *
 * По кругу, а не до конца списка: переключатель из трёх пунктов, упирающийся в последний,
 * заставляет тянуться мышью ради возврата в начало. Недоступные пропускаются — нажатие
 * на команду обязано что-то менять, иначе она выглядит сломанной.
 *
 * `null` означает «менять не на что»: доступна одна поверхность или ни одной.
 */
export function nextSurfaceId(
  options: readonly SurfaceOption[],
  currentId: string | null
): string | null {
  const usable = options.filter((option) => option.available);
  if (usable.length < 2) return null;
  const at = usable.findIndex((option) => option.surface.id === currentId);
  // Текущей нет в списке (её сняли вместе с плагином) — начинаем с первой.
  return usable[(at + 1) % usable.length].surface.id;
}
