/**
 * `useFormBundle` — стабильность формы между рендерами + арминг живой валидации.
 *
 * Общий хук для всех фабрик семейства (`createCoreForm`, `createReactForm`, `createJsonForm`):
 * пакеты рендера реэкспортируют его как `useReactForm` / `useJsonForm`, чтобы вызов читался в
 * терминах своего слоя.
 *
 * Фабрика вызывается РОВНО один раз — ленивым инициализатором `useState`. `useMemo` для этого не
 * годится: React вправе сбросить его кэш и пересобрать форму, потеряв введённое.
 *
 * @module reformer/form/hooks/use-form-bundle
 */

import { useEffect, useState } from 'react';
import type { FormValidationController } from '../validation-strategy';

/** Минимум, который хук ожидает от бандла: опциональный контроллер живой валидации. */
export interface FormBundleLike {
  validation?: { controller: FormValidationController };
}

/**
 * Собрать форму один раз и держать её стабильной; живую стратегию валидации армировать в эффекте
 * (не при SSR — там эффекты не выполняются).
 *
 * @typeParam B - Тип бандла конкретной фабрики.
 * @param factory - Фабрика бандла, обычно `() => createCoreForm({…})`.
 * @returns Стабильный бандл.
 *
 * @example
 * ```tsx
 * const credit = useFormBundle(() => createCoreForm<CreditForm>({ model: createCreditModel() }));
 * ```
 *
 * @remarks
 * Передавайте именно фабрику: `useState` трактует функцию как ленивый инициализатор, а некоторые
 * части бандла сами являются функциями (`RenderSchemaProxy`), поэтому `useFormBundle(bundle.render)`
 * вызвал бы её вместо сохранения.
 */
export function useFormBundle<B extends FormBundleLike>(factory: () => B): B {
  const [bundle] = useState(factory);
  const controller = bundle.validation?.controller;
  useEffect(() => controller?.start(), [controller]);
  return bundle;
}
