/**
 * Реестр компонентов и источников — РЕШЕНИЯ, уже принятые, разложенные для шаблона.
 *
 * ## Что здесь и почему именно здесь
 *
 * Всё, что делает этот модуль, — решает: какой символ кита отвечает имени из схемы, чем
 * регистрируется визард и тело шага, кому достанется заглушка и с какой формулировкой это
 * сказать человеку, какие символы попадут в импорт и в каком порядке. Ни одно из этих решений
 * шаблон принять не может: он не знает ни каталога кита, ни того, что «у кита нет адаптера
 * визарда» — не то же самое, что «компонента нет».
 *
 * ## Визард — библиотечный
 *
 * Узел с шагами (`Wizard`, `FormWizard`, `RendererFormWizard`) регистрируется символом
 * `kit.adapters.wizard`: шаги он берёт из узлов-детей, форму и поток — из сборки. Тело шага
 * (`Step`) — из `@reformer/cdk/form-wizard`. Переходника приложения (`wizard.tsx`) больше нет.
 *
 * Кит без адаптера визарда получает заглушку с причиной — и для хозяев шагов, и для `Step`:
 * тело шага без визарда рисовать нечем, а импорт из чужого пакета у пользователя не соберётся.
 *
 * `kit.codegen.needsShim` про визард больше ничего не решает (шима нет, с контракта `3.0` поле
 * устарело); имя из этого набора у кита прежней версии, не относящееся к визарду, по-прежнему
 * уходит в заглушку — переходник под него кодоген не печатает.
 *
 * ## Импорты кита — по входам пакета
 *
 * Символ записи берётся из главного входа кита либо с подпутя, который запись объявила
 * (`<спецификатор кита>/<подпуть>` — то же правило, что у адаптера визарда). Подпуть — не
 * повод для заглушки: он только говорит, откуда импортировать. Строки импорта группируются по
 * спецификатору: главный вход первым, подпути кита — по алфавиту, внутри строки символы тоже
 * по алфавиту; тело шага из cdk идёт последним. Раскладывает их шаблон, решает — этот модуль.
 *
 * @module plugins/reformer/core/codegen/view/registry
 */

import { isStepsHostName } from '../../form-model/node-kind';
import { resolveComponent } from '../components';
import type { EmitContext } from '../context';

/** Имя, под которым в схеме лежит тело шага. */
export const STEP_NAME = 'Step';

/** Откуда импортируется тело шага — у любого кита. */
export const STEP_IMPORT = '@reformer/cdk/form-wizard';

/** Одна привязка `$component` к реализации. */
export interface RegistryComponentView {
  /** Имя из схемы — оно же ключ регистрации. */
  readonly name: string;
  /** Символ кита; `null` у заглушки. */
  readonly symbol: string | null;
  /** Спецификатор, из которого символ импортируется: главный вход кита либо его подпуть. */
  readonly importFrom: string | null;
  readonly placeholder: boolean;
  /** Почему заглушка. Есть ровно тогда, когда `placeholder`. */
  readonly reason?: string;
}

/** Строка импорта: символы и спецификатор. */
export interface RegistryImportView {
  /** Символы без повторов, по алфавиту. */
  readonly symbols: readonly string[];
  readonly from: string;
}

/** Визард и тело шага в реестре: чем регистрируются имена из схемы. */
export interface RegistryWizardView {
  /** Имена из схемы, которые держат шаги. */
  readonly hostNames: readonly string[];
  /** Символ визарда из адаптера кита. */
  readonly symbol: string;
  /** Откуда его импортировать — спецификатор кита с учётом `subpath` адаптера. */
  readonly importFrom: string;
  /** Имя тела шага в схеме (`Step`) либо `null`, если узла шага в схеме нет. */
  readonly stepName: string | null;
}

/** Реестр глазами шаблона. */
export interface RegistryView {
  /** Символ обёртки поля из `infra` кита. */
  readonly fieldWrapper: string;
  /**
   * Символы для импорта из ГЛАВНОГО ВХОДА кита: без повторов, по алфавиту, вместе с обёрткой
   * поля и символом визарда, если тот лежит в главном входе.
   */
  readonly kitSymbols: readonly string[];
  /**
   * Импорты сверх главного входа кита, в порядке печати: подпути кита по алфавиту (компоненты
   * записей с подпутём и визард, если адаптер назвал подпуть), затем тело шага.
   */
  readonly extraImports: readonly RegistryImportView[];
  /** Визард либо `null`: в схеме его нет или кит не поставляет адаптер (тогда — заглушки). */
  readonly wizard: RegistryWizardView | null;
  /** Привязки компонентов, кроме визарда и тела шага, зарегистрированных символами. */
  readonly components: readonly RegistryComponentView[];
  /** Имена источников в порядке классов: списки, скаляры, подписи. */
  readonly dataSourceNames: readonly string[];
  /** Нужна ли декларация заглушки и импорт `ReactNode` под неё. */
  readonly hasPlaceholder: boolean;
}

export function registryView(ctx: EmitContext): RegistryView {
  const { collected, kit } = ctx;
  const fieldWrapper = kit.kit.infra.fieldWrapper;
  const specifier = kit.kit.codegen.importSpecifier;
  const adapter = kit.kit.adapters.wizard ?? null;

  /** Спецификатор входа кита: главный либо подпуть. Одно правило и записям, и адаптеру. */
  const entryOf = (subpath: string | undefined): string =>
    subpath === undefined ? specifier : `${specifier}/${subpath}`;

  const hostNames = collected.components.filter(isStepsHostName);
  const hasStep = collected.components.includes(STEP_NAME);
  const isWizardName = (name: string): boolean => isStepsHostName(name) || name === STEP_NAME;

  const wizard: RegistryWizardView | null =
    adapter === null || (hostNames.length === 0 && !hasStep)
      ? null
      : {
          hostNames,
          symbol: adapter.symbol,
          importFrom: entryOf(adapter.subpath),
          stepName: hasStep ? STEP_NAME : null,
        };

  const noAdapter = `кит «${kit.kit.label}» не поставляет адаптер визарда`;
  const components: RegistryComponentView[] = collected.components
    // Визард и тело шага зарегистрированы символами выше — второй раз их не привязываем.
    .filter((name) => wizard === null || !isWizardName(name))
    .map((name): RegistryComponentView => {
      if (isWizardName(name)) {
        return { name, symbol: null, importFrom: null, placeholder: true, reason: noAdapter };
      }
      const resolved = resolveComponent(name, kit);
      if (resolved.shim) {
        return {
          name,
          symbol: null,
          importFrom: null,
          placeholder: true,
          reason: `кит «${kit.kit.label}» не поставляет адаптер для этого компонента`,
        };
      }
      return {
        name: resolved.name,
        symbol: resolved.symbol,
        importFrom: resolved.symbol === null ? null : entryOf(resolved.subpath),
        placeholder: resolved.placeholder,
        ...(resolved.reason === undefined ? {} : { reason: resolved.reason }),
      };
    });

  // Символы по входам пакета кита: главный вход — одной строкой, каждый подпуть — своей.
  const kitSymbols = new Set<string>([fieldWrapper]);
  const bySubpath = new Map<string, Set<string>>();
  const importSymbol = (symbol: string, from: string): void => {
    if (from === specifier) {
      kitSymbols.add(symbol);
      return;
    }
    const symbols = bySubpath.get(from) ?? new Set<string>();
    symbols.add(symbol);
    bySubpath.set(from, symbols);
  };
  for (const c of components) {
    if (c.symbol !== null && c.importFrom !== null) importSymbol(c.symbol, c.importFrom);
  }
  // Визард из главного входа кита уезжает одной строкой с остальными компонентами, из подпутя —
  // строкой этого подпутя (общей с записями, лежащими там же).
  if (wizard !== null && wizard.hostNames.length > 0) {
    importSymbol(wizard.symbol, wizard.importFrom);
  }

  const extraImports: RegistryImportView[] = [...bySubpath.keys()]
    .sort()
    .map((from) => ({ symbols: [...(bySubpath.get(from) ?? [])].sort(), from }));
  if (wizard !== null && wizard.stepName !== null) {
    extraImports.push({ symbols: [wizard.stepName], from: STEP_IMPORT });
  }

  return {
    fieldWrapper,
    kitSymbols: [...kitSymbols].sort(),
    extraImports,
    wizard,
    components,
    dataSourceNames: [
      ...[...collected.ds.optionLike].sort(),
      ...[...collected.ds.scalarLike].sort(),
      ...[...collected.ds.functionLike].sort(),
    ],
    hasPlaceholder: components.some((c) => c.placeholder),
  };
}
