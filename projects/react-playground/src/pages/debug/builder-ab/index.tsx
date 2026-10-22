/**
 * Стенд A/B ассистента билдера: формы, которые собрала модель, — рядом со счётом прогона.
 *
 * Каждый подкаталог — модуль формы одного прогона замера
 * `projects/reformer-builder-playground/.ui_builder/plugins/reformer/integration/assistant-ab-eval.test.ts`:
 * итог хода напечатан кодогеном билдера (той же доставкой, что «Сгенерировать»), а рядом лежит
 * `meta.json` — счёт прогона. Страница находит их сама (`import.meta.glob`): новый прогон
 * появляется здесь без правки кода, а модуль грузится, только когда его открыли.
 *
 * ## Режимы
 *
 * - **structured** — модель правит схему структурными инструментами (JSON Pointer), правила
 *   держит мост; в модуль они попадают печатью кодогена;
 * - **files** — модель правит файлы модуля напрямую (`list_files`, `read_file`, `edit_file`,
 *   `write_file`), правила пишет кодом в `validation/*.ts` и `behavior/index.ts`.
 *
 * ## Сценарии
 *
 * - **spec** — форма кредитной заявки с нуля по спецификации;
 * - **rules** — на шаблоне «Пошаговая форма»: «Город» обязателен, «Должность» видна, только когда
 *   город заполнен.
 *
 * @module pages/debug/builder-ab
 */

import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Счёт прогона — `meta.json`, который пишет замер. */
interface RunMeta {
  readonly scenario: string;
  readonly mode: string;
  readonly run: number;
  readonly model: string;
  readonly date: string;
  readonly seconds: number;
  readonly reason: string;
  readonly stop?: { readonly reason?: string } | null;
  readonly stats: {
    readonly steps: number;
    readonly inputTokens: number;
    readonly cachedInputTokens: number;
    readonly outputTokens: number;
    readonly peakStepInputTokens: number;
  };
  readonly calls: Readonly<Record<string, number>>;
  readonly refusals: Readonly<Record<string, number>>;
  readonly answer: string;
  readonly form: {
    readonly valid: boolean;
    readonly errors: number;
    readonly steps: number;
    readonly fields: number;
    readonly firstErrors: readonly string[];
  };
  readonly coverage?: { readonly expected: number; readonly found: number };
  readonly rules?: {
    readonly required: boolean;
    readonly visibility: boolean;
    readonly codeErrors?: number;
  };
  readonly touched?: readonly string[];
  /** Страница модуля — имя файла от корня модуля. */
  readonly page: string;
}

/** Прогон стенда: каталог, счёт и ленивая страница его формы. */
interface Run {
  readonly id: string;
  readonly meta: RunMeta;
  readonly Page: ComponentType | null;
}

const SCENARIO_TITLE: Readonly<Record<string, string>> = {
  spec: 'Кредитная заявка по спецификации',
  rules: 'Правила на шаблоне',
};

const MODE_TITLE: Readonly<Record<string, string>> = {
  structured: 'структурный',
  files: 'файлы',
};

const SCENARIO_ORDER = ['spec', 'rules'];
const MODE_ORDER = ['structured', 'files'];

const metas = import.meta.glob<RunMeta>('./*/meta.json', { eager: true, import: 'default' });
// Модуль формы — по его `index.ts`: страница — его экспорт по умолчанию. Ленивый импорт: страница
// стенда не тянет все формы разом, а сломанная форма не роняет оглавление.
const pages = import.meta.glob<{ default: ComponentType }>('./*/index.ts');

const rank = (order: readonly string[], value: string): number => {
  const at = order.indexOf(value);
  return at < 0 ? order.length : at;
};

const RUNS: readonly Run[] = Object.entries(metas)
  .map(([path, meta]): Run => {
    const id = path.split('/')[1];
    const load = pages[`./${id}/index.ts`];
    return { id, meta, Page: load ? lazy(load) : null };
  })
  .sort(
    (a, b) =>
      rank(SCENARIO_ORDER, a.meta.scenario) - rank(SCENARIO_ORDER, b.meta.scenario) ||
      rank(MODE_ORDER, a.meta.mode) - rank(MODE_ORDER, b.meta.mode) ||
      a.meta.run - b.meta.run
  );

const RERUN =
  'EVAL_MODEL=qwen3.8:27b-32k npx vitest run assistant-ab-eval.test.ts  # из каталога integration/';

const thousands = (value: number): string => value.toLocaleString('ru-RU');

/** Чем кончился ход: причина цикла и, если поток оборван, причина обрыва. */
function endOf(meta: RunMeta): string {
  const stop = meta.stop?.reason;
  return stop && stop !== meta.reason ? `${meta.reason} (${stop})` : meta.reason;
}

/** Выполнена ли просьба сценария — то, ради чего прогон затевался. */
function verdictOf(meta: RunMeta): string {
  if (meta.coverage) return `полей из спеки: ${meta.coverage.found}/${meta.coverage.expected}`;
  if (meta.rules) {
    const mark = (ok: boolean): string => (ok ? '✓' : '✗');
    return `обязательность ${mark(meta.rules.required)} · видимость ${mark(meta.rules.visibility)}`;
  }
  return '—';
}

function Chips({ entries, tone }: { entries: Readonly<Record<string, number>>; tone: string }) {
  const list = Object.entries(entries);
  if (list.length === 0) return <span className="text-gray-400">нет</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {list.map(([name, count]) => (
        <span key={name} className={`rounded border px-1 font-mono text-[11px] ${tone}`}>
          {name} × {count}
        </span>
      ))}
    </span>
  );
}

interface BoundaryState {
  readonly error: Error | null;
}

/**
 * Граница ошибок формы прогона: форма, которую собрала модель, вправе не собраться, а оглавление
 * и счёт от этого пропадать не должны.
 */
class FormBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  render() {
    if (this.state.error === null) return this.props.children;
    return (
      <div
        className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800"
        data-testid="ab-form-error"
      >
        Форма упала при отрисовке: {this.state.error.message}
      </div>
    );
  }
}

function RunDetails({ run }: { run: Run }) {
  const { meta, Page } = run;
  return (
    <section className="flex flex-col gap-4" data-testid={`ab-details-${run.id}`}>
      <div className="grid gap-x-6 gap-y-1 rounded border p-3 text-xs sm:grid-cols-[max-content_1fr]">
        <span className="text-gray-500">Модель</span>
        <span className="font-mono">{meta.model}</span>
        <span className="text-gray-500">Прогон</span>
        <span>
          {new Date(meta.date).toLocaleString('ru-RU')} · {meta.seconds} с · ход кончился:{' '}
          <span className="font-mono">{endOf(meta)}</span>
        </span>
        <span className="text-gray-500">Токены</span>
        <span>
          шагов {meta.stats.steps}, вход {thousands(meta.stats.inputTokens)} (из кэша{' '}
          {thousands(meta.stats.cachedInputTokens)}), выход {thousands(meta.stats.outputTokens)},
          пик шага {thousands(meta.stats.peakStepInputTokens)}
        </span>
        <span className="text-gray-500">Вызовы</span>
        <Chips entries={meta.calls} tone="border-gray-300" />
        <span className="text-gray-500">Отказы</span>
        <Chips entries={meta.refusals} tone="border-red-300 text-red-700" />
        <span className="text-gray-500">Форма</span>
        <span>
          {meta.form.valid ? 'валидна' : `ошибок: ${meta.form.errors}`} · шагов {meta.form.steps} ·
          полей {meta.form.fields}
          {meta.form.firstErrors.length > 0 ? (
            <span className="block font-mono text-red-700">{meta.form.firstErrors.join('; ')}</span>
          ) : null}
        </span>
        <span className="text-gray-500">Просьба</span>
        <span>
          {verdictOf(meta)}
          {meta.rules?.codeErrors ? ` · ошибок проверки кода: ${meta.rules.codeErrors}` : ''}
        </span>
        {meta.touched && meta.touched.length > 0 ? (
          <>
            <span className="text-gray-500">Записаны</span>
            <span className="font-mono">{meta.touched.join(', ')}</span>
          </>
        ) : null}
      </div>

      <details className="rounded border p-3 text-xs">
        <summary className="cursor-pointer text-gray-600">Ответ модели</summary>
        <pre className="mt-2 whitespace-pre-wrap font-sans">{meta.answer || '—'}</pre>
      </details>

      <div className="rounded border" data-testid="ab-form">
        {Page === null ? (
          <p className="p-3 text-sm text-gray-500">
            У прогона нет модуля формы: <code>index.ts</code> не напечатан.
          </p>
        ) : (
          <FormBoundary key={run.id}>
            <Suspense fallback={<p className="p-3 text-sm text-gray-500">Форма загружается…</p>}>
              <Page />
            </Suspense>
          </FormBoundary>
        )}
      </div>
    </section>
  );
}

export default function BuilderAbBench() {
  const [params, setParams] = useSearchParams();
  const selected = RUNS.find((run) => run.id === params.get('run')) ?? RUNS[0] ?? null;

  return (
    <div className="flex flex-col gap-4 p-4" data-testid="builder-ab">
      <header>
        <h1 className="text-xl font-bold">A/B ассистента билдера: структурный режим и файлы</h1>
        <p className="mt-1 text-sm text-gray-600">
          Каждая строка — один прогон замера с живой моделью. Ниже — форма, которую модель собрала:
          модуль напечатан кодогеном билдера и работает как обычная страница формы. Перезапуск —{' '}
          <code className="text-xs">{RERUN}</code>
        </p>
      </header>

      {RUNS.length === 0 ? (
        <p className="text-sm text-gray-500">Прогонов пока нет — запустите замер командой выше.</p>
      ) : (
        <div className="overflow-x-auto rounded border">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-2 py-1">Сценарий</th>
                <th className="px-2 py-1">Режим</th>
                <th className="px-2 py-1">Время</th>
                <th className="px-2 py-1">Шагов</th>
                <th className="px-2 py-1">Вход, ток.</th>
                <th className="px-2 py-1">Форма</th>
                <th className="px-2 py-1">Просьба</th>
                <th className="px-2 py-1">Отказов</th>
              </tr>
            </thead>
            <tbody>
              {RUNS.map((run) => {
                const { meta } = run;
                const refusals = Object.values(meta.refusals).reduce((sum, n) => sum + n, 0);
                return (
                  <tr
                    key={run.id}
                    data-testid={`ab-run-${run.id}`}
                    aria-selected={run === selected}
                    className={`cursor-pointer border-t ${
                      run === selected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                    onClick={() => setParams({ run: run.id })}
                  >
                    <td className="px-2 py-1">
                      {SCENARIO_TITLE[meta.scenario] ?? meta.scenario}
                      {meta.run > 1 ? ` #${meta.run}` : ''}
                    </td>
                    <td className="px-2 py-1 font-mono">{MODE_TITLE[meta.mode] ?? meta.mode}</td>
                    <td className="px-2 py-1">{meta.seconds} с</td>
                    <td className="px-2 py-1">{meta.stats.steps}</td>
                    <td className="px-2 py-1">{thousands(meta.stats.inputTokens)}</td>
                    <td className={`px-2 py-1 ${meta.form.valid ? '' : 'text-red-700'}`}>
                      {meta.form.valid ? '✓' : '✗'} {meta.form.fields} полей
                    </td>
                    <td className="px-2 py-1">{verdictOf(meta)}</td>
                    <td className={`px-2 py-1 ${refusals > 0 ? 'text-red-700' : ''}`}>
                      {refusals}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {selected === null ? null : <RunDetails key={selected.id} run={selected} />}
    </div>
  );
}
