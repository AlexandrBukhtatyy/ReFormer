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
 *   (`normalizeModulePath`), поэтому `../../secrets.ts` отсекается здесь, а не оказывается набором
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
 *   (`application/resolver/capability-resolver` билдера) и каталогом плагинов оболочки, а после активации —
 *   рантаймом плагинов оболочки (он сверяет объявленное с фактически зарегистрированным). Разбор
 *   манифеста обязан оставаться чтением ОДНОГО файла, ничего вокруг себя не зная.
 *
 * **Поля `permissions` нет и не будет** — решено там же: включённый плагин может всё, и объявлять
 * намерения полем, которое ничего не принуждает, значит создавать ложное ощущение границы.
 *
 * ## Почему разбор в пакете контракта
 *
 * Манифест читают ДВОЕ: оболочка, решая, грузить ли плагин, и инструменты автора плагина
 * (`reformer-plugin validate`), решая, пропустить ли его. Два разбора разошлись бы на первой
 * же правке правил, и валидатор пропускал бы плагин, который оболочка отвергнет, — ровно
 * тот отказ, ради предупреждения которого валидатор и нужен. Поэтому разбор один и живёт
 * там, откуда его берут оба: оболочка — входом `./internal`, инструменты — входом `./tooling`.
 *
 * @module @reformer/builder-plugin-api/plugin/manifest-parser
 */

import type { CapabilityDeclaration, CapabilityRequirement } from '../primitives/capability';
import { normalizeChord } from '../primitives/command';
import { parseRange, parseVersion, satisfies } from '../primitives/semver';
import { parseWhen } from '../primitives/when-expr';
import { normalizeModulePath } from '../primitives/module-path';
import {
  BUILDER_API_VERSION,
  PLUGIN_MANIFEST_FILE,
  type BuiltinDelivery,
  type DeclaredKeybinding,
  type ManifestOf,
  type ManifestParseResult,
  type PluginManifestBase,
  type PluginContributes,
  type PluginProblem,
  type PluginProblemCode,
  type PluginRequirements,
  type PluginSource,
  type PluginSourceManifest,
  type PluginStyles,
} from './manifest';

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
  const parsed = parseStage(raw, source, apiVersion);
  if (!parsed.ok) return parsed;
  // Единственное приведение в модуле. Разбор поставки (`parseEntry`) отдаёт ровно тот
  // вариант, о котором его спросили, — но связь «спросили про builtin, получили builtin»
  // выражена ветвлением, а не типом, и вывод её не прослеживает. Проверяется она тестом:
  // манифест каждой поставки разбирается и предъявляет своё поле.
  return { ok: true, manifest: { ...parsed.manifest, source } as ManifestOf<S> };
}

/**
 * Разбирает манифест ИСХОДНИКОВ плагина — тот, что лежит в репозитории автора.
 *
 * Это не третья поставка, а стадия ДО поставки: такой манифест оболочка не читает никогда,
 * его читают инструменты (`reformer-plugin validate`, `build`). Правила — те же самые, одним
 * кодом, и отличий ровно два, оба названы:
 *
 * - **имя каталога не сверяется с `id`.** Репозиторий автора зовётся как угодно (`acme-forms-plugin`),
 *   а каталогом с именем `id` плагин становится только при установке. Сверка возвращается
 *   на выходе сборки: собранный каталог проверяется разбором поставки `project` целиком.
 * - **`version` обязательна и обязана быть версией.** Оболочка подставляет `0.0.0` — ей нужна
 *   подпись в списке, а не номер. Исходники же идут в сборку и упаковку, где версия — это
 *   адрес пакета, и умолчание тихо опубликовало бы `0.0.0`.
 *
 * `main` при этом указывает на исходник (`src/main.ts`), а не на собранный файл: проверяется
 * тем же `normalizeModulePath`, поэтому выход за корень отсекается и здесь.
 */
export function parsePluginSourceManifest(
  text: string,
  apiVersion: string = BUILDER_API_VERSION
): ManifestParseResult<PluginSourceManifest> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return problem('manifest-unreadable', `${PLUGIN_MANIFEST_FILE} не разбирается как JSON`, {
      file: PLUGIN_MANIFEST_FILE,
      cause,
    });
  }
  const parsed = parseStage(raw, { kind: 'source' }, apiVersion);
  if (!parsed.ok) return parsed;

  const version = stringField(raw as Record<string, unknown>, 'version');
  if (version === undefined || parseVersion(version) === undefined) {
    return problem(
      'manifest-invalid',
      `«version» исходников должна быть версией вида «1.0.0», а не «${version ?? ''}»: ` +
        'по ней собирается и публикуется пакет, и умолчания у неё нет',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }
  // У стадии `source` разбор поставки отдаёт точку входа, а не способ доставки; сужение —
  // для вывода типов, ветвь «без main» недостижима.
  const { manifest } = parsed;
  return 'main' in manifest
    ? { ok: true, manifest }
    : problem('manifest-invalid', 'в манифесте нет поля «main» или оно не строка', {
        file: PLUGIN_MANIFEST_FILE,
      });
}

/**
 * Что разбору известно о месте манифеста: поставка оболочки или исходники автора.
 *
 * Внутренний тип: наружу стадия «исходники» выходит отдельной функцией, а не третьим вариантом
 * {@link PluginSource}. Оболочка исходников не видит никогда, и вариант, который каждый её
 * `switch` обязан был бы разбирать ради невозможного случая, был бы ложью в типе.
 */
type ManifestStage = PluginSource | { readonly kind: 'source' };

/** Манифест без `source`: его приписывает тот, кто знает поставку. */
type StagedManifest = PluginManifestBase &
  (
    | { readonly main: string; readonly styles?: PluginStyles }
    | { readonly builtin: BuiltinDelivery }
  );

function parseStage(
  raw: unknown,
  source: ManifestStage,
  apiVersion: string
): { ok: true; manifest: StagedManifest } | { ok: false; problem: PluginProblem } {
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

  return { ok: true, manifest: { ...common, ...entry } };
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
  source: ManifestStage
):
  | { readonly main: string; readonly styles?: PluginStyles }
  | { readonly builtin: BuiltinDelivery }
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
    return { builtin: builtin.builtin };
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
  const main = normalizeModulePath(mainRaw);
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

  return { main, ...(styles === undefined ? {} : { styles: styles.styles }) };
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
    const file = normalizeModulePath(value.trim());
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
  const file = normalizeModulePath(fileRaw);
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
