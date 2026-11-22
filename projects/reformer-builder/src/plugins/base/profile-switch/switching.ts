/**
 * Смена профиля: спросить про перезагрузку и попросить службу профилей.
 *
 * Профиль фиксируется при сборке приложения, поэтому его смена — перезагрузка: служба профилей
 * запоминает выбор и перезапускает приложение сама. Здесь остаётся одно решение — спросить
 * человека ДО этого: правки открытых файлов переживут перезагрузку, но вид экрана изменится.
 *
 * Модуль чистый: службы приходят функциями, чтобы каждая спрашивалась в момент действия.
 *
 * @module plugins/base/profile-switch/switching
 */

import type { ApplicationProfilesService, PromptService } from '@reformer/builder-plugin-api';
import type { ProfileChoice } from './choices';

export interface SwitchDeps {
  /** Идентификатор плагина: по нему диалог находит словарь с текстами вопроса. */
  readonly pluginId: string;
  readonly profiles: () =>
    | Pick<ApplicationProfilesService, 'select' | 'current' | 'launch'>
    | undefined;
  readonly prompt: () => Pick<PromptService, 'confirm'> | undefined;
  /** Куда сказать об отказе. */
  readonly report: (error: unknown) => void;
}

/** Выбирает профиль. Действующий — ничего не делает; отказ от вопроса — тоже. */
export async function applyChoice(deps: SwitchDeps, choice: ProfileChoice): Promise<void> {
  if (choice.active) return;
  try {
    if (choice.restarts && !(await confirmRestart(deps, choice.label))) return;
    await deps.profiles()?.select(choice.id);
  } catch (error) {
    deps.report(error);
  }
}

/** Возвращает профиль конфига запуска: отказ от собственного выбора. */
export async function resetToLaunch(deps: SwitchDeps): Promise<void> {
  try {
    const profiles = deps.profiles();
    const launch = profiles?.launch();
    if (profiles === undefined || launch === undefined) return;
    const restarts = profiles.current().id !== launch.id;
    if (restarts && !(await confirmRestart(deps, launch.name))) return;
    await profiles.select(launch.id);
  } catch (error) {
    deps.report(error);
  }
}

/** Без службы диалогов согласия нет: перезагружать приложение молча нельзя. */
async function confirmRestart(deps: SwitchDeps, profile: string): Promise<boolean> {
  const prompt = deps.prompt();
  if (prompt === undefined) return false;
  return prompt.confirm({
    titleKey: 'confirm.title',
    descriptionKey: 'confirm.description',
    confirmKey: 'confirm.accept',
    params: { profile },
    pluginId: deps.pluginId,
  });
}
