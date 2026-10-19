/**
 * Подготовка браузерного прогона кита: готовый CSS дизайн-системы HexaUI.
 *
 * В билдере его приносит манифест плагина (`src/builder-plugin.css`, изоляция `scoped`), в
 * приложении — вход пакета (`src/index.ts`). Тест рисует компоненты без оболочки, поэтому
 * подключает CSS сам — иначе раскладка (а с ней и попадание кликов) была бы не той, что у людей.
 *
 * @module reformer/kit-hexa-ui/testing/browser-setup
 */

import '@kaspersky/hexa-ui/design-system/global-style/styles.css';
