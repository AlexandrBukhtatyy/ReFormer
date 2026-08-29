/// <reference types="vitest" />

import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

/**
 * Второй прогон — в НАСТОЯЩЕМ браузере. Отдельный файл, а не проект внутри
 * [vitest.config.ts](vitest.config.ts), сознательно: там `npx vitest run` обязан остаться
 * прогоном на 7-8 секунд, а объединение проектов сделало бы каждый быстрый прогон запуском
 * Chromium.
 *
 * ## Почему браузер, а не jsdom
 *
 * Дыра, ради которой конфиг заведён, названа четырьмя агентами независимо: `.tsx` не попадали
 * в прогон вовсе. Из перечисленного ими непроверяемого **jsdom не закрывает большинство**:
 *
 * - `new CSSStyleSheet()` + `replaceSync()` + `document.adoptedStyleSheets` — механизм изоляции
 *   стилей плагина (`host/plugin/styles`). jsdom конструируемых таблиц не реализует вовсе;
 *   в нём этот код нечем проверить, кроме подделки — а подделка проверяет подделку;
 * - **геометрия и CSS.** У jsdom нет ни движка раскладки, ни каскада: `getComputedStyle` отдаёт
 *   объявленное, а не вычисленное, любая высота — `0px`, `getBoundingClientRect` — нули.
 *   Утверждения вида «`h-auto` вместо `h-full` кита, иначе список схлопнется» в нём
 *   не выразимы;
 * - **тёмная тема** — это каскад пользовательских свойств, то есть тот же вычисленный стиль;
 * - **ловушка фокуса Radix** и `inert` на фоне: `inert` в jsdom не влияет на фокусируемость,
 *   и «Tab не уходит наружу» проверялось бы не тем.
 *
 * Цена, которую этот выбор берёт: одна новая зависимость (`@vitest/browser`) и запуск Chromium.
 * Второе оплачено заранее — `@playwright/test` и браузеры в монорепо уже стоят ради e2e,
 * так что в CI это не новая установка.
 *
 * ## Имя файлов
 *
 * `*.browser.test.tsx` — расширение выбрано так, чтобы `include` node-прогона
 * (`src/**\/*.test.ts`) их не подобрал ни при каких обстоятельствах: у node-прогона расширение
 * `.ts`, у браузерного `.tsx`, и путаница невозможна даже при копировании файла.
 *
 * Запуск: `npm run test:browser` (он же `npx vitest run -c vitest.browser.config.ts`).
 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // Тот же dedupe, что в vite.config.ts: без одной копии React и Radix контекст диалога
    // не находится, и ловушка фокуса проверялась бы на другом дереве, чем в приложении.
    dedupe: ['react', 'react-dom', 'radix-ui', '@preact/signals-core'],
    alias: { '@': path.resolve(__dirname, './src') },
  },
  // Подсветка блоков кода грузится динамическим импортом, а Vite предзаготавливает
  // зависимости по СТАТИЧЕСКИМ импортам. Без этой строки первый же тест с блоком кода
  // получает «Failed to fetch dynamically imported module» и перезагрузку прогона.
  optimizeDeps: { include: ['highlight.js/lib/common'] },
  test: {
    name: 'browser',
    include: ['src/**/*.browser.test.tsx'],
    setupFiles: ['./src/testing/browser-setup.ts'],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // Один экземпляр: приложение и так требует Chromium (File System Access), проверять
      // раскладку в Firefox значило бы охранять то, что не поддерживается.
      instances: [{ browser: 'chromium' }],
      screenshotFailures: false,
    },
  },
});
