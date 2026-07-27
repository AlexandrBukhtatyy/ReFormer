/**
 * Подсветка (monarch-токенизация) НЕ-JSON языков для code-редактора: typescript/css/html/markdown/
 * yaml/… Грузится ЛЕНИВО вместе с {@link CodeEditor} (в чанк редактора, вне стартового бандла —
 * поэтому не раздувает главный чанк, который держит только ядро + JSON, см. `monaco-setup`).
 *
 * Только `basic-languages` (грамматики) — без тяжёлых языковых сервисов (ts/css-воркеры не
 * подключаем): для редактирования файлов достаточно подсветки.
 *
 * @module reformer-builder/canvas/monaco-languages
 */

// Регистрация грамматик на том же инстансе monaco, что настроен в `monaco-setup` (loader.config).
import 'monaco-editor/basic-languages/monaco.contribution';
