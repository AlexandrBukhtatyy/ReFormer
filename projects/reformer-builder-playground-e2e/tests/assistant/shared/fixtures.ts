/**
 * Фикстуры e2e ассистента: общие фикстуры билдера плюс подменённая модель и панель.
 *
 * Тесты ассистента импортируют `test` и `expect` отсюда.
 *
 * @module tests/assistant/shared/fixtures
 */

import { test as base, expect } from '../../shared/fixtures';
import { AssistantPanel } from './assistant-panel.pom';
import { installModelMock, type ModelMock } from './model-mock';

interface AssistantFixtures {
  /**
   * Модель с очередью ответов. Подмена ставится до открытия билдера; запрос, на который
   * в очереди не нашлось ответа, проваливает тест — сценарий ждал меньше шагов, чем случилось.
   */
  model: ModelMock;
  panel: AssistantPanel;
}

export const test = base.extend<AssistantFixtures>({
  // Автоматическая: подмена стоит в каждом тесте, даже если он её не называет, и даже в хуках
  // `beforeEach` (фикстуры тела теста поднимаются после них). Иначе запрос уходил на настоящий
  // локальный сервер — на машине с запущенным Ollama тест подключался к чужой модели.
  model: [
    async ({ page }, use) => {
      const model = await installModelMock(page);
      await use(model);
      expect(model.unanswered, 'запросы модели без ответа в сценарии (номера по порядку)').toEqual(
        []
      );
    },
    { auto: true },
  ],

  panel: async ({ page }, use) => {
    await use(new AssistantPanel(page));
  },
});

export { expect };
