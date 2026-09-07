/**
 * Monaco, собранный локально: ни одного обращения в сеть.
 *
 * ## Почему это принципиально
 *
 * `@monaco-editor/react` по умолчанию тянет редактор с CDN (`jsdelivr`) и без сети
 * не поднимается вовсе. Приложение обязано работать офлайн — источником файлов может быть
 * локальный каталог, а редактор кода в нём не роскошь. Поэтому монако импортируется как
 * обычная зависимость, а загрузчику подсовывается УЖЕ загруженный экземпляр
 * ({@link loader.config}); после этого `loader.init()` ничего не скачивает.
 *
 * Приём перенесён из первой версии билдера (история git), `src/canvas/monaco-setup.ts`, вместе
 * с причинами. Что изменилось: в monaco 0.56 вклады разъехались по каталогам —
 * возможности редактора лежат в `features/`, языковые службы в `languages/features/`,
 * подсветка в `languages/definitions/`, и подключаются они по отдельности.
 *
 * ## Что собрано и почему именно это
 *
 * ```text
 * editor/editor.api            ядро редактора и публичный API — без него ничего нет
 * features/register.all        возможности: поиск, сворачивание, подсказки, мультикурсор
 * languages/features/json      ЯЗЫКОВАЯ СЛУЖБА JSON: проверка, автодополнение, форматирование
 * languages/definitions/…      только подсветка: ts, js, markdown, css, html, xml, yaml
 * ```
 *
 * Языковая служба взята **одна** — для JSON, потому что схема формы это JSON и именно там
 * подсказки окупаются. Служба TypeScript не подключена сознательно: она тянет компилятор
 * целиком (несколько мегабайт в отдельном воркере), а проверка типов сайдкаров — работа Э8
 * с собственным пулом воркеров, и делать её сейчас случайным побочным эффектом подключения
 * подсветки нельзя. `.ts` при этом подсвечивается: определение языка и языковая служба
 * в 0.56 — разные вклады, и определение стоит один ленивый чанк.
 *
 * ## Воркеры
 *
 * Через `?worker` Vite: каждый воркер собирается локальным файлом рядом с бандлом.
 * `MonacoEnvironment.getWorker` — тот самый крючок, который зовёт standalone-сервис
 * воркеров (`standaloneWebWorkerService`); без него Monaco пытается собрать URL сам
 * и падает с «Failed to load worker script».
 *
 * @module plugins/editor-monaco/runtime/monaco-runtime
 */

import * as monaco from 'monaco-editor/editor/editor.api';
import { loader } from '@monaco-editor/react';

// Возможности редактора: поиск, сворачивание, подсказки, контекстное меню, мультикурсор.
// Без этого набора остаётся голое поле ввода с подсветкой — и Ctrl+F в нём не работает.
import 'monaco-editor/features/register.all';

// Языковая служба JSON: она же регистрирует сам язык `json`.
import { jsonDefaults } from 'monaco-editor/languages/features/json/register';

// Подсветка без языковых служб: определение языка + ленивый чанк с токенизатором.
import 'monaco-editor/languages/definitions/typescript/register';
import 'monaco-editor/languages/definitions/javascript/register';
import 'monaco-editor/languages/definitions/markdown/register';
import 'monaco-editor/languages/definitions/css/register';
import 'monaco-editor/languages/definitions/html/register';
import 'monaco-editor/languages/definitions/xml/register';
import 'monaco-editor/languages/definitions/yaml/register';

import editorWorker from 'monaco-editor/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/languages/features/json/json.worker?worker';

/** Окружение Monaco: единственная точка, где решается, откуда берутся воркеры. */
interface MonacoEnvironment {
  getWorker(moduleId: string, label: string): Worker;
}

(globalThis as unknown as { MonacoEnvironment: MonacoEnvironment }).MonacoEnvironment = {
  getWorker(_moduleId: string, label: string): Worker {
    // Метка воркера — идентификатор языка (`json`) либо служебная метка ядра. Ядро
    // отвечает за всё остальное: разбор ссылок, сравнение, подсветку скобок.
    return label === 'json' ? new jsonWorker() : new editorWorker();
  },
};

/**
 * Диагностика JSON у Monaco выключена, а всё остальное от языковой службы — оставлено.
 *
 * Свод проблем ресурса у платформы ОДИН: валидаторы публикуют в службу диагностик, оттуда
 * их берут и разметка редактора, и пометка на файле в дереве, и панель проблем. Маркеры,
 * которые Monaco поставил бы сам, в этот свод не попадают вовсе — они были бы вторым,
 * невидимым платформе каналом, и на ошибке разбора JSON человек получил бы ДВА
 * подчёркивания одного и того же места.
 *
 * `enableSchemaRequest: false` — это про офлайн, а не про удобство: `"$schema": "https://…"`
 * в файле схемы формы иначе заставил бы редактор сходить в сеть, и запрет CDN обошёлся бы
 * через чёрный ход. Подсказки, форматирование, сворачивание и переход по символам при этом
 * работают: их даёт `modeConfiguration`, которого этот вызов не касается.
 */
jsonDefaults.setDiagnosticsOptions({
  validate: false,
  allowComments: false,
  enableSchemaRequest: false,
  schemas: [],
});

// С этого момента `loader.init()` отдаёт НАШ экземпляр и в сеть не ходит.
loader.config({ monaco });

/** Тип пространства имён Monaco: компонентам он нужен для маркеров и координат. */
export type MonacoApi = typeof monaco;

export { monaco };
