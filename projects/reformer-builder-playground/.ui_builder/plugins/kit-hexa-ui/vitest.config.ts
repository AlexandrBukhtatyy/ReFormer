import { defineConfig } from 'vitest/config';

// Тесты плагина — в node: они проверяют вклад плагина и данные кита, а не отрисовку. Сам HexaUI
// (antd, styled-components) в node не исполняется, и тесты его намеренно не грузят.
export default defineConfig({
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
