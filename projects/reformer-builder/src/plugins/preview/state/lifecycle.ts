/**
 * Сколько живёт состояние превью — режим поверхности, введённые значения, находки сборки.
 *
 * ## Почему это здесь, а не в композиции
 *
 * Правило жизни принадлежит тому, чьё состояние. Пока сведение жило в порту композиции
 * (`shell/boot/ports/preview`), плагин превью не мог ответить, когда его состояние исчезнет:
 * реестр ему давали снаружи, и снаружи же его чистили. Состав без превью при этом всё равно
 * заводил и реестр, и подписку на вкладки — оболочка чистила состояние плагина, которого
 * в ней нет.
 *
 * Теперь реестр создаёт сам плагин и сам же вешает на него это правило, а вкладки узнаёт
 * у рабочей области (`DocumentsService`) — то есть у службы, а не у порта. Вкладок в `@reformer/builder-plugin-api`
 * по-прежнему нет; есть открытые документы, и их достаточно. Каталог адреса спрашивается
 * у второй её половины (`WorkspaceFilesService`): разбирать адрес самому плагину нельзя.
 *
 * ## Граница — КАТАЛОГ формы, а не её вкладка
 *
 * Это не щедрость. Одиночный щелчок в дереве открывает временную вкладку, которая замещает
 * предыдущую: человек увидел в живой форме «validation.ts не компилируется», щёлкнул по
 * `validation.ts` — и вкладка формы закрылась. Забудь мы состояние здесь, находка исчезла бы
 * ровно в тот миг, когда её пошли чинить. Пока открыт сайдкар, находки формы нужны; закрыли
 * последний файл каталога — некому.
 *
 * ## Сведение по СНИМКУ, а не по событию «закрыли»
 *
 * У рабочей области событие одно — «что-то изменилось», — и этого достаточно: сведение
 * по снимку не пропускает закрытие, случившееся мимо уведомления, и переживает смену проекта,
 * которая закрывает все вкладки разом. Без проекта открытых документов нет, и забывается всё.
 *
 * @module plugins/preview/state/lifecycle
 */

import type {
  Disposable,
  DocumentsService,
  WorkspaceFilesService,
} from '@reformer/builder-plugin-api';
import type { PreviewSessions } from './sessions';

/** Открытые документы в объёме правила: что открыто и когда спрашивать заново. */
export type PreviewLifecycleDocuments = Pick<DocumentsService, 'openDocuments' | 'onDidChange'>;

/**
 * Адресация в объёме правила: чей это каталог.
 *
 * Вторая служба, а не метод первой, и это не дробление: «что открыто» и «где лежит» —
 * вопросы к разным половинам рабочей области (`platform/services/workspace-files`).
 * Обе даёт сама оболочка, поэтому их всегда две и отсутствовать по отдельности они не могут.
 */
export type PreviewLifecycleFiles = Pick<WorkspaceFilesService, 'parentOf'>;

export function attachPreviewLifecycle(
  documents: PreviewLifecycleDocuments,
  files: PreviewLifecycleFiles,
  sessions: Pick<PreviewSessions, 'ids' | 'forget'>
): Disposable {
  const sync = (): void => {
    const openDirs = new Set(documents.openDocuments().map((id) => files.parentOf(id)));
    for (const id of sessions.ids()) {
      if (!openDirs.has(files.parentOf(id))) sessions.forget(id);
    }
  };

  const subscription = documents.onDidChange(sync);
  sync();
  return subscription;
}
