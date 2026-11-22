/**
 * Тексты замечаний страницы — словарь формы: правила несут код, строку по коду даёт словарь.
 * Подключён `ValidationMessagesProvider messages` на корне страницы.
 */
import { defineIssueMessages } from '@reformer/core/i18n';

export const fileUploadDemoMessages = defineIssueMessages({
  // Правила формы
  'demoValidation.required': 'Приложите хотя бы один файл',

  // Коды file-валидаторов и отбора CDK
  maxFiles: 'Максимум {maxFiles} файла(ов)',
  minFiles: 'Минимум {minFiles} файла(ов)',
  fileType: 'Недопустимый тип файла (разрешено: {accept})',
  maxFileSize: 'Файл больше 5 МБ',
  minFileSize: 'Файл пустой',
  maxTotalFileSize: 'Суммарный размер превышен',
  fileExists: 'Файл {fileName} уже добавлен',
  uploadFailed: (params) => `Не удалось загрузить: ${String(params.reason ?? 'ошибка сети')}`,
  uploadAborted: 'Загрузка прервана',
});
