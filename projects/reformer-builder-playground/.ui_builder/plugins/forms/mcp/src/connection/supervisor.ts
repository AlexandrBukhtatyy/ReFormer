/**
 * Диспетчер воркеров — единственный, кто запускает и останавливает соединения с серверами.
 *
 * Задача — чтобы десяток серверов проекта ничего не стоил, пока к ним не обращаются, и чтобы
 * одновременно жило не больше нескольких потоков с их корпусами в памяти. Менеджер соединений
 * (`./manager`) и фасад ассистента сессий не создают и не закрывают: они берут АРЕНДУ.
 *
 * ## Правила
 *
 * - **Ленивый запуск.** Сессия открывается на первую аренду, не раньше: ни активация плагина, ни
 *   обнаружение серверов ничего не запускают.
 * - **Аренда на время вызова.** Пока аренда не отпущена, сессию не усыпляют и не вытесняют —
 *   остановка посреди вызова исключена.
 * - **Сон по простою.** Отпущена последняя аренда — заводится таймер: `idleSeconds` сервера или
 *   умолчание. Истёк — сессия закрывается (воркер останавливается), следующее обращение откроет
 *   её заново. `0` — закрыть сразу.
 * - **Потолок живых воркеров** ({@link SupervisorPolicy.maxLive}). Нужен ещё один — закрывается
 *   тот, к кому дольше всех не обращались, из тех, что без аренды. Все живые заняты — новый
 *   открывается сверх потолка, а лишний закрывается, как только освободится его аренда: потолок
 *   мягкий, и вызов никогда не ждёт чужой остановки. Удалённые серверы потоков не держат и в
 *   потолок не входят, но засыпают по тому же таймеру.
 * - **Падения.** Сессия, умершая сама (упал воркер), — падение. Следующая попытка — не раньше
 *   {@link SupervisorPolicy.restartBackoffMs}; после {@link SupervisorPolicy.maxCrashes} падений
 *   подряд — только после ручного {@link Supervisor.reset}. Неудавшееся открытие — тоже падение:
 *   стучаться в недоступный сервер на каждый вызов модели незачем.
 *
 * Политика — параметр: тесты подставляют свою, а будущая настройка (если замеры покажут нужду)
 * подключится без переделки.
 *
 * ## Замеры
 *
 * Открытие сессии меряется `performance.measure('rb:mcp.spawn:<имя>')` — с тем же префиксом, что
 * остальные фазы билдера, поэтому видно в сводке `?rb-trace`.
 *
 * @module plugins/forms/mcp/connection/supervisor
 */

/** Числа стратегии запуска. */
export interface SupervisorPolicy {
  /** Сколько воркеров живёт одновременно (мягкий потолок). */
  readonly maxLive: number;
  /** Простой до сна, если сервер не назвал своего. */
  readonly defaultIdleSeconds: number;
  /** Пауза перед повторным открытием после падения. */
  readonly restartBackoffMs: number;
  /** Падений подряд до остановки попыток. */
  readonly maxCrashes: number;
}

export const DEFAULT_POLICY: SupervisorPolicy = Object.freeze({
  maxLive: 3,
  defaultIdleSeconds: 300,
  restartBackoffMs: 10_000,
  maxCrashes: 3,
});

/** Открытое соединение. Чем оно является — дело открывающего. */
export interface Session {
  close(): Promise<void>;
}

/** К чему открывается сессия. */
export interface SessionTarget {
  readonly name: string;
  /** Воркер держит поток и входит в потолок; удалённый сервер — нет. */
  readonly kind: 'worker' | 'remote';
  readonly idleSeconds?: number;
}

/** Часы — подменяются в тестах. */
export interface Clock {
  now(): number;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

const SYSTEM_CLOCK: Clock = {
  now: () => Date.now(),
  setTimeout: (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
};

/** Состояние слота сервера. */
export type SessionPhase = 'idle' | 'starting' | 'running' | 'asleep' | 'crashed';

export interface SessionStatus {
  readonly phase: SessionPhase;
  /** Падений подряд. */
  readonly crashes: number;
  /** Последняя причина падения или неудачного открытия. */
  readonly error?: string;
  /** Попытки остановлены до ручного `reset`. */
  readonly halted: boolean;
}

/** Почему аренду не выдали. */
export class SupervisorError extends Error {
  /** `stopped` — слот закрыли, пока сессия открывалась (смена проекта). */
  readonly reason: 'halted' | 'backoff' | 'open-failed' | 'stopped';

  constructor(reason: SupervisorError['reason'], message: string) {
    super(message);
    this.name = 'SupervisorError';
    this.reason = reason;
  }
}

/** Аренда сессии. Отпустить — ровно один раз, в `finally`. */
export interface Lease<S extends Session> {
  readonly session: S;
  release(): void;
}

export interface SupervisorOptions<S extends Session> {
  readonly policy?: Partial<SupervisorPolicy>;
  /**
   * Открыть сессию. `lost` — позвать, когда она умерла сама (упал воркер, оборвался транспорт):
   * диспетчер сочтёт это падением.
   */
  open(target: SessionTarget, lost: (error: Error) => void): Promise<S>;
  readonly clock?: Clock;
  /** Состояние какого-то слота изменилось — для панели. */
  onChange?(): void;
}

export interface Supervisor<S extends Session> {
  /** Взять сессию сервера, открыв её при необходимости. */
  acquire(target: SessionTarget): Promise<Lease<S>>;
  /** Усыпить сервер сейчас. С активной арендой — `false`: остановка посреди вызова запрещена. */
  sleep(name: string): Promise<boolean>;
  /** Забыть падения сервера — ручное «Переподключить». */
  reset(name: string): void;
  status(name: string): SessionStatus;
  /** Живых (открытых или открывающихся) воркеров. */
  liveWorkers(): number;
  readonly policy: SupervisorPolicy;
  /** Закрыть всё и забыть слоты — смена проекта, перечитанная конфигурация или деактивация. */
  closeAll(): Promise<void>;
}

interface Slot<S extends Session> {
  target: SessionTarget;
  phase: SessionPhase;
  session?: S;
  starting?: Promise<S>;
  leases: number;
  lastUsed: number;
  idleTimer?: unknown;
  crashes: number;
  lastCrashAt?: number;
  error?: string;
  /** Поколение сессии: `lost` от закрытой намеренно сессии не считается падением. */
  generation: number;
}

/** Собрать диспетчер. */
export function createSupervisor<S extends Session>(options: SupervisorOptions<S>): Supervisor<S> {
  const policy: SupervisorPolicy = { ...DEFAULT_POLICY, ...options.policy };
  const clock = options.clock ?? SYSTEM_CLOCK;
  const slots = new Map<string, Slot<S>>();

  const changed = () => options.onChange?.();

  const slotOf = (target: SessionTarget): Slot<S> => {
    let slot = slots.get(target.name);
    if (slot === undefined) {
      slot = { target, phase: 'idle', leases: 0, lastUsed: 0, crashes: 0, generation: 0 };
      slots.set(target.name, slot);
    } else {
      // Настройки запуска могли поменяться (перечитан `server.json`) — берётся свежая цель.
      slot.target = target;
    }
    return slot;
  };

  const isLive = (slot: Slot<S>) => slot.phase === 'starting' || slot.phase === 'running';
  const liveWorkers = () =>
    [...slots.values()].filter((slot) => slot.target.kind === 'worker' && isLive(slot)).length;

  const clearIdle = (slot: Slot<S>) => {
    if (slot.idleTimer !== undefined) clock.clearTimeout(slot.idleTimer);
    slot.idleTimer = undefined;
  };

  /** Закрыть сессию слота намеренно: не падение. */
  const close = async (slot: Slot<S>): Promise<void> => {
    clearIdle(slot);
    const session = slot.session;
    slot.session = undefined;
    slot.generation += 1;
    if (slot.phase === 'running') slot.phase = 'asleep';
    changed();
    await session?.close().catch(() => undefined);
  };

  /** Вытеснить воркеры сверх потолка: LRU среди тех, что без аренды. */
  const trim = async (): Promise<void> => {
    const candidates = [...slots.values()]
      .filter(
        (slot) => slot.target.kind === 'worker' && slot.phase === 'running' && slot.leases === 0
      )
      .sort((a, b) => a.lastUsed - b.lastUsed);
    let excess = liveWorkers() - policy.maxLive;
    for (const slot of candidates) {
      if (excess <= 0) break;
      await close(slot);
      excess -= 1;
    }
  };

  const crash = (slot: Slot<S>, error: unknown) => {
    clearIdle(slot);
    slot.session = undefined;
    slot.generation += 1;
    slot.phase = 'crashed';
    slot.crashes += 1;
    slot.lastCrashAt = clock.now();
    slot.error = error instanceof Error ? error.message : String(error);
    changed();
  };

  /**
   * Открыть сессию слота. Фаза и промис открытия выставляются СИНХРОННО: параллельная аренда того
   * же сервера должна увидеть «открывается» и ждать этого открытия, а не завести второе.
   */
  const start = (slot: Slot<S>): Promise<S> => {
    const generation = slot.generation + 1;
    slot.generation = generation;
    slot.phase = 'starting';
    changed();
    const started = typeof performance === 'undefined' ? 0 : performance.now();
    const lost = (error: Error) => {
      // От сессии, которую уже закрыли или заменили, падение не принимается.
      if (slot.generation === generation) crash(slot, error);
    };
    // Вытеснение — до открытия: этот слот уже считается живым, лишние засыпают под него.
    const room = slot.target.kind === 'worker' ? trim() : Promise.resolve();
    const opening = room
      .then(() => options.open(slot.target, lost))
      .then(
        (session) => {
          measure(`rb:mcp.spawn:${slot.target.name}`, started);
          if (slot.generation !== generation || slots.get(slot.target.name) !== slot) {
            // Пока открывалось, слот закрыли (смена проекта): эта сессия никому не нужна.
            void session.close().catch(() => undefined);
            throw new SupervisorError('stopped', `MCP server ${slot.target.name} was stopped`);
          }
          slot.session = session;
          slot.starting = undefined;
          slot.phase = 'running';
          slot.crashes = 0;
          slot.error = undefined;
          changed();
          return session;
        },
        (error: unknown) => {
          slot.starting = undefined;
          if (slot.generation === generation) crash(slot, error);
          throw error instanceof SupervisorError
            ? error
            : new SupervisorError('open-failed', slot.error ?? String(error));
        }
      );
    slot.starting = opening;
    return opening;
  };

  const release = (slot: Slot<S>) => {
    slot.leases = Math.max(0, slot.leases - 1);
    slot.lastUsed = clock.now();
    if (slot.leases > 0 || slot.phase !== 'running') return;
    const idleSeconds = slot.target.idleSeconds ?? policy.defaultIdleSeconds;
    if (idleSeconds === 0) {
      void close(slot);
      return;
    }
    clearIdle(slot);
    slot.idleTimer = clock.setTimeout(() => {
      slot.idleTimer = undefined;
      if (slot.leases === 0) void close(slot);
    }, idleSeconds * 1000);
    // Освободилась аренда — можно вернуть потолок, если его превысили, пока все были заняты.
    if (liveWorkers() > policy.maxLive) void trim();
  };

  return {
    policy,

    async acquire(target) {
      const slot = slotOf(target);

      if (slot.phase === 'crashed') {
        if (slot.crashes >= policy.maxCrashes) {
          throw new SupervisorError(
            'halted',
            `MCP server ${target.name} failed ${slot.crashes} times in a row: ${slot.error ?? ''}`
          );
        }
        const since = clock.now() - (slot.lastCrashAt ?? 0);
        if (since < policy.restartBackoffMs) {
          throw new SupervisorError(
            'backoff',
            `MCP server ${target.name} failed recently (${slot.error ?? 'unknown error'}); retry later`
          );
        }
      }

      clearIdle(slot);
      slot.leases += 1;
      slot.lastUsed = clock.now();
      try {
        let session: S;
        if (slot.phase === 'running' && slot.session !== undefined) session = slot.session;
        else if (slot.phase === 'starting' && slot.starting !== undefined)
          session = await slot.starting;
        else session = await start(slot);
        let released = false;
        return {
          session,
          release: () => {
            if (released) return;
            released = true;
            release(slot);
          },
        };
      } catch (error) {
        slot.leases = Math.max(0, slot.leases - 1);
        throw error;
      }
    },

    async sleep(name) {
      const slot = slots.get(name);
      if (slot === undefined || slot.phase !== 'running') return true;
      if (slot.leases > 0) return false;
      await close(slot);
      return true;
    },

    reset(name) {
      const slot = slots.get(name);
      if (slot === undefined) return;
      slot.crashes = 0;
      slot.lastCrashAt = undefined;
      slot.error = undefined;
      if (slot.phase === 'crashed') slot.phase = 'idle';
      changed();
    },

    status(name) {
      const slot = slots.get(name);
      if (slot === undefined) return { phase: 'idle', crashes: 0, halted: false };
      return {
        phase: slot.phase,
        crashes: slot.crashes,
        ...(slot.error === undefined ? {} : { error: slot.error }),
        halted: slot.phase === 'crashed' && slot.crashes >= policy.maxCrashes,
      };
    },

    liveWorkers,

    async closeAll() {
      const all = [...slots.values()];
      slots.clear();
      await Promise.all(
        all.map(async (slot) => {
          clearIdle(slot);
          slot.generation += 1;
          const session = slot.session;
          slot.session = undefined;
          await session?.close().catch(() => undefined);
        })
      );
      changed();
    },
  };
}

/** Замер фазы в сводке билдера; без `performance` — ничего. */
function measure(name: string, start: number): void {
  try {
    if (typeof performance !== 'undefined') performance.measure(name, { start });
  } catch {
    // Замер — не повод ронять запуск.
  }
}
