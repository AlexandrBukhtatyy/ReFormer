/**
 * Полнота словарей: ключ, забытый в одной локали, обязан падать здесь, а не маркером на экране.
 *
 * Проверка живёт ТЕСТОМ, а не отдельным скриптом: прогон тестов и есть CI, а скрипт пришлось бы
 * заводить в `package.json`, помнить про него и запускать вторым проходом. Тест же выполняется
 * тем же `npx vitest run`, которым проверяют всё остальное, и падает в том же отчёте.
 *
 * ## Почему в `app/`, а не рядом со словарём Host
 *
 * Словари везут ВСЕ — и оболочка, и каждый встроенный плагин, — а увидеть их одновременно
 * позволено только композиции: `host/**` не имеет права импортировать `@/plugins/*` (правило
 * линтера `denyFromHost`), и проверка, положенная туда, либо нарушила бы границу слоёв, либо
 * молча проверяла бы одну оболочку. Полнота словарей — свойство СОБРАННОГО приложения, поэтому
 * его место здесь.
 *
 * ## Расхождение в любую сторону — ОТКАЗ, а не предупреждение
 *
 * Соблазн смягчить второй случай («русский основной, английский отстаёт») есть, и он неверен —
 * ровно потому, что резервной локалью выбран английский ({@link FALLBACK_LOCALE}):
 *
 * - **ключа нет в `en`** — падать НЕКУДА. Промах доходит до пользователя маркером `⟦ключ⟧`
 *   и в сборке тоже; «отставание» английского здесь — это не отставание, а дыра в самом дне;
 * - **ключа нет в `ru`** — в разработке маркер (режим нарочно не откатывается, см. `i18n.ts`),
 *   в сборке английская фраза посреди русского интерфейса, и это ОСНОВНАЯ локаль приложения
 *   (`DEFAULT_LOCALE` в `app/boot`).
 *
 * Предупреждение вдобавок не сделало бы работы: `vitest run` печатает `console.warn` в общий
 * поток, где его никто не читает, а зелёный прогон означает «всё в порядке». Проверка,
 * не умеющая уронить сборку, — это комментарий.
 *
 * ## Что ещё проверяется заодно
 *
 * Разбор каждого сообщения и совпадение ИМЁН аргументов между локалями. Первое ловит битый
 * шаблон до того, как он уронит активацию у пользователя (`PluginI18n.contribute` разбирает
 * словарь на регистрации); второе — случай, когда перевод забыл подстановку: ключ на месте,
 * набор совпал, а `{count}` в одной локали превратился в текст без числа. Обе проверки стоят
 * дешевле, чем поиск причины по маркеру на экране.
 *
 * @module shell/boot/integration/i18n-completeness.test
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FALLBACK_LOCALE } from '@/shell/platform/services/i18n/i18n';
import { parseMessage, type MessagePattern } from '@/shell/platform/services/i18n/message-format';
import hostEn from '@/shell/platform/services/i18n/locales/en.json';
import hostRu from '@/shell/platform/services/i18n/locales/ru.json';
import { AI_MESSAGES } from '@/plugins/reformer/ai/messages';
import { CODEGEN_MESSAGES } from '@/plugins/reformer/codegen/messages';
import { MARKDOWN_MESSAGES } from '@/plugins/base/editor-markdown';
import { MONACO_MESSAGES } from '@/plugins/base/editor-monaco/messages';
import { SCHEMA_EDITOR_MESSAGES } from '@/plugins/reformer/editor/messages';
import { FILES_MESSAGES } from '@/plugins/base/files';
import { KITS_MESSAGES } from '@/plugins/kits/registry/messages';
import { PLUGIN_MANAGER_MESSAGES } from '@/plugins/base/plugin-manager';
import { PLAIN_MESSAGES } from '@/plugins/plain/demo/messages';
import { PREVIEW_MESSAGES } from '@/plugins/base/preview/messages';
import { PREVIEW_RUNTIME_MESSAGES } from '@/plugins/reformer/render/messages';
import { RJSF_EDITOR_MESSAGES } from '@/plugins/rjsf/editor/messages';
import { RJSF_RENDER_MESSAGES } from '@/plugins/rjsf/render/messages';
import { TEMPLATES_MESSAGES } from '@/plugins/reformer/templates/messages';

/** Словарь одного владельца: локаль → ключ → сообщение. */
type Dictionary = Readonly<Record<string, Readonly<Record<string, string>>>>;

/**
 * Словарь Host собирается здесь из тех же файлов, которые грузит сам сервис.
 *
 * Список локалей у него явный (`loadBundledHostMessages`), поэтому и здесь он явный: шаблонный
 * `import()` не типизуем, и «автоматически» этот список не получить ни там, ни тут.
 */
const HOST_MESSAGES: Dictionary = { ru: hostRu, en: hostEn };

/**
 * Все словари приложения.
 *
 * Имя владельца плагина — его путь `домен/плагин` в `src/plugins`: по нему отчёт о промахе
 * ведёт прямо к файлу, и по нему же сверка ниже находит плагин со словарём.
 */
const DICTIONARIES: ReadonlyArray<readonly [string, Dictionary]> = [
  ['host', HOST_MESSAGES],
  ['reformer/ai', AI_MESSAGES],
  ['reformer/codegen', CODEGEN_MESSAGES],
  ['base/editor-markdown', MARKDOWN_MESSAGES],
  ['base/editor-monaco', MONACO_MESSAGES],
  ['reformer/editor', SCHEMA_EDITOR_MESSAGES],
  ['base/files', FILES_MESSAGES],
  ['kits/registry', KITS_MESSAGES],
  ['plain/demo', PLAIN_MESSAGES],
  ['base/plugin-manager', PLUGIN_MANAGER_MESSAGES],
  ['base/preview', PREVIEW_MESSAGES],
  ['reformer/render', PREVIEW_RUNTIME_MESSAGES],
  ['reformer/templates', TEMPLATES_MESSAGES],
  ['rjsf/editor', RJSF_EDITOR_MESSAGES],
  ['rjsf/render', RJSF_RENDER_MESSAGES],
];

/** Локали, в которых обязан быть каждый ключ. Резервная — первой, потому что за ней нет никого. */
const REQUIRED_LOCALES: readonly string[] = [FALLBACK_LOCALE, 'ru'];

/** Имена аргументов сообщения, включая те, что встречаются только внутри веток. */
function argumentsOf(pattern: MessagePattern, out = new Set<string>()): Set<string> {
  for (const node of pattern) {
    if (node.kind === 'text') continue;
    out.add(node.name);
    if (node.kind === 'plural' || node.kind === 'select') {
      for (const branch of node.branches.values()) argumentsOf(branch, out);
    }
  }
  return out;
}

/** `владелец · ключ` — адрес, по которому промах ищется в репозитории. */
function address(owner: string, key: string): string {
  return `${owner} · ${key}`;
}

describe('словари: наборы ключей совпадают во всех локалях', () => {
  it.each(DICTIONARIES)('%s', (owner, dictionary) => {
    // Объединение, а не «ключи основной локали»: иначе ключ, существующий ТОЛЬКО в английском,
    // не проверялся бы вовсе — а это ровно тот случай, когда перевод забыли в основную локаль.
    const all = new Set<string>();
    for (const locale of REQUIRED_LOCALES) {
      for (const key of Object.keys(dictionary[locale] ?? {})) all.add(key);
    }

    const missing: string[] = [];
    for (const key of [...all].sort()) {
      for (const locale of REQUIRED_LOCALES) {
        if (dictionary[locale]?.[key] === undefined) {
          missing.push(`${address(owner, key)}: нет в «${locale}»`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it('локалей у каждого словаря ровно столько, сколько умеет приложение', () => {
    const extra: string[] = [];
    for (const [owner, dictionary] of DICTIONARIES) {
      for (const locale of Object.keys(dictionary)) {
        // Лишняя локаль не ошибка сама по себе, но она не проверяется на полноту ничем:
        // список выше её не знает, и её ключи разъедутся молча.
        if (!REQUIRED_LOCALES.includes(locale)) extra.push(`${owner}: локаль «${locale}»`);
      }
    }
    expect(extra).toEqual([]);
  });
});

describe('словари: сообщения разбираются и подставляют одно и то же', () => {
  it.each(DICTIONARIES)('%s', (owner, dictionary) => {
    const broken: string[] = [];
    const patterns = new Map<string, MessagePattern>();

    for (const locale of REQUIRED_LOCALES) {
      for (const [key, message] of Object.entries(dictionary[locale] ?? {})) {
        try {
          patterns.set(`${locale} ${key}`, parseMessage(message));
        } catch (error) {
          broken.push(
            `${address(owner, key)} [${locale}]: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
    }
    expect(broken).toEqual([]);

    // Имена аргументов сверяются с резервной локалью, а не попарно между всеми: пар было бы
    // больше, а адресат один — тот, кто перевёл и потерял подстановку.
    const mismatched: string[] = [];
    for (const locale of REQUIRED_LOCALES) {
      if (locale === FALLBACK_LOCALE) continue;
      for (const key of Object.keys(dictionary[locale] ?? {})) {
        const base = patterns.get(`${FALLBACK_LOCALE} ${key}`);
        const other = patterns.get(`${locale} ${key}`);
        if (base === undefined || other === undefined) continue;
        const expected = [...argumentsOf(base)].sort().join(', ');
        const actual = [...argumentsOf(other)].sort().join(', ');
        if (expected !== actual) {
          mismatched.push(
            `${address(owner, key)}: «${FALLBACK_LOCALE}» ждёт {${expected}}, «${locale}» — {${actual}}`
          );
        }
      }
    }
    expect(mismatched).toEqual([]);
  });
});

describe('словари: список проверяемых не отстаёт от репозитория', () => {
  /**
   * Плагины, у которых есть свой словарь, — по файлам, а не по списку выше.
   *
   * Без этой сверки проверка полноты сама неполна: новый плагин привёз бы словарь, никто бы
   * не вспомнил дописать его сюда, и его локали разъезжались бы ровно так же молча, как
   * разъезжались бы ключи. Признак словаря — каталог `locales/` или модуль `messages.ts`
   * (плагин файлов везёт строки литералами, и каталога у него нет).
   */
  function pluginsWithMessages(): string[] {
    const root = fileURLToPath(new URL('../../../plugins', import.meta.url));
    const found: string[] = [];
    // Плагины разложены по доменам: `plugins/<домен>/<плагин>`. Ядро домена (`core`) плагином
    // не является и словаря не несёт.
    for (const domain of readdirSync(root)) {
      if (!statSync(`${root}/${domain}`).isDirectory()) continue;
      for (const name of readdirSync(`${root}/${domain}`)) {
        const directory = `${root}/${domain}/${name}`;
        if (!statSync(directory).isDirectory()) continue;
        const entries = readdirSync(directory);
        if (entries.includes('locales') || entries.includes('messages.ts')) {
          found.push(`${domain}/${name}`);
        }
      }
    }
    return found.sort();
  }

  it('каждый плагин со словарём попал в проверку', () => {
    const checked = new Set(DICTIONARIES.map(([owner]) => owner));
    const uncovered = pluginsWithMessages().filter((name) => !checked.has(name));
    expect(uncovered).toEqual([]);
  });
});

describe('находки самой платформы переведены словарём оболочки', () => {
  /**
   * Коды находок, которые публикует рабочая область, — по исходникам, а не по списку.
   *
   * У платформы нет плагина-владельца, и её коды переводит только словарь оболочки. Забытый
   * текст не ломает ничего, кроме панели проблем: там вместо фразы стоит маркер
   * `⟦errors.document.parse-failed⟧` — ровно так и было, пока эту проверку не завели.
   */
  function platformDiagnosticCodes(): string[] {
    const root = fileURLToPath(new URL('../../platform/workspace', import.meta.url));
    const codes = new Set<string>();
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = `${dir}/${name}`;
        if (statSync(path).isDirectory()) {
          walk(path);
          continue;
        }
        if (!/\.ts$/.test(name) || /\.test\.ts$/.test(name)) continue;
        const text = readFileSync(path, 'utf8');
        if (!text.includes('Diagnostic')) continue;
        for (const match of text.matchAll(/\bcode: '([^']+)'/g)) codes.add(match[1]!);
      }
    };
    walk(root);
    return [...codes].sort();
  }

  it('у каждого кода есть текст на каждой локали', () => {
    const codes = platformDiagnosticCodes();
    const missing = codes.flatMap((code) =>
      Object.entries(HOST_MESSAGES)
        .filter(([, messages]) => messages[`errors.${code}`] === undefined)
        .map(([locale]) => `${locale}: errors.${code}`)
    );
    expect(missing).toEqual([]);
  });

  it('проверка не пуста: коды платформы найдены', () => {
    expect(platformDiagnosticCodes()).toEqual(
      expect.arrayContaining(['document.parse-failed', 'workspace.import-unresolved'])
    );
  });
});
