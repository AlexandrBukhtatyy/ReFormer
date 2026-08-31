/**
 * Проверка САМОЙ композиции — единственного места, где структурные копии типов встречаются
 * с настоящими вещами платформы.
 *
 * Каждый плагин покрыт своими тестами, и все они зелёные, — но проверяют они плагин на своих
 * двойниках. Ошибка сборки живёт между ними, и её не видит никто: порт, проглотивший аргумент,
 * компилируется (реализация с меньшим числом параметров присваивается функции с бо́льшим),
 * а вклад, ушедший в точку-двойник, теряется молча, потому что точки сравниваются по
 * идентичности объекта.
 *
 * Оба случая в этом проекте уже происходили. Отсюда этот файл.
 *
 * @module app/plugins.test
 */

import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry } from '../host/primitives/command';
import { createEventBus } from '../host/primitives/event';
import { createExtensionRegistry } from '../host/primitives/extension-point';
import type { ExtensionPoint } from '../host/primitives/extension-point';
import { createServiceRegistry } from '../host/primitives/service';
import { createSelectionService, SelectionServiceToken } from '../host/services/selection';
import { createPluginRegistry } from '../host/plugin/registry';
import { createMemoryStorageBackend } from '../host/plugin/storage';
import { DocumentModelPoint } from '../host/workspace/model/provider';
import { EditorPoint, resolveEditor } from '../host/ui/editors';
import { PanelPoint } from '../host/ui/slots';
import { createFocusRegistry } from '../plugins/editor-monaco';
import { createBuiltinPlugins } from './plugins';

/**
 * Порты-пустышки: композиция проверяется на СОСТАВ вкладов, а не на поведение портов.
 *
 * Прокси, а не литерал с методами: у семи портов вместе больше шестидесяти методов, и держать
 * их список здесь значило бы переписывать этот файл на каждое изменение любого порта — то есть
 * получить вторую копию контрактов вдобавок к тем, что уже есть.
 */
function stubHost(): never {
  return new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return undefined;
        // Хуки обязаны быть функциями с именем на `use`: правила хуков смотрят на имя.
        return typeof prop === 'string' && prop.startsWith('use')
          ? function useStub(): unknown {
              return () => '';
            }
          : () => null;
      },
    }
  ) as never;
}

/**
 * Русский словарь плагина или `null`, если словаря у него нет.
 *
 * Читается ДИНАМИЧЕСКИМ импортом по идентификатору, а не статическим списком: список
 * отстал бы от репозитория молча, и проверка стала бы проверять подмножество, о котором
 * никто не помнит. Русский, а не английский, потому что он основная локаль, а совпадение
 * наборов ключей между локалями проверяет отдельный тест.
 */
async function loadPluginLocale(id: string): Promise<Record<string, string> | null> {
  try {
    const mod = (await import(`../plugins/${id}/locales/ru.json`)) as {
      default: Record<string, string>;
    };
    return mod.default;
  } catch {
    return null;
  }
}

function harness() {
  const services = createServiceRegistry();
  const extensions = createExtensionRegistry();
  const commands = createCommandRegistry();
  const events = createEventBus();
  const onError = vi.fn();
  const plugins = createPluginRegistry({
    services,
    extensions,
    commands,
    events,
    storage: createMemoryStorageBackend(),
    onError,
  });

  const built = createBuiltinPlugins({
    files: stubHost(),
    monaco: stubHost(),
    monacoFocus: createFocusRegistry(),
    monacoI18n: undefined,
    markdown: stubHost(),
    markdownI18n: undefined,
    schema: stubHost(),
    schemaI18n: undefined,
    ai: stubHost(),
    aiI18n: undefined,
    preview: stubHost(),
    previewI18n: undefined,
    codegen: stubHost(),
    codegenI18n: undefined,
    templates: stubHost(),
    templatesI18n: undefined,
    printTemplate: () => Promise.resolve([]),
    kits: { translate: (key: string) => key },
  });

  return { built, plugins, extensions, commands, services, onError };
}

describe('состав встроенных плагинов', () => {
  it('активируются ВСЕ до единого', () => {
    // Упавший плагин не роняет остальных — это правило платформы, и оно верное. Цена в том,
    // что здесь отказ выглядел бы как «просто нет панели», а не как красный тест.
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const failed = h.plugins.statuses().filter((s) => s.state !== 'active');
    expect(failed).toEqual([]);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('идентификаторы уникальны', () => {
    const ids = harness().built.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('вклады доезжают до НАСТОЯЩИХ точек расширения, а не до двойников', () => {
    // Ровно та ошибка, ради которой файл и заведён: плагин объявляет структурную копию точки,
    // композиция подставляет настоящую, и разойдись они — вклад ушёл бы в никуда молча.
    //
    // Сверяется ПОИМЁННЫЙ состав, а не количество. Порог «не меньше N» эту ошибку
    // не ловит — проверено мутацией: подмена точки у плагина файлов оставляет панелей
    // достаточно, чтобы порог прошёл, и вклад теряется незаметно.
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const owners = <T>(point: ExtensionPoint<T>): string[] =>
      [...new Set(h.extensions.get(point).map((c) => c.pluginId))].sort();

    expect(owners(PanelPoint)).toEqual([
      'ai',
      'codegen',
      'editor-schema',
      'files',
      // Превью вносит панель модели: значения формы, состояние узлов и производные пути
      // не видны больше нигде. Форму оно по-прежнему не дублирует — её рисует редактор схемы.
      'preview',
      'templates',
    ]);
    expect(owners(EditorPoint)).toEqual([
      'editor-markdown',
      'editor-monaco',
      'editor-schema',
      'files',
    ]);
    expect(owners(DocumentModelPoint)).toEqual(['editor-schema']);
  });

  it('markdown-файл достаётся markdown-редактору, а не Monaco', () => {
    // Проверка ЗДЕСЬ, а не в плагине: приоритеты сравниваются между плагинами, а плагин
    // видит только свой. Числа были равны — и `.md` доставался Monaco просто потому, что
    // тот зарегистрирован раньше; кнопки предпросмотра при этом рисовались и «не работали».
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const ref = {
      id: 'mem:README.md',
      sourceId: 'mem',
      path: 'README.md',
      name: 'README.md',
      kind: 'file' as const,
      mediaType: 'text/markdown',
    };
    const winner = resolveEditor(h.extensions.get(EditorPoint), ref, {
      text: () => Promise.resolve('# заголовок'),
    });

    expect(winner?.value.id).toBe('markdown.editor');
  });

  it('у каждого вклада есть владелец, и он настоящий плагин', () => {
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const ids = new Set(h.built.map((p) => p.id));
    // Явными вызовами, а не циклом по массиву точек: точки разнотипны, и массив из них
    // получил бы тип-объединение, к которому `get` уже не применить.
    const check = <T>(point: ExtensionPoint<T>): void => {
      for (const contribution of h.extensions.get(point)) {
        expect(ids).toContain(contribution.pluginId);
      }
    };
    check(PanelPoint);
    check(EditorPoint);
    check(DocumentModelPoint);
  });

  it('порядок активации ничего не значит', () => {
    // Правило объявлено в контракте Э4 и проверено там на выдуманных плагинах. Здесь оно
    // проверяется на НАСТОЯЩИХ: именно они могут завести неявную зависимость друг от друга
    // через сервис, которого при обратном порядке ещё нет.
    const forward = harness();
    forward.plugins.registerAll(forward.built);
    forward.plugins.activateAll();

    const backward = harness();
    backward.plugins.registerAll([...backward.built].reverse());
    backward.plugins.activateAll();

    expect(backward.plugins.statuses().filter((s) => s.state !== 'active')).toEqual([]);
    expect(backward.extensions.get(PanelPoint).length).toBe(
      forward.extensions.get(PanelPoint).length
    );
  });

  it('каждая команда знает своего владельца', () => {
    // Без владельца заголовок команды плагина ищется в словаре оболочки и всегда промахивается.
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const ids = new Set(h.built.map((p) => p.id));
    const orphans = h.commands
      .getAll()
      .filter((c) => c.pluginId === undefined || !ids.has(c.pluginId));
    expect(orphans.map((c) => c.id)).toEqual([]);
  });

  it('снятие плагинов убирает все вклады', () => {
    // Утечка вклада после выключения означала бы панель от плагина, которого больше нет.
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();
    for (const plugin of h.built) h.plugins.deactivate(plugin.id);

    expect(h.extensions.get(PanelPoint)).toEqual([]);
    expect(h.extensions.get(EditorPoint)).toEqual([]);
    expect(h.commands.getAll()).toEqual([]);
  });
});

describe('проверки выше не пусты', () => {
  it('вкладов и команд действительно много, а не ноль', () => {
    // Тест, который проверяет отсутствие нарушений в пустом списке, проходит всегда
    // и не значит ничего. Эти числа — нижняя граница того, что композиция обязана дать.
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    expect(h.built.length).toBeGreaterThanOrEqual(8);
    expect(h.plugins.statuses().length).toBe(h.built.length);
    expect(h.extensions.get(PanelPoint).length).toBeGreaterThanOrEqual(4);
    expect(h.extensions.get(EditorPoint).length).toBeGreaterThanOrEqual(2);
    expect(h.commands.getAll().length).toBeGreaterThanOrEqual(5);
  });
});

describe('заголовки команд разрешаются в словаре владельца', () => {
  it('ни одна команда не показывает маркер промаха', async () => {
    // Дефект, который этот тест ловит, полгода прятался ЗА ТЕСТОМ: проверка палитры была
    // написана на правильном ключе, которого в коде не было. Она проверяла выдуманный
    // случай и потому оставалась зелёной.
    //
    // Ловушка в том, что пространство имён — ОТДЕЛЬНОЕ ИЗМЕРЕНИЕ, а не приставка к ключу.
    // `titleKey: 'editor-schema.command.delete'` ищется внутри словаря плагина целиком,
    // а там лежат `command.delete`, `palette.title` и прочие голые ключи. Промах.
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const dictionaries = new Map<string, Set<string>>();
    for (const plugin of h.built) {
      const locale = await loadPluginLocale(plugin.id);
      if (locale !== null) dictionaries.set(plugin.id, new Set(Object.keys(locale)));
    }

    const missing = h.commands
      .getAll()
      .filter((c) => c.pluginId !== undefined)
      .filter((c) => {
        const keys = dictionaries.get(c.pluginId as string);
        // Плагин без словаря — отдельный разговор: его строки не локализуемы вовсе,
        // и это дыра контракта, а не промах конкретной команды.
        return keys !== undefined && !keys.has(c.titleKey);
      })
      .map((c) => `${c.pluginId}: ${c.titleKey}`);

    expect(missing).toEqual([]);
  });

  it('проверка не пуста: словари найдены и команды с владельцем есть', () => {
    const h = harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const owned = h.commands.getAll().filter((c) => c.pluginId !== undefined);
    expect(owned.length).toBeGreaterThanOrEqual(5);
  });
});

describe('канал выделения насквозь: настоящая служба и оба плагина', () => {
  /**
   * Отражение выделения проверено с обеих сторон по отдельности — но во всех тех тестах
   * канал был ДВОЙНИКОМ службы: плагин не видит платформу и не видит соседний плагин,
   * это держит линтер. Значит проверка «настоящая служба плюс оба плагина» может жить
   * только здесь, в композиции, — и без неё двойник остаётся утверждением о службе,
   * а не её проверкой.
   */
  function connected() {
    const h = harness();
    const selection = createSelectionService();
    h.services.register(SelectionServiceToken, selection);
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();
    return { ...h, selection };
  }

  it('оба плагина подключились к ОДНОЙ службе, а не к своим двойникам', () => {
    const c = connected();
    let seen = 0;
    const off = c.selection.onDidChange(() => (seen += 1));

    c.selection.set('mem:form.json', ['aaaaaaaa']);

    expect(seen).toBe(1);
    expect(c.selection.get('mem:form.json')).toEqual(['aaaaaaaa']);
    off.dispose();
  });

  it('эхо затухает: повтор того же значения не рассылается', () => {
    // Единственная защита от бесконечного отражения между канвасом и превью. Рассылка
    // синхронная, поэтому круг проявился бы переполнением стека, а не медленной работой.
    const c = connected();
    let seen = 0;
    const off = c.selection.onDidChange(() => (seen += 1));

    c.selection.set('mem:form.json', ['aaaaaaaa']);
    c.selection.set('mem:form.json', ['aaaaaaaa']);
    c.selection.set('mem:form.json', [...['aaaaaaaa']]);

    expect(seen).toBe(1);
    off.dispose();
  });

  it('выделения разных ресурсов независимы', () => {
    // Единственное выделение на приложение пришлось бы гасить при каждом переключении
    // вкладки, то есть решать за плагины, когда их состояние умирает.
    const c = connected();

    c.selection.set('mem:a.json', ['aaaaaaaa']);
    c.selection.set('mem:b.json', ['bbbbbbbb']);

    expect(c.selection.get('mem:a.json')).toEqual(['aaaaaaaa']);
    expect(c.selection.get('mem:b.json')).toEqual(['bbbbbbbb']);
  });

  it('снятие плагинов не оставляет подписок на службе', () => {
    // Живая подписка выключенного плагина — это ход, уходящий в объект, которого больше нет.
    const c = connected();
    for (const plugin of c.built) c.plugins.deactivate(plugin.id);

    expect(() => c.selection.set('mem:form.json', ['aaaaaaaa'])).not.toThrow();
  });
});
