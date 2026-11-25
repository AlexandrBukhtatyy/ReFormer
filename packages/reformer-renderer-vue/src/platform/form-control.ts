/**
 * Состояние поля формы в компоненте Vue: сигналы ноды как ссылки и текст показанного замечания.
 *
 * @module renderer-vue/platform/form-control
 */

import { getCurrentScope, inject, provide, type ShallowRef } from 'vue';
import type { FormControl, ValidationIssue } from '@reformer/core';
import { resolveIssueMessage } from '@reformer/core/i18n';
import type { I18nHandle, IssueMessages } from '@reformer/core/i18n';
import { primaryIssue } from '@reformer/core/render';
import { useSignalValue } from '../bridge/signals';
import { DEFAULT_I18N, I18N, ISSUE_MESSAGES } from '../context';

type Ref<T> = Readonly<ShallowRef<T>>;

/** Состояние поля ссылками Vue. Подписка на сигнал ноды заводится при первом чтении ключа. */
export interface FormControlRefs<T = unknown> {
  readonly value: Ref<T>;
  readonly disabled: Ref<boolean>;
  readonly touched: Ref<boolean>;
  /** Идёт асинхронная проверка поля. */
  readonly pending: Ref<boolean>;
  readonly issues: Ref<readonly ValidationIssue[]>;
  /** Состояние ошибки: поле невалидно и его трогали или меняли. */
  readonly shouldShowError: Ref<boolean>;
  /** Показывать ли тексты замечаний: ошибки или предупреждения на тронутом поле. */
  readonly shouldShowIssues: Ref<boolean>;
  /** Путь поля в модели; у поля строки массива следует за индексом строки. */
  readonly path: Ref<string>;
  /** Реактивные пропсы ноды (`updateComponentProps`). */
  readonly componentProps: Ref<Readonly<Record<string, unknown>>>;
}

const KEYS = [
  'value',
  'disabled',
  'touched',
  'pending',
  'issues',
  'shouldShowError',
  'shouldShowIssues',
  'path',
  'componentProps',
] as const;

/**
 * Состояние поля для рендер-функции. Компонент подписывается только на прочитанное: поле, которое
 * не показывает `pending`, на серверную проверку не перерисовывается.
 *
 * Вызывать в `setup`: подписки живут в его области и снимаются вместе с компонентом.
 *
 * @example
 * ```ts
 * setup(props) {
 *   const field = useFormControl(props.control);
 *   return () => h('input', { value: field.value.value, disabled: field.disabled.value });
 * }
 * ```
 */
export function useFormControl<T>(control: FormControl<T>): FormControlRefs<T> {
  const scope = getCurrentScope();
  const refs = {} as Record<string, Ref<unknown>>;
  const out = {} as Record<string, unknown>;
  for (const name of KEYS) {
    Object.defineProperty(out, name, {
      enumerable: true,
      get: () => {
        if (!(name in refs)) {
          const bridge = () => useSignalValue(() => control[name].value as unknown);
          refs[name] = scope ? scope.run(bridge)! : bridge();
        }
        return refs[name];
      },
    });
  }
  return out as unknown as FormControlRefs<T>;
}

/**
 * Словарь формы для поддерева: записи накладываются поверх словаря предка, а код, которого в
 * словаре нет, получает текст из локали. Вызывать в `setup`.
 *
 * @param messages - Словарь формы (`defineIssueMessages` из `@reformer/core/i18n`).
 */
export function provideIssueMessages(messages: IssueMessages): void {
  const parent = inject(ISSUE_MESSAGES, undefined);
  provide(ISSUE_MESSAGES, parent === undefined ? messages : { ...parent, ...messages });
}

/** Локаль для поддерева: тексты замечаний и описатели `msg()` в пропсах узлов. Вызывать в `setup`. */
export function provideI18n(i18n: I18nHandle): void {
  provide(I18N, i18n);
}

/**
 * Резолвер текста замечания: словарь формы → словарь локали по коду → встроенный английский →
 * сам код. Вызывать в `setup`.
 */
export function useIssueMessage(): (issue: ValidationIssue) => string {
  const i18n = inject(I18N, DEFAULT_I18N);
  const messages = inject(ISSUE_MESSAGES, undefined);
  return (issue) => resolveIssueMessage(issue, i18n, messages);
}

/**
 * Текст замечания, которое поле показывает сейчас: главное замечание тронутого поля либо
 * `undefined`. Пока текста нет, элемент ошибки в разметку не ставится. Вызывать в `setup`.
 *
 * @example
 * ```ts
 * setup(props) {
 *   const error = useFieldError(props.control);
 *   return () => (error.value ? h('p', { role: 'alert' }, error.value) : null);
 * }
 * ```
 */
export function useFieldError(control: FormControl<unknown>): Ref<string | undefined> {
  const resolve = useIssueMessage();
  return useSignalValue(() => {
    if (!control.shouldShowIssues.value) return undefined;
    const issue = primaryIssue(control.issues.value);
    return issue ? resolve(issue) : undefined;
  });
}
