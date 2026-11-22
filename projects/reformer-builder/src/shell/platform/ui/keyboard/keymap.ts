/**
 * Раскладка приложения: кто даёт правила клавиш и какое из них выигрывает.
 *
 * ## Зачем отдельная служба, если правила выводятся из команд
 *
 * Потому что источников больше одного, и это не «на будущее». Команда объявляет своё
 * сочетание сама, но рядом обязаны встать правила из манифеста плагина (их видно ДО того,
 * как плагин включён) и правила человека (они старше всех). Три источника с разным временем
 * жизни, сходящиеся в один указатель, — это и есть служба, а не функция.
 *
 * ## Указатель пересобирается ЛЕНИВО
 *
 * Активация одного плагина регистрирует до двух десятков команд одним синхронным проходом.
 * Жадная пересборка означала бы двадцать полных пересборок за время запуска — по одной на
 * каждую команду. Поэтому изменение только помечает указатель устаревшим, а собирается он
 * при первом чтении. Тот же приём и тот же довод, что у снимка реестра команд.
 *
 * Обратная сторона — забытый сброс метки: клавиша молча перестаёт работать после включения
 * плагина. Отказ был бы невидимым, поэтому его стережёт пара тестов: один считает число
 * сборок, другой проверяет содержимое после регистрации.
 *
 * Объявление службы раскладки и токен живут в пакете `@reformer/builder-plugin-api`.
 *
 * @module shell/platform/ui/keyboard/keymap
 */

import type { CommandRegistry } from '@reformer/builder-plugin-api/internal';
import { normalizeChord, whenOf } from '@reformer/builder-plugin-api/internal';
import type { SettingsService } from '@reformer/builder-plugin-api/internal';
import { parseWhen, WHEN_TRUE, type WhenExpr } from '@reformer/builder-plugin-api/internal';
import { toDisposable, type Disposable } from '@reformer/builder-plugin-api/internal';
import {
  buildKeybindingIndex,
  findConflicts,
  rulesFromCommands,
  type KeybindingRemoval,
} from './keybinding-rules';
import { type KeybindingConflict } from '@reformer/builder-plugin-api/internal';
import {
  type KeybindingIndex,
  type KeybindingLayer,
  type KeybindingRule,
} from '@reformer/builder-plugin-api/internal';
import {
  detectPlatformModifier,
  type PlatformModifier,
} from '@reformer/builder-plugin-api/internal';
import {
  type ExternalKeybinding,
  type KeymapIssue,
  type KeymapService,
  type UserKeybinding,
} from '@reformer/builder-plugin-api/internal';

/**
 * Ключ раскладки в настройках.
 *
 * Область — `user` (её даёт префикс, см. `scopeForKey`): клавиатура принадлежит человеку,
 * а не проекту. Перенеси мы её в `workspace` — открытие чужого проекта переучивало бы руки.
 *
 * Пространство имён — `host.*`, как у `host.locale`, а не `reformer.*` токена службы ниже:
 * ключ настройки адресует запись в хранилище человека, а не реализацию в реестре.
 */
export const KEYMAP_SETTINGS_KEY = 'host.keymap';

export interface KeymapDeps {
  /** Реестр команд в объёме, нужном раскладке: набор и уведомление о его смене. */
  readonly commands: Pick<CommandRegistry, 'getAll' | 'onDidChange'>;
  /**
   * Настройки — источник раскладки человека. Необязательны: без них слой `user` пуст,
   * и это законная сборка (тест, встраивание), а не поломка.
   */
  readonly settings?: Pick<SettingsService, 'get' | 'set' | 'onDidChange'>;
  readonly modifier?: PlatformModifier;
  /**
   * Слой плагина. Композиция знает, кто пришёл из каталога проекта, а кто встроен;
   * оболочка — нет и знать не должна.
   */
  readonly layerOf?: (pluginId: string | undefined) => KeybindingLayer;
  /**
   * Счётчик сборок — только для проверок. Существует потому, что ленивость указателя
   * является ТРЕБОВАНИЕМ, а проверить её снаружи иначе нечем: результат сборки одинаков
   * и при жадной, и при ленивой стратегии, различается только их число.
   */
  readonly onBuild?: () => void;
}

interface Source {
  readonly layer: KeybindingLayer;
  readonly rules: readonly ExternalKeybinding[];
}

/** Разобранная раскладка человека: что применить и что убрать. */
interface ParsedUserKeymap {
  readonly rules: readonly ExternalKeybinding[];
  readonly removals: readonly KeybindingRemoval[];
  readonly issues: readonly KeymapIssue[];
}

/** Значение из настроек — список записей или пусто. Чужая форма трактуется как пусто. */
function readUserKeymap(value: unknown): readonly UserKeybinding[] {
  return Array.isArray(value) ? (value as readonly UserKeybinding[]) : [];
}

/**
 * Разбирает раскладку человека ПОЭЛЕМЕНТНО.
 *
 * Испорченная запись отбрасывается вместе со своей причиной, остальные применяются. Ронять
 * весь список нельзя: в настройках лежит то, что положили прошлые версии приложения, а чинят
 * раскладку именно в приложении — то есть отказ загрузки запер бы человека снаружи. Та же
 * политика, что у списка включённых плагинов.
 */
function parseUserKeymap(entries: readonly UserKeybinding[]): ParsedUserKeymap {
  const rules: ExternalKeybinding[] = [];
  const removals: KeybindingRemoval[] = [];
  const issues: KeymapIssue[] = [];

  entries.forEach((entry, at) => {
    if (typeof entry !== 'object' || entry === null) {
      issues.push({ kind: 'not-an-object', at, message: 'запись раскладки должна быть объектом' });
      return;
    }
    if (typeof entry.key !== 'string' || typeof entry.command !== 'string') {
      issues.push({ kind: 'not-an-object', at, message: 'у записи нет полей «key» и «command»' });
      return;
    }

    let chord: readonly string[];
    try {
      chord = normalizeChord(entry.key);
    } catch (error) {
      issues.push({
        kind: 'invalid-key',
        at,
        message: error instanceof Error ? error.message : `сочетание «${entry.key}» не разбирается`,
      });
      return;
    }

    // Ведущий минус — снятие. Снимается слой строго ниже пользовательского, поэтому другие
    // записи самого человека оно не трогает: их он правит напрямую.
    if (entry.command.startsWith('-')) {
      const target = entry.command.slice(1);
      removals.push({
        chord,
        commandId: target === '' ? null : target,
        layer: 'user',
        seq: at,
      });
      return;
    }

    let when: WhenExpr = WHEN_TRUE;
    if (typeof entry.when === 'string' && entry.when.trim() !== '') {
      const parsed = parseWhen(entry.when);
      if (!parsed.ok) {
        issues.push({ kind: 'invalid-when', at, message: parsed.error.message });
        return;
      }
      when = parsed.expr;
    }

    rules.push({
      chord,
      commandId: entry.command,
      when,
      ...(entry.args === undefined ? {} : { args: entry.args }),
      ...(entry.allowInEditable === undefined ? {} : { allowInEditable: entry.allowInEditable }),
    });
  });

  return { rules, removals, issues };
}

export function createKeymapService(deps: KeymapDeps): KeymapService & Disposable {
  const modifier = deps.modifier ?? detectPlatformModifier();
  const sources = new Map<string, Source>();
  const removals: KeybindingRemoval[] = [];
  const listeners = new Set<() => void>();

  let cached: KeybindingIndex | null = null;
  let cachedConflicts: readonly KeybindingConflict[] | null = null;
  /** Отказы разбора раскладки человека: заполняются той же сборкой, что и указатель. */
  let cachedIssues: readonly KeymapIssue[] = [];

  function invalidate(): void {
    cached = null;
    cachedConflicts = null;
    const errors: unknown[] = [];
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch (error) {
        errors.push(error);
      }
    }
    if (errors.length === 1) throw errors[0];
    if (errors.length > 1) throw new AggregateError(errors, 'ошибки в подписчиках раскладки');
  }

  // Набор команд меняется ПОСЛЕ первого кадра: команды оболочки регистрируются эффектами
  // компонентов, команды плагинов — при активации. Без этой подписки указатель, собранный
  // на первом кадре, навсегда остался бы без них.
  const commandsSubscription = deps.commands.onDidChange(() => {
    invalidate();
  });

  // Раскладка человека меняется из редактора клавиш и, теоретически, из другой вкладки —
  // указатель обязан это заметить, иначе переназначение начнёт работать только после
  // перезапуска.
  const settingsSubscription = deps.settings?.onDidChange((key) => {
    if (key === KEYMAP_SETTINGS_KEY) invalidate();
  });

  function build(): KeybindingIndex {
    deps.onBuild?.();
    const fromCommands = rulesFromCommands(deps.commands.getAll(), {
      whenOf,
      ...(deps.layerOf === undefined ? {} : { layerOf: deps.layerOf }),
    });

    // Раскладка человека разбирается здесь же: её отказы обязаны появляться и исчезать
    // вместе с указателем, а не жить отдельной жизнью.
    const user = parseUserKeymap(readUserKeymap(deps.settings?.get(KEYMAP_SETTINGS_KEY)));
    cachedIssues = user.issues;

    // Внешние правила нумеруются ПОСЛЕ команд, поэтому при полном равенстве всего остального
    // выигрывает пришедшее из файла: человек и манифест — более поздние решения, чем код.
    let next = fromCommands.length;
    const external: KeybindingRule[] = [];
    const allSources: readonly (readonly [string, Source])[] = [
      ...sources,
      ['user', { layer: 'user', rules: user.rules }] as const,
    ];
    for (const [source, entry] of allSources) {
      for (const rule of entry.rules) {
        external.push({
          id: `${source}:${String(next)}`,
          chord: rule.chord,
          commandId: rule.commandId,
          ...(rule.args === undefined ? {} : { args: rule.args }),
          when: rule.when,
          layer: entry.layer,
          ...(rule.pluginId === undefined ? {} : { pluginId: rule.pluginId }),
          allowInEditable: rule.allowInEditable === true,
          seq: next++,
        });
      }
    }

    return buildKeybindingIndex(
      [...fromCommands, ...external],
      [...removals, ...user.removals],
      modifier
    );
  }

  return {
    index(): KeybindingIndex {
      cached ??= build();
      return cached;
    },

    onDidChange(cb: () => void): Disposable {
      listeners.add(cb);
      return toDisposable(() => {
        listeners.delete(cb);
      });
    },

    registerRules(
      source: string,
      layer: KeybindingLayer,
      rules: readonly ExternalKeybinding[]
    ): Disposable {
      const entry: Source = { layer, rules };
      sources.set(source, entry);
      invalidate();
      return toDisposable(() => {
        // Сверяем значение, а не только имя источника: снятие устаревшей подписки не должно
        // уносить правила, зарегистрированные тем же источником позже.
        if (sources.get(source) !== entry) return;
        sources.delete(source);
        invalidate();
      });
    },

    conflicts(): readonly KeybindingConflict[] {
      cachedConflicts ??= findConflicts(this.index());
      return cachedConflicts;
    },

    userRules(): readonly UserKeybinding[] {
      return readUserKeymap(deps.settings?.get(KEYMAP_SETTINGS_KEY));
    },

    async setUserRules(rules: readonly UserKeybinding[]): Promise<void> {
      if (deps.settings === undefined) {
        throw new Error('раскладку некуда записать: служба настроек не передана');
      }
      await deps.settings.set(KEYMAP_SETTINGS_KEY, rules);
    },

    issues(): readonly KeymapIssue[] {
      // Указатель строится при первом чтении, а отказы заполняются той же сборкой: спросить
      // про них раньше, чем собран указатель, — значит получить пустой список вместо правды.
      this.index();
      return cachedIssues;
    },

    dispose(): void {
      commandsSubscription.dispose();
      settingsSubscription?.dispose();
      listeners.clear();
      sources.clear();
    },
  };
}
