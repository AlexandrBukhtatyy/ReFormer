/**
 * Мост страницы формы к демо на сайте: значения модели, состояние формы и высота документа —
 * сообщениями `postMessage` родителю. Только в сборке для демо и только с `?demo` (`./demo.ts`).
 *
 * Протокол — объекты с `source: 'reformer-demo'`:
 * - страница → сайт: `{ type: 'state', values, state, issues }` после изменений (не чаще кадра) и
 *   `{ type: 'height', height }` — высота содержимого (нижний край `<main>`) при её смене;
 * - сайт → страница: `{ type: 'hello' }` — прислать текущие состояние и высоту заново.
 *
 * Адресат — `'*'`: сайт и страницы форм на разработке живут на разных портах, а в данных нет
 * ничего, кроме введённого в саму форму.
 */
import {
  isFormArray,
  isFormGroup,
  type FormBundle,
  type FormNode,
  type ValidationIssue,
} from '@reformer/core';
import { effect } from '@reformer/core/signals';

export const DEMO_SOURCE = 'reformer-demo';

/** Замечание правила на поле: путь в модели и код правила. */
export interface DemoIssue {
  path: string;
  code: string;
  severity: 'error' | 'warning';
}

/** Состояние формы целиком. */
export interface DemoFormState {
  valid: boolean;
  invalid: boolean;
  /** Идёт асинхронная проверка поля (сервер). */
  pending: boolean;
  /** Идёт проверка формы или шага. */
  validating: boolean;
  dirty: boolean;
  touched: boolean;
  submitting: boolean;
  /** Шаг мастера; у формы без шагов — `null`. */
  step: { id: string; index: number; total: number; completed: string[] } | null;
}

export interface DemoStateMessage {
  source: typeof DEMO_SOURCE;
  type: 'state';
  values: unknown;
  state: DemoFormState;
  issues: DemoIssue[];
}

type AnyNode = FormNode<unknown>;

/**
 * Замечания по полям с путями. У группы и массива — только их собственные (правила на ручке
 * группы, `minLength` массива), у поля — его. Выключенные ноды пропускаются: их замечания сняты.
 */
function collectIssues(node: AnyNode, path: string, out: DemoIssue[]): void {
  if (node.disabled.value) return;
  const push = (issues: readonly ValidationIssue[]) => {
    for (const issue of issues)
      out.push({ path: path || '(форма)', code: issue.code, severity: issue.severity ?? 'error' });
  };
  if (isFormArray(node)) {
    push(node.ownIssues.value);
    node.forEach((row, index) => collectIssues(row as AnyNode, `${path}[${index}]`, out));
    return;
  }
  if (isFormGroup(node)) {
    push(node.ownIssues.value);
    const fields = node.$ as unknown as Record<string, AnyNode | undefined>;
    for (const key of Object.keys((node.value.value as object | null) ?? {})) {
      const child = fields[key];
      if (child) collectIssues(child, path ? `${path}.${key}` : key, out);
    }
    return;
  }
  push(node.issues.value);
}

function readState(bundle: FormBundle<unknown>): Omit<DemoStateMessage, 'source' | 'type'> {
  const { form, flow, submission } = bundle;
  const issues: DemoIssue[] = [];
  collectIssues(form as AnyNode, '', issues);
  return {
    values: form.value.value,
    state: {
      valid: form.valid.value,
      invalid: form.invalid.value,
      pending: form.pending.value,
      validating: bundle.validating.value,
      dirty: form.dirty.value,
      touched: form.touched.value,
      submitting: submission.submitting.value,
      step: flow
        ? {
            id: flow.current.value,
            index: flow.index.value,
            total: flow.activeSteps.value.length,
            completed: [...flow.completed.value],
          }
        : null,
    },
    issues,
  };
}

/** Снять мост прежней сборки — при перемонтировании формы. */
let disconnect: (() => void) | null = null;

export function connectBridge<T>(bundle: FormBundle<T>): void {
  disconnect?.();
  const post = (message: object) =>
    window.parent.postMessage({ source: DEMO_SOURCE, ...message }, '*');

  // Высота — по нижнему краю `<main>` страницы, а не документа: у Vuetify приложение не ниже окна
  // (`min-height: 100vh`), и высота документа за `iframe` только росла бы. `<main>` появляется
  // после сборки формы (её создаёт рендер), поэтому подписка на его размер — при каждой отправке.
  const contentHeight = () => {
    const main = document.querySelector('main');
    return main
      ? Math.ceil(main.getBoundingClientRect().bottom + window.scrollY)
      : document.documentElement.scrollHeight;
  };
  const postHeight = () => post({ type: 'height', height: contentHeight() });
  const resize = new ResizeObserver(postHeight);
  resize.observe(document.body);
  let observed: Element | null = null;
  const watchMain = () => {
    const main = document.querySelector('main');
    if (!main || main === observed) return;
    if (observed) resize.unobserve(observed);
    resize.observe(main);
    observed = main;
  };

  let latest: ReturnType<typeof readState> | null = null;
  let frame = 0;
  const flush = () => {
    frame = 0;
    watchMain();
    if (latest) post({ type: 'state', ...latest });
    postHeight();
  };
  // Один прогон эффекта читает все сигналы формы и подписывается на них; набор клавиши меняет
  // несколько сигналов подряд — родителю уходит одно сообщение на кадр.
  const stop = effect(() => {
    latest = readState(bundle as FormBundle<unknown>);
    if (!frame) frame = requestAnimationFrame(flush);
  });

  const onMessage = (event: MessageEvent) => {
    const data = event.data as { source?: unknown; type?: unknown } | null;
    if (event.source !== window.parent || data?.source !== DEMO_SOURCE || data.type !== 'hello')
      return;
    flush();
  };
  window.addEventListener('message', onMessage);

  disconnect = () => {
    stop();
    if (frame) cancelAnimationFrame(frame);
    resize.disconnect();
    window.removeEventListener('message', onMessage);
  };
}
