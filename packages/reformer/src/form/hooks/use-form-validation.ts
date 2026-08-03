import { useCallback, useEffect, useMemo } from 'react';
import { useSyncExternalStore } from 'use-sync-external-store/shim';
import type { FormModel } from '../../index';
import type { ValidationSchema } from '../validation-schema';
import { createFormValidation, type ValidationStrategyKind } from '../validation-strategy';

export interface UseFormValidationArgs<T> {
  /** Модель данных формы. */
  model: FormModel<T>;
  /** Схема валидации. **Стабильная ссылка** (module-level `const` / `useMemo`) — иначе ломается дедуп раннера. */
  schema: ValidationSchema<T>;
  /** Стратегия запуска. Default `'submit'`. */
  strategy?: ValidationStrategyKind;
  /** Debounce (мс) для live-фаз (`change` / live-часть `afterFirstSubmit`). */
  debounce?: number;
  /** Режим live-фазы для `afterFirstSubmit`. Default `'change'`. */
  liveAfterSubmit?: 'change' | 'blur';
}

export interface UseFormValidationResult {
  /** Полный прогон + раскрытие ошибок (`touch:true`); для `onSubmit`. Стабильная ссылка. */
  submit: () => Promise<boolean>;
  /** Алиас `submit` для не-submit сценариев. */
  validate: () => Promise<boolean>;
  /** Идёт ли прогон (submit или live) — для блокировки кнопки. */
  isValidating: boolean;
}

/**
 * Декларативный выбор стратегии валидации формы: одна точка вместо ручной разводки
 * `validateModel`/`revalidateWhen`. Собирает стабильный {@link createFormValidation}-контроллер,
 * армит реактивную стратегию на клиенте (`useEffect` → SSR-safe) и отдаёт `submit`/`isValidating`.
 *
 * Схема-валидации — **стабильная ссылка** (обязанность вызывающего): контроллер мемоизируется по
 * `[model, schema, strategy, debounce, liveAfterSubmit]`.
 *
 * @example
 * ```tsx
 * const validation = defineValidationSchema<Form>(({ model }) => { ... }); // module-level
 *
 * function MyForm() {
 *   const { submit, isValidating } = useFormValidation({
 *     model, schema: validation, strategy: 'afterFirstSubmit', debounce: 300,
 *   });
 *   const onSubmit = async (e: React.FormEvent) => {
 *     e.preventDefault();
 *     if (await submit()) await api.save(model.get());
 *   };
 *   return <form onSubmit={onSubmit}>{ ... }<button disabled={isValidating}>Отправить</button></form>;
 * }
 * ```
 */
export function useFormValidation<T>(args: UseFormValidationArgs<T>): UseFormValidationResult {
  const { model, schema, strategy, debounce, liveAfterSubmit } = args;

  const controller = useMemo(
    () => createFormValidation(model, schema, { strategy, debounce, liveAfterSubmit }),
    [model, schema, strategy, debounce, liveAfterSubmit]
  );

  // Арм реактивной стратегии только на клиенте (эффект не бежит при SSR); cleanup → dispose.
  useEffect(() => controller.start(), [controller]);

  const isValidating = useSyncExternalStore(
    useCallback((onChange) => controller.validating.subscribe(onChange), [controller]),
    () => controller.validating.peek(),
    () => false // SSR: прогон не идёт
  );

  const submit = useCallback(() => controller.validate(), [controller]);

  return { submit, validate: submit, isValidating };
}
