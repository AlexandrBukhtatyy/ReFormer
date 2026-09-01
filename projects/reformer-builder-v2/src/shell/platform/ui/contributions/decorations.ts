/**
 * Декорации ресурсов — ответ на вопрос «чей файловый список».
 *
 * Разбор такой: **навигация по ресурсам платформенная** — она про источник и рабочую область,
 * а не про формы; **знание «этот JSON — схема формы» предметное** и приходит вкладом. Поэтому
 * дерево живёт в Host (см. `./resource-tree`) и ничего не знает о формах, а пометка на файле
 * приходит отсюда.
 *
 * Механизм окупается сразу: тем же способом на файлы вешаются ошибки валидации, а позже —
 * состояние git. И по тому же правилу, по которому Host не вносит панелей, он не вносит и
 * декораций: **точка расширения остаётся пустой**, пока не появится плагин. Это не оговорка,
 * а свойство устройства — у корневого реестра нет `contribute`, поэтому «декорация от Host»
 * невыразима, и декорация от диагностик придёт вкладом того, кто диагностики публикует.
 *
 * ## Проба здесь ленивая
 *
 * `decorate` синхронна, а проба отдаёт содержимое промисом — значит вклад, которому мало
 * `ref`, содержимого в этот момент не получит. Так и задумано: раскрытие каталога стоит
 * одного листинга, и если бы декорации читали тела файлов, оно стоило бы N чтений.
 * Вклад, которому нужно содержимое, читает его сам (проба это позволяет) и объявляет
 * результат вторым проходом — сняв и внеся вклад заново.
 *
 * @module shell/platform/ui/contributions/decorations
 */

import type { ComponentType } from 'react';
import type { Disposable } from '@/shell/platform/primitives/disposable';
import {
  defineExtensionPoint,
  type Contribution,
} from '@/shell/platform/primitives/extension-point';
import type { ResourceRef } from '@/shell/platform/primitives/resource';
import type { RootI18nService } from '@/shell/platform/services/i18n/i18n';
import type { EditorProbe } from '@/shell/platform/workspace/model/provider';

/**
 * Тон пометки. Предметного смысла у Host нет: он переносит значение от вклада к отрисовке.
 *
 * Порядок значений несущий — см. {@link TONE_SEVERITY} и правило слияния.
 */
export type DecorationTone = 'default' | 'accent' | 'warning' | 'danger';

/** Пометка на ресурсе: короткий значок и подсказка, а не текст произвольной длины. */
export interface Decoration {
  /** Короткая пометка: «S», «3», «●». Строка, а не число: это и счётчик, и буква вида. */
  readonly badge?: string;
  readonly icon?: ComponentType;
  /** Ключ i18n подсказки — в пространстве имён внёсшего плагина, как у заголовка панели. */
  readonly tooltipKey?: string;
  /**
   * Параметры подсказки: подставляются в момент показа, вместе с ключом.
   *
   * Без них пометка «3» умеет сказать только «есть проблемы», а «три ошибки» — уже нет:
   * счётчик пришлось бы вклеивать в строку самим, то есть переводить у себя. Ключ и его
   * параметры путешествуют парой — см. {@link mergeDecorations}.
   */
  readonly tooltipParams?: Record<string, unknown>;
  readonly tone?: DecorationTone;
}

export interface ResourceDecorationContribution {
  /** Уникален среди декораций; попадает в диагностику и служит React-ключом. */
  readonly id: string;
  /**
   * Пометка для ресурса или `null`, если этому вкладу сказать нечего.
   *
   * Синхронна и обязана быть дешёвой: её зовут для каждой строки видимого уровня дерева
   * на каждую перерисовку. Содержимое через пробу читается лениво — см. шапку модуля.
   */
  decorate(ref: ResourceRef, probe: EditorProbe): Decoration | null;
  /**
   * «Мой ответ изменился» — повод спросить {@link decorate} заново.
   *
   * Необязателен, и большинству вкладов не нужен: пометка «это схема формы» зависит только
   * от `ref`, а `ref` меняется вместе со строкой дерева. Нужен тем, чей ответ зависит от
   * состояния СНАРУЖИ дерева — диагностике прежде всего: находки приходят от валидатора,
   * дерево про них ничего не знает и перерисовываться ему не с чего.
   *
   * Пока этого крючка не было, единственным способом обновить пометку было снять вклад
   * и внести заново (так и записано в шапке модуля — «объявить результат вторым проходом»).
   * Для содержимого файла это годится: оно меняется редко. Для диагностики — нет: она
   * меняется на каждой правке, и перерегистрация вклада означала бы две рассылки реестра
   * на каждый набранный символ, а заодно потерю порядка вкладов.
   */
  onDidChange?(cb: () => void): Disposable;
}

/** Точка расширения декораций. Заполняется только плагинами. */
export const ResourceDecorationPoint =
  defineExtensionPoint<ResourceDecorationContribution>('resource.decoration');

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
