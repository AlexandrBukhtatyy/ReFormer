/**
 * Шим визарда: нужен ли он форме, каким символом и откуда его импортировать.
 *
 * Текст файла `renderer.wizard.tsx` печатает `templates/wizard.eta`; здесь остаётся РЕШЕНИЕ,
 * которое шаблон принять не может, — оно же служит предикатом `applies` у цели генерации.
 *
 * ## Зачем он вообще
 *
 * Кит компонент под `$component(Wizard)` не экспортирует: его `FormWizard` не умеет ни
 * JSON-шаги, ни рендер `RenderNode`, поэтому переходник пишет приложение — канон раскладки
 * держит под него опциональный файл `renderer.wizard.tsx`. Пока этого файла у кодогена не было,
 * экспорт визарда печатал `reg.component('Wizard', Placeholder)`, и выгруженная форма не
 * работала: шаги не рисовались, submit было некому послать.
 *
 * ## Что изменилось против v1
 *
 * Символ и его subpath берутся из `kit.adapters.wizard`, а не зашиты как
 * `@reformer/ui-kit/form-wizard`. Отсюда же следует новое честное поведение: **кит без адаптера
 * визарда шима не получает** — файл не печатается, а `registry.ts` регистрирует заглушку
 * с внятной причиной. Раньше в этом случае печатался импорт из чужого пакета, и форма
 * не собиралась у пользователя.
 *
 * @module reformer-builder/lib/codegen/view/wizard
 */

import { isStepsHostName } from '../../form-model/node-kind';
import type { EmitContext } from '../context';

/** Имя, под которым в схеме лежит тело шага. */
export const STEP_NAME = 'Step';

/** Что именно уедет в шим и под какими именами он регистрируется. */
export interface WizardShim {
  /** Имена из схемы, которые обслуживает компонент `Wizard` шима. */
  readonly hostNames: readonly string[];
  /** Есть ли в схеме узел тела шага. */
  readonly hasStep: boolean;
  /**
   * Имя компонента тела шага — им шим объявляет экспорт, а реестр его регистрирует.
   *
   * В виде, а не литералом в шаблоне: разойдись эти два места, шим экспортировал бы
   * одно имя, а `registry.ts` регистрировал другое — форма собралась бы и не заработала.
   */
  readonly stepName: string;
  /** Символ компонента визарда в ките. */
  readonly symbol: string;
  /** Откуда его импортировать (спецификатор с учётом subpath). */
  readonly importFrom: string;
}

/**
 * Нужен ли форме шим визарда и можно ли его напечатать.
 *
 * `null` в двух разных случаях, и различать их вызывающему не нужно: визарда в схеме нет
 * либо кит не поставляет адаптера. В обоих случаях файла не будет, а разницу объясняет
 * `registry.ts` — там она видна на месте регистрации.
 */
export function wizardShimOf(ctx: EmitContext): WizardShim | null {
  const adapter = ctx.kit.kit.adapters.wizard;
  if (adapter === null || adapter === undefined) return null;

  const needsShim = ctx.kit.kit.codegen.needsShim;
  const hostNames = ctx.collected.components.filter(
    (name) => isStepsHostName(name) && needsShim.has(name)
  );
  if (hostNames.length === 0) return null;

  const specifier = ctx.kit.kit.codegen.importSpecifier;
  return {
    hostNames,
    hasStep: ctx.collected.components.includes(STEP_NAME),
    stepName: STEP_NAME,
    symbol: adapter.symbol,
    importFrom: adapter.subpath === undefined ? specifier : `${specifier}/${adapter.subpath}`,
  };
}
