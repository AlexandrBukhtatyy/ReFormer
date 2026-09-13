/**
 * Правило клавиатуры как данные и указатель «сочетание → правила».
 *
 * ## Правило, а не команда
 *
 * До этого модуля вопрос «какая команда сработает» решался перебором всего реестра команд
 * с проверками внутри. У такого устройства два следствия, и оба неприятные: перебор идёт на
 * каждое похожее на сочетание нажатие, а при совпадении сочетаний выигрывает первая
 * зарегистрированная — то есть исход зависит от порядка активации плагинов, который по
 * контракту рантайма не значит ничего.
 *
 * Здесь привязка становится отдельной вещью: {@link KeybindingRule}. У неё есть слой, условие
 * и порядковый номер, поэтому «кто выигрывает» — это сортировка, а не случайность. И она
 * может прийти не только от команды: из манифеста плагина, из раскладки пользователя.
 *
 * ## Порядок разрешения: слой → специфичность → порядок
 *
 * 1. **Слой.** `user` выше всех: переназначение, проигравшее более специфичному правилу
 *    плагина, было бы переназначением, которое не сработало, — и объяснить это человеку нечем.
 * 2. **Специфичность условия** (см. `primitives/when-expr`): кто точнее назвал место, тот и
 *    прав. Это машинное выражение привычки «ближний контекст важнее» из WebStorm.
 * 3. **Порядок.** Последний зарегистрированный. Осознанно последний критерий: он и есть та
 *    случайность, от которой уходим, и доходить до него должны только неразличимые правила.
 *
 * Сортировка считается ОДИН раз при сборке указателя, а не на нажатии.
 *
 * Правило, слой и индекс живут в пакете `@reformer/builder-plugin-api`; здесь — сборка индекса
 * из команд, применение снятий и поиск конфликтов.
 *
 * @module shell/platform/ui/keyboard/keybinding-rules
 */

import type { KeybindingConflict } from '@reformer/builder-plugin-api/internal';
import { normalizeChord } from '@reformer/builder-plugin-api/internal';
import { provablyDisjoint, WHEN_TRUE, type WhenExpr } from '@reformer/builder-plugin-api/internal';
import { resolvePlatformChord } from './keybindings';
import { type PlatformModifier } from '@reformer/builder-plugin-api/internal';
import {
  type KeybindingIndex,
  type KeybindingLayer,
  type KeybindingRule,
} from '@reformer/builder-plugin-api/internal';

export const LAYER_RANK: Readonly<Record<KeybindingLayer, number>> = Object.freeze({
  host: 0,
  'builtin-plugin': 1,
  'catalog-plugin': 2,
  user: 3,
});

/**
 * Правило-снятие: само не срабатывает, а убирает совпадающие правила слоёв не выше своего.
 *
 * Адресуется парой «сочетание + команда», как в VS Code, и это правильная форма: снятие по
 * одному сочетанию убило бы и те привязки, которых человек не видел. Отдельно есть
 * `commandId: null` — «освободить клавишу целиком», когда именно это и нужно.
 */
export interface KeybindingRemoval {
  readonly chord: readonly string[];
  readonly commandId: string | null;
  readonly layer: KeybindingLayer;
  readonly seq: number;
}

/** Пустой результат: одна замороженная ссылка вместо нового массива на каждый промах. */
const NO_RULES: readonly KeybindingRule[] = Object.freeze([]);

/**
 * Сравнение правил: слой, затем специфичность, затем порядок.
 *
 * Экспортируется ради проверок: правило разрешения — самая несущая вещь модуля, и
 * сравнивать его лучше напрямую, чем через собранный указатель.
 */
export function compareRules(a: KeybindingRule, b: KeybindingRule): number {
  return (
    LAYER_RANK[b.layer] - LAYER_RANK[a.layer] ||
    b.when.specificity - a.when.specificity ||
    b.seq - a.seq
  );
}

function sameChord(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((step, i) => step === b[i]);
}

/**
 * Применяет снятия к набору правил.
 *
 * Снятие действует на слои СТРОГО НИЖЕ своего. Правила того же слоя оно не трогает, и это
 * несущее: раскладку человека правит он сам, и снятие, убирающее его собственную запись,
 * означало бы, что порядок строк в файле важен. Порядок строк в списке настроек — не то,
 * о чём человек должен думать, назначая клавишу.
 */
export function applyRemovals(
  rules: readonly KeybindingRule[],
  removals: readonly KeybindingRemoval[]
): readonly KeybindingRule[] {
  if (removals.length === 0) return rules;
  return rules.filter(
    (rule) =>
      !removals.some(
        (removal) =>
          LAYER_RANK[rule.layer] < LAYER_RANK[removal.layer] &&
          sameChord(rule.chord, removal.chord) &&
          (removal.commandId === null || removal.commandId === rule.commandId)
      )
  );
}

/**
 * Собирает указатель.
 *
 * Ключ — сочетание, УЖЕ разрешённое по платформе: `mod+s` на macOS ложится под `meta+s`.
 * Разрешение делается здесь, а не на нажатии, потому что платформа в течение сессии
 * не меняется, а разворачивать `mod` для каждого правила на каждое нажатие — работа ни за чем.
 */
export function buildKeybindingIndex(
  rules: readonly KeybindingRule[],
  removals: readonly KeybindingRemoval[],
  modifier: PlatformModifier
): KeybindingIndex {
  const resolved: KeybindingRule[] = [];
  for (const rule of applyRemovals(rules, removals)) {
    try {
      resolved.push({ ...rule, chord: resolvePlatformChord(rule.chord, modifier) });
    } catch {
      // Неразбираемое сочетание до сюда не доходит: и реестр команд, и разбор манифеста
      // проверяют его раньше. Здесь это защита от правила, собранного в обход обоих.
    }
  }

  const byFirstStep = new Map<string, KeybindingRule[]>();
  const prefixes = new Set<string>();
  for (const rule of resolved) {
    const first = rule.chord[0];
    if (first === undefined) continue;
    const bucket = byFirstStep.get(first) ?? [];
    bucket.push(rule);
    byFirstStep.set(first, bucket);
    if (rule.chord.length > 1) prefixes.add(first);
  }
  for (const bucket of byFirstStep.values()) bucket.sort(compareRules);

  const frozen: readonly KeybindingRule[] = Object.freeze([...resolved].sort(compareRules));

  return {
    rulesFor: (binding) =>
      (byFirstStep.get(binding) ?? NO_RULES).filter((rule) => rule.chord.length === 1),
    isChordPrefix: (binding) => prefixes.has(binding),
    rulesAfter(prefix, binding) {
      const first = prefix[0];
      if (first === undefined) return NO_RULES;
      return (byFirstStep.get(first) ?? NO_RULES).filter(
        (rule) =>
          rule.chord.length === prefix.length + 1 &&
          prefix.every((step, i) => rule.chord[i] === step) &&
          rule.chord[prefix.length] === binding
      );
    },
    all: () => frozen,
  };
}

/** Объявление команды в объёме, из которого получается правило. */
export interface RuleSourceCommand {
  readonly id: string;
  readonly keybinding?: string;
  readonly when?: string;
  readonly pluginId?: string;
  readonly allowInEditable?: boolean;
}

export interface RulesFromCommandsOptions {
  /** Условие команды, уже разобранное. Отдельным входом, чтобы модуль не разбирал строки сам. */
  readonly whenOf: (command: RuleSourceCommand) => WhenExpr;
  /**
   * Слой команды. Композиция знает, какой плагин пришёл из каталога, а какой встроен;
   * оболочка — нет и знать не должна.
   */
  readonly layerOf?: (pluginId: string | undefined) => KeybindingLayer;
  /** С какого номера нумеровать. Нужен, когда правила собираются из нескольких источников. */
  readonly startSeq?: number;
}

/** Слой по умолчанию: без владельца — оболочка, с владельцем — встроенный плагин. */
function defaultLayerOf(pluginId: string | undefined): KeybindingLayer {
  return pluginId === undefined ? 'host' : 'builtin-plugin';
}

/**
 * Превращает команды с сочетаниями в правила.
 *
 * Команда без условия получает {@link WHEN_TRUE} и специфичность ноль — то есть ведёт себя
 * ровно как до появления правил. Обратная совместимость держится на этой одной строке.
 */
export function rulesFromCommands(
  commands: readonly RuleSourceCommand[],
  options: RulesFromCommandsOptions
): readonly KeybindingRule[] {
  const layerOf = options.layerOf ?? defaultLayerOf;
  const rules: KeybindingRule[] = [];
  let seq = options.startSeq ?? 0;

  for (const command of commands) {
    if (command.keybinding === undefined) continue;
    let chord: readonly string[];
    try {
      chord = normalizeChord(command.keybinding);
    } catch {
      // Реестр проверяет сочетание на регистрации и отказал бы раньше.
      continue;
    }
    rules.push({
      id: `command:${command.id}`,
      chord,
      commandId: command.id,
      when: options.whenOf(command) ?? WHEN_TRUE,
      layer: layerOf(command.pluginId),
      ...(command.pluginId === undefined ? {} : { pluginId: command.pluginId }),
      allowInEditable: command.allowInEditable === true,
      seq: seq++,
    });
  }
  return rules;
}

/**
 * Ищет неразрешимые пары.
 *
 * Конфликтом считается пара с ОДИНАКОВЫМ аккордом, ОДНИМ слоем и РАВНОЙ специфичностью,
 * условия которой не доказано непересекаемы. Все три требования обязательны: пара разных
 * слоёв разрешается слоем, пара разной специфичности — специфичностью, а пара с разными
 * значениями одного ключа (`focus == tree` против `focus == canvas`) не пересекается вовсе.
 *
 * Доказательство намеренно неполно (см. `provablyDisjoint`), и ошибается оно в сторону
 * лишнего предупреждения: не доказали непересекаемость — человек увидит строку в редакторе
 * клавиш; «доказали» ошибочно — конфликт пропущен молча, и одна из клавиш не работает
 * без единого следа.
 */
export function findConflicts(index: KeybindingIndex): readonly KeybindingConflict[] {
  const byChord = new Map<string, KeybindingRule[]>();
  for (const rule of index.all()) {
    const key = rule.chord.join(' ');
    const group = byChord.get(key) ?? [];
    group.push(rule);
    byChord.set(key, group);
  }

  const conflicts: KeybindingConflict[] = [];
  for (const group of byChord.values()) {
    if (group.length < 2) continue;
    const found: KeybindingRule[] = [];
    for (let i = 0; i < group.length; i += 1) {
      for (let j = i + 1; j < group.length; j += 1) {
        const [a, b] = [group[i], group[j]];
        if (a.layer !== b.layer) continue;
        if (a.when.specificity !== b.when.specificity) continue;
        if (provablyDisjoint(a.when, b.when)) continue;
        if (!found.includes(a)) found.push(a);
        if (!found.includes(b)) found.push(b);
      }
    }
    if (found.length > 0) {
      const sorted = [...found].sort(compareRules);
      conflicts.push({
        chord: sorted[0].chord,
        rules: sorted,
        winner: sorted[0].id,
      });
    }
  }
  return conflicts;
}
