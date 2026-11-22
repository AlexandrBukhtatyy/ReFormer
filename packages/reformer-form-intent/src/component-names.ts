/** Имя из `names`, равное `name` без учёта регистра; `null` — такого нет. */
export function nameIgnoringCase(name: string, names: Iterable<string>): string | null {
  const lower = name.toLowerCase();
  for (const candidate of names) {
    if (candidate.toLowerCase() === lower) return candidate;
  }
  return null;
}
