/**
 * Слой `templates/` — шаблоны формы как данные: модель, плейсхолдеры имени, сборка шаблона из
 * файлов проекта и подготовка файлов новой формы. Без React и файловой системы (чтение/запись —
 * `io/template-repo`, оркестрация — `app/template-actions`).
 *
 * @module reformer-builder/templates
 */

export * from './types';
export * from './placeholders';
export * from './collect';
export * from './generate';
export * from './builtin';
