/**
 * Правила формы — валидация, реактивные связи и условная видимость.
 *
 * **Почему отдельно от схемы, а не внутри неё.** `JsonFormSchema` — закрытый контракт
 * `@reformer/renderer-json`: `additionalProperties: false` и на корне, и внутри `meta` (там
 * только `name` и `description`). Положить правила туда нельзя, не расширив контракт рендерера,
 * а его набор операторов закрыт в шести синхронизированных местах. Поэтому правила —
 * САЙДКАР: живут рядом со схемой, сохраняются отдельным файлом.
 *
 * **Почему словарь чужой.** Типы взяты из `@reformer/mcp` (`FormIntent`), а не придуманы
 * заново. Там они уже обслуживают генерацию бандла, проверку циклов (`findCycle`) и
 * кросс-проверки `C1..C9`; второй словарь для того же самого разошёлся бы с первым на первой
 * же правке — и разошёлся бы молча, потому что оба выглядели бы правильно.
 *
 * **Что здесь НЕ хранится.** Ни раскладка, ни список полей, ни источники данных: всё это уже
 * есть в схеме, и дублировать его значило бы завести второй источник истины о форме. Полный
 * `FormIntent` для генерации собирается из схемы (`codegen/collect`) плюс этих правил.
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
 * Правила открытой формы.
 *
 * Пустой набор — нормальное состояние: форма без правил валидна и генерируется в пустые
 * `validation.ts` / `form.behavior.ts` с примерами, как и сегодня.
 */
export interface FormRules {
  /** Правила валидации по путям модели. */
  validation: ValidationRuleIntent[];
  /** Реактивные связи: computeFrom, enableWhen, copyFrom и остальные восемь видов. */
  behavior: BehaviorIntent[];
  /** Условная видимость узлов render-слоя (по `selector`, а не по пути модели). */
  visibility: VisibilityIntent[];
}

/** Пустые правила. Отдельная функция, а не константа: массивы нельзя делить между вкладками. */
export function emptyRules(): FormRules {
  return { validation: [], behavior: [], visibility: [] };
}

/** Есть ли хоть одно правило — для dirty-индикации и решения «эмитить заглушку или содержимое». */
export function hasRules(rules: FormRules | undefined): boolean {
  if (!rules) return false;
  return rules.validation.length > 0 || rules.behavior.length > 0 || rules.visibility.length > 0;
}
