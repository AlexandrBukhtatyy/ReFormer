/**
 * Русская локаль cdk — синхронный модуль (`@reformer/cdk/locale/ru`): словарь ядра плюс строки
 * cdk. Нужен для SSR и тестов; загрузчик `loadCdkLocale` импортирует его же отдельным чанком.
 *
 * @module locale/ru
 */

import { extendLocale, type FormLocale } from '@reformer/core/i18n';
import { ru as coreRu } from '@reformer/core/locale/ru';
import type { CdkMessageKey } from '../i18n/messages';
import ruJson from '../i18n/ru.json';

// Полноту перевода проверяет компилятор: ключ, забытый в ru.json, — ошибка типов здесь.
const messages: Record<CdkMessageKey, string> = ruJson;

export const ru: FormLocale = extendLocale(coreRu, { messages });
