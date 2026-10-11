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
 * ## Граница — КАТАЛОГ МОДУЛЯ формы, а не её вкладка
 *
 * Это не щедрость. Одиночный щелчок в дереве открывает временную вкладку, которая замещает
 * предыдущую: человек увидел в живой форме «validation/form.ts не компилируется», щёлкнул по
 * этому файлу — и вкладка формы закрылась. Забудь мы состояние здесь, находка исчезла бы
 * ровно в тот миг, когда её пошли чинить. Пока открыт файл модуля, находки формы нужны; закрыли
 * последний — некому.
 *
 * ## Каталог модуля — не обязательно каталог документа
 *
 * Модуль формы раскладывают по папкам: документ — в `schema/`, правила — в `validation/`,
 * поведение — в `behavior/`. Поэтому каталог модуля — каталог документа, а если документ лежит
 * в папке `schema` — её родитель ({@link moduleDirectoryOf}); а «файл модуля» — файл в этом
 * каталоге либо в его подкаталогах не глубже {@link MODULE_DEPTH} уровней. Глубина ограничена
 * намеренно: документ в корне проекта иначе жил бы, пока в проекте открыто хоть что-нибудь.
 *
 * Правило знает только имя папки, а не формат документа: превью общее для стеков, и чей это
 * модуль, ему безразлично.
 *
 * ## Сведение по СНИМКУ, а не по событию «закрыли»
 *
 * У рабочей области событие одно — «что-то изменилось», — и этого достаточно: сведение
 * по снимку не пропускает закрытие, случившееся мимо уведомления, и переживает смену проекта,
 * которая закрывает все вкладки разом. Без проекта открытых документов нет, и забывается всё.
 *
 * @module plugins/forms/preview/state/lifecycle
 */

import type {
  Disposable,
  DocumentsService,
  ResourceId,
  WorkspaceFilesService,
} from '@reformer/builder-plugin-api';
import type { PreviewSessions } from './sessions';

/** Открытые документы в объёме правила: что открыто и когда спрашивать заново. */
export type PreviewLifecycleDocuments = Pick<DocumentsService, 'openDocuments' | 'onDidChange'>;

/**
 * Адресация в объёме правила: чей это каталог и как зовётся каталог.
 *
 * Вторая служба, а не метод первой, и это не дробление: «что открыто» и «где лежит» —
 * вопросы к разным половинам рабочей области (`platform/services/workspace-files`).
 * Обе даёт сама оболочка, поэтому их всегда две и отсутствовать по отдельности они не могут.
 */
export type PreviewLifecycleFiles = Pick<WorkspaceFilesService, 'parentOf' | 'resolve'>;

/** Папка, в которой документ лежит ВНУТРИ модуля формы: модуль тогда — её родитель. */
export const DOCUMENT_FOLDER = 'schema';

/**
 * На сколько уровней каталогов файл модуля может лежать глубже его корня.
 *
 * Три — самый глубокий файл раскладки по папкам: часть документа в `schema/steps/<шаг>/`.
 */
export const MODULE_DEPTH = 3;

/**
 * Каталог модуля формы по её документу: каталог документа, а если он зовётся
 * {@link DOCUMENT_FOLDER} — его родитель.
 *
 * Имя каталога узнаётся у службы: «каталог зовётся `schema`» — это «адрес `schema` внутри его
 * родителя и есть он сам». Разбирать адрес плагину нельзя.
 */
export function moduleDirectoryOf(files: PreviewLifecycleFiles, document: ResourceId): ResourceId {
  const directory = files.parentOf(document);
  const parent = files.parentOf(directory);
  return files.resolve(parent, DOCUMENT_FOLDER) === directory ? parent : directory;
}

/**
 * Каталоги, модулю которых принадлежит открытый документ: его каталог и предки не дальше
 * {@link MODULE_DEPTH} уровней. Подъём останавливается в корне источника — там каталог ресурса
 * равен ему самому.
 */
function owningDirectories(files: PreviewLifecycleFiles, document: ResourceId): ResourceId[] {
  const out: ResourceId[] = [];
  let directory = files.parentOf(document);
  for (let depth = 0; depth <= MODULE_DEPTH; depth += 1) {
    out.push(directory);
    const parent = files.parentOf(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return out;
}

export function attachPreviewLifecycle(
  documents: PreviewLifecycleDocuments,
  files: PreviewLifecycleFiles,
  sessions: Pick<PreviewSessions, 'ids' | 'forget'>
): Disposable {
  const sync = (): void => {
    const openDirs = new Set(
      documents.openDocuments().flatMap((id) => owningDirectories(files, id))
    );
    for (const id of sessions.ids()) {
      if (!openDirs.has(moduleDirectoryOf(files, id))) sessions.forget(id);
    }
  };

  const subscription = documents.onDidChange(sync);
  sync();
  return subscription;
}
