/**
 * Команда «Очистить кэш»: снести всё, что приложение держит на источнике, и перезапуститься.
 *
 * ## Зачем она есть
 *
 * Между рабочей копией в OPFS, кэшем сборки, настройками и списком вкладок в IndexedDB
 * состояние приложения переживает не только перезагрузку, но и смену версии сборщика.
 * Когда оно расходится с действительностью (кэш собранных модулей от прошлой версии,
 * рабочая копия каталога, которого больше нет), единственным лечением до сих пор был
 * DevTools → Application → Clear site data. Инструмент, чьё лечение живёт в чужом
 * инструменте, лечения не имеет.
 *
 * ## Почему это одна команда, а не окно
 *
 * Показывать перед очисткой нечего: список областей человеку ничего не решает — он либо
 * согласен потерять локальное состояние, либо нет. Поэтому вопрос ровно один, и задаёт его
 * общая служба запросов (`tone: 'danger'`), а не свой диалог. Следствие принимается:
 * **без службы запросов команда объявляет себя недоступной**. Молчаливая очистка по щелчку
 * в меню — не «упрощение», а несоразмерный ущерб: несохранённые правки не восстанавливаются.
 *
 * ## Перезагрузка — часть действия, а не совет после него
 *
 * После очистки в памяти остаётся приложение, у которого под ногами больше нет ни рабочей
 * копии, ни метаданных: открытые вкладки ссылаются на снесённые файлы, ближайшая запись
 * заново создаст половину удалённого. Плюс отложенные удаления баз (`blocked`) доводятся
 * до конца именно закрытием страницы. Поэтому успех ведёт к `reload` без вопросов.
 *
 * Отказ — наоборот, НЕ ведёт: перезагрузка спрятала бы и отчёт, и тост, а человек остался бы
 * с наполовину очищенным хранилищем и без единого следа причины. Вместо этого показывается
 * уведомление с кнопкой перезагрузки — решение остаётся за человеком.
 *
 * @module host/ui/storage-purge
 */

import type { CommandContribution } from '../primitives/command';
import type { NotificationsService } from '../services/notifications';
import type { PromptService } from '../services/prompt';
import type { PurgeReport } from '../workspace/storage/purge';

/** Идентификатор команды. Экспортирован: на него ссылается пункт меню «Файл». */
export const STORAGE_PURGE_COMMAND_ID = 'host.storage.purge';

/**
 * Порт обслуживания хранилища — то, что композиция знает, а оболочка знать не должна.
 *
 * Оболочке нельзя ни перечислять хранилища (их состав — решение композиции), ни звать
 * `location.reload` (в тестах оболочки это перезапуск прогона). Оба знания приходят сюда
 * вместе, потому что порознь бесполезны: очистка без перезапуска оставляет приложение
 * поверх снесённого хранилища.
 */
export interface StorageMaintenance {
  /** Сносит хранилища источника. Не бросает: отказы приходят отчётом. */
  purge(): Promise<PurgeReport>;
  /** Перезапускает страницу. */
  reload(): void;
}

export interface StoragePurgeCommandOptions {
  readonly storage: StorageMaintenance;
  /** Без службы запросов команда недоступна — см. шапку. */
  readonly prompt: PromptService | null;
  /** Без уведомлений отказ виден только в консоли. Законная сборка, не поломка. */
  readonly notifications: NotificationsService | null;
}

/**
 * Собирает команду.
 *
 * Функция, а не эффект в оболочке: так исход («спросили — отказались», «снесли — перезапуск»,
 * «отказ — тост с кнопкой») проверяется без DOM и без реестра команд.
 */
export function storagePurgeCommand(options: StoragePurgeCommandOptions): CommandContribution {
  const { storage, prompt, notifications } = options;

  return {
    id: STORAGE_PURGE_COMMAND_ID,
    titleKey: 'shell.storage.purge',
    enabled: () => prompt !== null,
    run: async () => {
      if (prompt === null) return false;

      const agreed = await prompt.confirm({
        titleKey: 'shell.storage.purge.confirm.title',
        descriptionKey: 'shell.storage.purge.confirm.description',
        confirmKey: 'shell.storage.purge.confirm.ok',
        tone: 'danger',
      });
      if (!agreed) return false;

      let report: PurgeReport;
      try {
        report = await storage.purge();
      } catch (error) {
        // Очистка обещает не бросать, но обещание чужое: сорвавшись, оно не должно
        // превращаться в необработанный отказ команды.
        reportFailure(notifications, storage, error);
        return false;
      }

      if (report.failures.length > 0) {
        reportFailure(notifications, storage, report.failures, report.failures.length);
        return false;
      }

      storage.reload();
      return true;
    },
  };
}

/**
 * Сообщает об отказе и предлагает перезагрузку.
 *
 * Подробности уходят в консоль, а не в текст тоста: у отказа нет одной причины — их
 * столько, сколько записей не снеслось, и каждая со своим `DOMException`. Показывать
 * человеку имеет смысл число и кнопку, остальное нужно тому, кто будет разбираться.
 */
function reportFailure(
  notifications: NotificationsService | null,
  storage: StorageMaintenance,
  detail: unknown,
  count = 1
): void {
  console.error('[shell] очистка хранилища прошла не полностью', detail);
  notifications?.error('shell.storage.purge.failed', {
    params: { count },
    action: {
      titleKey: 'shell.storage.purge.reload',
      run: () => {
        storage.reload();
      },
    },
  });
}
