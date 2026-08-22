/**
 * Бюджет выдачи: собрать ответ под потолок токенов, не порезав главное.
 *
 * Зачем. Замерено на этом сервере: `list_symbols({})` отдаёт 20 591 токен, крупный рецепт —
 * до 4 283. Это ответы ИНСТРУМЕНТОВ, то есть то, что агент получает не глядя, в отличие от
 * явного `resources/read`. Пока таких выдач не было потолка, одна неудачная формулировка
 * стоила больше, чем весь остальной диалог.
 *
 * Принцип — не «резать всё пропорционально», а «отдать сначала главное». Куски идут в порядке
 * приоритета: сигнатура и канонический пример важнее списка «см. также», поэтому при нехватке
 * бюджета выпадает хвост, а не начало. Обрезанный кусок ВСЕГДА помечается, потому что молча
 * усечённый пример хуже отсутствующего: агент допишет его сам и получит несуществующий API.
 */

/**
 * Оценка токенов. Та же формула, что в eval (`chars / 4`) — иначе бюджет и метрика жили бы
 * в разных единицах и сравнивать их было бы нельзя.
 */
export function estimateTokens(text: string): number {
  return Math.ceil(String(text).length / 4);
}

/** Кусок будущего ответа. Чем меньше `priority`, тем раньше он попадёт в выдачу. */
export interface Chunk {
  /** Порядок важности: 0 — обязателен, дальше по убыванию. */
  priority: number;
  /** Готовый markdown. */
  text: string;
  /**
   * Можно ли обрезать этот кусок по строкам, если он не влезает целиком.
   * Для кода — да (с пометкой), для короткой сводки — бессмысленно.
   */
  truncatable?: boolean;
}

export interface AssembledContext {
  text: string;
  /** Сколько токенов заняла выдача по нашей оценке. */
  tokens: number;
  /** Куски, не попавшие в бюджет, — их видно в подсказке «что осталось». */
  dropped: number;
  /** Был ли хоть один кусок урезан. */
  truncated: boolean;
}

/** Обрезать текст по строкам под лимит символов, оставив явную пометку. */
function truncateToChars(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const lines = text.split('\n');
  const kept: string[] = [];
  let used = 0;
  for (const line of lines) {
    if (used + line.length + 1 > maxChars) break;
    kept.push(line);
    used += line.length + 1;
  }
  // Незакрытый код-фенс после обрезки сломал бы разметку у клиента.
  const fences = kept.filter((l) => /^\s*```/.test(l)).length;
  if (fences % 2 === 1) kept.push('```');
  return `${kept.join('\n')}\n_(обрезано: ${text.length - used} символов не влезло в бюджет)_`;
}

/**
 * Собрать куски под бюджет.
 *
 * @param chunks    - Куски ответа; порядок задаётся полем `priority`, а не позицией в массиве.
 * @param maxTokens - Потолок. `null`/`undefined` — без ограничения.
 */
export function assemble(chunks: Chunk[], maxTokens?: number | null): AssembledContext {
  const ordered = [...chunks].sort((a, b) => a.priority - b.priority);
  if (maxTokens == null || !Number.isFinite(maxTokens) || maxTokens <= 0) {
    const text = ordered.map((c) => c.text).join('\n\n');
    return { text, tokens: estimateTokens(text), dropped: 0, truncated: false };
  }

  const parts: string[] = [];
  let used = 0;
  let dropped = 0;
  let truncated = false;

  for (const chunk of ordered) {
    const cost = estimateTokens(chunk.text);
    const left = maxTokens - used;
    if (cost <= left) {
      parts.push(chunk.text);
      used += cost;
      continue;
    }
    // Не влезает целиком. Режем только если это осмысленно и остаётся хоть сколько-то места:
    // огрызок в две строки не помогает, а бюджет съедает.
    if (chunk.truncatable && left > 40) {
      parts.push(truncateToChars(chunk.text, left * 4));
      used = maxTokens;
      truncated = true;
      continue;
    }
    dropped++;
  }

  const text = parts.join('\n\n');
  return { text, tokens: estimateTokens(text), dropped, truncated };
}
