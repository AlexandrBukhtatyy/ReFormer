import { defineConfig } from 'vitest/config';
import { sourceAliases } from '../../.shared/vitest';

// Тесты плагина — в node: связь с буфером, разметка, состояние вида, состав вкладов.
// Сам Monaco здесь не грузится: он нужен только телу редактора, а его проверяет браузер.
export default defineConfig({
  resolve: { alias: sourceAliases },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
