/**
 * Модель шаблона формы: набор файлов + метаданные. Шаблон — ДАННЫЕ (в отличие от «рыб»
 * `app/form-templates.ts`, которые зашиты в код): его можно собрать из файлов открытого проекта,
 * сохранить в `.reformer/templates/` или локально в IndexedDB и генерировать из него новые формы.
 *
 * Имена внутри файлов хранятся плейсхолдерами ({@link ../templates/placeholders}), поэтому один
 * шаблон обслуживает формы с любыми именами.
 *
 * @module reformer-builder/templates/types
 */

/** Откуда шаблон: зашит в билдер / лежит в каталоге проекта / сохранён локально в браузере. */
export type TemplateSource = 'builtin' | 'project' | 'local';

/** Подписи источников для бейджей (единственное число — про один шаблон). */
export const SOURCE_LABEL: Record<TemplateSource, string> = {
  builtin: 'встроенный',
  project: 'проект',
  local: 'локальный',
};

/** Заголовки групп панели шаблонов, в порядке показа. */
export const SOURCE_GROUPS: ReadonlyArray<{ source: TemplateSource; title: string }> = [
  { source: 'builtin', title: 'Встроенные' },
  { source: 'project', title: 'Проект' },
  { source: 'local', title: 'Локальные' },
];

/** Один файл шаблона. */
export interface TemplateFile {
  /** Путь относительно корня шаблона (`model.ts`, `sections/head.ts`); может нести плейсхолдеры. */
  path: string;
  /** Содержимое с плейсхолдерами вместо имени формы. */
  content: string;
}

/** Шаблон формы. */
export interface FormTemplate {
  /** Идентификатор: имя папки (project), ключ в IndexedDB (local), фиксированный slug (builtin). */
  id: string;
  name: string;
  description?: string;
  source: TemplateSource;
  files: TemplateFile[];
  /**
   * Зависимости между файлами: `{ 'index.tsx': ['model.ts', …] }` — отметка файла в диалоге тянет
   * перечисленные. Есть у встроенного шаблона (страница не соберётся без модели и реестра);
   * пользовательские шаблоны обычно без ограничений.
   */
  requires?: Record<string, string[]>;
  /** Человеческие подписи файлов для диалога выбора; без записи показывается сам путь. */
  labels?: Record<string, string>;
  /** ISO-время создания (для сортировки списка); у встроенного отсутствует. */
  createdAt?: string;
}

/** Метаданные шаблона в проекте — файл `template.json` рядом с файлами шаблона. */
export interface TemplateManifest {
  /** Версия формата манифеста. */
  version: string;
  name: string;
  description?: string;
  /** Имя, по которому проставлялись плейсхолдеры (справочно — для правки шаблона руками). */
  baseName?: string;
  createdAt?: string;
  requires?: Record<string, string[]>;
}

/** Имя файла-манифеста в каталоге шаблона (в состав файлов шаблона не входит). */
export const TEMPLATE_MANIFEST = 'template.json';

/** Текущая версия формата манифеста. */
export const TEMPLATE_MANIFEST_VERSION = '1.0';
