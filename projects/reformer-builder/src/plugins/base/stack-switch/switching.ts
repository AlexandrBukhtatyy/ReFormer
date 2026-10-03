/**
 * Выбор сочетания: что сделать с двумя осями, когда человек щёлкнул по пункту.
 *
 * Оси меняются по-разному, и это видно здесь целиком. Кит переключается сразу, одним вызовом
 * службы китов. Движок — нет: состав приложения фиксируется при сборке, поэтому его смена —
 * запись выбора и перезапуск, а перезапуску предшествует вопрос. Человек, щёлкнувший по строке
 * меню, перезагрузки не ждёт, и получить её без предупреждения значит принять за поломку.
 *
 * ## Порядок при смене движка: сначала кит, потом движок
 *
 * `profiles.select` перезапускает приложение и назад не возвращается. Кит, не записанный до него,
 * не записался бы вовсе — и после перезапуска человек увидел бы новый движок с прежним китом,
 * то есть не то сочетание, по которому щёлкнул.
 *
 * ## Отказ — словами
 *
 * Обе оси могут отказать: кит исчез между показом списка и щелчком (плагин выключили), выбор
 * профиля не сохранился (IndexedDB недоступна). Ни то ни другое не должно пропасть в консоли:
 * щелчок, после которого ничего не произошло, неотличим от неработающей кнопки.
 *
 * @module plugins/base/stack-switch/switching
 */

import type {
  ApplicationProfilesService,
  KitsService,
  PromptService,
} from '@reformer/builder-plugin-api';
import type { Combination } from './combinations';

/** Службы спрашиваются в момент выбора: кит и запросы выключаемы на ходу. */
export interface SwitchDeps {
  /** Чей словарь переводит вопрос о перезапуске. */
  readonly pluginId: string;
  readonly profiles: () =>
    | Pick<ApplicationProfilesService, 'select' | 'current' | 'launch'>
    | undefined;
  readonly kits: () => Pick<KitsService, 'activate' | 'resetChoice'> | undefined;
  readonly prompt: () => Pick<PromptService, 'confirm'> | undefined;
  /** Отказ переключения — человеку. */
  readonly report: (error: unknown) => void;
}

/**
 * Делает сочетание действующим. Не отвергается: отказ уходит в {@link SwitchDeps.report}.
 *
 * Сочетание, которое уже действует, — не действие: ни вопроса, ни записи.
 */
export async function applyCombination(deps: SwitchDeps, combination: Combination): Promise<void> {
  if (combination.active) return;
  try {
    const { kit, profile } = combination;
    if (combination.restarts && !(await confirmRestart(deps, profile?.name ?? ''))) return;
    if (kit !== null && !kit.active) await deps.kits()?.activate(kit.id);
    if (combination.restarts && profile !== null) await deps.profiles()?.select(profile.id);
  } catch (error) {
    deps.report(error);
  }
}

/**
 * Возвращает обе оси к конфигу запуска: снимает выбор кита и выбор движка.
 *
 * Отдельное действие, а не «выбрать сочетание из конфига»: выбор человека сильнее конфига
 * запуска, и выбрав то же сочетание руками, он остался бы «выбравшим» — смена кита или профиля
 * в конфиге его бы уже не касалась. Здесь записи СНИМАЮТСЯ, и приложение снова следует конфигу.
 *
 * Порядок тот же, что у смены движка, и по той же причине: кит — до профиля, потому что
 * `select` может перезапустить приложение. `select(launch)` зовётся и тогда, когда собран уже
 * профиль запуска: перезапуска не будет, но запись выбора, который перестал действовать
 * (профиль убрали из предложенных), снимется.
 */
export async function resetToLaunch(deps: SwitchDeps): Promise<void> {
  try {
    const profiles = deps.profiles();
    const launch = profiles?.launch();
    const restarts = launch !== undefined && profiles?.current().id !== launch.id;
    if (restarts && !(await confirmRestart(deps, launch.name))) return;
    await deps.kits()?.resetChoice();
    if (launch !== undefined) await profiles?.select(launch.id);
  } catch (error) {
    deps.report(error);
  }
}

/**
 * Спрашивает согласие на перезапуск.
 *
 * Без службы запросов ответ — «нет», а не «да»: спросить нечем, а перезапуск без вопроса хуже
 * непереключившегося движка. В собранном приложении служба есть всегда — её даёт оболочка.
 */
async function confirmRestart(deps: SwitchDeps, engine: string): Promise<boolean> {
  const prompt = deps.prompt();
  if (prompt === undefined) return false;
  return prompt.confirm({
    titleKey: 'confirm.title',
    descriptionKey: 'confirm.description',
    confirmKey: 'confirm.accept',
    params: { engine },
    pluginId: deps.pluginId,
  });
}
