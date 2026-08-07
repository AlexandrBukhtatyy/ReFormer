/**
 * Совместимость кита с рантаймом билдера — гейт СИМВОЛЬНЫЙ, а не semver.
 *
 * Спайк S1 показал, почему semver тут бесполезен: `@reformer/ui-kit@12.2.0` объявляет
 * `"@reformer/renderer-react": ">=1.0.0"`, локальный рантайм этот диапазон удовлетворяет — и всё
 * равно импорт падает на ЛИНКОВКЕ с «does not provide an export named 'useModelArrayItems'».
 * Открытые peer-диапазоны реальный контракт не выражают, поэтому решение принимает факт загрузки
 * и наличие нужных символов, а `kit.peerRanges` остаётся подсказкой для человека.
 *
 * Отказ должен быть ГРОМКИМ и объяснимым: сырой link error в консоли — худший исход, потому что
 * пользователь видит пустой билдер и не понимает причины.
 *
 * @module reformer-builder/kits/compat
 */

import type { KitEntry } from './registry';
import type { KitDescriptor, KitNamespace } from './types';

/** Результат попытки загрузить кит. */
export type KitLoadResult =
  | {
      ok: true;
      namespace: KitNamespace;
      /**
       * INFRA-имена, которых кит не поставил (напр. `List` отсутствует в ui-kit@11). Не ошибка:
       * билдер покажет для них подписанный стаб. Возвращаются, чтобы вызывающий мог предупредить.
       */
      missingInfra: string[];
    }
  | { ok: false; reason: string };

/** Символ, которого не хватило, из текста ошибки линковки ESM. */
function describeLinkError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const missing = /does not provide an export named '([^']+)'/.exec(message);
  const from = /module '([^']+)'/.exec(message);
  if (missing) {
    return from
      ? `рантайм билдера не экспортирует «${missing[1]}» из ${from[1]} — кит собран против более новой версии`
      : `рантайм билдера не экспортирует «${missing[1]}» — кит собран против более новой версии`;
  }
  return message.split('\n')[0];
}

/**
 * Загрузить namespace кита, превратив возможный отказ в структурированную причину.
 *
 * @param kit запись реестра
 * @param descriptor дескриптор этого кита (нужен, чтобы знать имена INFRA-символов)
 */
export async function loadKitNamespace(
  kit: KitEntry,
  descriptor: KitDescriptor
): Promise<KitLoadResult> {
  let namespace: KitNamespace;
  try {
    namespace = await kit.loadNamespace();
  } catch (err) {
    return { ok: false, reason: describeLinkError(err) };
  }

  // Без враппера поля форма не соберётся вообще — это единственный жёсткий минимум.
  if (!(descriptor.infra.fieldWrapper in namespace)) {
    return {
      ok: false,
      reason: `кит не поставляет враппер поля «${descriptor.infra.fieldWrapper}» — поля формы рендерить нечем`,
    };
  }

  const missingInfra = [descriptor.infra.asyncBoundary, descriptor.infra.list].filter(
    (name) => !(name in namespace)
  );
  return { ok: true, namespace, missingInfra };
}
