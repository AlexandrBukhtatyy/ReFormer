/**
 * Манифест плагина каталога: `.ui_builder/plugins/<id>/manifest.json` → {@link PluginManifest}.
 *
 * Разбор вынесен в отдельный модуль по той же причине, по которой отдельно живут отказы
 * источника: **манифест читает не только загрузчик**. Список плагинов показывает найденное
 * до того, как хоть что-то исполнено, и обязан уметь показать плагин, который не поднялся:
 * «здесь лежит каталог `acme-forms`, и вот почему он не грузится» — ответ, который получается
 * только из разбора, отделённого от загрузки.
 *
 * Отсюда форма результата: {@link parsePluginManifest} НИЧЕГО не бросает, а возвращает либо
 * манифест, либо {@link PluginProblem}. Испорченный манифест — обычное состояние каталога,
 * который человек правит руками, а не авария.
 *
 * ## Что проверяется и почему именно это
 *
 * - **`id` совпадает с именем каталога.** Идентификатор — ключ во всех реестрах, а каталог —
 *   единственное, что видно до чтения манифеста. Разойдясь, они дали бы список, в котором
 *   плагин зовётся не так, как папка, и команда «перезагрузить `acme-forms`» перезагружала бы
 *   что-то другое.
 * - **`main` не выходит за каталог плагина.** Нормализация — та же, что у линковщика
 *   (`normalizePath`), поэтому `../../secrets.ts` отсекается здесь, а не оказывается набором
 *   файлов, который загрузчик прочитал бы из чужого места.
 * - **Версия оболочки попадает в `apiVersion`.** Политику совместимости мы по-прежнему не строим
 *   — решено (plugin-and-shell.md): при расхождении плагин просто не грузится с внятным
 *   сообщением. Изменилось одно: диапазон разбирается НАСТОЯЩЕЙ утилитой версий
 *   (`primitives/semver`), а не выуживанием первого числа регуляркой. Прежний `majorOf`
 *   читал `^2` и `>=2` одинаково, то есть «^1» у нас совпадало бы с «1.5», хотя оболочка
 *   объявляет {@link BUILDER_API_VERSION} целиком. Утилита всё равно нужна полям `provides`
 *   и `requires`, поэтому вторая, самодельная, проверка версий здесь была бы ещё и лишней.
 *
 * - **`provides` и `requires` — это ФОРМА, а не разрешение конфликта.** Здесь проверяется, что
 *   идентификатор непуст, версия — версия, а диапазон — диапазон. «Кто предоставляет и хватает
 *   ли этого» решается уже снаружи: до загрузки кода — резолвером
 *   (`application/resolver/capability-resolver`) и каталогом (`./catalog`), а после активации —
 *   рантаймом (`./registry` сверяет объявленное с фактически зарегистрированным). Разбор
 *   манифеста обязан оставаться чтением ОДНОГО файла, ничего вокруг себя не зная.
 *
 * **Поля `permissions` нет и не будет** — решено там же: включённый плагин может всё, и объявлять
 * намерения полем, которое ничего не принуждает, значит создавать ложное ощущение границы.
 *
 * @module shell/platform/plugin/manifest
 */

import type {
  CapabilityDeclaration,
  CapabilityRequirement,
} from '@/shell/platform/primitives/capability';
import { normalizeChord } from '@/shell/platform/primitives/command';
import { parseRange, parseVersion, satisfies } from '@reformer/builder-plugin-api/internal';
import { parseWhen } from '@reformer/builder-plugin-api/internal';
import { normalizePath } from '@/shell/platform/modules/linker';

/** Имя файла манифеста внутри каталога плагина. */
export const PLUGIN_MANIFEST_FILE = 'manifest.json';

/**
 * Версия API плагинов, которую даёт эта сборка оболочки.
 *
 * Константа, а не мажор числом: с ней `apiVersion: "^1.2"` наконец значит то, что написано, —
 * прежний разбор доставал из диапазона первое число и не отличал `^1` от `1.5`. Растить её
 * обязан тот, кто меняет `@/sdk`: минор — на добавление имени, мажор — на удаление или смену
 * смысла. Политики совместимости между мажорами как не было, так и нет (plugin-and-shell.md).
 */
export const BUILDER_API_VERSION = '1.0.0';

/**
 * Откуда плагин взялся. Разбор манифеста спрашивают об этом ЗАРАНЕЕ, а не выводят потом.
 *
 * Две поставки различаются не «происхождением вообще», а двумя проверками, которые нельзя
 * сделать одинаковыми. У плагина ПРОЕКТА идентификатор обязан совпасть с именем каталога —
 * каталог единственное, что видно до чтения манифеста, — и точка входа обязана быть, иначе
 * грузить нечего. У ВСТРОЕННОГО каталога нет вовсе (он лежит в бандле оболочки, а имя его
 * папки — `ai` против идентификатора `reformer.ai`), и точки входа тоже нет: его код уже
 * здесь. Зато у него есть то, чего не бывает у плагина проекта, — способ доставки
 * ({@link BuiltinDelivery}).
 */
export type PluginSource =
  | { readonly kind: 'builtin' }
  | { readonly kind: 'project'; readonly dir: string };

/**
 * Как встроенный плагин приезжает в браузер.
 *
 * Деление про СБОРКУ, а не про поведение: оба набора встают до первой отрисовки. Смысл в том,
 * что иначе код всех плагинов лежит внутри entry одним файлом, а отдельный файл даёт только
 * динамический импорт (`manualChunks` измерен и отвергнут — см. `vite.config.ts`).
 *
 * `reason` заполняется у СТАТИЧЕСКИХ и только у них: ленивость — умолчание, объяснять надо
 * отступление от него. Живёт причина здесь, а не комментарием у записи состава, потому что
 * относится к плагину, а не к карте: карта может смениться, а довод останется тем же.
 */
export interface BuiltinDelivery {
  readonly loading: 'eager' | 'lazy';
  /** Почему этот плагин не может приехать своим файлом. Обязателен при `eager`. */
  readonly reason?: string;
}

/**
 * Общее у манифестов обеих поставок.
 *
 * `name` и `version` необязательны в файле и получают умолчания: они нужны списку плагинов,
 * а не механике, и требовать их значило бы отвергать рабочий плагин из-за подписи. `id`
 * и `apiVersion` умолчаний не имеют — у них нет осмысленного «по умолчанию».
 */
interface PluginManifestBase {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Диапазон API, объявленный плагином, как он написан в файле: `^1`, `1.2`, `~1.0.0`. */
  readonly apiVersion: string;
  /** Вклады, объявленные ДЕКЛАРАТИВНО — то есть видимые до того, как плагин включён. */
  readonly contributes?: PluginContributes;
  /**
   * Возможности, которые плагин ДАЁТ другим: `[{ "id": "reformer.kit.catalog", "version": "1.0.0" }]`.
   *
   * Объявление, а не регистрация: слот в реестре служб плагин занимает сам, в `activate`.
   * Расхождение между объявленным и занятым ловит рантайм (`./registry`) — иначе резолвер
   * верил бы манифесту, а реестр молчал бы, и «возможность есть» означало бы «написано,
   * что есть».
   */
  readonly provides?: readonly CapabilityDeclaration[];
  /**
   * Возможности, которые плагину НУЖНЫ, — двумя списками.
   *
   * Деление на обязательные и необязательные не косметическое, оно про разные исходы.
   * Невыполненное ОБЯЗАТЕЛЬНОЕ требование — отказ включения ДО того, как исполнится код
   * плагина (`./catalog`, `requires-unsatisfied`): плагин, которому нечем работать, не должен
   * получать шанс упасть на середине `activate` и оставить половину вкладов.
   * Невыполненное НЕОБЯЗАТЕЛЬНОЕ — названная деградация, ровно по принципу «необязательный
   * член контракта = названная деградация, а не поломка»: плагин включается и работает
   * без этой возможности, спрашивая её через `ctx.capabilities.get`.
   */
  readonly requires?: PluginRequirements;
}

/** Манифест плагина каталога проекта: у него есть каталог и точка входа. */
export interface ProjectPluginManifest extends PluginManifestBase {
  readonly source: { readonly kind: 'project'; readonly dir: string };
  /** Точка входа ВНУТРИ каталога плагина, нормализованная: `main.js`, `dist/main.js`. */
  readonly main: string;
  /**
   * Своя таблица стилей. Отсутствие поля — рекомендуемый путь: плагин пользуется классами
   * оболочки и токенами кита и выглядит родным бесплатно.
   */
  readonly styles?: PluginStyles;
}

/**
 * Манифест встроенного плагина: точки входа нет, зато объявлен способ доставки.
 *
 * Своей таблицы стилей у встроенного не бывает и быть не может: его CSS собирается вместе
 * с оболочкой, и изолировать его было бы нечего и не от чего.
 */
export interface BuiltinPluginManifest extends PluginManifestBase {
  readonly source: { readonly kind: 'builtin' };
  readonly builtin: BuiltinDelivery;
}

/**
 * Разобранный манифест — одной из двух поставок.
 *
 * Объединение размечено {@link PluginSource}, а не двумя необязательными полями: «точка входа
 * есть, но у встроенного её не бывает» пришлось бы проверять в загрузчике на каждом обращении,
 * и отсутствие `main` у того, кого грузят из каталога, стало бы не ошибкой разбора,
 * а исключением где-то посередине загрузки.
 */
export type PluginManifest = ProjectPluginManifest | BuiltinPluginManifest;

/** Требования плагина. Оба списка есть всегда — пустые, если в манифесте их не написали. */
export interface PluginRequirements {
  readonly required: readonly CapabilityRequirement[];
  readonly optional: readonly CapabilityRequirement[];
}

/**
 * Декларативные вклады манифеста — то есть видимые ДО того, как плагин включён.
 *
 * Клавиши попали сюда по проверяемой причине, а не «для симметрии с VS Code»: сочетание,
 * объявленное КОДОМ, появляется в приложении только после активации плагина. Значит до
 * включения таблица клавиш о нём не знает, и переназначить его нельзя — а человеку это нужно
 * ровно тогда, когда новый плагин занял привычную ему клавишу.
 *
 * Словари попали сюда по причине жёстче: без них плагину каталога негде взять СВОЙ текст
 * вовсе. Заголовок команды разрешается словарём её владельца (`primitives/command`, поле
 * `titleKey`), сервиса i18n в `PluginContext` нет и не будет (вклад в словарь не снимается
 * вместе с плагином, значит его подпиской быть не может), а словари встроенных вносит
 * композиция — кодом, которого у внешнего плагина не существует. Итог без этого поля:
 * КАЖДАЯ команда плагина каталога показана в палитре и меню маркером промаха
 * `⟦mycode.command.format⟧`.
 */
export interface PluginContributes {
  readonly keybindings?: readonly DeclaredKeybinding[];
  /**
   * Словари: локаль → путь к JSON внутри каталога плагина, например
   * `{ "ru": "locales/ru.json", "en": "locales/en.json" }`.
   *
   * Путь, а не сам словарь. Манифесты читаются у ВСЕХ найденных плагинов на каждом обходе
   * каталога, включая выключенные, и встроенный текст превратил бы обход в чтение всех
   * переводов всех плагинов проекта. Файл читается один раз и только у того, кого включили
   * (`./loader`).
   */
  readonly messages?: Readonly<Record<string, string>>;
}

/**
 * Сочетание, объявленное в манифесте.
 *
 * `command` — строка, и плагин вправе назвать команду, которой сейчас нет: она появится
 * при активации. Правило без команды просто не срабатывает — это обычное состояние
 * выключенного плагина, а не поломка.
 */
export interface DeclaredKeybinding {
  readonly command: string;
  /** Сочетание или аккорд: `mod+alt+i`, `mod+k mod+i`. */
  readonly key: string;
  /** Условие применимости; синтаксис — `primitives/when-expr`. */
  readonly when?: string;
  /** Аргументы вызова: у клавиши их нет, поэтому объявить их можно только здесь. */
  readonly args?: unknown;
  readonly allowInEditable?: boolean;
}

/**
 * Объявление своей таблицы стилей.
 *
 * `isolation` необязателен и умеет ровно одно значение. Поле существует не ради выбора,
 * а ради читаемости манифеста: `"isolation": "scoped"` рядом с файлом говорит автору плагина,
 * что его CSS ограничат, — и он не будет искать причину, почему `body { margin: 0 }`
 * не подействовал на весь документ. Второго значения нет и не планируется: неизолированный
 * чужой CSS перекрашивает оболочку, и это не режим, а поломка.
 */
export interface PluginStyles {
  /** Путь к CSS ВНУТРИ каталога плагина, нормализованный. */
  readonly file: string;
  readonly isolation: 'scoped';
}

/**
 * Почему плагин не работает. Код — для интерфейса и тестов, `message` — для человека.
 *
 * Набор плоский и общий на весь путь «нашли → разобрали → загрузили → включили», потому что
 * показывается он в одном месте — строке списка плагинов, — и различать там «отказ разбора»
 * от «отказа загрузки» человеку незачем: ему нужно знать, что чинить.
 */
export type PluginProblemCode =
  /** В каталоге плагина нет `manifest.json`. */
  | 'manifest-missing'
  /** Манифест не читается или не разбирается как JSON. */
  | 'manifest-unreadable'
  /** Манифест разобран, но поле отсутствует или не того вида. */
  | 'manifest-invalid'
  /** `id` в манифесте не совпадает с именем каталога. */
  | 'id-mismatch'
  /** `apiVersion` не покрывает версию оболочки: плагин написан против другой. */
  | 'api-version'
  /**
   * Обязательное требование `requires.required` не выполнено ничем из доступного.
   *
   * Проверяется ДО загрузки кода (`./catalog`), поэтому плагин не получает шанса упасть
   * на середине `activate`. Строка в списке плагинов остаётся — с этой причиной, как
   * у `styles-invalid` и `messages-invalid`.
   */
  | 'requires-unsatisfied'
  /**
   * Плагин объявил в `provides` возможность, которую к концу `activate` не зарегистрировал.
   *
   * Отдельный код, а не `activate-failed`: `activate` тут как раз НЕ бросал. Отличать их
   * нужно тому, кто чинит плагин, — это ошибка в самом плагине, а не в его окружении.
   */
  | 'provides-unregistered'
  /** Файла точки входа нет среди файлов плагина. */
  | 'entry-missing'
  /** В каталоге плагина слишком много файлов — это не плагин, а чужое дерево. */
  | 'too-many-files'
  /** Источник не разрешает исполнять свой код (`capabilities.executesCode`). */
  | 'source-forbids-code'
  /** Транспиляция, линковка или исполнение модуля отказали. */
  | 'code-failed'
  /** Точка входа экспортировала не плагин. */
  | 'not-a-plugin'
  /** Идентификатор уже занят другим плагином — встроенным или соседним по каталогу. */
  | 'id-taken'
  /** `activate` бросил. Плагин выключен и показан — автоповтора нет. */
  | 'activate-failed'
  /** Объявленная таблица стилей не разбирается или не изолируется (см. `./styles`). */
  | 'styles-invalid'
  /** Объявленный файл словаря не читается или это не плоский объект «ключ → строка». */
  | 'messages-invalid';

/** Отказ как данные. Исключением он не бывает нигде: испорченный каталог — не авария. */
export interface PluginProblem {
  readonly code: PluginProblemCode;
  readonly message: string;
  /** Файл, к которому отнесён отказ, если он известен. Путь внутри каталога плагина. */
  readonly file?: string;
  /** Исходное исключение — для консоли, не для показа. */
  readonly cause?: unknown;
}

/**
 * Манифест той поставки, которую назвали разбору.
 *
 * Нужен затем, чтобы загрузчик каталога получал манифест С точкой входа, а не объединение,
 * у которого её может не быть: спросив разбор про каталог проекта, он спросил про плагин,
 * у которого `main` есть по определению, и проверять это второй раз ему незачем.
 */
export type ManifestOf<S extends PluginSource> = Extract<
  PluginManifest,
  { readonly source: { readonly kind: S['kind'] } }
>;

/** Результат разбора: либо манифест, либо причина, по которой его нет. */
export type ManifestParseResult<M extends PluginManifest = PluginManifest> =
  | { readonly ok: true; readonly manifest: M }
  | { readonly ok: false; readonly problem: PluginProblem };

/**
 * Идентификатор плагина: буквы, цифры, `.`, `_`, `-`, начиная с буквы или цифры.
 *
 * Тот же набор, что у имени каталога, и не шире: `id` попадает в ключи хранилища, в имена
 * вкладов и (позже) в CSS-класс изоляции стилей, поэтому пробел или слэш в нём — источник
 * поломок в трёх местах сразу.
 */
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

const problem = (
  code: PluginProblemCode,
  message: string,
  extra?: { file?: string; cause?: unknown }
): { ok: false; problem: PluginProblem } => ({
  ok: false,
  problem: { code, message, file: extra?.file, cause: extra?.cause },
});

function stringField(raw: Record<string, unknown>, key: string): string | undefined {
  const value = raw[key];
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

/**
 * Разбирает текст манифеста.
 *
 * @param text содержимое `manifest.json`
 * @param source откуда плагин — от этого зависят две проверки, см. {@link PluginSource}
 * @param apiVersion версия API оболочки; параметр ради тестов, умолчание —
 * {@link BUILDER_API_VERSION}
 */
export function parsePluginManifest<S extends PluginSource>(
  text: string,
  source: S,
  apiVersion: string = BUILDER_API_VERSION
): ManifestParseResult<ManifestOf<S>> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return problem('manifest-unreadable', `${PLUGIN_MANIFEST_FILE} не разбирается как JSON`, {
      file: PLUGIN_MANIFEST_FILE,
      cause,
    });
  }
  return parsePluginManifestValue(raw, source, apiVersion);
}

/**
 * Разбирает УЖЕ разобранный JSON.
 *
 * Отдельный вход нужен встроенным: их манифест приезжает статическим импортом, то есть
 * значением, а не текстом. Обратно в строку его сериализовать только затем, чтобы тут же
 * разобрать, — значит завести второй путь, который однажды разойдётся с первым. Проверки
 * же обязаны быть ТЕМИ ЖЕ: «встроенные и внешние — один контракт» держится на том, что
 * манифест встроенного проходит разбор каталога целиком, а не свою облегчённую копию.
 */
export function parsePluginManifestValue<S extends PluginSource>(
  raw: unknown,
  source: S,
  apiVersion: string = BUILDER_API_VERSION
): ManifestParseResult<ManifestOf<S>> {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return problem('manifest-invalid', `${PLUGIN_MANIFEST_FILE} должен быть объектом JSON`, {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  const fields = raw as Record<string, unknown>;

  const id = stringField(fields, 'id');
  if (id === undefined) {
    return problem('manifest-invalid', 'в манифесте нет поля «id» или оно не строка', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  if (!ID_PATTERN.test(id)) {
    return problem(
      'manifest-invalid',
      `«${id}» не годится в идентификаторы: допустимы буквы, цифры, «.», «_» и «-»`,
      { file: PLUGIN_MANIFEST_FILE }
    );
  }
  if (source.kind === 'project' && id !== source.dir) {
    return problem(
      'id-mismatch',
      `манифест объявляет «${id}», а каталог называется «${source.dir}». ` +
        'Идентификатор — ключ во всех реестрах, и он обязан совпадать с именем каталога: ' +
        'иначе список плагинов и команды перезагрузки говорят о разных вещах',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const declaredApi = stringField(fields, 'apiVersion');
  if (declaredApi === undefined) {
    return problem('manifest-invalid', 'в манифесте нет поля «apiVersion» или оно не строка', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  if (parseRange(declaredApi) === undefined) {
    return problem(
      'manifest-invalid',
      `из «apiVersion»: «${declaredApi}» не читается диапазон версий. ` +
        'Допустимы «^1», «~1.2», «>=1.0.0», «1.x» и точная версия; составные диапазоны ' +
        'и пререлизы не поддерживаются',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }
  if (!satisfies(apiVersion, declaredApi)) {
    return problem(
      'api-version',
      `плагин написан против API «${declaredApi}», а оболочка даёт API ${apiVersion}. ` +
        'Совместимость между мажорами не обещана, поэтому плагин не загружается',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const entry = parseEntry(fields, source);
  if ('ok' in entry) return entry;

  const contributes = parseContributes(fields.contributes);
  if (contributes !== undefined && 'ok' in contributes) return contributes;

  const provides = parseProvides(fields.provides);
  if (provides !== undefined && 'ok' in provides) return provides;

  const requires = parseRequires(fields.requires);
  if (requires !== undefined && 'ok' in requires) return requires;

  const common = {
    id,
    name: stringField(fields, 'name') ?? id,
    version: stringField(fields, 'version') ?? '0.0.0',
    apiVersion: declaredApi,
    ...(contributes === undefined ? {} : { contributes: contributes.contributes }),
    ...(provides === undefined ? {} : { provides: provides.provides }),
    ...(requires === undefined ? {} : { requires: requires.requires }),
  };

  // Единственное приведение в модуле. Разбор поставки (`parseEntry`) отдаёт ровно тот
  // вариант, о котором его спросили, — но связь «спросили про builtin, получили builtin»
  // выражена ветвлением, а не типом, и вывод её не прослеживает. Проверяется она тестом:
  // манифест каждой поставки разбирается и предъявляет своё поле.
  return { ok: true, manifest: { ...common, ...entry } as ManifestOf<S> };
}

/**
 * Разбирает то, что у двух поставок РАЗНОЕ: точку входа со стилями против способа доставки.
 *
 * Лишнее поле здесь отвергается, а не игнорируется. Манифест — то, во что верит резолвер
 * до исполнения кода, и `"main"` у встроенного или `"builtin": { "loading": "lazy" }`
 * у плагина каталога значат, что автор ошибся поставкой: первый объявил файл, которого никто
 * не будет грузить, второй — способ доставки, которым никто не распоряжается. Промолчи
 * разбор — поле осталось бы в файле как рабочее указание, ни на что не влияющее.
 */
function parseEntry(
  fields: Record<string, unknown>,
  source: PluginSource
):
  | {
      readonly source: { readonly kind: 'project'; readonly dir: string };
      readonly main: string;
      readonly styles?: PluginStyles;
    }
  | { readonly source: { readonly kind: 'builtin' }; readonly builtin: BuiltinDelivery }
  | { ok: false; problem: PluginProblem } {
  if (source.kind === 'builtin') {
    if (fields.main !== undefined) {
      return problem(
        'manifest-invalid',
        'у встроенного плагина не бывает поля «main»: его код приезжает вместе с оболочкой, ' +
          'и грузить из каталога нечего',
        { file: PLUGIN_MANIFEST_FILE }
      );
    }
    const builtin = parseBuiltin(fields.builtin);
    if ('ok' in builtin) return builtin;
    return { source, builtin: builtin.builtin };
  }

  if (fields.builtin !== undefined) {
    return problem(
      'manifest-invalid',
      'поле «builtin» объявляет способ доставки встроенного плагина, и у плагина каталога ' +
        'его быть не может: как он приезжает, решает не он',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const mainRaw = stringField(fields, 'main');
  if (mainRaw === undefined) {
    return problem('manifest-invalid', 'в манифесте нет поля «main» или оно не строка', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  const main = normalizePath(mainRaw);
  if (main === undefined || main === '') {
    return problem(
      'manifest-invalid',
      `точка входа «${mainRaw}» выходит за каталог плагина: ` +
        'загрузчик читает только его собственные файлы',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const styles = parseStyles(fields.styles);
  if (styles !== undefined && 'ok' in styles) return styles;

  return { source, main, ...(styles === undefined ? {} : { styles: styles.styles }) };
}

/**
 * Разбирает способ доставки встроенного.
 *
 * Причина обязательна у СТАТИЧЕСКОГО и запрещена у ленивого. Ленивость — умолчание, и её
 * объяснять нечем; а статический плагин утяжеляет стартовый граф, и запись без довода через
 * полгода не отличить от забытой. Это единственное место, где манифест требует прозы,
 * и требует он её ровно там, где без неё принимается молчаливое решение.
 */
function parseBuiltin(
  raw: unknown
): { builtin: BuiltinDelivery } | { ok: false; problem: PluginProblem } {
  const fields = objectFields(raw);
  if (fields === undefined) {
    return problem(
      'manifest-invalid',
      'в манифесте встроенного плагина нет поля «builtin» или оно не объект: ' +
        'способ доставки читается ДО загрузки кода и умолчания не имеет',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const loading = stringField(fields, 'loading');
  if (loading !== 'eager' && loading !== 'lazy') {
    return problem(
      'manifest-invalid',
      `«builtin.loading» должен быть «eager» или «lazy», а не «${loading ?? ''}»`,
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const reason = stringField(fields, 'reason');
  if (loading === 'eager' && reason === undefined) {
    return problem(
      'manifest-invalid',
      'статический плагин обязан объяснить себя полем «builtin.reason»: он едет в стартовом ' +
        'графе, и запись без довода через полгода не отличить от забытой',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }
  if (loading === 'lazy' && reason !== undefined) {
    return problem(
      'manifest-invalid',
      'у ленивого плагина «builtin.reason» лишний: ленивость — умолчание, объяснять надо ' +
        'отступление от него',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  return { builtin: { loading, ...(reason === undefined ? {} : { reason }) } };
}

/**
 * Разбирает `provides` — список объявленных возможностей.
 *
 * Версия здесь обязана быть ВЕРСИЕЙ, а не диапазоном: `provides` говорит, что у плагина есть,
 * и «у меня есть ^1» не значит ничего. Отказ, а не приведение: диапазон в этом поле почти
 * наверняка означает, что автор перепутал его с `requires`, и молчаливое «возьмём нижнюю
 * границу» спрятало бы ошибку до первого несовпадения у потребителя.
 *
 * Повтор идентификатора — тоже отказ. Две версии одной возможности у одного плагина
 * невыразимы: слот в реестре служб один, и вторая запись просто не значила бы ничего.
 */
function parseProvides(
  raw: unknown
):
  | { provides: readonly CapabilityDeclaration[] }
  | { ok: false; problem: PluginProblem }
  | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    return problem('manifest-invalid', 'поле «provides» должно быть массивом', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }

  const parsed: CapabilityDeclaration[] = [];
  const seen = new Set<string>();
  for (const [index, item] of raw.entries()) {
    const at = `provides[${String(index)}]`;
    const fields = objectFields(item);
    if (fields === undefined) {
      return problem('manifest-invalid', `${at} должен быть объектом`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }

    const id = stringField(fields, 'id');
    if (id === undefined) {
      return problem('manifest-invalid', `в ${at} нет поля «id» или оно не строка`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }
    if (seen.has(id)) {
      return problem(
        'manifest-invalid',
        `${at}: возможность «${id}» объявлена дважды. Слот в реестре служб один, ` +
          'и вторая версия не значила бы ничего',
        { file: PLUGIN_MANIFEST_FILE }
      );
    }

    const version = stringField(fields, 'version');
    if (version === undefined || parseVersion(version) === undefined) {
      return problem(
        'manifest-invalid',
        `${at}: «version» должна быть версией вида «1.0.0», а не «${version ?? ''}». ` +
          'Диапазон здесь недопустим: «provides» говорит, что ЕСТЬ, а не что требуется',
        { file: PLUGIN_MANIFEST_FILE }
      );
    }

    seen.add(id);
    parsed.push({ id, version });
  }

  return { provides: parsed };
}

/**
 * Разбирает `requires` — два списка требований.
 *
 * Оба списка необязательны, но само поле, если оно есть, обязано быть объектом с этими двумя
 * именами: `requires: ["reformer.kit.catalog"]` — частая догадка автора, и отвергнуть её внятно дешевле,
 * чем позволить ей молча не сработать.
 */
function parseRequires(
  raw: unknown
): { requires: PluginRequirements } | { ok: false; problem: PluginProblem } | undefined {
  if (raw === undefined || raw === null) return undefined;
  const fields = objectFields(raw);
  if (fields === undefined) {
    return problem(
      'manifest-invalid',
      'поле «requires» должно быть объектом с полями «required» и «optional»',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const required = parseRequirementList(fields.required, 'requires.required');
  if ('ok' in required) return required;
  const optional = parseRequirementList(fields.optional, 'requires.optional');
  if ('ok' in optional) return optional;

  return { requires: { required: required.items, optional: optional.items } };
}

/** Один список требований. `undefined` и `null` — пустой список, а не отказ. */
function parseRequirementList(
  raw: unknown,
  at: string
): { items: readonly CapabilityRequirement[] } | { ok: false; problem: PluginProblem } {
  if (raw === undefined || raw === null) return { items: [] };
  if (!Array.isArray(raw)) {
    return problem('manifest-invalid', `поле «${at}» должно быть массивом`, {
      file: PLUGIN_MANIFEST_FILE,
    });
  }

  const items: CapabilityRequirement[] = [];
  for (const [index, item] of raw.entries()) {
    const where = `${at}[${String(index)}]`;
    const fields = objectFields(item);
    if (fields === undefined) {
      return problem('manifest-invalid', `${where} должен быть объектом`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }

    const id = stringField(fields, 'id');
    if (id === undefined) {
      return problem('manifest-invalid', `в ${where} нет поля «id» или оно не строка`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }

    const range = stringField(fields, 'range');
    if (range === undefined || parseRange(range) === undefined) {
      return problem(
        'manifest-invalid',
        `${where}: «range» должен быть диапазоном вида «^1», «~1.2», «>=1.0.0» или «*», ` +
          `а не «${range ?? ''}». Составные диапазоны и пререлизы не поддерживаются`,
        { file: PLUGIN_MANIFEST_FILE }
      );
    }

    items.push({ id, range });
  }

  return { items };
}

/** Объект JSON без массивов и `null`. Возвращает `undefined`, если это не он. */
function objectFields(raw: unknown): Record<string, unknown> | undefined {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return undefined;
  return raw as Record<string, unknown>;
}

/**
 * Разбирает поле `contributes`. `undefined` — поля нет, и это норма.
 *
 * Форма та же, что у {@link parseStyles}, и код проблемы тот же (`manifest-invalid`): строке
 * списка плагинов незачем различать «сломаны стили» и «сломаны клавиши» — ей нужно знать,
 * что чинить, а это уже в сообщении.
 */
function parseContributes(
  raw: unknown
): { contributes: PluginContributes } | { ok: false; problem: PluginProblem } | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return problem('manifest-invalid', 'поле «contributes» должно быть объектом', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }

  const keybindings = parseKeybindings((raw as Record<string, unknown>).keybindings);
  if (keybindings !== undefined && 'ok' in keybindings) return keybindings;

  const messages = parseMessages((raw as Record<string, unknown>).messages);
  if (messages !== undefined && 'ok' in messages) return messages;

  return {
    contributes: {
      ...(keybindings === undefined ? {} : { keybindings: keybindings.keybindings }),
      ...(messages === undefined ? {} : { messages: messages.messages }),
    },
  };
}

/**
 * Разбирает `contributes.messages`.
 *
 * Проверяется только ФОРМА объявления: объект, непустое имя локали, путь, не выводящий
 * за каталог плагина (тем же `normalizePath`, что у точки входа и стилей). Содержимое файла
 * здесь не смотрят вовсе — его читает загрузчик, и отказ у него свой (`messages-invalid`).
 * Разделение не формальное: разбор манифеста обязан оставаться чтением ОДНОГО файла, иначе
 * список плагинов открывался бы со скоростью чтения всех словарей всех найденных плагинов.
 */
function parseMessages(
  raw: unknown
):
  | { messages: Readonly<Record<string, string>> }
  | { ok: false; problem: PluginProblem }
  | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return problem(
      'manifest-invalid',
      'поле «contributes.messages» должно быть объектом «локаль → путь к файлу словаря»',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const parsed: Record<string, string> = {};
  for (const [locale, value] of Object.entries(raw as Record<string, unknown>)) {
    if (locale.trim() === '') {
      return problem('manifest-invalid', 'в «contributes.messages» есть пустое имя локали', {
        file: PLUGIN_MANIFEST_FILE,
      });
    }
    const at = `contributes.messages[«${locale}»]`;
    if (typeof value !== 'string' || value.trim() === '') {
      return problem('manifest-invalid', `${at}: путь к словарю должен быть непустой строкой`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }
    const file = normalizePath(value.trim());
    if (file === undefined || file === '') {
      return problem('manifest-invalid', `${at}: словарь «${value}» выходит за каталог плагина`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }
    parsed[locale] = file;
  }

  return { messages: parsed };
}

/**
 * Разбирает `contributes.keybindings`.
 *
 * **Неразбираемое сочетание или условие — отказ манифеста, а не пропуск записи.** Довод тот
 * же, по которому реестр команд проверяет их на регистрации: клавиша с испорченным описанием
 * не сработает никогда, и узнавать об этом в день нажатия — самая дорогая из поломок, потому
 * что она молчит. Отказ манифеста человек видит в списке плагинов сразу.
 */
function parseKeybindings(
  raw: unknown
):
  | { keybindings: readonly DeclaredKeybinding[] }
  | { ok: false; problem: PluginProblem }
  | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) {
    return problem('manifest-invalid', 'поле «contributes.keybindings» должно быть массивом', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }

  const parsed: DeclaredKeybinding[] = [];
  for (const [index, item] of raw.entries()) {
    const at = `contributes.keybindings[${String(index)}]`;
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      return problem('manifest-invalid', `${at} должен быть объектом`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }
    const fields = item as Record<string, unknown>;

    const command = stringField(fields, 'command');
    if (command === undefined) {
      return problem('manifest-invalid', `в ${at} нет поля «command» или оно не строка`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }

    const key = stringField(fields, 'key');
    if (key === undefined) {
      return problem('manifest-invalid', `в ${at} нет поля «key» или оно не строка`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }
    try {
      normalizeChord(key);
    } catch (cause) {
      return problem('manifest-invalid', `${at}: сочетание «${key}» разобрать нельзя`, {
        file: PLUGIN_MANIFEST_FILE,
        cause,
      });
    }

    const when = stringField(fields, 'when');
    if (when !== undefined) {
      const result = parseWhen(when);
      if (!result.ok) {
        return problem('manifest-invalid', `${at}: ${result.error.message}`, {
          file: PLUGIN_MANIFEST_FILE,
        });
      }
    }

    const allowInEditable = fields.allowInEditable;
    if (allowInEditable !== undefined && typeof allowInEditable !== 'boolean') {
      return problem('manifest-invalid', `${at}: «allowInEditable» должно быть булевым`, {
        file: PLUGIN_MANIFEST_FILE,
      });
    }

    parsed.push({
      command,
      key,
      ...(when === undefined ? {} : { when }),
      ...(fields.args === undefined ? {} : { args: fields.args }),
      ...(allowInEditable === undefined ? {} : { allowInEditable }),
    });
  }

  return { keybindings: parsed };
}

/**
 * Разбирает поле `styles`. `undefined` — поля нет, и это норма, а не упущение.
 *
 * Путь нормализуется тем же `normalizePath`, что и точка входа, и по той же причине:
 * `../../theme.css` был бы чтением из чужого места, а не стилями плагина.
 */
function parseStyles(
  raw: unknown
): { styles: PluginStyles } | { ok: false; problem: PluginProblem } | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    return problem('manifest-invalid', 'поле «styles» должно быть объектом', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  const fields = raw as Record<string, unknown>;
  const fileRaw = stringField(fields, 'file');
  if (fileRaw === undefined) {
    return problem('manifest-invalid', 'в «styles» нет поля «file» или оно не строка', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  const file = normalizePath(fileRaw);
  if (file === undefined || file === '') {
    return problem('manifest-invalid', `таблица стилей «${fileRaw}» выходит за каталог плагина`, {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  const isolation = stringField(fields, 'isolation') ?? 'scoped';
  if (isolation !== 'scoped') {
    return problem(
      'manifest-invalid',
      `«styles.isolation»: «${isolation}» не поддерживается, возможно только «scoped». ` +
        'Неизолированный чужой CSS перекрашивает оболочку — это не режим, а поломка',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }
  return { styles: { file, isolation } };
}
