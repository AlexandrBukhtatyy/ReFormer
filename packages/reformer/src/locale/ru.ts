/**
 * Русская локаль ядра — синхронный модуль (`@reformer/core/locale/ru`). Нужен для SSR и тестов;
 * загрузчик `loadCoreLocale` импортирует его же отдельным чанком.
 *
 * @module locale/ru
 */

import type enJson from '../i18n/en.json';
import ruJson from '../i18n/ru.json';
import type { FormLocale } from '../i18n/locale';

// Полноту перевода проверяет компилятор: ключ, забытый в ru.json, — ошибка типов здесь.
const messages: Record<keyof typeof enJson, string> = ruJson;

export const ru: FormLocale = { code: 'ru', weekStartsOn: 1, messages };
