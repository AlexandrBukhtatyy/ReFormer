/**
 * Реестр компонентов и источников — РЕШЕНИЯ, уже принятые, разложенные для шаблона.
 *
 * ## Что здесь и почему именно здесь
 *
 * Всё, что делает этот модуль, — решает: какой символ кита отвечает имени из схемы, кому шима
 * не будет и с какой формулировкой это сказать человеку, какие символы попадут в импорт и в
 * каком порядке. Ни одно из этих решений шаблон принять не может: он не знает ни каталога кита,
 * ни того, что «нужен шим, но адаптера нет» — не то же самое, что «компонента нет».
 *
 * Шаблону остаётся раскладка: четыре условные строки импорта и три цикла. И это ровно то, что
 * человек в `registry.ts` меняет чаще всего, — поэтому оно и должно быть в шаблоне.
 *
 * @module reformer-builder/lib/codegen/view/registry
 */

import { resolveComponent } from '../components';
import type { EmitContext } from '../context';
import { STEP_NAME, wizardShimOf } from './wizard';

/** Одна привязка `$component` к реализации. */
export interface RegistryComponentView {
  /** Имя из схемы — оно же ключ регистрации. */
  readonly name: string;
  /** Символ кита; `null` у заглушки. */
  readonly symbol: string | null;
  readonly placeholder: boolean;
  /** Почему заглушка. Есть ровно тогда, когда `placeholder`. */
  readonly reason?: string;
}

/** Реестр глазами шаблона. */
export interface RegistryView {
  /** Символ обёртки поля из `infra` кита. */
  readonly fieldWrapper: string;
  /** Символы для импорта из кита: без повторов, по алфавиту, вместе с обёрткой поля. */
  readonly kitSymbols: readonly string[];
  readonly components: readonly RegistryComponentView[];
  /** Имена источников в порядке классов: списки, скаляры, подписи. */
  readonly dataSourceNames: readonly string[];
  /** Нужна ли декларация заглушки и импорт `ReactNode` под неё. */
  readonly hasPlaceholder: boolean;
}

export function registryView(ctx: EmitContext): RegistryView {
  const { collected, kit } = ctx;
  const fieldWrapper = kit.kit.infra.fieldWrapper;
  const shim = wizardShimOf(ctx);
  const shimmed = new Set<string>(
    shim === null ? [] : [...shim.hostNames, ...(shim.hasStep ? [STEP_NAME] : [])]
  );

  // Имя, которому нужен шим, но шима не будет (кит без адаптера визарда), — заглушка
  // с внятной причиной, а не импорт из чужого пакета.
  const components: RegistryComponentView[] = collected.components
    .filter((name) => !shimmed.has(name))
    .map((name) => resolveComponent(name, kit))
    .map((r) =>
      r.shim
        ? {
            name: r.name,
            symbol: null,
            placeholder: true,
            reason: `кит «${kit.kit.label}» не поставляет адаптер для этого компонента`,
          }
        : {
            name: r.name,
            symbol: r.symbol,
            placeholder: r.placeholder,
            ...(r.reason === undefined ? {} : { reason: r.reason }),
          }
    );

  const kitSymbols = new Set<string>([fieldWrapper]);
  for (const c of components) if (c.symbol !== null) kitSymbols.add(c.symbol);

  return {
    fieldWrapper,
    kitSymbols: [...kitSymbols].sort(),
    components,
    dataSourceNames: [
      ...[...collected.ds.optionLike].sort(),
      ...[...collected.ds.scalarLike].sort(),
      ...[...collected.ds.functionLike].sort(),
    ],
    hasPlaceholder: components.some((c) => c.placeholder),
  };
}
