export function combineClasses(...args: Array<string | undefined>): string {
  return args.filter(Boolean).join(' ');
}
