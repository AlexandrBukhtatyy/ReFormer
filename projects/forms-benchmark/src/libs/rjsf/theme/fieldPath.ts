/**
 * DOM-contract path of a field (BENCH-CONTRACT §4: `personalData-lastName`, `properties-9-value`),
 * derived from the id RJSF generates for it, and the one error message a field shows.
 *
 * RJSF builds every id as `[idPrefix, ...path].join(idSeparator)` (`toFieldPathId` in @rjsf/utils),
 * so with the Form prop `idSeparator="-"` the contract path is the id without its `idPrefix-` head.
 * No field names are hard-coded here: nested objects and array rows get their path for free.
 */
import type { Registry } from '@rjsf/utils';
import type { SelectOption } from '../../../shared/ui/controls';

/**
 * What the bench theme reads from the Form's `formContext` (docs: "passed down to all fields and
 * widgets. Useful for implementing context aware fields and widgets"). Both keys are optional, so a
 * form without them (registration) behaves as plain RJSF.
 */
export interface BenchFormContext {
  /** Option lists of `ui:widget: 'remoteSelect'`, by the widget's `ui:options.optionsFrom`. */
  options?: Readonly<Record<string, readonly SelectOption[]>>;
  /** Contract paths whose errors are not shown yet (a field that appeared after a failed submit). */
  quiet?: ReadonlySet<string>;
}

type PathRegistry = Pick<Registry, 'globalFormOptions'>;

export function fieldPath(id: string, { globalFormOptions }: PathRegistry): string {
  const { idPrefix, idSeparator } = globalFormOptions;
  return id.slice(idPrefix.length + idSeparator.length);
}

/** The array's path from the path of one of its items: `properties-0` → `properties`. */
export function parentPath(path: string, { globalFormOptions }: PathRegistry): string {
  return path.slice(0, path.lastIndexOf(globalFormOptions.idSeparator));
}

/**
 * The one message a field shows: RJSF hands every message of the field (`rawErrors`); the rules
 * (`transformErrors`) leave the first violated one first. Nothing while RJSF hides the field's errors
 * (`hideError`) or while the form keeps the field quiet (`formContext.quiet`).
 */
export function shownError(
  path: string,
  rawErrors: readonly string[] | undefined,
  hideError: boolean | undefined,
  registry: Registry
): string | undefined {
  if (hideError || !rawErrors?.length) return undefined;
  const { quiet } = registry.formContext as BenchFormContext;
  return quiet?.has(path) ? undefined : rawErrors[0];
}
