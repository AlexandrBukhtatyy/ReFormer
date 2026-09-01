/**
 * Единственное место со списком встроенных плагинов.
 *
 * Список собирается ФУНКЦИЕЙ, а не лежит константой: плагин файлов получает порт платформы,
 * а валидатор — каталог активного кита, и оба зависят от того, что создано в `boot`. Константа
 * заставила бы плагины дотягиваться до композиции самим — то есть ровно наоборот тому, ради
 * чего композиция существует.
 *
 * Порядок в массиве на поведение не влияет — рантайм плагинов не строит графа зависимостей
 * (см. `host/plugin/registry`) и проверяет это тестом «порядок активации ничего не значит».
 * Держать его читаемым стоит только ради вывода диагностики.
 *
 * @module shell/boot/plugins
 */

import type { CatalogEntry } from '@/lib/catalog/types';
import type { Plugin } from '@/shell/platform/plugin/types';
import { EditorPoint } from '@/shell/platform/ui/contributions/editors';
import { PanelPoint } from '@/shell/platform/ui/slots';
import type { FilesHost } from '@/plugins/files/host';
import { createFilesPlugin } from '@/plugins/files/plugin';
import type { ViewStateRegistry } from '@/plugins/editor-monaco';
import {
  createMonacoEditorPlugin,
  type MonacoFocusRegistry,
  type MonacoHost,
} from '@/plugins/editor-monaco';
import { createMarkdownPlugin } from '@/plugins/editor-markdown';
import type { MarkdownHost } from '@/plugins/editor-markdown';
import { createSchemaEditorPlugin } from '@/plugins/editor-schema';
import type { SchemaEditorHost } from '@/plugins/editor-schema';
import { createKitsPlugin } from '@/plugins/kits/plugin';
import type { KitsPluginOptions } from '@/plugins/kits/plugin';
import { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';
import { createAiPlugin } from '@/plugins/ai';
import type { AiHost } from '@/plugins/ai';
import { createPreviewPlugin } from '@/plugins/preview';
import type { PreviewHost } from '@/plugins/preview';
import { createCodegenPlugin } from '@/plugins/codegen';
import type { CodegenHost } from '@/plugins/codegen';
import { createTemplatesPlugin } from '@/plugins/templates';
import type { ModulePrinter, TemplatesHost } from '@/plugins/templates';
import { createSchemaValidatorPlugin } from '@/plugins/validator-schema/plugin';

export interface BuiltinPluginsOptions {
  /** Порт платформы для плагина файлов. */
  readonly files: FilesHost;
  /** Порт платформы для редактора Monaco. */
  readonly monaco: MonacoHost;
  /**
   * Общий реестр фокуса Monaco.
   *
   * **Обязан быть тем же объектом**, что уходит в `createModelDocument({ isTextEditorFocused })`.
   * Это условие правильности, а не удобство подключения: перерисовка буфера по модели
   * откладывается, пока человек печатает, и «печатает ли он» знает только редактор. Два реестра
   * означали бы, что ход ассистента затирает набранное на полуслове.
   */
  readonly monacoFocus: MonacoFocusRegistry;
  /**
   * Реестр снимков вида Monaco.
   *
   * Приходит от композиции, потому что его делят двое: сам редактор и предпросмотр
   * markdown, одалживающий тело редактора для режима «рядом». Два реестра означали бы
   * потерянную позицию курсора при каждом переключении режима.
   */
  readonly monacoViewStates?: ViewStateRegistry;
  /** Словарь плагина Monaco: в `PluginContext` своего i18n пока нет. */
  readonly monacoI18n: Parameters<typeof createMonacoEditorPlugin>[0]['i18n'];
  /**
   * Порт предпросмотра markdown.
   *
   * Отдельный плагин, а не режим редактора Monaco: «этот файл показывают рендером» —
   * предметное знание о формате, и держать его внутри редактора кода значило бы, что
   * выключение markdown требует правки чужого плагина.
   */
  readonly markdown: MarkdownHost;
  /** Словарь плагина markdown. */
  readonly markdownI18n: Parameters<typeof createMarkdownPlugin>[0]['i18n'];
  /** Порт платформы для визуального редактора схемы. */
  readonly schema: SchemaEditorHost;
  /** Словарь редактора схемы. */
  readonly schemaI18n: Parameters<typeof createSchemaEditorPlugin>[0]['i18n'];
  /**
   * Настройки и перевод плагина китов.
   *
   * Киты вносятся плагином, а не композицией, потому что «какой кит активен» — это
   * состояние, которое читают трое: валидатор (с чем сверять), палитра (что предлагать)
   * и инспектор (какие свойства у компонента). Сервис — единственный способ отдать одно
   * состояние троим, не заводя его копию у каждого.
   */
  readonly kits: Pick<KitsPluginOptions, 'translate' | 'settings' | 'sources'>;
  /** Порт платформы для ассистента. */
  readonly ai: AiHost;
  /** Словарь ассистента. */
  readonly aiI18n: Parameters<typeof createAiPlugin>[0]['i18n'];
  /** Порт платформы для превью. */
  readonly preview: PreviewHost;
  /** Словарь превью. */
  readonly previewI18n: Parameters<typeof createPreviewPlugin>[0]['i18n'];
  /**
   * Реестр состояний превью.
   *
   * Создаётся композицией, а не плагином, потому что показывающих поверхности стало двое:
   * панель превью и живой вид редактора схемы. Общий реестр — то, из-за чего выбор поверхности,
   * находки сборки и введённые значения у них ОДНИ, а не две похожие копии. Тот же приём и та же
   * причина, что у реестров Monaco, делимых на троих.
   */
  readonly previewSessions?: Parameters<typeof createPreviewPlugin>[0]['sessions'];
  /** Порт платформы для генерации кода. */
  readonly codegen: CodegenHost;
  readonly codegenI18n: Parameters<typeof createCodegenPlugin>[0]['i18n'];
  /** Порт платформы для шаблонов форм. */
  readonly templates: TemplatesHost;
  readonly templatesI18n: Parameters<typeof createTemplatesPlugin>[0]['i18n'];
  /**
   * Печатник встроенных шаблонов.
   *
   * Шаблоны печатает САМ генератор — тот же, что экспортирует форму. Иначе встроенный
   * шаблон и результат экспорта разошлись бы: в v1 они и разошлись, потому что шаблоны
   * были ~900 строк готового текста, который никто не пересобирал при правке эмиттеров.
   * Переходник живёт здесь, потому что плагины не видят друг друга.
   */
  readonly printTemplate: ModulePrinter;
  /**
   * Каталог активного кита.
   *
   * Функция, а не список: кит переключают, и валидатор обязан сравнивать с тем каталогом,
   * который действует СЕЙЧАС. Композиция читает его из сервиса китов `services.get(KitsServiceToken)`,
   * то есть ЛЕНИВО: сервис появляется при активации плагина китов, а список плагинов
   * собирается до неё. Захвати мы каталог здесь значением — получили бы снимок пустого.
   */
  readonly catalog?: () => readonly CatalogEntry[];
}

/** Пустой каталог: одна замороженная ссылка вместо нового массива на каждый вызов. */
const NO_CATALOG: readonly CatalogEntry[] = Object.freeze([]);

/** Встроенные плагины: активируются на старте, выключить их из интерфейса нельзя. */
export function createBuiltinPlugins(options: BuiltinPluginsOptions): readonly Plugin[] {
  const catalog = options.catalog ?? ((): readonly CatalogEntry[] => NO_CATALOG);
  return Object.freeze([
    // Точки расширения подставляются ЗДЕСЬ: плагин объявил их структурно (`plugins/files/host`),
    // потому что `@/sdk` панелей и редакторов не отдаёт, а импортировать `@/shell` ему нельзя.
    createFilesPlugin({ host: options.files, panelPoint: PanelPoint, editorPoint: EditorPoint }),
    createSchemaValidatorPlugin({ catalog }),
    // Приоритет 10 против 1 у временного `textarea` в плагине файлов: Monaco его
    // вытесняет, но уступает структурному редактору схемы (100). Сам `TextEditor.tsx`
    // при этом остаётся запасным путём — на случай, когда движок не загрузился.
    createMonacoEditorPlugin({
      host: options.monaco,
      focus: options.monacoFocus,
      viewStates: options.monacoViewStates,
      i18n: options.monacoI18n,
    }),
    // Приоритет 50: markdown забирает свои файлы у Monaco (10), потому что рендер — это то,
    // зачем .md открывают чаще всего. Порядок в этом списке на исход не влияет и влиять
    // не должен: при РАВНОМ приоритете победил бы зарегистрированный раньше, то есть Monaco,
    // и предметный редактор не получил бы ни одного файла.
    createMarkdownPlugin({
      host: options.markdown,
      i18n: options.markdownI18n,
    }),
    // Приоритет 100: структурный редактор забирает файл формы у Monaco, а Monaco остаётся
    // для всего остального текста. Оба отвечают `canOpen` по содержимому пробы, а не по
    // расширению, — потому и уживаются на одном `.json` без ветвления по имени файла.
    createSchemaEditorPlugin({
      host: options.schema,
      modelPoint: DocumentModelPoint,
      i18n: options.schemaI18n,
    }),
    createKitsPlugin(options.kits),
    // Панель встаёт в правый слот без предиката: настройки провайдера и ключ должны быть
    // доступны и до того, как открыта форма, — иначе первый же запуск требует сначала
    // найти файл, а потом обнаружить, что ключа нет.
    createAiPlugin({ host: options.ai, i18n: options.aiI18n }),
    // Точку поверхностей плагин объявляет структурно — `@/sdk` её пока не отдаёт, как и
    // `defineExtensionPoint`, которым чужой плагин мог бы объявить свою. Пока поверхности
    // вносит только сам преьвю, это ничего не стоит; появится вторая — точку надо вынести.
    createPreviewPlugin({
      host: options.preview,
      i18n: options.previewI18n,
      sessions: options.previewSessions,
    }),
    createCodegenPlugin({ host: options.codegen, i18n: options.codegenI18n }),
    createTemplatesPlugin({
      host: options.templates,
      i18n: options.templatesI18n,
      print: options.printTemplate,
    }),
  ]);
}
