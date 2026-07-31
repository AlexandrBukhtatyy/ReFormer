/**
 * Бутстрап runtime-конфигурации: загрузить клиентский bundle и применить «ранние» эффекты
 * (заголовок вкладки), которые должны отработать до рендера `App`. Вызывается из `main.tsx` ПЕРЕД
 * динамическим импортом графа приложения — так `store`/`catalog` инициализируются уже с конфигом.
 *
 * @module reformer-builder/config/boot
 */

import { loadRuntimeBundle } from './load';
import { getRuntimeConfig } from './state';

/** Загрузить конфиг/каталог клиента и применить ранние эффекты. Бросает при невалидном файле. */
export async function bootRuntime(): Promise<void> {
  await loadRuntimeBundle();
  const title = getRuntimeConfig().branding?.title;
  if (title) document.title = title;
}
