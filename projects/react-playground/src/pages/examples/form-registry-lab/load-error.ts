/**
 * Разбор отказа загрузки до настоящей причины.
 *
 * `loadForm` оборачивает ЛЮБОЙ отказ части в `FormLoadError` с одним и тем же текстом
 * «не загрузилось по сети (url)». Для 404, для отданного вместо JSON html, для оборванной сети и для
 * отменённого запроса сообщение выходит буквально одинаковым — и по нему невозможно понять, что
 * чинить. Машиночитаемая причина при этом есть, но лежит глубже: `FormFetchError` несёт `kind`
 * и `status`, а связывает их цепочка `cause`.
 *
 * @module react-playground/examples/form-registry-lab/load-error
 */

/** Причины из `FormFetchError`. Дублируются здесь, чтобы дать человеку подсказку по каждой. */
const KIND_HINT: Record<string, string> = {
  'http-error': 'Сервер ответил кодом ошибки. Проверьте, что схема лежит по этому адресу.',
  'not-json':
    'Ответ пришёл не с JSON-типом. Классика: dev-сервер не нашёл файл и отдал index.html со статусом 200.',
  'not-a-form-schema': 'JSON получен, но в нём нет поля root — это не схема формы.',
  network: 'До сервера не достучались: он не поднят, перезапускается или адрес недоступен.',
  aborted: 'Запрос отменён — обычно потому, что ждать его стало некому.',
};

export interface LoadErrorDetail {
  /** Верхнее сообщение — то же, что печатает загрузчик. */
  message: string;
  kind?: string;
  status?: number;
  url?: string;
  hint?: string;
  /** Вся цепочка `cause`, от верхнего к нижнему. */
  chain: string[];
}

const asRecord = (v: unknown): Record<string, unknown> | undefined =>
  typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined;

export function describeLoadError(error: Error): LoadErrorDetail {
  const detail: LoadErrorDetail = { message: error.message, chain: [] };

  let current: unknown = error;
  // Потолок на случай замкнутой цепочки: она обошлась бы дороже самой ошибки.
  for (let depth = 0; depth < 6 && current; depth++) {
    const node = asRecord(current);
    if (!node) break;
    if (typeof node.message === 'string') detail.chain.push(node.message);
    if (detail.kind === undefined && typeof node.kind === 'string') detail.kind = node.kind;
    if (detail.status === undefined && typeof node.status === 'number') detail.status = node.status;
    if (detail.url === undefined && typeof node.url === 'string') detail.url = node.url;
    current = node.cause;
  }

  if (detail.kind) detail.hint = KIND_HINT[detail.kind];
  return detail;
}
