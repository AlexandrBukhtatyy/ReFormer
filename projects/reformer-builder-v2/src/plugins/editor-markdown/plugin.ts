/**
 * Плагин предпросмотра markdown: редактор, три режима показа и кнопки в строке вкладок.
 *
 * **Почему это плагин, а не часть Host.** Оболочка не знает ни одного формата: «этот файл —
 * markdown, и его показывают рендером» — предметное знание. Здесь оно и живёт, а платформа
 * даёт ровно две вещи: точку расширения редакторов и поверхность действий над документом.
 *
 * **Почему режимы — команды, а не внутреннее состояние кнопок.** Кнопка в строке вкладок это
 * пункт меню, то есть ссылка на команду; команда же доступна из палитры и с клавиши. Поэтому
 * «показать предпросмотр» одинаково работает мышью, сочетанием `mod+shift+v` и из палитры,
 * а состояние вида живёт в плагине (`./sessions`), где его видят обе стороны.
 *
 * **Чего здесь нет.** Связанной прокрутки двух половин: она требует от редактора кода знания
 * «какая строка сейчас видна», а порт Monaco такого не отдаёт. Это отдельная работа, и делать
 * её половинчато — значит получить прокрутку, которая иногда уезжает не туда.
 *
 * @module plugins/editor-markdown/plugin
 */

import { createElement, type ReactElement } from 'react';
import { Code2, Columns2, Eye } from 'lucide-react';
import {
  argsOfEditor,
  argsOfResource,
  definePlugin,
  EDITOR_TITLE_MENU,
  EditorPoint,
  MenuPoint,
  RESOURCE_CONTEXT_MENU,
  SettingsServiceToken,
  whenEditor,
  whenResource,
  type CommandContribution,
  type EditorContribution,
  type MenuContribution,
  type Plugin,
  type ResourceId,
} from '@/sdk';
import type { MarkdownHost } from './host';
import { isMarkdown } from './render/markdown';
import { MARKDOWN_MESSAGES } from './messages';
import { createMarkdownViewStore, type MarkdownViewStore } from './state/sessions';
import { MarkdownEditor } from './ui/MarkdownEditor';
import { availableViews, cycleView, MARKDOWN_VIEW_SETTING, type MarkdownView } from './state/view';

// Реэкспорт, а не объявление: идентификатор живёт в contract.ts, чтобы композиция могла
// взять его, не втягивая плагин в стартовый граф.
import { MARKDOWN_PLUGIN_ID } from './contract';
export { MARKDOWN_PLUGIN_ID };

/** Редактор markdown. */
export const MARKDOWN_EDITOR_ID = 'markdown.editor';

export const SHOW_CODE_COMMAND_ID = 'markdown.showCode';
export const SHOW_PREVIEW_COMMAND_ID = 'markdown.showPreview';
export const SHOW_SPLIT_COMMAND_ID = 'markdown.showSplit';
export const TOGGLE_VIEW_COMMAND_ID = 'markdown.toggleView';
export const CYCLE_VIEW_COMMAND_ID = 'markdown.cycleView';
export const OPEN_PREVIEW_COMMAND_ID = 'markdown.openPreview';

/**
 * Приоритет редактора.
 *
 * Выше Monaco (у того 10) и текстового запасного (единица), ниже редактора схемы формы (100):
 * предметный редактор важнее общего, и правило это должно читаться из чисел без оговорок.
 *
 * Число было равно приоритету Monaco, и это стоило редактору всей его работы. При равенстве
 * побеждает тот, кто раньше в реестре (см. `host/ui/editors`.`rankEditors`), Monaco
 * регистрируется раньше — и `.md` открывался кодом ВСЕГДА. Со стороны это выглядело как
 * «кнопки предпросмотра не работают»: кнопки рисовались по имени файла, команда честно меняла
 * режим, а на экране оставался Monaco, который про эти режимы не знает.
 *
 * Текст при этом никуда не делся: он остаётся режимом `code` внутри этого же редактора
 * и тем же самым Monaco — портом `MarkdownHost.TextEditor`.
 */
export const MARKDOWN_EDITOR_PRIORITY = 50;

/** Значки режимов. Обёртки ради размера: контракт объявляет значок компонентом без пропсов. */
const CodeIcon = (): ReactElement => createElement(Code2, { className: 'size-4' });
const PreviewIcon = (): ReactElement => createElement(Eye, { className: 'size-4' });
const SplitIcon = (): ReactElement => createElement(Columns2, { className: 'size-4' });

/** Аргументы команд вида: адрес документа. Без него команда берёт активный. */
export function documentIdOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const value = (args as { documentId?: unknown }).documentId;
  return typeof value === 'string' ? value : null;
}

/** Первый адрес из аргументов пункта дерева. */
export function firstResourceOf(args: unknown): ResourceId | null {
  if (typeof args !== 'object' || args === null) return null;
  const ids = (args as { ids?: unknown }).ids;
  if (!Array.isArray(ids)) return null;
  const first = ids[0];
  return typeof first === 'string' ? first : null;
}

/** Вклад редактора: за markdown берётся по медиатипу и по имени. */
export function markdownEditor(host: MarkdownHost, views: MarkdownViewStore): EditorContribution {
  return {
    id: MARKDOWN_EDITOR_ID,
    titleKey: 'editor.label',
    canOpen(ref) {
      // Решение по ссылке, без чтения: «markdown ли это» отвечает имя файла, а разбор
      // содержимого ради этого превратил бы открытие каталога в чтение каждого файла.
      return isMarkdown(ref.name, ref.mediaType) ? MARKDOWN_EDITOR_PRIORITY : false;
    },
    Body: ({ documentId }: { documentId: ResourceId }) =>
      createElement(MarkdownEditor, { host, views, documentId }),
  };
}

export interface MarkdownCommandDeps {
  readonly host: MarkdownHost;
  readonly views: MarkdownViewStore;
}

/** Команды плагина: три вида, цикл по кругу и открытие предпросмотром из дерева. */
export function markdownCommands(deps: MarkdownCommandDeps): readonly CommandContribution[] {
  const { host, views } = deps;

  /** К какому документу относится команда: названный аргументом либо активный. */
  const target = (args: unknown): ResourceId | null =>
    documentIdOf(args) ?? host.activeDocument?.() ?? null;

  /** Markdown ли открытый документ: команды вида не должны трогать чужие вкладки. */
  const isMarkdownDocument = (id: ResourceId | null): boolean => {
    if (id === null) return false;
    const document = host.documentOf(id);
    return document !== null && isMarkdown(document.ref.name, document.ref.mediaType);
  };

  const show = (view: MarkdownView) => (args: unknown) => {
    const id = target(args);
    if (id === null) return false;
    views.set(id, view);
    return true;
  };

  return [
    {
      id: SHOW_CODE_COMMAND_ID,
      titleKey: 'command.showCode',
      enabled: () => isMarkdownDocument(host.activeDocument?.() ?? null),
      run: show('code'),
    },
    {
      id: SHOW_PREVIEW_COMMAND_ID,
      titleKey: 'command.showPreview',
      enabled: () => isMarkdownDocument(host.activeDocument?.() ?? null),
      run: show('preview'),
    },
    {
      id: SHOW_SPLIT_COMMAND_ID,
      titleKey: 'command.showSplit',
      // Без редактора кода режим «рядом» неотличим от предпросмотра, и команда честно
      // объявляет себя недоступной, а не показывает половину экрана пустой.
      enabled: () =>
        host.TextEditor !== undefined && isMarkdownDocument(host.activeDocument?.() ?? null),
      run: show('split'),
    },
    {
      id: TOGGLE_VIEW_COMMAND_ID,
      titleKey: 'command.toggleView',
      enabled: () => isMarkdownDocument(host.activeDocument?.() ?? null),
      run: (args) => {
        const id = target(args);
        if (id === null) return false;
        // Из кода — в предпросмотр, из чего угодно ещё — обратно в код. Именно поэтому
        // это тумблер, а не круг: «рядом» тоже показывает рендер, и возврат к тексту
        // из него означает ровно то же самое.
        views.set(id, views.get(id) === 'code' ? 'preview' : 'code');
        return true;
      },
    },
    {
      id: CYCLE_VIEW_COMMAND_ID,
      titleKey: 'command.cycleView',
      // То же сочетание, что в v1: рука его помнит, а конфликтовать ему не с чем —
      // на не-markdown вкладке команда недоступна.
      keybinding: 'mod+shift+v',
      allowInEditable: true,
      enabled: () => isMarkdownDocument(host.activeDocument?.() ?? null),
      run: (args) => {
        const id = target(args);
        if (id === null) return false;
        const available = availableViews(host.TextEditor !== undefined);
        let next = cycleView(views.get(id));
        // Круг идёт по ДОСТУПНЫМ видам: без редактора кода «рядом» пропускается, иначе
        // одно нажатие из трёх не меняло бы ничего.
        while (!available.includes(next)) next = cycleView(next);
        views.set(id, next);
        return true;
      },
    },
    {
      id: OPEN_PREVIEW_COMMAND_ID,
      titleKey: 'command.openPreview',
      enabled: () => host.openResource !== undefined,
      run: (args) => {
        const id = firstResourceOf(args) ?? documentIdOf(args);
        if (id === null || host.openResource === undefined) return false;
        // Режим задаётся ДО открытия: иначе вкладка успела бы отрисоваться исходником
        // и мигнула бы, переключившись следующим кадром.
        views.set(id, 'preview', false);
        host.openResource(id);
        return true;
      },
    },
  ];
}

/**
 * Кнопки в строке вкладок и пункт контекстного меню дерева.
 *
 * Кнопки видны только на markdown-документе — это `when` по цели, а не по активной вкладке:
 * ряд действий спрашивают про конкретный документ, и решать за него по чему-то другому
 * значило бы показывать кнопки «предпросмотр» над схемой формы.
 *
 * ## Мало быть markdown — надо ещё рисоваться ЭТИМ редактором
 *
 * Имя файла отвечает на вопрос «бывает ли у него предпросмотр», а не «покажет ли его
 * кто-нибудь сейчас». Тот же `.md` можно открыть текстовым редактором («открыть другим
 * редактором»), и тогда режимы переключались бы вхолостую: команда меняет состояние, значок
 * кнопки послушно меняется, а на экране остаётся Monaco, который про эти режимы не знает.
 * Со стороны это выглядит как «кнопка не работает» — худший вид поломки, потому что
 * неотличим от испорченного рендера.
 *
 * Поэтому кнопки спрашивают про редактор цели: они принадлежат ему, а не расширению файла.
 * Ушёл с него — кнопок нет, и способ вернуться остаётся ровно один и честный: сменить
 * редактор обратно.
 */
export function markdownMenuItems(
  views: MarkdownViewStore,
  hasTextEditor: () => boolean
): readonly { readonly id: string; readonly value: MenuContribution }[] {
  const onMarkdown = whenEditor(
    (target) =>
      target.editorId === MARKDOWN_EDITOR_ID && isMarkdown(target.ref.name, target.ref.mediaType)
  );
  const args = argsOfEditor((target) => ({ documentId: target.documentId }));
  /** Режим документа, над которым открыт ряд; `null` — цель не документ. */
  const viewOf = (target: unknown): MarkdownView | null => {
    const documentId = (target as { documentId?: unknown } | null)?.documentId;
    return typeof documentId === 'string' ? views.get(documentId) : null;
  };

  return [
    {
      // Тумблер нарисован ДВУМЯ вкладами, а не одним со сменным значком, и это не обходной
      // путь: у пункта меню значок статичен по контракту, а предикат — нет. Два пункта
      // с взаимоисключающими условиями дают ровно одну кнопку на экране, чей значок и
      // подсказка меняются вместе с режимом — то есть то самое поведение, но без поля,
      // которое пришлось бы вычислять на каждую отрисовку каждому вкладу.
      id: 'markdown.title.toPreview',
      value: {
        kind: 'item',
        menu: EDITOR_TITLE_MENU,
        command: TOGGLE_VIEW_COMMAND_ID,
        group: '1_view',
        // Своя подпись у каждой половины: у команды она одна на оба направления
        // («переключить»), а подсказка кнопки обязана говорить, ЧТО будет после нажатия.
        titleKey: 'command.showPreview',
        icon: PreviewIcon,
        when: (ctx, target) => onMarkdown(ctx, target) && viewOf(target) === 'code',
        argsOf: args,
        onDidChange: (cb) => views.subscribe(cb),
      },
    },
    {
      id: 'markdown.title.toCode',
      value: {
        kind: 'item',
        menu: EDITOR_TITLE_MENU,
        command: TOGGLE_VIEW_COMMAND_ID,
        group: '1_view',
        titleKey: 'command.showCode',
        icon: CodeIcon,
        when: (ctx, target) => onMarkdown(ctx, target) && viewOf(target) !== 'code',
        argsOf: args,
        onDidChange: (cb) => views.subscribe(cb),
      },
    },
    {
      id: 'markdown.title.split',
      value: {
        kind: 'item',
        menu: EDITOR_TITLE_MENU,
        command: SHOW_SPLIT_COMMAND_ID,
        group: '1_view',
        order: 10,
        icon: SplitIcon,
        // Кнопки «рядом» нет вовсе, когда рядом показывать нечем: гасить её значило бы
        // оставить в полосе значок, который никогда не сработает.
        when: (ctx, target) => hasTextEditor() && onMarkdown(ctx, target),
        toggled: (_ctx, target) => viewOf(target) === 'split',
        argsOf: args,
        onDidChange: (cb) => views.subscribe(cb),
      },
    },
    {
      id: 'markdown.context.openPreview',
      value: {
        kind: 'item',
        menu: RESOURCE_CONTEXT_MENU,
        command: OPEN_PREVIEW_COMMAND_ID,
        group: '1_open',
        when: whenResource(
          (target) => target.ref !== null && isMarkdown(target.ref.name, target.ref.mediaType)
        ),
        argsOf: argsOfResource((target) => ({ ids: target.ref === null ? [] : [target.ref.id] })),
      },
    },
  ];
}

export interface MarkdownPluginOptions {
  readonly host: MarkdownHost;
  /** Приёмник словаря. Без него строки показываются маркерами промаха. */
  readonly i18n?: { contribute(locale: string, messages: Readonly<Record<string, string>>): void };
}

export function createMarkdownPlugin(options: MarkdownPluginOptions): Plugin {
  const { host } = options;

  return definePlugin({
    id: MARKDOWN_PLUGIN_ID,
    activate(ctx) {
      for (const [locale, messages] of Object.entries(MARKDOWN_MESSAGES)) {
        options.i18n?.contribute(locale, messages);
      }

      // Настройки — из реестра служб: предпочтение вида принадлежит человеку, а не проекту,
      // и хранит его платформа. Без службы режимы работают, но не переживают перезагрузку.
      const settings = ctx.services.get(SettingsServiceToken) ?? null;
      const hasTextEditor = (): boolean => host.TextEditor !== undefined;
      const views = createMarkdownViewStore({
        settings,
        settingKey: MARKDOWN_VIEW_SETTING,
        hasTextEditor,
      });
      ctx.subscriptions.push({
        dispose: () => {
          views.dispose();
        },
      });

      for (const command of markdownCommands({ host, views })) {
        ctx.subscriptions.push(ctx.commands.register(command));
      }

      ctx.subscriptions.push(
        ctx.extensions.contribute(EditorPoint, markdownEditor(host, views), {
          id: MARKDOWN_EDITOR_ID,
        })
      );

      for (const item of markdownMenuItems(views, hasTextEditor)) {
        ctx.subscriptions.push(ctx.extensions.contribute(MenuPoint, item.value, { id: item.id }));
      }
    },
  });
}
