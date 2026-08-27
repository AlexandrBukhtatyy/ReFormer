/**
 * Правила формы — валидация, реактивные связи и поведение render-слоя.
 *
 * **Почему отдельно от схемы, а не внутри неё.** `JsonFormSchema` — закрытый контракт
 * `@reformer/renderer-json`: `additionalProperties: false` и на корне, и внутри `meta` (там
 * только `name` и `description`). Положить правила туда нельзя, не расширив контракт рендерера,
 * а его набор операторов закрыт в шести синхронизированных местах. Поэтому правила —
 * САЙДКАР: живут рядом со схемой, сохраняются отдельным файлом.
 *
 * **Почему словарь валидации и поведения чужой.** `ValidationRuleIntent` и `BehaviorIntent`
 * взяты из `@reformer/mcp` (`FormIntent`), а не придуманы заново: там они уже обслуживают
 * генерацию бандла (`buildValidationTs`, `buildBehaviorTs`), проверку циклов (`findCycle`) и
 * кросс-проверки `C1..C9`, и билдер зовёт эти эмиттеры. Второй словарь для того же самого
 * разошёлся бы с первым на первой же правке — и разошёлся бы молча.
 *
 * **А почему render-правила — свои.** Ровно по обратной причине: `renderer.behavior.ts` целиком
 * билдерский. Его печатает `codegen/emit-behavior.ts` (фабрика `createJsonRenderBehavior` с
 * submit-обвязкой), `emit-index.ts` импортирует именно её, а MCP-шный `buildRenderBehaviorTs`
 * билдер не зовёт ни из одного места и умеет только `hideWhen`. Второго словаря здесь не
 * возникает — возникает первый. `VisibilityIntent` из MCP приезжает извне (форма по спеке) и
 * сворачивается в `hideWhen`-вариант на входе, чтобы дальше жил один список.
 *
 * **Что здесь НЕ хранится.** Ни раскладка, ни список полей, ни источники данных: всё это уже
 * есть в схеме, и дублировать его значило бы завести второй источник истины о форме.
 *
 * @module reformer-builder/model/rules
 */

import type {
  BehaviorIntent,
  ValidationRuleIntent,
  VisibilityIntent,
} from '@reformer/mcp/dist/core/generate/form-intent.js';

export type { BehaviorIntent, ValidationRuleIntent, VisibilityIntent };

/**
 * Правило render-слоя: поведение над УЗЛОМ разметки, адресуемым по `selector`.
 *
 * Три вида — ровно те, у которых есть декларативная форма: скрыть узел по условию, повесить
 * обработчик события, дописать пропсы. `renderEffect` / `onInit` / `onMount` / `onUnmount`
 * сознательно оставлены вне словаря: они принимают произвольные замыкания над рефами, и это
 * территория сырого TS в код-вкладке, а не декларатива.
 */
export type RenderRuleIntent =
  | {
      kind: 'hideWhen';
      /** `selector` узла в схеме. */
      selector: string;
      /** Выражение на TS: узел СКРЫТ, когда оно истинно. */
      condition: string;
    }
  | {
      kind: 'onEvent';
      selector: string;
      /** Имя проп-события компонента: `onClick`, `onSubmit`, `onBlur`. */
      event: string;
      /** Тело обработчика на TS — вставляется как есть; аргументы доступны как `args`. */
      body: string;
      async?: boolean;
    }
  | {
      kind: 'patchProps';
      selector: string;
      /**
       * Пропсы, дописываемые узлу. Строка вида `$expr(...)` вставляется ВЫРАЖЕНИЕМ, всё
       * остальное — JSON-литералом: без этого различия `"true"` и `true` неразличимы.
       */
      props: Record<string, unknown>;
    };

/** Виды render-правил — для валидации входа и перечисления в UI. */
export const RENDER_RULE_KINDS = ['hideWhen', 'onEvent', 'patchProps'] as const;

/**
 * Правила открытой формы.
 *
 * Пустой набор — нормальное состояние: форма без правил валидна и генерируется в заглушки с
 * примерами.
 */
export interface FormRules {
  /** Правила валидации по путям модели. */
  validation: ValidationRuleIntent[];
  /** Реактивные связи: computeFrom, enableWhen, copyFrom и остальные восемь видов. */
  behavior: BehaviorIntent[];
  /** Поведение render-слоя по `selector`, а не по пути модели. */
  render: RenderRuleIntent[];
}

/** Пустые правила. Отдельная функция, а не константа: массивы нельзя делить между вкладками. */
export function emptyRules(): FormRules {
  return { validation: [], behavior: [], render: [] };
}

/** Есть ли хоть одно правило — для dirty-индикации. */
export function hasRules(rules: FormRules | undefined): boolean {
  if (!rules) return false;
  return rules.validation.length > 0 || rules.behavior.length > 0 || rules.render.length > 0;
}

/**
 * Вопрос «эмитить заглушку или содержимое» задаётся ПОФАЙЛОВО, а не набору целиком.
 *
 * Общий `hasRules` на этом месте давал молчаливую потерю: одно правило видимости — и
 * `validation.ts` уезжал пользователю пустым «правил в intent не было», хотя заглушка вывела бы
 * `required` из `componentProps.required`. То есть форма переставала проверять то, что проверяла,
 * и узнать об этом можно было только сабмитом.
 */
export function hasValidationRules(rules: FormRules | undefined): boolean {
  return (rules?.validation.length ?? 0) > 0;
}

/** @see hasValidationRules — тот же приём для `form.behavior.ts`. */
export function hasBehaviorRules(rules: FormRules | undefined): boolean {
  return (rules?.behavior.length ?? 0) > 0;
}

/** @see hasValidationRules — тот же приём для `renderer.behavior.ts`. */
export function hasRenderRules(rules: FormRules | undefined): boolean {
  return (rules?.render.length ?? 0) > 0;
}

/** Свернуть `VisibilityIntent` (словарь MCP, один вид) в render-правило. */
export function renderRuleFromVisibility(v: VisibilityIntent): RenderRuleIntent {
  return { kind: 'hideWhen', selector: v.selector, condition: v.condition };
}

/** Развернуть обратно — для вызовов, которым нужен словарь MCP (`normalizeIntent`, cross-check). */
export function visibilityFromRules(rules: FormRules): VisibilityIntent[] {
  return rules.render
    .filter((r): r is Extract<RenderRuleIntent, { kind: 'hideWhen' }> => r.kind === 'hideWhen')
    .map((r) => ({ selector: r.selector, condition: r.condition }));
}

/** Форма записи правил до появления `render` — читается, но не пишется. */
interface LegacyRules {
  validation?: unknown;
  behavior?: unknown;
  render?: unknown;
  visibility?: unknown;
}

/**
 * Прочитать правила из внешнего источника — черновика IndexedDB или чужого JSON.
 *
 * Нужна ровно из-за одного перехода: записи, сделанные до появления `render`, несут `visibility`.
 * Отбросить их значило бы молча потерять правила видимости у пользователя, который просто
 * перезагрузил страницу, — поэтому они сворачиваются, а не игнорируются. Неизвестная форма
 * читается как «правил нет», а не как повреждённая запись: черновик обязан открыться.
 */
export function readRules(raw: unknown): FormRules {
  if (!raw || typeof raw !== 'object') return emptyRules();
  const src = raw as LegacyRules;
  const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

  const legacy = arr<VisibilityIntent>(src.visibility)
    .filter((v) => v && typeof v.selector === 'string')
    .map(renderRuleFromVisibility);

  return {
    validation: arr<ValidationRuleIntent>(src.validation),
    behavior: arr<BehaviorIntent>(src.behavior),
    render: [...legacy, ...arr<RenderRuleIntent>(src.render)],
  };
}
