/**
 * Слияние декораций ресурсов и подсказка к ним.
 *
 * Пометка, вклад и точка расширения живут в пакете `@reformer/builder-plugin-api`; там же
 * записано, почему навигация платформенная, а знание «этот JSON — схема формы» приходит вкладом.
 *
 * @module shell/platform/ui/contributions/decorations
 */

import type { ComponentType } from 'react';
import type { Disposable } from '@reformer/builder-plugin-api/internal';
import { type Contribution } from '@reformer/builder-plugin-api/internal';
import type { ResourceRef } from '@reformer/builder-plugin-api/internal';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { EditorProbe } from '@reformer/builder-plugin-api/internal';
import {
  type Decoration,
  type DecorationTone,
  type ResourceDecorationContribution,
} from '@reformer/builder-plugin-api/internal';

/** Вклад декорации вместе с происхождением. */
export type DecorationEntry = Contribution<ResourceDecorationContribution>;

/**
 * Пометка после слияния — с одной добавкой: чей словарь разрешает `tooltipKey`.
 *
 * Без неё ключ разрешать нечем. Ключ приходит из словаря ВНЁСШЕГО плагина (то же правило,
 * что у заголовка панели: словарь всегда чей-то, и `kind.schema` двух плагинов — два разных
 * сообщения), а слияние собирает поля от разных вкладов и происхождение при этом теряет.
 * Поэтому оно переносится вместе с ключом — и только с ним: у значка и тона словаря нет.
 */
export interface MergedDecoration extends Decoration {
  /** Плагин, чей `tooltipKey` попал в слияние. Есть ровно тогда, когда есть `tooltipKey`. */
  readonly tooltipPluginId?: string;
}

/**
 * Подписывает на «пометка изменилась» все вклады сразу.
 *
 * Отдельная функция, а не три строки в компоненте, ровно по той причине, по которой
 * отдельны {@link mergeDecorations} и `panels.selectPanels`: окружение тестов — `node`,
 * и всё, что осталось внутри компонента, проверить нечем.
 *
 * Политика отказа та же, что у `decorate`: упавший вклад пропускается, остальные
 * подписываются дальше — дерево обязано перерисовываться и с одним сломанным плагином.
 * Возвращённое освобождение снимает ровно то, что удалось подписать, и терпит повторный
 * вызов: React зовёт очистку эффекта и в StrictMode, и на каждой смене состава вкладов.
 */
export function observeDecorations(
  entries: readonly DecorationEntry[],
  onChange: () => void,
  onError: DecorationErrorHandler = defaultOnDecorationError
): Disposable {
  const subscriptions: Disposable[] = [];
  for (const entry of entries) {
    const observe = entry.value.onDidChange;
    if (observe === undefined) continue;
    try {
      subscriptions.push(observe.call(entry.value, onChange));
    } catch (error) {
      onError(error, entry);
    }
  }
  return {
    dispose: () => {
      // Копия и очистка списка: повторный `dispose` обязан быть пустым делом, а не вторым
      // снятием тех же подписок.
      const taken = subscriptions.splice(0, subscriptions.length);
      for (const subscription of taken) {
        try {
          subscription.dispose();
        } catch (error) {
          console.error('[shell] декорация: отписка бросила', error);
        }
      }
    },
  };
}

/**
 * Старшинство тонов при слиянии. Больше — важнее.
 *
 * Тон — единственное поле, которое сливается по старшинству, а не «первый выигрывает».
 * Причина в том, что тон — сигнал, а не оформление: ошибка валидации, закрытая ровным
 * акцентом «это схема формы», — дефект, а не вопрос вкуса.
 */
export const TONE_SEVERITY: Readonly<Record<DecorationTone, number>> = Object.freeze({
  default: 0,
  accent: 1,
  warning: 2,
  danger: 3,
});

/**
 * Куда сообщать о падении `decorate`.
 *
 * Политика та же, что у предиката панели: упавший вклад пропускается, остальные
 * спрашиваются дальше. Дерево обязано нарисоваться и с одним сломанным плагином.
 */
export type DecorationErrorHandler = (error: unknown, entry: DecorationEntry) => void;

function defaultOnDecorationError(error: unknown, entry: DecorationEntry): void {
  console.error(
    `[shell] декорация «${entry.value.id}» плагина «${entry.pluginId}»: decorate бросил`,
    error
  );
}

/**
 * Сливает пометки нескольких вкладов в одну.
 *
 * Правило разное для разных полей, и это намеренно:
 *
 * - `badge`, `icon`, `tooltipKey` — **первый, кто задал**. Порядок задаёт реестр (`order`
 *   вклада, при равенстве — порядок регистрации), поэтому старшинство объявляется, а не
 *   достаётся случайно тому, чей плагин активировался раньше;
 * - `tone` — **самый строгий из всех**, см. {@link TONE_SEVERITY}.
 *
 * `null` — если не высказался никто или все высказавшиеся вернули пустую пометку: пустой
 * объект и его отсутствие для отрисовки — одно и то же, и различать их значило бы рисовать
 * пустой значок.
 */
export function mergeDecorations(
  entries: readonly DecorationEntry[],
  ref: ResourceRef,
  probe: EditorProbe,
  onError: DecorationErrorHandler = defaultOnDecorationError
): MergedDecoration | null {
  let badge: string | undefined;
  let icon: ComponentType | undefined;
  let tooltipKey: string | undefined;
  let tooltipParams: Record<string, unknown> | undefined;
  let tooltipPluginId: string | undefined;
  let tone: DecorationTone | undefined;

  for (const entry of entries) {
    let decoration: Decoration | null;
    try {
      decoration = entry.value.decorate(ref, probe);
    } catch (error) {
      onError(error, entry);
      continue;
    }
    if (decoration === null || decoration === undefined) continue;

    badge ??= decoration.badge;
    icon ??= decoration.icon;
    if (tooltipKey === undefined && decoration.tooltipKey !== undefined) {
      tooltipKey = decoration.tooltipKey;
      // Параметры едут ВМЕСТЕ с ключом, а не отдельным полем по общему правилу «первый,
      // кто задал»: параметры чужого ключа подставились бы в этот и дали бы бессмыслицу.
      tooltipParams = decoration.tooltipParams;
      tooltipPluginId = entry.pluginId;
    }
    if (
      decoration.tone !== undefined &&
      (tone === undefined || TONE_SEVERITY[decoration.tone] > TONE_SEVERITY[tone])
    ) {
      tone = decoration.tone;
    }
  }

  if (badge === undefined && icon === undefined && tooltipKey === undefined && tone === undefined) {
    return null;
  }
  return { badge, icon, tooltipKey, tooltipParams, tooltipPluginId, tone };
}

/**
 * Разрешает подсказку пометки в словаре внёсшего плагина.
 *
 * Отдельная функция, а не поле в слиянии: перевод обязан случаться в момент показа, иначе
 * смена локали оставит на экране прежний язык — тот же довод, по которому у панели `titleKey`,
 * а не готовая строка.
 */
export function decorationTooltip(
  i18n: Pick<RootI18nService, 'forPlugin'>,
  decoration: MergedDecoration
): string | null {
  if (decoration.tooltipKey === undefined || decoration.tooltipPluginId === undefined) return null;
  return i18n
    .forPlugin(decoration.tooltipPluginId)
    .t(decoration.tooltipKey, decoration.tooltipParams);
}
