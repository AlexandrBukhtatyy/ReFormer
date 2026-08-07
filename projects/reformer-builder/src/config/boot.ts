/**
 * Бутстрап runtime-конфигурации: загрузить клиентский bundle, активировать выбранный кит и
 * применить «ранние» эффекты (заголовок вкладки), которые должны отработать до рендера `App`.
 * Вызывается из `main.tsx` ПЕРЕД динамическим импортом графа приложения — так `store`/`catalog`
 * инициализируются уже с конфигом и уже с namespace нужного кита.
 *
 * Порядок обязателен: `getCatalog()`, реестр превью и монако-диагностика мемоизируются на графе
 * модулей, поэтому кит должен быть выбран ДО первого импорта `App`.
 *
 * @module reformer-builder/config/boot
 */

import { loadRuntimeBundle } from './load';
import { getRuntimeConfig } from './state';
import { toDescriptor } from '../kits/descriptor';
import { getKitOrDefault, getKit, DEFAULT_KIT_ID, type KitEntry } from '../kits/registry';
import { clearSelectedKitId, getSelectedKitId } from '../kits/selection';
import { loadKitNamespace } from '../kits/compat';
import { setActiveNamespace } from '../kits/runtime';

/** Что случилось с активацией кита — показывается пользователю после старта. */
export interface KitBootResult {
  kit: KitEntry;
  /** Кит из localStorage не активировался, откатились на дефолтный; текст — причина. */
  fallbackReason?: string;
  /** INFRA-компоненты, которых кит не поставил (не ошибка: рисуем стаб). */
  missingInfra: string[];
}

let bootResult: KitBootResult | null = null;

/** Итог активации кита (для баннера/тоста в оболочке). `null` — бутстрап ещё не отработал. */
export function getKitBootResult(): KitBootResult | null {
  return bootResult;
}

/**
 * Активировать кит: загрузить его namespace и положить в рантайм.
 *
 * Провал НЕ фатален — это тот же принцип graceful degradation, что и у отсутствующего
 * runtime-bundle (`fetchRuntimeBundle → null → дефолты`). Пользователь с несовместимым китом должен
 * получить работающий билдер и внятное объяснение, а не пустой экран.
 */
async function activateKit(): Promise<KitBootResult> {
  const selectedId = getSelectedKitId();
  const kit = getKitOrDefault(selectedId);

  const result = await loadKitNamespace(kit, toDescriptor(kit.catalog));
  if (result.ok) {
    setActiveNamespace(result.namespace);
    return { kit, missingInfra: result.missingInfra };
  }

  // Выбранный кит не поднялся. Забываем выбор, чтобы следующий старт не упирался в то же самое.
  clearSelectedKitId();
  const fallbackReason = `${kit.label} ${kit.version}: ${result.reason}`;
  const fallback = getKit(DEFAULT_KIT_ID)!;
  if (kit.id !== fallback.id) {
    const retry = await loadKitNamespace(fallback, toDescriptor(fallback.catalog));
    if (retry.ok) {
      setActiveNamespace(retry.namespace);
      return { kit: fallback, fallbackReason, missingInfra: retry.missingInfra };
    }
  }
  // Даже дефолтный кит не поднялся — оставляем namespace по умолчанию из `kits/runtime`.
  return { kit: fallback, fallbackReason, missingInfra: [] };
}

/** Загрузить конфиг/каталог клиента, активировать кит, применить ранние эффекты. */
export async function bootRuntime(): Promise<void> {
  await loadRuntimeBundle();
  bootResult = await activateKit();
  if (bootResult.fallbackReason) {
    console.error(`[reformer-builder] кит не активирован — ${bootResult.fallbackReason}`);
  }
  const title = getRuntimeConfig().branding?.title;
  if (title) document.title = title;
}
