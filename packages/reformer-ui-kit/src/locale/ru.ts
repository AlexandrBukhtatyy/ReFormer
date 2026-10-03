/**
 * Русская локаль кита — синхронный модуль (`@reformer/ui-kit/locale/ru`): словари ядра и cdk плюс
 * подписи кита. Нужен для SSR и тестов; загрузчик `loadKitLocale` импортирует его же отдельным
 * чанком.
 *
 * @module locale/ru
 */

import { extendLocale, type FormLocale } from '@reformer/core/i18n';
import { ru as cdkRu } from '@reformer/cdk/locale/ru';
import type { KitMessageKey } from '../i18n/message-default';
import ruJson from '../i18n/ru.json';

// Полноту перевода проверяет компилятор: ключ, забытый в ru.json, — ошибка типов здесь.
const messages: Record<KitMessageKey, string> = ruJson;

export const ru: FormLocale = extendLocale(cdkRu, { messages });
