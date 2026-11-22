/**
 * zod helpers for schemas used with `zodResolver`.
 *
 * Every field rule here produces a *continuable* issue (zod's default for checks), so object-level
 * `.refine()` / `.superRefine()` — cross-field rules, conditional sections — still run while some
 * fields are invalid and one "Далее"/submit reports every field's first issue at once.
 */
import * as z from 'zod';

type ServerCheck<T> = (value: T) => Promise<boolean | undefined>;

/**
 * Adapts a shared-client check (`true` ok, `false` rejected, `undefined` superseded by a later
 * call) to a zod refinement predicate: only an explicit `false` is an error.
 */
export const serverCheck =
  <T>(check: ServerCheck<T>) =>
  async (value: T): Promise<boolean> =>
    (await check(value)) !== false;

/**
 * zod `when` for an async refinement: run it only if the field's earlier (sync) rules produced no
 * issue. zod checks are continuable by default, so without it the server would be asked about
 * values that already failed a sync rule.
 */
export const afterSyncRules = (payload: z.core.ParsePayload): boolean =>
  payload.issues.length === 0;

/**
 * `number | null` field (empty number input → `null`): `null` fails `required`, a number runs the
 * checks of `schema` (`.min()`, `.max()`). `z.number()` alone would turn `null` into a type issue,
 * which is not continuable and would silence every object-level rule of the form.
 */
export const requiredNumber = (schema: z.ZodNumber, message: string) =>
  schema.nullable().refine((value) => value !== null, message);

/** Optional text field: `''` (not filled) or a value that passes `schema` (zod `union`). */
export const orEmpty = (schema: z.ZodType<string, string>) => z.union([z.literal(''), schema]);

/**
 * Inside `.superRefine()` of an object: validates `value` with `section` — an object schema over some
 * of the same keys — and reports its issues at the same paths. Used for conditional sections: their
 * rules apply only while the section is shown.
 */
export function reportSection(ctx: z.RefinementCtx, section: z.ZodType, value: unknown): void {
  const result = section.safeParse(value);
  if (result.success) return;
  for (const issue of result.error.issues) {
    ctx.addIssue({ code: 'custom', path: issue.path, message: issue.message });
  }
}
