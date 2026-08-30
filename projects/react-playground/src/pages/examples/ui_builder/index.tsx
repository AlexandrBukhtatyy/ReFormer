/**
 * Демо «UI Builder»: полный цикл — правишь сайдкары, они компилируются в браузере,
 * форма пересобирается, инспектор показывает и правит модель.
 *
 * ## Что здесь проверяется
 *
 * 1. **Компиляция в браузере** — тексты слева транспилируются и линкуются тем же механизмом,
 *    что и в билдере (`@builder-src/host/modules/*`), а не собираются заранее.
 * 2. **Идентичность экземпляров** — `@reformer/core` коду формы отдаёт реестр модулей, поэтому
 *    сигналы формы связаны с её узлами. Второй экземпляр сломал бы `getNodeForSignal`.
 * 3. **Фикстура** — данные (`model`, `dataSources`), подстановка модулей (`./api`) и окружение
 *    (`clock`). Форма из чужого проекта собирается, не имея его зависимостей.
 * 4. **Два разных поведения.** `form.behavior.ts` работает со ЗНАЧЕНИЯМИ модели (`compute`),
 *    `renderer.behavior.ts` — с УЗЛАМИ схемы (`hideWhen`, `onComponentEvent`, submit). Одно
 *    нельзя выразить другим: кнопка отправки модели не принадлежит, и спрятать её поведением
 *    модели нечем. Поэтому и файлов два.
 * 5. **Инспектор модели** — правка идёт тем же вызовом, что ввод в контрол, поэтому `compute`
 *    пересчитывается сам; производные пути помечены и не редактируются.
 *
 * ## Что попробовать
 *
 * — Поменяйте «Количество» в форме: «Итого» пересчитается (`compute` из `form.behavior.ts`).
 * — Поменяйте его же в инспекторе: пересчитается так же — точка ввода одна.
 * — Нажмите «Отправить» на пустой форме: появится ошибка под полем и сообщение внизу.
 *   Ошибку показывает `touch: true` в `validateModel` — без него киты молчат, потому что
 *   рисуют её только у ТРОНУТОГО поля, и кнопка выглядела бы нерабочей.
 * — Поставьте «Количество» в 0: сработает второе правило.
 * — Заполните «Имя клиента»: появится «Город» (`hideWhen` из `renderer.behavior.ts`).
 * — Отправьте заполненную: ответит `submitForm` из фикстуры — настоящего `api.ts`
 *   в наборе нет вовсе.
 * — Включите «Сырая запись» и очистите имя: значение ляжет в модель без `touched`.
 * — Сломайте `validation.ts` (уберите скобку): форма останется на экране, а находка появится
 *   внизу с именем файла — пофайловая изоляция.
 * — Уберите `CITY_LIST` из фикстуры: список городов опустеет.
 *
 * @module pages/examples/ui_builder
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createJsonForm,
  defineRegistry,
  FIELD_WRAPPER,
  JsonFormRenderer,
  JsonRendererProvider,
  type ComponentRegistry,
  type JsonForm,
} from '@reformer/renderer-json';
import { useFormControl } from '@reformer/core';
import { mergeFormData } from '@builder-src/lib/form-fixture';
import { synthMock } from '@builder-src/lib/form-mock';

import { ModelInspector } from './ModelInspector';
import { compileSources, extractContract, knownSpecifiers, type BuildProblem } from './compile';
import { DEMO_FILES, DEMO_SCHEMA } from './sources';

type Shape = Record<string, unknown>;

/** Значение поля из пропсов рендерера, каким его отдаёт адаптер. */
interface FieldProps {
  value?: unknown;
  onChange?: (value: unknown) => void;
  onBlur?: () => void;
  label?: string;
  type?: string;
  readOnly?: boolean;
  placeholder?: string;
  options?: readonly { value: string; label: string }[];
  onClick?: () => void;
  disabled?: boolean;
  children?: React.ReactNode;
}

/** Пропсы обёртки поля: рендерер даёт контрол и testId, но не подпись. */
interface FieldWrapperLike {
  control: never;
  testId?: string;
  children?: React.ReactNode;
}

/**
 * Реестр компонентов демо.
 *
 * Пять штук вместо каталога кита: страница показывает МЕХАНИЗМ, а не кит. Обёртка поля
 * регистрируется и под служебным именем `FIELD_WRAPPER` — рендерер адресует её именно им.
 */
function createDemoRegistry(dataSources: Record<string, unknown>): ComponentRegistry {
  /**
   * Обёртка поля.
   *
   * Подпись сюда НЕ приходит: `FieldWrapperProps` — это `control`, `className`, `children`
   * и `testId`, а `label` из `componentProps` уходит в сам контрол. Зато приходит `control`,
   * и ошибку показывает именно обёртка — по тому же правилу, что и киты:
   * только когда поле тронули.
   */
  const Field = ({ control, testId, children }: FieldWrapperLike) => {
    const state = useFormControl(control);
    const show = state.touched && state.errors.length > 0;
    return (
      <div className="flex flex-col gap-1" data-testid={testId ? `field-${testId}` : undefined}>
        {children}
        {show ? (
          <span
            className="text-xs text-red-600"
            data-testid={testId ? `error-${testId}` : undefined}
          >
            {state.errors[0]?.message}
          </span>
        ) : null}
      </div>
    );
  };

  const Input = ({ value, onChange, onBlur, type, readOnly, placeholder, label }: FieldProps) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <input
        className="rounded border px-2 py-1 text-sm read-only:bg-gray-100"
        type={type ?? 'text'}
        readOnly={readOnly}
        placeholder={placeholder}
        value={value == null ? '' : String(value)}
        onChange={(event) =>
          onChange?.(
            type === 'number' ? Number(event.currentTarget.value) : event.currentTarget.value
          )
        }
        onBlur={onBlur}
      />
    </label>
  );

  const Select = ({ value, onChange, onBlur, options, label }: FieldProps) => (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-gray-600">{label}</span>
      <select
        className="rounded border px-2 py-1 text-sm"
        value={value == null ? '' : String(value)}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        onBlur={onBlur}
      >
        <option value="">—</option>
        {(options ?? []).map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );

  const Stack = ({ children }: FieldProps) => <div className="flex flex-col gap-4">{children}</div>;

  /**
   * Кнопка — узел БЕЗ значения модели.
   *
   * Она здесь ради поведения рендера: `renderer.behavior.ts` вешает на неё обработчик через
   * `onComponentEvent` и прячет её через `hideWhen`. Ни то, ни другое не выражается поведением
   * модели, потому что кнопка модели не принадлежит.
   */
  const Button = ({ label, onClick, disabled }: FieldProps) => (
    <button
      type="button"
      data-testid="demo-submit"
      className="self-start rounded bg-emerald-600 px-3 py-1.5 text-sm text-white disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      {label ?? 'Отправить'}
    </button>
  );

  return defineRegistry((builder) => {
    builder.component('Stack', Stack);
    builder.component('Input', Input);
    builder.component('Select', Select);
    builder.component('Button', Button);
    builder.component('FormField', Field);
    builder.component(FIELD_WRAPPER, Field);
    for (const [name, value] of Object.entries(dataSources)) builder.dataSource(name, value);
  });
}

interface BuildResult {
  readonly form: JsonForm<Shape> | null;
  readonly problems: readonly BuildProblem[];
  readonly applied: readonly string[];
}

const EMPTY: BuildResult = { form: null, problems: [], applied: [] };

/**
 * Фабрика поведения рендера, какой её печатает кодоген.
 *
 * Третий параметр — колбэк результата: поведение принадлежит ФОРМЕ, а показ результата —
 * тому, кто её встроил. Так один и тот же `renderer.behavior.ts` работает и на странице
 * приложения, и в предпросмотре билдера.
 */
type RenderBehaviorFactory = (
  form: unknown,
  model: unknown,
  options: { onResult?: (message: string, ok: boolean) => void }
) => unknown;

export default function UiBuilderDemo() {
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEMO_FILES.map((file) => [file.name, file.source]))
  );
  const [result, setResult] = useState<BuildResult>(EMPTY);
  const [building, setBuilding] = useState(true);
  /** Что ответил submit из `renderer.behavior.ts`. */
  const [submitted, setSubmitted] = useState<{ message: string; ok: boolean } | null>(null);
  /** Номер сборки: опоздавший результат не должен затирать свежий. */
  const run = useRef(0);

  const build = useCallback(async (current: Record<string, string>) => {
    const ticket = (run.current += 1);
    setBuilding(true);
    const compiled = await compileSources(new Map(Object.entries(current)));
    if (ticket !== run.current) return;

    const contract = extractContract(compiled.modules);
    const problems: BuildProblem[] = [...compiled.problems];
    const applied: string[] = [];
    if (contract.initial !== undefined) applied.push('model');
    if (contract.validation !== undefined) applied.push('validation');
    if (contract.behavior !== undefined) applied.push('behavior');
    if (contract.renderBehavior !== undefined) applied.push('renderBehavior');
    if (compiled.fixture !== null) applied.push('fixture');

    // Порядок старшинства тот же, что в билдере: синтез < model.ts < фикстура.
    const merged = mergeFormData(synthMock(DEMO_SCHEMA), contract.initial, compiled.fixture);

    let form: JsonForm<Shape> | null = null;
    try {
      form = createJsonForm<Shape>({
        schema: DEMO_SCHEMA,
        registry: createDemoRegistry(merged.dataSources),
        initial: merged.model as Shape,
        behavior: contract.behavior as never,
        validation: contract.validation as never,
        // Фабрика получает форму и модель, а колбэк результата — от страницы: так поведение
        // рендера остаётся кодом ФОРМЫ, а показ результата — делом того, кто её встроил.
        // Фабрика подставляется, ТОЛЬКО если сайдкар её отдал: битый         // не должен уносить с собой форму, которая собралась из остального.
        renderBehavior:
          contract.renderBehavior === undefined
            ? undefined
            : (((form: unknown, model: unknown) =>
                (contract.renderBehavior as RenderBehaviorFactory)(form, model, {
                  onResult: (message: string, ok: boolean) => setSubmitted({ message, ok }),
                })) as never),
      });
    } catch (error) {
      problems.push({
        file: '',
        phase: 'render',
        message: error instanceof Error ? error.message : String(error),
      });
    }

    setResult({ form, problems, applied });
    setSubmitted(null);
    setBuilding(false);
  }, []);

  useEffect(() => {
    void build(files);
    // Первая сборка — при монтировании. Дальше пересобираем по кнопке: пересборка на каждое
    // нажатие клавиши в редакторе означала бы компиляцию недописанного файла.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const registry = useMemo(() => result.form?.registry, [result.form]);

  return (
    <div className="flex h-full flex-col gap-4 p-4" data-testid="ui-builder-demo">
      <header>
        <h1 className="text-xl font-bold">UI Builder: компиляция формы в браузере</h1>
        <p className="mt-1 text-sm text-gray-600">
          Слева — файлы формы. Их транспилирует и линкует тот же механизм, что в билдере:
          CommonJS-конверт с подставленным <code>require</code>, который отдаёт коду те же
          экземпляры <code>@reformer/*</code>, что держит страница. Справа — живая форма и инспектор
          её модели.
        </p>
      </header>

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <section className="flex min-h-0 flex-col gap-3 overflow-auto">
          {DEMO_FILES.map((file) => (
            <div key={file.name} className="flex flex-col">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-xs font-semibold">{file.name}</span>
                <span className="text-xs text-gray-500">{file.hint}</span>
              </div>
              <textarea
                data-testid={`source-${file.name}`}
                className="mt-1 h-40 w-full rounded border p-2 font-mono text-xs"
                spellCheck={false}
                value={files[file.name]}
                onChange={(event) => {
                  // Значение снимается СРАЗУ: к моменту, когда React позовёт функциональное
                  // обновление, синтетическое событие уже обнулило `currentTarget`.
                  const next = event.currentTarget.value;
                  setFiles((previous) => ({ ...previous, [file.name]: next }));
                }}
              />
            </div>
          ))}
          <button
            type="button"
            data-testid="rebuild"
            className="self-start rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
            onClick={() => void build(files)}
          >
            Пересобрать
          </button>
        </section>

        <section className="flex min-h-0 flex-col gap-3">
          <div className="rounded border p-3">
            <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px]">
              <span className="text-gray-500">применилось:</span>
              {result.applied.length === 0 ? (
                <span className="text-gray-400">ничего</span>
              ) : (
                result.applied.map((name) => (
                  <span key={name} className="rounded border px-1 font-mono">
                    {name}
                  </span>
                ))
              )}
              {building ? <span className="ml-2 text-gray-400">собирается…</span> : null}
            </div>

            {result.form === null ? (
              <p className="text-sm text-gray-500">Форма не собралась — см. находки ниже.</p>
            ) : (
              <div data-testid="demo-form">
                <JsonRendererProvider settings={{ registry }}>
                  <JsonFormRenderer form={result.form} />
                </JsonRendererProvider>
              </div>
            )}

            {submitted === null ? null : (
              <p
                data-testid="submit-result"
                className={`mt-2 text-xs ${submitted.ok ? 'text-emerald-700' : 'text-red-700'}`}
              >
                {submitted.message}
              </p>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-hidden rounded border">
            <ModelInspector model={result.form?.model ?? null} />
          </div>

          <div className="rounded border p-3 text-xs" data-testid="build-problems">
            <div className="mb-1 font-semibold">
              Находки сборки: {result.problems.length === 0 ? 'нет' : result.problems.length}
            </div>
            {result.problems.map((problem, index) => (
              <div key={`${problem.file}:${index}`} className="text-red-700">
                <span className="font-mono">{problem.file || '—'}</span>{' '}
                <span className="text-gray-500">[{problem.phase}]</span> {problem.message}
              </div>
            ))}
            <div className="mt-2 text-gray-500">
              Коду формы доступны: <span className="font-mono">{knownSpecifiers().join(', ')}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
