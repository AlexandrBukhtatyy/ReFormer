/**
 * Отказ открытия проекта глазами человека: какое сообщение показать и какую кнопку дать.
 *
 * ## Почему отдельный модуль, а не `boot`
 *
 * Оба правила чистые, а `boot` тянет за собой всё приложение: проверять их там значило бы
 * поднимать композицию ради двух `switch`. Показывает уведомление по-прежнему композиция —
 * здесь только ответ на вопрос «что сказать и что предложить».
 *
 * ## Кнопка зависит от причины, и угадать её нельзя
 *
 * - `denied` — хэндл есть, разрешения нет. Браузер отдаёт разрешение только по жесту,
 *   а восстановление на старте жестом не располагает. Щелчок по кнопке уведомления — жест,
 *   и повторное открытие из его обработчика уже вправе спросить.
 * - `missing` — поднимать нечего: каталог удалили, переместили или открывали в другом
 *   браузере. Остаётся не предлагать его больше — убрать из недавних.
 *
 * Кнопка есть, только когда известно, КАКУЮ область поднимали. У выбора каталога записи
 * ещё нет, и предложить по ней нечего.
 *
 * @module shell/boot/project/project-failure
 */

import type { NotificationAction } from '@reformer/builder-plugin-api/internal';
import type { ProjectFailure } from './project';

/**
 * Ключ сообщения об отказе открытия.
 *
 * Принимает отказ ЦЕЛИКОМ, а не только его вид: у недоступного источника есть причина,
 * и она решает, какую кнопку показать. «Источника больше нет» требует выбрать проект
 * заново, «доступ не дан» — одного нажатия «разрешить». Показывать их одинаково значит
 * посылать человека делать лишнюю работу в половине случаев.
 *
 * Причина отдельным полем, а не вторым видом отказа: вид отвечает «что случилось
 * с открытием» и выбирает уровень уведомления, причина — «что делать». Разложи мы второе
 * по первому, каждый, кому нужен только уровень, был бы обязан перечислять причины.
 */
export function projectFailureMessageKey(failure: ProjectFailure): string | null {
  switch (failure.kind) {
    case 'cancelled':
      return null;
    case 'unsupported':
      return 'files.notify.unsupported';
    case 'unavailable':
      return failure.reason === undefined
        ? 'files.notify.unavailable'
        : `files.notify.unavailable.${failure.reason}`;
    case 'failed':
      return 'files.notify.failed';
  }
}

/** Что композиция умеет сделать по кнопке уведомления. */
export interface ProjectFailureActions {
  /** Переоткрыть область — из обработчика щелчка, то есть по жесту. */
  reopen(workspaceId: string): void;
  /** Убрать область из недавних: рабочая копия остаётся, пропадает строка списка. */
  forget(workspaceId: string): void;
}

/** Кнопка на уведомлении об отказе или `undefined`, если предложить нечего. */
export function projectFailureAction(
  failure: ProjectFailure,
  actions: ProjectFailureActions
): NotificationAction | undefined {
  const { workspaceId } = failure;
  if (failure.kind !== 'unavailable' || workspaceId === undefined) return undefined;
  switch (failure.reason) {
    case 'denied':
      return {
        titleKey: 'files.notify.action.grant',
        run: () => {
          actions.reopen(workspaceId);
        },
      };
    case 'missing':
      return {
        titleKey: 'files.notify.action.forget',
        run: () => {
          actions.forget(workspaceId);
        },
      };
    default:
      return undefined;
  }
}
