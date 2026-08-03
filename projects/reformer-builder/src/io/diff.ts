/**
 * Построчный diff для diff-preview сохранения (спека §7.3: два столбца «текущий файл / после
 * сохранения» + счётчик `+N −M`). LCS-DP — чистая функция, тестируется.
 *
 * @module reformer-builder/io/diff
 */

/** Операция diff'а над строкой. */
export interface DiffOp {
  type: 'same' | 'add' | 'del';
  text: string;
}

/** Построчный diff (LCS). `del` — строки старого текста, `add` — нового. */
export function diffLines(oldText: string, newText: string): DiffOp[] {
  const a = oldText.split('\n');
  const b = newText.split('\n');
  const m = a.length;
  const n = b.length;

  // dp[i][j] — длина LCS суффиксов a[i..], b[j..]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      ops.push({ type: 'same', text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ type: 'del', text: a[i] });
      i++;
    } else {
      ops.push({ type: 'add', text: b[j] });
      j++;
    }
  }
  while (i < m) ops.push({ type: 'del', text: a[i++] });
  while (j < n) ops.push({ type: 'add', text: b[j++] });
  return ops;
}

/** Счётчик изменений: добавлено/удалено строк. */
export function diffStat(ops: DiffOp[]): { added: number; removed: number } {
  let added = 0;
  let removed = 0;
  for (const op of ops) {
    if (op.type === 'add') added++;
    else if (op.type === 'del') removed++;
  }
  return { added, removed };
}

/** Есть ли изменения между текстами (для «нет правок → нулевой diff»). */
export function hasChanges(oldText: string, newText: string): boolean {
  return oldText !== newText;
}
