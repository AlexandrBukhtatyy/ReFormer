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
 * - **Мажор `apiVersion` совпадает с нашим.** Политику совместимости мы не строим — решено
 *   (plugin-and-shell.md): при расхождении мажора плагин просто не грузится с внятным
 *   сообщением. Диапазон разбирается ровно настолько, чтобы достать из него первое число:
 *   всё, что сложнее, было бы обещанием семантики, которой у нас нет.
 *
 * **Поля `permissions` нет и не будет** — решено там же: включённый плагин может всё, и объявлять
 * намерения полем, которое ничего не принуждает, значит создавать ложное ощущение границы.
 *
 * @module shell/platform/plugin/manifest
 */

import { normalizeChord } from '@/shell/platform/primitives/command';
import { parseWhen } from '@/shell/platform/primitives/when-expr';
import { normalizePath } from '@/shell/platform/modules/linker';

/** Имя файла манифеста внутри каталога плагина. */
export const PLUGIN_MANIFEST_FILE = 'manifest.json';

/** Мажор API плагинов, который понимает эта сборка оболочки. */
export const PLUGIN_API_MAJOR = 1;

/**
 * Разобранный манифест.
 *
 * `name` и `version` необязательны в файле и получают умолчания: они нужны списку плагинов,
 * а не механике, и требовать их значило бы отвергать рабочий плагин из-за подписи. `id`,
 * `main` и `apiVersion` умолчаний не имеют — у них нет осмысленного «по умолчанию».
 */
export interface PluginManifest {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  /** Диапазон API, объявленный плагином, как он написан в файле: `^1`, `1.2`, `~1.0.0`. */
  readonly apiVersion: string;
  /** Точка входа ВНУТРИ каталога плагина, нормализованная: `main.js`, `dist/main.js`. */
  readonly main: string;
  /**
   * Своя таблица стилей. Отсутствие поля — рекомендуемый путь: плагин пользуется классами
   * оболочки и токенами кита и выглядит родным бесплатно.
   */
  readonly styles?: PluginStyles;
  /** Вклады, объявленные ДЕКЛАРАТИВНО — то есть видимые до того, как плагин включён. */
  readonly contributes?: PluginContributes;
}

/**
 * Декларативные вклады манифеста.
 *
 * Пока здесь только клавиши, и они попали сюда по проверяемой причине, а не «для симметрии
 * с VS Code»: сочетание, объявленное КОДОМ, появляется в приложении только после активации
 * плагина. Значит до включения таблица клавиш о нём не знает, и переназначить его нельзя —
 * а человеку это нужно ровно тогда, когда новый плагин занял привычную ему клавишу.
 */
export interface PluginContributes {
  readonly keybindings?: readonly DeclaredKeybinding[];
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
  /** Мажор `apiVersion` не наш: плагин написан против другой оболочки. */
  | 'api-version'
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
  | 'styles-invalid';

/** Отказ как данные. Исключением он не бывает нигде: испорченный каталог — не авария. */
export interface PluginProblem {
  readonly code: PluginProblemCode;
  readonly message: string;
  /** Файл, к которому отнесён отказ, если он известен. Путь внутри каталога плагина. */
  readonly file?: string;
  /** Исходное исключение — для консоли, не для показа. */
  readonly cause?: unknown;
}

/** Результат разбора: либо манифест, либо причина, по которой его нет. */
export type ManifestParseResult =
  | { readonly ok: true; readonly manifest: PluginManifest }
  | { readonly ok: false; readonly problem: PluginProblem };

/**
 * Идентификатор плагина: буквы, цифры, `.`, `_`, `-`, начиная с буквы или цифры.
 *
 * Тот же набор, что у имени каталога, и не шире: `id` попадает в ключи хранилища, в имена
 * вкладов и (позже) в CSS-класс изоляции стилей, поэтому пробел или слэш в нём — источник
 * поломок в трёх местах сразу.
 */
const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]*$/;

/** Первое число диапазона: `^1` → 1, `~1.2.3` → 1, `>=2.0` → 2. */
function majorOf(range: string): number | undefined {
  const found = /^\s*[\^~>=<v\s]*(\d+)/.exec(range);
  if (found === null) return undefined;
  const major = Number.parseInt(found[1], 10);
  return Number.isNaN(major) ? undefined : major;
}

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
 * @param dirName имя каталога плагина — с ним сверяется `id`
 * @param apiMajor мажор API оболочки; параметр ради тестов, умолчание — {@link PLUGIN_API_MAJOR}
 */
export function parsePluginManifest(
  text: string,
  dirName: string,
  apiMajor: number = PLUGIN_API_MAJOR
): ManifestParseResult {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (cause) {
    return problem('manifest-unreadable', `${PLUGIN_MANIFEST_FILE} не разбирается как JSON`, {
      file: PLUGIN_MANIFEST_FILE,
      cause,
    });
  }

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
  if (id !== dirName) {
    return problem(
      'id-mismatch',
      `манифест объявляет «${id}», а каталог называется «${dirName}». ` +
        'Идентификатор — ключ во всех реестрах, и он обязан совпадать с именем каталога: ' +
        'иначе список плагинов и команды перезагрузки говорят о разных вещах',
      { file: PLUGIN_MANIFEST_FILE }
    );
  }

  const apiVersion = stringField(fields, 'apiVersion');
  if (apiVersion === undefined) {
    return problem('manifest-invalid', 'в манифесте нет поля «apiVersion» или оно не строка', {
      file: PLUGIN_MANIFEST_FILE,
    });
  }
  const major = majorOf(apiVersion);
  if (major === undefined) {
    return problem(
      'manifest-invalid',
      `из «apiVersion»: «${apiVersion}» не читается номер версии`,
      { file: PLUGIN_MANIFEST_FILE }
    );
  }
  if (major !== apiMajor) {
    return problem(
      'api-version',
      `плагин написан против API ${major}, а оболочка даёт API ${apiMajor}. ` +
        'Совместимость между мажорами не обещана, поэтому плагин не загружается',
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

  const contributes = parseContributes(fields.contributes);
  if (contributes !== undefined && 'ok' in contributes) return contributes;

  return {
    ok: true,
    manifest: {
      id,
      name: stringField(fields, 'name') ?? id,
      version: stringField(fields, 'version') ?? '0.0.0',
      apiVersion,
      main,
      ...(styles === undefined ? {} : { styles: styles.styles }),
      ...(contributes === undefined ? {} : { contributes: contributes.contributes }),
    },
  };
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
  return {
    contributes: keybindings === undefined ? {} : { keybindings: keybindings.keybindings },
  };
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
