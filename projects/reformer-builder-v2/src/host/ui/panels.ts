/**
 * Отбор панелей для слота — вся логика оболочки, которую можно проверить без браузера.
 *
 * Модуль намеренно состоит из чистых функций и не знает ни React, ни DOM. Причина
 * практическая: окружение тестов — `node`, и всё, что осталось внутри компонента, проверить
 * нечем. Причина устройства важнее: «какие панели видны в слоте» — это правило, а не отрисовка,
 * и держать его в JSX означало бы, что единственный способ узнать ответ — посмотреть глазами.
 *
 * @module host/ui/panels
 */

import type { Contribution } from '../primitives/extension-point';
import type { RootI18nService } from '../services/i18n/i18n';
import type { WhenContext } from '../primitives/when-context';
import type { PanelContribution, SlotId } from './slots';

/** Вклад панели: то, что лежит в точке расширения, вместе с происхождением и React-ключом. */
export type PanelEntry = Contribution<PanelContribution>;

/**
 * Действующий порядок панели: собственный `order` панели, иначе `order` вклада.
 *
 * Панель важнее регистрации: `order` вклада плагин задаёт один раз в `contribute`, а порядок
 * панели — свойство самой панели и переживает перерегистрацию (перезагрузку плагина).
 */
export function panelOrder(entry: PanelEntry): number {
  return entry.value.order ?? entry.order;
}

/**
 * Куда сообщать о падении предиката `when`.
 *
 * Политика та же, что у шины событий и рантайма плагинов: чужая поломка не роняет оболочку,
 * но и не исчезает бесследно. Панель с упавшим предикатом считается скрытой — из двух
 * неверных ответов этот безопаснее: показать панель, чей предикат не отработал, значит
 * отрисовать её `Body` в состоянии, для которого он не писался.
 */
export type PanelPredicateErrorHandler = (error: unknown, entry: PanelEntry) => void;

function defaultOnPredicateError(error: unknown, entry: PanelEntry): void {
  console.error(
    `[shell] панель «${entry.value.id}» плагина «${entry.pluginId}»: предикат when бросил`,
    error
  );
}

/**
 * Видна ли панель при данном контексте. Отсутствие предиката означает «всегда».
 *
 * Слот здесь не проверяется: это отдельный вопрос, и разделение позволяет диагностике
 * спросить «почему панель не видна» отдельно от «в тот ли слот она внесена».
 */
export function isPanelVisible(
  entry: PanelEntry,
  ctx: WhenContext,
  onError: PanelPredicateErrorHandler = defaultOnPredicateError
): boolean {
  const when = entry.value.when;
  if (when === undefined) return true;
  try {
    return when(ctx) === true;
  } catch (error) {
    onError(error, entry);
    return false;
  }
}

/**
 * Панели слота, видимые при данном контексте, в порядке показа.
 *
 * Порядок: по {@link panelOrder}, при равенстве — в порядке, в котором отдал реестр (тот уже
 * отсортирован по `order` и номеру регистрации). Сортировка устойчива, поэтому равные
 * значения не перемешиваются от кадра к кадру — иначе панели прыгали бы местами при каждой
 * перерисовке.
 *
 * Возвращается новый массив: результат зависит от контекста, и кэшировать его — дело
 * подписчика (`usePanels` держит его в `useMemo`).
 */
export function selectPanels(
  entries: readonly PanelEntry[],
  slot: SlotId,
  ctx: WhenContext,
  onError?: PanelPredicateErrorHandler
): readonly PanelEntry[] {
  return entries
    .filter((entry) => entry.value.slot === slot && isPanelVisible(entry, ctx, onError))
    .sort((a, b) => panelOrder(a) - panelOrder(b));
}

/**
 * Какая вкладка дока активна.
 *
 * `preferred` — то, что записано в настройках. Если такой панели среди видимых больше нет
 * (плагин выключили, `when` перестал выполняться), берётся первая видимая, а не пустота:
 * док с вкладками и без содержимого — состояние, в котором пользователю нечего делать.
 * Запись в настройках при этом не трогается — вернулась панель, вернулась и вкладка.
 */
export function resolveActivePanelId(
  panels: readonly PanelEntry[],
  preferred: string | null
): string | null {
  if (panels.length === 0) return null;
  if (preferred !== null && panels.some((entry) => entry.value.id === preferred)) return preferred;
  return panels[0].value.id;
}

/** Панель дока по идентификатору активной вкладки. `null`, если показывать нечего. */
export function findPanel(panels: readonly PanelEntry[], id: string | null): PanelEntry | null {
  if (id === null) return null;
  return panels.find((entry) => entry.value.id === id) ?? null;
}

/**
 * Заголовок панели.
 *
 * Разрешается **в пространстве имён внёсшего плагина**, а не словарём Host. Это то, ради чего
 * `pluginId` вообще есть у вклада: словарь всегда чей-то, и `files.panel.title` двух разных
 * плагинов — два разных сообщения. Host-словаря для панели не бывает: у корневого реестра
 * вкладов нет `contribute`, поэтому панель без плагина невыразима.
 */
export function panelTitle(i18n: RootI18nService, entry: PanelEntry): string {
  return i18n.forPlugin(entry.pluginId).t(entry.value.titleKey);
}

/**
 * Запасная подпись для рейла, когда у панели нет значка: первая буква заголовка.
 *
 * Не «первые буквы слов» и не аббревиатура: заголовок приходит из перевода, и правила
 * сокращения у языков разные. Одна буква одинаково честна везде.
 */
export function panelInitial(title: string): string {
  return [...title.trim()][0]?.toUpperCase() ?? '?';
}
