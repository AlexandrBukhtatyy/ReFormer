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
 * @module shell/boot/plugins.test
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ExtensionPoint } from '@/shell/platform/primitives/extension-point';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createSelectionService, SelectionServiceToken } from '@/shell/platform/services/selection';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { DocumentModelPoint } from '@/shell/platform/workspace/model/provider';
import { EditorPoint, resolveEditor } from '@/shell/platform/ui/contributions/editors';
import { PanelPoint } from '@/shell/platform/ui/slots';
import { createFocusRegistry } from '@/plugins/editor-monaco';
import {
  createBuiltinPlugins,
  createEagerBuiltinPlugins,
  LAZY_PLUGIN_IDS,
  loadLazyBuiltinPlugins,
} from './plugins';

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
    const mod = (await import(`../../plugins/${id}/locales/ru.json`)) as {
      default: Record<string, string>;
    };
    return mod.default;
  } catch {
    return null;
  }
}

async function harness() {
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

  // Ждём ОБЕ фазы: состав проверяется целиком, а не только той половиной, что едет в entry.
  const built = await createBuiltinPlugins({
    // Словари в этом стенде не проверяются: перевод возвращает ключ, вклад глотается.
    // Полнота словарей проверяется отдельно (integration/i18n-completeness).
    i18n: {
      forPlugin: () => ({ t: (key: string) => key, contribute: () => {} }),
    },
    files: stubHost(),
    monaco: stubHost(),
    monacoFocus: createFocusRegistry(),
    markdown: stubHost(),
    schema: stubHost(),
    ai: stubHost(),
    preview: stubHost(),
    codegen: stubHost(),
    templates: stubHost(),
    printTemplate: () => Promise.resolve([]),
    kits: {},
    pluginManager: { host: stubHost() },
  });

  return { built, plugins, extensions, commands, services, onError };
}

describe('состав встроенных плагинов', () => {
  it('активируются ВСЕ до единого', async () => {
    // Упавший плагин не роняет остальных — это правило платформы, и оно верное. Цена в том,
    // что здесь отказ выглядел бы как «просто нет панели», а не как красный тест.
    const h = await harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const failed = h.plugins.statuses().filter((s) => s.state !== 'active');
    expect(failed).toEqual([]);
    expect(h.onError).not.toHaveBeenCalled();
  });

  it('идентификаторы уникальны', async () => {
    const ids = (await harness()).built.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('вклады доезжают до НАСТОЯЩИХ точек расширения, а не до двойников', async () => {
    // Ровно та ошибка, ради которой файл и заведён: плагин объявляет структурную копию точки,
    // композиция подставляет настоящую, и разойдись они — вклад ушёл бы в никуда молча.
    //
    // Сверяется ПОИМЁННЫЙ состав, а не количество. Порог «не меньше N» эту ошибку
    // не ловит — проверено мутацией: подмена точки у плагина файлов оставляет панелей
    // достаточно, чтобы порог прошёл, и вклад теряется незаметно.
    const h = await harness();
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

  it('markdown-файл достаётся markdown-редактору, а не Monaco', async () => {
    // Проверка ЗДЕСЬ, а не в плагине: приоритеты сравниваются между плагинами, а плагин
    // видит только свой. Числа были равны — и `.md` доставался Monaco просто потому, что
    // тот зарегистрирован раньше; кнопки предпросмотра при этом рисовались и «не работали».
    const h = await harness();
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

  it('у каждого вклада есть владелец, и он настоящий плагин', async () => {
    const h = await harness();
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

  it('порядок активации ничего не значит', async () => {
    // Правило объявлено в контракте Э4 и проверено там на выдуманных плагинах. Здесь оно
    // проверяется на НАСТОЯЩИХ: именно они могут завести неявную зависимость друг от друга
    // через сервис, которого при обратном порядке ещё нет.
    const forward = await harness();
    forward.plugins.registerAll(forward.built);
    forward.plugins.activateAll();

    const backward = await harness();
    backward.plugins.registerAll([...backward.built].reverse());
    backward.plugins.activateAll();

    expect(backward.plugins.statuses().filter((s) => s.state !== 'active')).toEqual([]);
    expect(backward.extensions.get(PanelPoint).length).toBe(
      forward.extensions.get(PanelPoint).length
    );
  });

  it('каждая команда знает своего владельца', async () => {
    // Без владельца заголовок команды плагина ищется в словаре оболочки и всегда промахивается.
    const h = await harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const ids = new Set(h.built.map((p) => p.id));
    const orphans = h.commands
      .getAll()
      .filter((c) => c.pluginId === undefined || !ids.has(c.pluginId));
    expect(orphans.map((c) => c.id)).toEqual([]);
  });

  it('снятие плагинов убирает все вклады', async () => {
    // Утечка вклада после выключения означала бы панель от плагина, которого больше нет.
    const h = await harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();
    for (const plugin of h.built) h.plugins.deactivate(plugin.id);

    expect(h.extensions.get(PanelPoint)).toEqual([]);
    expect(h.extensions.get(EditorPoint)).toEqual([]);
    expect(h.commands.getAll()).toEqual([]);
  });
});

describe('проверки выше не пусты', () => {
  it('вкладов и команд действительно много, а не ноль', async () => {
    // Тест, который проверяет отсутствие нарушений в пустом списке, проходит всегда
    // и не значит ничего. Эти числа — нижняя граница того, что композиция обязана дать.
    const h = await harness();
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
    const h = await harness();
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

  it('проверка не пуста: словари найдены и команды с владельцем есть', async () => {
    const h = await harness();
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();

    const owned = h.commands.getAll().filter((c) => c.pluginId !== undefined);
    expect(owned.length).toBeGreaterThanOrEqual(5);

    // Громкость динамического пути: `import(\`../../plugins/…\`)` в loadPluginLocale резолвится
    // относительно ЭТОГО файла, а отказ глотается try/catch. Сломай переезд файла этот путь —
    // проверка ключей выше осталась бы зелёной, сверив пустое множество словарей. Поэтому здесь
    // утверждается сам факт загрузки: словари у встроенных плагинов действительно находятся.
    const dictionaries = await Promise.all(h.built.map((p) => loadPluginLocale(p.id)));
    expect(dictionaries.filter((d) => d !== null).length).toBeGreaterThanOrEqual(5);
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
  async function connected() {
    const h = await harness();
    const selection = createSelectionService();
    h.services.register(SelectionServiceToken, selection);
    h.plugins.registerAll(h.built);
    h.plugins.activateAll();
    return { ...h, selection };
  }

  it('оба плагина подключились к ОДНОЙ службе, а не к своим двойникам', async () => {
    const c = await connected();
    let seen = 0;
    const off = c.selection.onDidChange(() => (seen += 1));

    c.selection.set('mem:form.json', ['aaaaaaaa']);

    expect(seen).toBe(1);
    expect(c.selection.get('mem:form.json')).toEqual(['aaaaaaaa']);
    off.dispose();
  });

  it('эхо затухает: повтор того же значения не рассылается', async () => {
    // Единственная защита от бесконечного отражения между канвасом и превью. Рассылка
    // синхронная, поэтому круг проявился бы переполнением стека, а не медленной работой.
    const c = await connected();
    let seen = 0;
    const off = c.selection.onDidChange(() => (seen += 1));

    c.selection.set('mem:form.json', ['aaaaaaaa']);
    c.selection.set('mem:form.json', ['aaaaaaaa']);
    c.selection.set('mem:form.json', [...['aaaaaaaa']]);

    expect(seen).toBe(1);
    off.dispose();
  });

  it('выделения разных ресурсов независимы', async () => {
    // Единственное выделение на приложение пришлось бы гасить при каждом переключении
    // вкладки, то есть решать за плагины, когда их состояние умирает.
    const c = await connected();

    c.selection.set('mem:a.json', ['aaaaaaaa']);
    c.selection.set('mem:b.json', ['bbbbbbbb']);

    expect(c.selection.get('mem:a.json')).toEqual(['aaaaaaaa']);
    expect(c.selection.get('mem:b.json')).toEqual(['bbbbbbbb']);
  });

  it('снятие плагинов не оставляет подписок на службе', async () => {
    // Живая подписка выключенного плагина — это ход, уходящий в объект, которого больше нет.
    const c = await connected();
    for (const plugin of c.built) c.plugins.deactivate(plugin.id);

    expect(() => c.selection.set('mem:form.json', ['aaaaaaaa'])).not.toThrow();
  });
});

describe('две фазы: что едет в entry, а что своим файлом', () => {
  /**
   * Опции те же, что у стенда выше, но без реестра плагинов: здесь проверяется СОСТАВ фаз,
   * а не поведение вкладов.
   */
  function options() {
    return {
      i18n: { forPlugin: () => ({ t: (key: string) => key, contribute: () => {} }) },
      files: stubHost(),
      monaco: stubHost(),
      monacoFocus: createFocusRegistry(),
      markdown: stubHost(),
      schema: stubHost(),
      ai: stubHost(),
      preview: stubHost(),
      codegen: stubHost(),
      templates: stubHost(),
      printTemplate: () => Promise.resolve([]),
      kits: {},
      pluginManager: { host: stubHost() },
    };
  }

  it('ленивая фаза отдаёт ровно объявленный список', async () => {
    const lazy = await loadLazyBuiltinPlugins(options());

    expect(lazy.map((plugin) => plugin.id).sort()).toEqual([...LAZY_PLUGIN_IDS].sort());
  });

  it('фазы не пересекаются и вместе дают весь набор', async () => {
    const eager = createEagerBuiltinPlugins(options()).map((plugin) => plugin.id);
    const lazy = (await loadLazyBuiltinPlugins(options())).map((plugin) => plugin.id);
    const all = (await createBuiltinPlugins(options())).map((plugin) => plugin.id);

    expect(eager.filter((id) => lazy.includes(id))).toEqual([]);
    expect([...eager, ...lazy].sort()).toEqual([...all].sort());
  });

  /**
   * ХРАПОВИК, ради которого затевалось разделение.
   *
   * Ленивый плагин приезжает своим файлом ровно до тех пор, пока ни один модуль оболочки
   * не импортирует его барель ЗНАЧЕНИЕМ: один такой импорт возвращает плагин в стартовый граф
   * целиком, и заметить это можно только сравнив размеры сборки. Именно так и случилось —
   * шесть портов тянули идентификаторы из барелей, и первая же сборка показала, что из шести
   * плагинов отделился один. Отсюда проверка: импортировать можно ТИП (стирается компилятором)
   * и подмодуль `contract` (лист без импортов значений), но не барель.
   */
  it('оболочка не импортирует барель ленивого плагина значением', () => {
    const root = new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const offenders: string[] = [];

    const walk = (dir: string): void => {
      for (const entry of readdirSync(dir)) {
        const full = dir + '/' + entry;
        if (statSync(full).isDirectory()) {
          walk(full);
          continue;
        }
        if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue;
        const text = readFileSync(full, 'utf8');
        for (const id of LAZY_PLUGIN_IDS) {
          // Барель — это ТОЧНО `@/plugins/<id>`: `@/plugins/<id>/contract` под шаблон не подходит.
          const pattern = new RegExp(
            "(^|\\n)import\\s+(?!type)[^;]*?from '@/plugins/" + id + "';",
            's'
          );
          if (pattern.test(text)) offenders.push(full.slice(root.length) + ' → ' + id);
        }
      }
    };

    walk(root + '/shell');

    expect(offenders).toEqual([]);
  });
});
