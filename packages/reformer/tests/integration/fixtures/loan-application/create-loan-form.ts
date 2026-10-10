/**
 * Сборка заявки на кредит одним вызовом `createForm` — точка входа сценариев.
 *
 * Фабрика собирает модель, схему, поведение, правила и поток одной сборки и отдаёт бандл вместе с
 * заглушкой сервера, чтобы сценарий видел журнал внешних вызовов и управлял ответами. Опции
 * переключают то, что в настоящем приложении выбирают при сборке:
 * - `strategy` / `debounce` / `liveAfterSubmit` — живая проверка (по умолчанию — только отправка);
 * - `server` — своя заглушка сервера (ручные ответы, недоступный сервис);
 * - `initial` + `seed` — модель из готовых значений (черновик, загрузка) и правка до сборки нод;
 * - `rules: 'all'` — одностраничный вариант: полный набор правил одной схемой, без потока шагов.
 *
 * Сборка не армирует стратегию: `start()` контроллера зовёт `useFormBundle`, а без React —
 * сценарий (`bundle.validation?.controller.start()`).
 */

import {
  createForm,
  type FormBundle,
  type FormModel,
  type FormValidation,
} from '../../../../src/index';
import type { ValidationStrategyKind } from '../../../../src/form/validation/index';
import { createLoanServer, type LoanServer } from './api';
import { createLoanBehavior } from './behavior';
import { createLoanFlow } from './flow';
import { createLoanModel, markServerOwned, type LoanApplication } from './model';
import { loanSchema } from './schema';
import { createLoanRules, type LoanRules } from './validation';

/** Опции сборки заявки. */
export interface LoanFormOptions {
  /** Когда запускать живую проверку; по умолчанию `'submit'` — только отправка. */
  readonly strategy?: ValidationStrategyKind;
  /** Задержка живой проверки, мс. */
  readonly debounce?: number;
  /** Режим живой фазы `afterFirstSubmit`. */
  readonly liveAfterSubmit?: 'change' | 'blur';
  /** Заглушка сервера; по умолчанию — отвечающая сразу. */
  readonly server?: LoanServer;
  /** Значения заявки: модель создаёт `createForm` из них, поля сервера помечаются в `seed`. */
  readonly initial?: LoanApplication;
  /** Правка модели до сборки нод. */
  readonly seed?: (model: FormModel<LoanApplication>) => void;
  /**
   * Набор правил: `'steps'` (по умолчанию) — правила по шагам потока и межшаговые `extras`;
   * `'all'` — полный набор одной схемой без потока (одностраничная анкета).
   */
  readonly rules?: 'steps' | 'all';
}

/** Собранная заявка. */
export interface LoanForm {
  readonly bundle: FormBundle<LoanApplication>;
  /** Заглушка сервера: журнал вызовов и ручные ответы. */
  readonly server: LoanServer;
  /** Правила этой сборки — по ним сценарий проверяет схемы напрямую. */
  readonly rules: LoanRules;
}

/**
 * Собрать заявку на кредит.
 *
 * @example
 * ```ts
 * const { bundle, server } = createLoanForm();
 * fillLoanStep(bundle.model);
 * await bundle.flow?.next(); // { status: 'moved', from: 'loan', to: 'applicant' }
 * ```
 */
export function createLoanForm(options: LoanFormOptions = {}): LoanForm {
  const server = options.server ?? createLoanServer();
  const rules = createLoanRules(server.api);
  const singlePage = options.rules === 'all';

  const validation: FormValidation<LoanApplication> = {
    ...(singlePage ? { rules: rules.all } : { extras: rules.crossStep }),
    strategy: options.strategy,
    debounce: options.debounce,
    liveAfterSubmit: options.liveAfterSubmit,
  };

  const { initial, seed } = options;
  const bundle = createForm<LoanApplication>({
    ...(initial !== undefined
      ? {
          initial,
          seed: (model: FormModel<LoanApplication>) => {
            markServerOwned(model);
            seed?.(model);
          },
        }
      : { model: createLoanModel(), seed }),
    schema: loanSchema,
    behavior: createLoanBehavior(server.api, rules),
    validation,
    ...(singlePage ? {} : { flow: createLoanFlow(rules) }),
  });

  return { bundle, server, rules };
}
