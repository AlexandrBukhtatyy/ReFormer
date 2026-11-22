import type { StringSchema } from 'yup';

/** Shared API check: `true` — ok, `false` — rejected, `undefined` — superseded (no error). */
export type ServerCheck = (value: string) => Promise<boolean | undefined>;

/**
 * Appends an async Yup test that asks the server only for a value that already passes `schema`'s
 * synchronous rules (BENCH-CONTRACT §3).
 *
 * The gate has to be explicit: Formik validates with `abortEarly: false`, and Yup then runs every
 * test of a field, so an async test placed after `min`/`matches` would still fire for a value those
 * rules reject. `schema` is the field's sync-only schema, captured before the async test is added.
 * Being declared last, the async test also never outranks a sync message (one message per field —
 * Formik keeps the first Yup error per path).
 */
export function withServerCheck(
  schema: StringSchema<string>,
  name: string,
  message: string,
  check: ServerCheck
): StringSchema<string> {
  return schema.test(
    name,
    message,
    async (value) => !schema.isValidSync(value) || (await check(value)) !== false
  );
}
