/**
 * Управляемые заглушки внешних вызовов заявки: проверка ИНН (async-правило валидации), справочник
 * городов (загрузка по `onChange` с задержкой и отменой), отправка заявки и сохранение черновика.
 *
 * Каждый вызов попадает в журнал вместе с ручным промисом (`deferred` из `test-utils/async`). По
 * умолчанию заглушка отвечает сразу типовым ответом; методы из `manual` (и переведённые в ручной
 * режим `hold` посреди сценария) ждут, пока тест сам решит, чем завершить вызов, — так сценарии
 * воспроизводят гонки, медленную сеть и сбои. Вызов с `AbortSignal` при отмене отклоняется
 * `AbortError`, как `fetch`, а журнал помнит, что вызов отменён: по нему видно, что форма отменяет
 * устаревшие запросы, а не просто их игнорирует.
 */

import { deferred, type Deferred } from '../../../test-utils/async';
import type { LoanApplication } from './model';

/** Ответ проверки ИНН. */
interface InnCheck {
  readonly status: 'found' | 'not-found';
}

/** Квитанция об отправке заявки. */
interface SubmitReceipt {
  readonly applicationNumber: string;
}

/** Внешние вызовы, которые делает заявка. */
export interface LoanApi {
  /** Есть ли ИНН в реестре налоговой. */
  checkInn(inn: string, signal: AbortSignal): Promise<InnCheck>;
  /** Города региона для выпадающего списка. */
  loadCities(region: string, signal: AbortSignal): Promise<readonly string[]>;
  submitApplication(values: LoanApplication): Promise<SubmitReceipt>;
  saveDraft(values: LoanApplication): Promise<void>;
}

/** Имя внешнего вызова. */
type LoanApiMethod = keyof LoanApi;

/** Чем завершается вызов метода. */
type LoanApiResult<M extends LoanApiMethod> = Awaited<ReturnType<LoanApi[M]>>;

/** Вызов в журнале заглушки. */
interface ApiCall<M extends LoanApiMethod = LoanApiMethod> {
  readonly method: M;
  readonly args: Parameters<LoanApi[M]>;
  /** Сигнал отмены, если метод его принимает. */
  readonly signal: AbortSignal | undefined;
  /** Вызов отменён вызывающей стороной (`signal.aborted`). */
  readonly aborted: boolean;
  /** Вызов завершён: ответом, ошибкой или отменой. */
  readonly settled: boolean;
  /** Ответить (ручной режим). Завершённый вызов не меняется. */
  resolve(value: LoanApiResult<M>): void;
  /** Ответить ошибкой (ручной режим). */
  reject(error: unknown): void;
}

/** Настройки заглушки сервера. */
export interface LoanServerOptions {
  /** Методы, вызовы которых завершает тест; остальные отвечают сразу. */
  readonly manual?: readonly LoanApiMethod[];
  /** ИНН, которых нет в реестре: проверка отвечает `not-found`. */
  readonly unknownInns?: readonly string[];
  /** ИНН, проверка которых падает сетевой ошибкой. */
  readonly failingInns?: readonly string[];
}

/** Заглушка сервера: API для формы и журнал вызовов для теста. */
export interface LoanServer {
  readonly api: LoanApi;
  /** Все вызовы в порядке поступления. */
  readonly calls: readonly ApiCall[];
  /** Вызовы одного метода. */
  callsOf<M extends LoanApiMethod>(method: M): ApiCall<M>[];
  /** Последний вызов метода; вызовов не было — исключение. */
  last<M extends LoanApiMethod>(method: M): ApiCall<M>;
  /**
   * Перевести метод в ручной режим посреди сценария: следующие вызовы ждут ответа теста
   * (`resolve` / `reject` записи журнала). Визард проходится с ответами сразу, а гонку разыгрывает
   * уже отправка или повторная проверка.
   */
  hold(method: LoanApiMethod): void;
}

/** Справочник городов по регионам. */
const CITIES_BY_REGION: Readonly<Record<string, readonly string[]>> = {
  Москва: ['Москва', 'Зеленоград'],
  'Московская область': ['Химки', 'Мытищи', 'Подольск'],
  'Санкт-Петербург': ['Санкт-Петербург', 'Колпино'],
};

/** Ошибка сети, которой падает проверка ИНН из `failingInns`. */
class NetworkError extends Error {
  override readonly name = 'NetworkError';
}

/** Запись журнала: вызов и его ручной промис. */
class RecordedCall<M extends LoanApiMethod> implements ApiCall<M> {
  private done = false;

  constructor(
    readonly method: M,
    readonly args: Parameters<LoanApi[M]>,
    readonly signal: AbortSignal | undefined,
    private readonly response: Deferred<LoanApiResult<M>>
  ) {
    if (signal?.aborted) this.reject(abortError());
    signal?.addEventListener('abort', () => this.reject(abortError()), { once: true });
  }

  get aborted(): boolean {
    return this.signal?.aborted ?? false;
  }

  get settled(): boolean {
    return this.done;
  }

  resolve(value: LoanApiResult<M>): void {
    if (this.done) return;
    this.done = true;
    this.response.resolve(value);
  }

  reject(error: unknown): void {
    if (this.done) return;
    this.done = true;
    this.response.reject(error);
  }
}

const abortError = (): DOMException => new DOMException('Запрос отменён', 'AbortError');

/**
 * Заглушка сервера заявки.
 *
 * @example
 * ```ts
 * const server = createLoanServer({ manual: ['checkInn'] });
 * const { bundle } = createLoanForm({ server });
 * const step = bundle.validateStep('applicant');
 * server.last('checkInn').resolve({ status: 'found' });
 * await step;
 * ```
 */
export function createLoanServer(options: LoanServerOptions = {}): LoanServer {
  const calls: ApiCall[] = [];
  const manual = new Set<LoanApiMethod>(options.manual ?? []);
  let submitted = 0;

  /** Записать вызов и, если метод не ручной, ответить сразу. */
  const record = <M extends LoanApiMethod>(
    method: M,
    args: Parameters<LoanApi[M]>,
    signal: AbortSignal | undefined,
    respond: (call: ApiCall<M>) => void
  ): Promise<LoanApiResult<M>> => {
    const response = deferred<LoanApiResult<M>>();
    const call = new RecordedCall(method, args, signal, response);
    calls.push(call as unknown as ApiCall);
    if (!manual.has(method)) respond(call);
    return response.promise;
  };

  const api: LoanApi = {
    checkInn: (inn, signal) =>
      record('checkInn', [inn, signal], signal, (call) => {
        if (options.failingInns?.includes(inn)) {
          call.reject(new NetworkError('Сервис проверки ИНН недоступен'));
        } else {
          call.resolve({ status: options.unknownInns?.includes(inn) ? 'not-found' : 'found' });
        }
      }),
    loadCities: (region, signal) =>
      record('loadCities', [region, signal], signal, (call) =>
        call.resolve(CITIES_BY_REGION[region] ?? [])
      ),
    submitApplication: (values) =>
      record('submitApplication', [values], undefined, (call) => {
        submitted += 1;
        call.resolve({ applicationNumber: `ЗК-${String(submitted).padStart(6, '0')}` });
      }),
    saveDraft: (values) =>
      record('saveDraft', [values], undefined, (call) => call.resolve(undefined)),
  };

  const callsOf = <M extends LoanApiMethod>(method: M): ApiCall<M>[] =>
    calls.filter((call): call is ApiCall<M> => call.method === method);

  return {
    api,
    calls,
    callsOf,
    last(method) {
      const list = callsOf(method);
      const call = list[list.length - 1];
      if (call === undefined) throw new Error(`[loan-server] вызовов «${method}» не было`);
      return call;
    },
    hold(method) {
      manual.add(method);
    },
  };
}
