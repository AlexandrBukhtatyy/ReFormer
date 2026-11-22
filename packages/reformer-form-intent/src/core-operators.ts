/** Справочник правил ядра (`@reformer/core`), которыми печатаются `rules` записи валидации. */

/** Фабрика правила ядра. */
export interface CoreRule {
  /** Имя фабрики: `minAge`. */
  name: string;
  /** Как записать правило в `rules`: `minAge(18)`, `required`. */
  call: string;
  /** Какие значения проверяет: `any`, `text`, `number`, `date`, `file` — или своё значение ядра. */
  group: string;
}

export interface CoreOperators {
  /** Индекс ядра найден. `false` — сверять не с чем: имена правил идут в код как есть. */
  readonly found: boolean;
  /** Фабрики правил в порядке грамматики: по группам, внутри группы — по имени. */
  readonly rules: ReadonlyMap<string, CoreRule>;
  /** Значения из `./validators`, `./validation`, `./behaviors`: свой оператор так называться не может. */
  readonly names: ReadonlySet<string>;
  /**
   * Значения только из `./validation` и `./behaviors` — операторы схем и основа своих операторов.
   * По ним грамматика находит оператор ядра, которого нет в языке intent (ReFormer-wkva).
   */
  readonly operatorNames: ReadonlySet<string>;
}

export const NO_CORE_OPERATORS: CoreOperators = {
  found: false,
  rules: new Map(),
  names: new Set(),
  operatorNames: new Set(),
};
