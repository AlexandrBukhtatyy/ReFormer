/**
 * Словарь плагина файлов.
 *
 * **Почему он здесь, а не в `host/services/i18n/locales`.** Заголовок панели разрешается
 * в пространстве имён ВНЁСШЕГО плагина (`panelTitle` в `host/ui/panels`), а не словарём Host:
 * `panel.title` двух разных плагинов — два разных сообщения. Словарь Host для панели
 * невыразим, поэтому свои строки плагин везёт сам.
 *
 * Заголовки КОМАНД лежат здесь же, и это исправление, а не исходное устройство. Пока они
 * жили в словаре Host, на их месте показывался маркер промаха: и палитра, и меню разрешают
 * `titleKey` словарём ВЛАДЕЛЬЦА команды, а владелец здесь — плагин. Обнаружено запуском,
 * когда команды файлов появились в меню «Файл» строками `⟦files.files.command.save⟧`.
 *
 * Ключи при переносе НЕ переименованы (`files.command.save`, а не `command.save`):
 * пространство имён `PluginI18n` добавляет и при регистрации словаря, и при чтении, поэтому
 * менять имя было незачем — а не переименовав, перенос не потребовал трогать ни одного
 * `titleKey` в коде.
 *
 * Регистрирует словарь композиция: `PluginContext` сервиса локализации не содержит, и это
 * не упущение — вклад в словарь не снимается вместе с плагином, а значит и не может быть
 * частью его подписок.
 *
 * @module plugins/files/messages
 */

/** Локаль → ключ (без пространства имён) → сообщение. */
export const FILES_MESSAGES: Readonly<Record<string, Readonly<Record<string, string>>>> =
  Object.freeze({
    ru: Object.freeze({
      'files.command.copy': 'Копировать',
      'files.command.copyPath': 'Копировать путь',
      'files.command.cut': 'Вырезать',
      'files.command.delete': 'Удалить',
      'files.command.newFile': 'Новый файл…',
      'files.command.newFolder': 'Новая папка…',
      'files.command.openProject': 'Открыть папку…',
      'files.command.openToSide': 'Открыть рядом',
      'files.command.paste': 'Вставить',
      'files.command.refresh': 'Обновить',
      'files.command.rename': 'Переименовать…',
      'files.command.save': 'Сохранить',
      'files.command.saveAll': 'Сохранить всё',
      'panel.title': 'Проект',
      'editor.label': 'Содержимое файла',
      'editor.readonly': 'Файл открыт только для чтения: источник не принимает запись.',
      'problems.title': 'Проблемы',
      'problems.empty.title': 'Проблем нет',
      'problems.empty.description': 'Валидаторы ничего не нашли в открытых документах.',
      'problems.origin': '{source} · {code}',
      'tree.problems.error':
        '{count, plural, one{# ошибка} few{# ошибки} many{# ошибок} other{# ошибки}}',
      'tree.problems.warning':
        '{count, plural, one{# предупреждение} few{# предупреждения} many{# предупреждений} other{# предупреждения}}',
      'ops.name.label': 'Имя',
      'ops.newFile.title': 'Новый файл',
      'ops.newFolder.title': 'Новая папка',
      'ops.rename.title': 'Переименовать',
      'ops.delete.title': 'Удалить безвозвратно?',
      'ops.delete.message':
        '{count, plural, one{«{name}» будет удалён из проекта} few{# записи будут удалены из проекта} many{# записей будут удалены из проекта} other{# записи будут удалены из проекта}}. Отменить это нельзя.',
      'ops.delete.confirm': 'Удалить',
      'ops.name.empty': 'Имя не может быть пустым',
      'ops.name.separator': 'Косая черта создаёт вложенность — в имени её быть не может',
      'ops.name.dots': '«.» и «..» — переход по дереву, а не имя',
      'ops.name.forbidden-character':
        'Такие символы файловая система не примет: \\ / : * ? " < > |',
      'ops.name.reserved': 'Это имя устройства: Windows не даст его занять',
      'ops.name.trailing': 'Точка или пробел в конце пропадут при сохранении',
      'ops.name.too-long': 'Слишком длинное имя',
      'tree.problems.info':
        '{count, plural, one{# замечание} few{# замечания} many{# замечаний} other{# замечания}}',
    }),
    en: Object.freeze({
      'files.command.copy': 'Copy',
      'files.command.copyPath': 'Copy path',
      'files.command.cut': 'Cut',
      'files.command.delete': 'Delete',
      'files.command.newFile': 'New file…',
      'files.command.newFolder': 'New folder…',
      'files.command.openProject': 'Open folder…',
      'files.command.openToSide': 'Open to the side',
      'files.command.paste': 'Paste',
      'files.command.refresh': 'Refresh',
      'files.command.rename': 'Rename…',
      'files.command.save': 'Save',
      'files.command.saveAll': 'Save all',
      'panel.title': 'Project',
      'editor.label': 'File contents',
      'editor.readonly': 'The file is read-only: the source does not accept writes.',
      'problems.title': 'Problems',
      'problems.empty.title': 'No problems',
      'problems.empty.description': 'Validators found nothing in the open documents.',
      'problems.origin': '{source} · {code}',
      'tree.problems.error': '{count, plural, one{# error} other{# errors}}',
      'tree.problems.warning': '{count, plural, one{# warning} other{# warnings}}',
      'tree.problems.info': '{count, plural, one{# note} other{# notes}}',
      'ops.name.label': 'Name',
      'ops.newFile.title': 'New file',
      'ops.newFolder.title': 'New folder',
      'ops.rename.title': 'Rename',
      'ops.delete.title': 'Delete permanently?',
      'ops.delete.message':
        '{count, plural, one{«{name}» will be removed from the project} other{# entries will be removed from the project}}. This cannot be undone.',
      'ops.delete.confirm': 'Delete',
      'ops.name.empty': 'The name cannot be empty',
      'ops.name.separator': 'A slash creates nesting — it cannot be part of a name',
      'ops.name.dots': '«.» and «..» navigate the tree, they are not names',
      'ops.name.forbidden-character':
        'The file system will not accept these characters: \\ / : * ? " < > |',
      'ops.name.reserved': 'This is a device name: Windows will not allow it',
      'ops.name.trailing': 'A trailing dot or space is dropped when saving',
      'ops.name.too-long': 'The name is too long',
    }),
  });
