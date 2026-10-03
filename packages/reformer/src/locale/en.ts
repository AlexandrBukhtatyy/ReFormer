/**
 * Английская локаль ядра — синхронный модуль (`@reformer/core/locale/en`). Нужен для SSR и
 * тестов; загрузчик `loadCoreLocale` импортирует его же отдельным чанком.
 *
 * @module locale/en
 */

import messages from '../i18n/en.json';
import type { FormLocale } from '../i18n/locale';

export const en: FormLocale = { code: 'en', weekStartsOn: 0, messages };
