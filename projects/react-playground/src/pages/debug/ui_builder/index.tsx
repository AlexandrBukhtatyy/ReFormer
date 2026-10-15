/**
 * Демо «UI Builder»: полный цикл — правишь файлы модуля формы, они компилируются в браузере,
 * форма пересобирается, инспектор показывает и правит модель.
 *
 * ## Что здесь проверяется
 *
 * 1. **Компиляция в браузере** — тексты слева транспилируются и линкуются тем же механизмом,
 *    что и в билдере (`@builder-src/shell/platform/modules/*`), а не собираются заранее.
 * 2. **Идентичность экземпляров** — `@reformer/core` коду формы отдаёт реестр модулей, поэтому
 *    сигналы формы связаны с её узлами. Второй экземпляр сломал бы `getNodeForSignal`.
 * 3. **Фикстура** — данные (`model`, `dataSources`), подстановка модулей (`../api`) и окружение
 *    (`clock`). Форма из чужого проекта собирается, не имея его зависимостей.
 * 4. **Единая сборка.** Форму собирает `createForm` — та же сборка, что у приложения: модель →
 *    дерево из документа формата 2 (его строит реестр) → ноды → поведение → валидация. Держит
 *    её `useFormBundle`, рисует `FormRenderer`.
 * 5. **Поведение одно.** `behavior/index.ts` держит и связи над моделью (`computeFrom`), и
 *    правила узлов схемы (`hideWhen`); отправку (`application/submit.ts`, `onComponentEvent`)
 *    сборка дописывает к тем же правилам — как `application/create.ts` модуля. Кнопка отправки
 *    модели не принадлежит, поэтому правило адресует УЗЕЛ схемы: `schema.node('submit')`.
 * 6. **Инспектор модели** — правка идёт тем же вызовом, что ввод в контрол, поэтому вычисляемое
 *    поле пересчитывается само; производные пути помечены и не редактируются.
 *
 * ## Что попробовать
 *
 * — Поменяйте «Количество» в форме: «Итого» пересчитается (`computeFrom` из `behavior/index.ts`).
 * — Поменяйте его же в инспекторе: пересчитается так же — точка ввода одна.
 * — Нажмите «Отправить» на пустой форме: появится ошибка под полем и сообщение внизу.
 *   Ошибку показывает `touch: true` в `validateModel` — без него киты молчат, потому что
 *   рисуют её только у ТРОНУТОГО поля, и кнопка выглядела бы нерабочей.
 * — Поставьте «Количество» в 0: сработает второе правило.
 * — Заполните «Имя клиента»: появится «Город» (`hideWhen` из `behavior/index.ts`).
 * — Отправьте заполненную: ответит `submitForm` из фикстуры — настоящего `api/index.ts`
 *   в наборе нет вовсе.
 * — Включите «Сырая запись» и очистите имя: значение ляжет в модель без `touched`.
 * — Сломайте `validation/form.ts` (уберите скобку): форма останется на экране, а находка появится
 *   внизу с именем файла — пофайловая изоляция. Отправка при этом не подключится: её файл
 *   импортирует правила, и без них проверять нечем.
 * — Уберите `CITY_LIST` из фикстуры: города сменятся опциями, синтезированными по схеме
 *   («City list 1…3»), — слой фикстуры ушёл, остался синтез.
 *
 * @module pages/debug/ui_builder
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createForm, type FormBundle } from '@reformer/core';
import { defineFormBehavior } from '@reformer/core/behaviors';
import { useFormBundle, useFormControl, useIssueMessage } from '@reformer/core/react';
import { defineRegistry, FIELD_WRAPPER, type ComponentRegistry } from '@reformer/renderer-json';
import { FormRenderer } from '@reformer/renderer-react';
import { mergeFormData, type FormFixture } from '@reformer-domain/core/form-fixture';
import { synthMock } from '@reformer-domain/core/form-mock';

import { ModelInspector } from './ModelInspector';
import {
  appliedArtifacts,
  compileSources,
  extractContract,
  knownSpecifiers,
  ROLE_FILES,
  runInitialValues,
  type BuildProblem,
  type FormContract,
  type Shape,
  type SubmitResultHandler,
} from './compile';
import { DEMO_FILES, DEMO_SCHEMA } from './sources';

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
 * Реестр компонентов демо — то, что в модуле формы лежит в `schema/registry.ts`.
 *
 * Пять штук вместо каталога кита: страница показывает МЕХАНИЗМ, а не кит. Обёртка поля
 * регистрируется и под служебным именем `FIELD_WRAPPER`: реестр кладёт её в бандл сборки, и
 * рендерер берёт её оттуда.
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
    // Текст ошибки — через резолвер: правило несёт код, и строку даёт словарь локали по коду.
    const message = useIssueMessage();
    const show = state.touched && state.issues.length > 0;
    return (
      <div className="flex flex-col gap-1" data-testid={testId ? `field-${testId}` : undefined}>
        {children}
        {show ? (
          <span
            className="text-xs text-red-600"
            data-testid={testId ? `error-${testId}` : undefined}
          >
            {state.issues[0] ? message(state.issues[0]) : null}
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
   * Она здесь ради правил узлов схемы: `application/submit.ts` вешает на неё обработчик через
   * `onComponentEvent`. Связью над моделью это не выразить — кнопка модели не принадлежит, —
   * поэтому правило адресует узел: `schema.node('submit')`.
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

/** Что дала компиляция текстов: всё, из чего собирается форма. */
interface Compiled {
  /** Номер компиляции — он же ключ React собранной формы: у каждой компиляции форма своя. */
  readonly ticket: number;
  readonly contract: FormContract;
  /** Начальные значения модуля: один вызов `createInitialValues` на компиляцию. */
  readonly initial: Shape | undefined;
  readonly fixture: FormFixture | null;
  readonly problems: readonly BuildProblem[];
}

/**
 * Итог сборки формы: бандл либо отказ.
 *
 * Отказ — данные, а не исключение: битое поведение это обычное состояние текста, который правят
 * прямо сейчас, и бросок из фабрики `useFormBundle` унёс бы страницу целиком.
 */
interface Assembly {
  readonly bundle: FormBundle<Shape> | null;
  readonly problems: readonly BuildProblem[];
  /**
   * Правила и контроллер живой проверки бандла. `useFormBundle` запускает стратегию проверки по
   * этому полю, поэтому оно вынесено рядом с бандлом: хуку достаётся итог сборки, а не сам бандл.
   */
  readonly validation: FormBundle<Shape>['validation'];
}

/** Первая компиляция ещё идёт: собирать не из чего. */
const NOT_BUILT: Assembly = Object.freeze({ bundle: null, problems: [], validation: undefined });

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Собирает форму — то, что в модуле делает `application/create.ts`.
 *
 * Сборка единая (`createForm`): документ формы, реестр, поведение, валидация. Поведение
 * складывается так же, как в модуле: правила (`behaviorRules`), затем отправка (`wireSubmit`) с
 * колбэком итога от места подключения. Нет одной из двух половин — берётся готовое `formBehavior`,
 * а отправка остаётся неподключённой.
 *
 * @param compiled - Что отдали файлы модуля и фикстура.
 * @param onResult - Куда отправка сообщает итог: поведение принадлежит ФОРМЕ, а показ итога —
 *   тому, кто её встроил.
 */
function assembleForm(compiled: Compiled, onResult: SubmitResultHandler): Assembly {
  const problems: BuildProblem[] = [];
  const { contract } = compiled;

  // Порядок старшинства тот же, что в билдере: синтез по схеме < начальные значения модуля <
  // фикстура.
  const merged = mergeFormData(synthMock(DEMO_SCHEMA), compiled.initial, compiled.fixture);

  const { behaviorRules, wireSubmit } = contract;
  const behavior =
    behaviorRules === undefined || wireSubmit === undefined
      ? contract.behavior
      : defineFormBehavior<Shape>((scope) => {
          behaviorRules(scope);
          // Отказ отправки форму не роняет: бросок из поведения сборка считает своим и снимает
          // форму целиком, а здесь это всего лишь не подключившаяся кнопка.
          try {
            wireSubmit(scope, { onResult });
          } catch (error) {
            problems.push({ file: ROLE_FILES.submit, phase: 'evaluate', message: describe(error) });
          }
        });

  try {
    const bundle = createForm<Shape>({
      initial: merged.model,
      schema: DEMO_SCHEMA,
      registry: createDemoRegistry(merged.dataSources),
      behavior,
      validation: contract.validation,
    });
    return { bundle, problems, validation: bundle.validation };
  } catch (error) {
    problems.push({ file: '', phase: 'render', message: describe(error) });
    return { bundle: null, problems, validation: undefined };
  }
}

/** Итог отправки, каким его сообщает `application/submit.ts`. */
interface SubmitOutcome {
  readonly message: string;
  readonly ok: boolean;
}

interface WorkbenchProps {
  /** Итог компиляции; `null` — первая компиляция ещё идёт. */
  readonly compiled: Compiled | null;
  readonly building: boolean;
}

/**
 * Собранная форма, инспектор её модели и находки.
 *
 * Монтируется заново на каждую компиляцию (ключ — её номер): фабрика `useFormBundle` выполняется
 * один раз за жизнь компонента, и это ровно одна форма на одну компиляцию. Итог отправки живёт
 * здесь же, поэтому пересборка убирает его вместе с формой, которая его сообщила.
 */
function Workbench({ compiled, building }: WorkbenchProps) {
  /** Что ответила отправка из `application/submit.ts`. */
  const [submitted, setSubmitted] = useState<SubmitOutcome | null>(null);
  // Именно фабрика: `useMemo` здесь неверен — React вправе сбросить кэш и потерять введённое.
  // Колбэк места подключения (`onResult`) замыкается прямо здесь.
  const assembly = useFormBundle(() =>
    compiled === null
      ? NOT_BUILT
      : assembleForm(compiled, (message, ok) => setSubmitted({ message, ok }))
  );
  const bundle = assembly.bundle;

  const applied: readonly string[] =
    compiled === null
      ? []
      : [...appliedArtifacts(compiled.contract), ...(compiled.fixture === null ? [] : ['fixture'])];
  const problems: readonly BuildProblem[] =
    compiled === null ? [] : [...compiled.problems, ...assembly.problems];

  return (
    <section className="flex min-h-0 flex-col gap-3">
      <div className="rounded border p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1 text-[11px]">
          <span className="text-gray-500">применилось:</span>
          {applied.length === 0 ? (
            <span className="text-gray-400">ничего</span>
          ) : (
            applied.map((name) => (
              <span key={name} className="rounded border px-1 font-mono">
                {name}
              </span>
            ))
          )}
          {building ? <span className="ml-2 text-gray-400">собирается…</span> : null}
        </div>

        {bundle === null ? (
          <p className="text-sm text-gray-500">
            {compiled === null ? 'Форма собирается…' : 'Форма не собралась — см. находки ниже.'}
          </p>
        ) : (
          <div data-testid="demo-form">
            {/* Обёртку поля и границу ошибок схемы рендерер берёт из бандла: их кладёт туда реестр. */}
            <FormRenderer form={bundle} />
          </div>
        )}

        {submitted === null ? null : (
          <p
            role="status"
            data-testid="submit-result"
            className={`mt-2 text-xs ${submitted.ok ? 'text-emerald-700' : 'text-red-700'}`}
          >
            {submitted.message}
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-hidden rounded border">
        <ModelInspector model={bundle?.model ?? null} />
      </div>

      <div className="rounded border p-3 text-xs" data-testid="build-problems">
        <div className="mb-1 font-semibold">
          Находки сборки: {problems.length === 0 ? 'нет' : problems.length}
        </div>
        {problems.map((problem, index) => (
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
  );
}

export default function UiBuilderDemo() {
  const [files, setFiles] = useState<Record<string, string>>(() =>
    Object.fromEntries(DEMO_FILES.map((file) => [file.name, file.source]))
  );
  const [compiled, setCompiled] = useState<Compiled | null>(null);
  const [building, setBuilding] = useState(true);
  /** Номер компиляции: опоздавший результат не должен затирать свежий. */
  const run = useRef(0);

  const build = useCallback(async (current: Record<string, string>) => {
    const ticket = (run.current += 1);
    setBuilding(true);
    const sources = await compileSources(new Map(Object.entries(current)));
    if (ticket !== run.current) return;

    const contract = extractContract(sources.modules);
    // Фабрика начальных значений — раз на компиляцию, а не на сборку формы: значения остаются
    // теми же, сколько бы раз React ни позвал фабрику бандла.
    const values = runInitialValues(contract);

    // Форму соберёт `Workbench`: новый номер перемонтирует его, и фабрика бандла выполнится
    // заново — уже над этими текстами. Прежняя форма остаётся на экране до этой строки.
    setCompiled({
      ticket,
      contract,
      initial: values.initial,
      fixture: sources.fixture,
      problems: [...sources.problems, ...values.problems],
    });
    setBuilding(false);
  }, []);

  useEffect(() => {
    void build(files);
    // Первая сборка — при монтировании. Дальше пересобираем по кнопке: пересборка на каждое
    // нажатие клавиши в редакторе означала бы компиляцию недописанного файла.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex h-full flex-col gap-4 p-4" data-testid="ui-builder-demo">
      <header>
        <h1 className="text-xl font-bold">UI Builder: компиляция формы в браузере</h1>
        <p className="mt-1 text-sm text-gray-600">
          Слева — файлы модуля формы в раскладке «папки по ролям». Их транспилирует и линкует тот же
          механизм, что в билдере: CommonJS-конверт с подставленным <code>require</code>, который
          отдаёт коду те же экземпляры <code>@reformer/*</code>, что держит страница. Справа — форма
          единой сборки (<code>createForm</code>) и инспектор её модели.
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

        <Workbench key={compiled?.ticket ?? 0} compiled={compiled} building={building} />
      </div>
    </div>
  );
}
