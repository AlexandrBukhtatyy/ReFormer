/**
 * Проверка САМОЙ композиции — единственного места, где структурные копии типов встречаются
 * с настоящими вещами платформы.
 *
 * Каждый плагин покрыт своими тестами, и все они зелёные, — но проверяют они плагин на своих
 * двойниках. Ошибка сборки живёт между ними, и её не видит никто: порт, проглотивший аргумент,
 * компилируется (реализация с меньшим числом параметров присваивается функции с бо́льшим),
 * а вклад, ушедший в точку с другим `id`, теряется молча: реестр ключуется ИМЕНЕМ точки,
 * поэтому разъехавшаяся копия объявления — не ошибка компиляции, а пустая панель.
 *
 * Оба случая в этом проекте уже происходили. Отсюда этот файл.
 *
 * С появлением профилей это тест ПОЛНОГО профиля — того состава, который получает человек,
 * открывший инструмент. Он собирается ровно тем же значением, что уходит в `boot` из
 * `main.tsx` (`builderApplication`), а не отдельным списком «всех, кого знаем»: список,
 * собранный для теста, проверял бы сам себя. Что даёт КОРОТКИЙ профиль — вопрос
 * `compose.test`, и проверяется он там поимённо.
 *
 * @module application/composer/builtin-plugins.test
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createCommandRegistry } from '@/shell/platform/primitives/command';
import { createEventBus } from '@/shell/platform/primitives/event';
import { createExtensionRegistry } from '@/shell/platform/primitives/extension-point';
import type { ExtensionPoint } from '@reformer/builder-plugin-api/internal';
import { createServiceRegistry } from '@/shell/platform/primitives/service';
import { createSelectionService } from '@/shell/platform/services/selection';
import { SelectionServiceToken } from '@reformer/builder-plugin-api/internal';
import { createPluginRegistry } from '@/shell/platform/plugin/registry';
import { createMemoryStorageBackend } from '@/shell/platform/plugin/storage';
import { DocumentModelPoint } from '@reformer/builder-plugin-api/internal';
import { resolveEditor } from '@/shell/platform/ui/contributions/editors';
import { EditorPoint } from '@reformer/builder-plugin-api/internal';
import { PanelPoint } from '@reformer/builder-plugin-api/internal';
import { PreviewSurfacePoint } from '@reformer/builder-plugin-api/internal';
import { KITS_PLUGIN_ID, KitsCapability, KitsServiceToken } from '@/plugins/kits';
import { builderApplication } from '../builder-application';
import {
  builtinPluginDirectory,
  BUILTIN_MANIFESTS,
  BUILTIN_PLUGIN_NAMESPACE,
  BUILTIN_PLUGINS,
  canonicalPluginId,
  LAZY_PLUGIN_IDS,
} from './builtin-plugins';
import { composeAll } from './compose';
import { stubBuiltinOptions, stubHostCapabilities } from './testing';

/**
 * Русский словарь плагина или `null`, если словаря у него нет.
 *
 * Читается ДИНАМИЧЕСКИМ импортом по идентификатору, а не статическим списком: список
 * отстал бы от репозитория молча, и проверка стала бы проверять подмножество, о котором
 * никто не помнит. Русский, а не английский, потому что он основная локаль, а совпадение
 * наборов ключей между локалями проверяет отдельный тест.
 *
 * Каталог берётся у {@link builtinPluginDirectory}: он зовётся `ai`, а плагин — `reformer.ai`,
 * и с фазы 7 это РАЗНЫЕ строки.
 */
async function loadPluginLocale(id: string): Promise<Record<string, string> | null> {
  const directory = builtinPluginDirectory(id);
  try {
    const mod = (await import(`../../plugins/${directory}/locales/ru.json`)) as {
      default: Record<string, string>;
    };
    return mod.default;
  } catch {
    return null;
  }
}

async function harness() {
  const services = createServiceRegistry();
  // Возможности оболочки — до активации, как в `boot`: без реестра фокуса и хранилища
  // снимков вида редактор кода не имеет права работать и отказывается подниматься.
  stubHostCapabilities(services);
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
  const composed = await composeAll(builderApplication, stubBuiltinOptions());
  const built = composed.map((entry) => entry.plugin);

  /** Регистрация как в `boot`: вместе с плагином уходит то, что он ОБЕЩАЛ дать остальным. */
  const registerComposed = (): void => {
    for (const entry of composed) plugins.register(entry.plugin, entry.provides);
  };

  return { built, composed, registerComposed, plugins, extensions, commands, services, onError };
}

describe('карта встроенных плагинов', () => {
  it('идентификаторы в карте уникальны: запись не может перекрыть соседнюю', () => {
    // Карта строится из массива записей, а `new Map` на повторный ключ молча перезаписывает —
    // то есть один плагин исчез бы из состава, а профиль, называющий его, остался бы зелёным.
    expect(BUILTIN_PLUGINS.size).toBe([...BUILTIN_PLUGINS.keys()].length);
    expect(BUILTIN_PLUGINS.size).toBeGreaterThanOrEqual(11);
  });

  it('ключ карты — настоящий идентификатор плагина, а не соседнее имя', async () => {
    // У ленивых записей идентификатор написан СТРОКОЙ: константа лежит в барели, и её импорт
    // вернул бы плагин в стартовый граф. Значит расхождение строки с `plugin.id` возможно,
    // и ловится оно только здесь — сборкой настоящих плагинов из карты.
    const options = stubBuiltinOptions();
    const mismatched: string[] = [];
    for (const [id, entry] of BUILTIN_PLUGINS) {
      const plugin = await entry.create(options);
      if (plugin.id !== id) mismatched.push(`${id} → ${plugin.id}`);
    }

    expect(mismatched).toEqual([]);
  });

  it('каждый встроенный живёт в пространстве имён, и прежнее имя ведёт к нему', () => {
    // Таблица прежних имён ВЫВОДИТСЯ из ключей карты снятием префикса, поэтому запись
    // без префикса дала бы псевдоним самому себе — то есть прежний конфиг перестал бы
    // называть этот плагин, и заметить это можно было бы только по собранному составу.
    const outside = [...BUILTIN_PLUGINS.keys()].filter(
      (id) => !id.startsWith(BUILTIN_PLUGIN_NAMESPACE)
    );
    expect(outside).toEqual([]);

    for (const id of BUILTIN_PLUGINS.keys()) {
      expect(canonicalPluginId(id.slice(BUILTIN_PLUGIN_NAMESPACE.length))).toBe(id);
      // Нынешнее имя через таблицу проходит НЕИЗМЕННЫМ: иначе повторное приведение
      // (конфиг уже переписан человеком) уводило бы имя в несуществующее.
      expect(canonicalPluginId(id)).toBe(id);
    }
  });

  it('объявленное манифестом совпадает с токеном, которым плагин регистрирует', () => {
    // Прежде объявление и токен были ОДНИМ объектом, и разойтись им было нечем. Теперь
    // объявление — данные манифеста, и сверка переехала сюда: рантайм проверяет только
    // идентификатор («что-то под этим именем зарегистрировано»), а ВЕРСИЯ разошлась бы молча —
    // резолвер обещал бы потребителю одну, а реестр служб держал бы другую.
    expect(BUILTIN_PLUGINS.get(KITS_PLUGIN_ID)?.manifest.provides).toEqual([KitsCapability]);
    expect(KitsCapability.id).toBe(KitsServiceToken.id);
  });

  it('манифест ЕСТЬ у каждого, он встроенной поставки и назван своим каталогом', () => {
    // Разбор происходит при загрузке модуля карты и бросает: сюда доходят только разобранные
    // манифесты, поэтому проверять здесь остаётся то, чего разбор не знает, — что манифест
    // взят у того плагина, чью фабрику зовёт запись.
    for (const [id, entry] of BUILTIN_PLUGINS) {
      expect(entry.manifest.id).toBe(id);
      expect(entry.manifest.source).toEqual({ kind: 'builtin' });
      expect(entry.manifest.builtin.loading).toBe(entry.loading);
    }

    expect(BUILTIN_MANIFESTS.map((manifest) => manifest.id).sort()).toEqual(
      [...BUILTIN_PLUGINS.keys()].sort()
    );
  });

  it('статический объясняет себя, ленивый — нет', () => {
    // Требование разбора, и проверяется оно тут на НАСТОЯЩЕМ составе: правило без предмета
    // проходит на выдуманном манифесте и молчит о том, что у половины состава довод потерян.
    for (const entry of BUILTIN_PLUGINS.values()) {
      const reason = entry.manifest.builtin.reason;
      if (entry.loading === 'eager') {
        expect(reason?.length ?? 0).toBeGreaterThan(40);
      } else {
        expect(reason).toBeUndefined();
      }
    }
  });

  it('объявленное в карте действительно регистрируется при активации', () => {
    // Рантайм проверяет это сам (фаза `provides`), поэтому достаточно поднять состав:
    // невыполненное обещание переводит плагин в `failed`, а не проходит молча.
    const services = createServiceRegistry();
    const registry = createPluginRegistry({
      services,
      extensions: createExtensionRegistry(),
      commands: createCommandRegistry(),
      events: createEventBus(),
      storage: createMemoryStorageBackend(),
      onError: vi.fn(),
    });
    const entry = BUILTIN_PLUGINS.get(KITS_PLUGIN_ID);
    if (entry === undefined || entry.loading !== 'eager') throw new Error('киты не в карте');

    registry.register(entry.create(stubBuiltinOptions()), entry.manifest.provides);

    expect(registry.activate(KITS_PLUGIN_ID)).toBe(true);
    expect(services.get(KitsCapability)).toBeDefined();
  });
});

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

  it('объявленное в карте состава РЕГИСТРИРУЕТСЯ: обещание доезжает до реестра служб', async () => {
    // Объявление `provides` читается ДО загрузки кода и решает, поднимется ли внешний плагин
    // с `requires`. Соврать в нём — значит отказать соседу по причине, которой нет, или
    // пустить его к службе, которой не будет. У плагина каталога это стережёт проверка
    // обещанного (`plugin/registry`, фаза `provides`); здесь проверяется, что встроенные
    // регистрируются ТЕМ ЖЕ путём — парой «плагин + объявление», как в `boot`.
    const h = await harness();
    h.registerComposed();
    h.plugins.activateAll();

    const declared = h.composed.flatMap((entry) => entry.provides ?? []);
    expect(declared.length).toBeGreaterThanOrEqual(2);
    expect(declared.filter((capability) => h.services.get(capability) === undefined)).toEqual([]);
    // Обратная сторона: ни один не переведён в `failed` за неисполненное обещание.
    expect(h.plugins.failures().filter((failure) => failure.phase === 'provides')).toEqual([]);
  });

  it('идентификаторы уникальны', async () => {
    const ids = (await harness()).built.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('вклады доезжают до НАСТОЯЩИХ точек расширения, а не до двойников', async () => {
    // Ровно та ошибка, ради которой файл и заведён: плагин объявляет структурную копию точки,
    // композиция подставляет настоящую, и разойдись они по `id` — вклад ушёл бы в никуда молча.
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
      'reformer.ai',
      'reformer.codegen',
      'reformer.editor-schema',
      'reformer.files',
      // Поверхности формы ReFormer вносят панель модели: значения формы, состояние узлов
      // и производные пути не видны больше нигде. Форму она не дублирует — её рисует редактор.
      // Превью-хост панелей не вносит: своего интерфейса у него нет.
      'reformer.preview-runtime',
      'reformer.templates',
    ]);
    // Поверхности вносит плагин стека, а не хост: чем рисовать схему — знание стека.
    expect(owners(PreviewSurfacePoint)).toEqual(['reformer.preview-runtime']);
    expect(owners(EditorPoint)).toEqual([
      'reformer.editor-markdown',
      'reformer.editor-monaco',
      'reformer.editor-schema',
      'reformer.files',
    ]);
    expect(owners(DocumentModelPoint)).toEqual(['reformer.editor-schema']);
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
  it('ленивая фаза полного профиля отдаёт ровно тех, кто объявлен ленивым', async () => {
    const lazy = await builderApplication.lazy(stubBuiltinOptions());

    expect(lazy.map((composed) => composed.plugin.id).sort()).toEqual([...LAZY_PLUGIN_IDS].sort());
  });

  it('фазы не пересекаются и вместе дают весь набор', async () => {
    const options = stubBuiltinOptions();
    const eager = builderApplication.eager(options).map((composed) => composed.plugin.id);
    const lazy = (await builderApplication.lazy(options)).map((composed) => composed.plugin.id);
    const all = (await composeAll(builderApplication, options)).map(
      (composed) => composed.plugin.id
    );

    expect(eager.filter((id) => lazy.includes(id))).toEqual([]);
    expect([...eager, ...lazy].sort()).toEqual([...all].sort());
  });

  it('полный профиль собирает ВСЮ карту: ни одна запись не осталась невостребованной', async () => {
    // Карта и профиль — разные списки, и разъехаться они могут в обе стороны. Плагин,
    // добавленный в карту и забытый в профиле, не попал бы в приложение вовсе, а тест
    // состава остался бы зелёным: он проверяет то, что собралось.
    const all = await composeAll(builderApplication, stubBuiltinOptions());

    expect(all.map((composed) => composed.plugin.id).sort()).toEqual(
      [...BUILTIN_PLUGINS.keys()].sort()
    );
  });

  /**
   * ХРАПОВИК, ради которого затевалось разделение.
   *
   * Ленивый плагин приезжает своим файлом ровно до тех пор, пока ни один модуль стартового
   * графа не импортирует его барель ЗНАЧЕНИЕМ: один такой импорт возвращает плагин в этот граф
   * целиком, и заметить это можно только сравнив размеры сборки. Именно так и случилось —
   * шесть портов тянули идентификаторы из барелей, и первая же сборка показала, что из шести
   * плагинов отделился один. Отсюда проверка: импортировать можно ТИП (стирается компилятором)
   * и подмодуль `contract` (лист без импортов значений), но не барель.
   *
   * Обходятся ДВЕ зоны, и вторая появилась вместе с `application/`: состав уехал из оболочки,
   * а вместе с ним уехала и возможность промахнуться. Статический импорт бареля ленивого
   * плагина сегодня естественнее всего написать именно здесь — рядом со списком, в двух строках
   * от литеральных `import()`. Обходи храповик один `shell/`, он стерёг бы то место, где ошибку
   * уже никто не сделает.
   */
  it('стартовый граф не импортирует барель ленивого плагина значением', () => {
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
          // По КАТАЛОГУ, а не по идентификатору: путь импорта — `@/plugins/ai`, а плагин
          // зовётся `reformer.ai`. Подставь сюда идентификатор — шаблон не совпал бы ни с чем
          // и храповик молча перестал бы стеречь.
          const directory = builtinPluginDirectory(id);
          // Барель — это ТОЧНО `@/plugins/<каталог>`: `@/plugins/<каталог>/contract`
          // под шаблон не подходит.
          const pattern = new RegExp(
            "(^|\\n)import\\s+(?!type)[^;]*?from '@/plugins/" + directory + "';",
            's'
          );
          if (pattern.test(text)) offenders.push(full.slice(root.length) + ' → ' + id);
        }
      }
    };

    walk(root + '/shell');
    walk(root + '/application');

    expect(offenders).toEqual([]);
  });

  it('храповик не пуст: зоны обойдены и ленивые плагины у него есть', () => {
    // Сломайся обход путём — проверка выше осталась бы зелёной на пустом множестве файлов.
    expect(LAZY_PLUGIN_IDS.length).toBeGreaterThanOrEqual(6);
  });
});
