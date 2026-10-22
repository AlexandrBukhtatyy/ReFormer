/**
 * Ход, на время которого человек правит форму руками, — источник превью конфликта.
 *
 * Внешнюю правку «диска» билдер разбирает только при сохранении, поэтому форма правится там,
 * где её правит человек, — в исходнике, открытом редактором кода.
 *
 * @module tests/assistant/shared/hand-edit
 */

import { expect, type Page } from '@playwright/test';
import type { BuilderApp } from '../../shared/builder-app.pom';
import type { AssistantPanel } from './assistant-panel.pom';
import { call, say, type ModelMock } from './model-mock';
import { inputNode } from './forms';

const MONACO_SCOPE = '[data-rb-plugin="reformer.editor-monaco"]';

/** Метка ручной правки — латиницей: символы вне латиницы Playwright шлёт мимо Monaco. */
export const HAND_EDIT = 'HANDEDIT';

/** Подпись поля, которое вставляет ход. */
export const AGENT_FIELD = 'Поле ассистента';

/**
 * Ход по активной форме контактов (`FORM_A`): модель вставляет поле, а пока запрос удержан,
 * человек дописывает метку в подсказку имени. Возвращается, когда ход закончился.
 */
export async function turnWithHandEdit(
  builder: BuilderApp,
  page: Page,
  model: ModelMock,
  panel: AssistantPanel
): Promise<void> {
  const gate = model.held(
    call('insert_node', { parent: '/root', nodes: [inputNode('agentField', AGENT_FIELD)] })
  );
  model.reply(say('Добавил поле.'));
  await panel.send('Добавь поле.');
  await gate.reached;

  await builder.openPalette('Показать исходник');
  await builder.paletteOption('Показать исходник').click();
  const editor = page.locator(`${MONACO_SCOPE} .monaco-editor`).filter({ visible: true }).first();
  await editor.locator('.view-line', { hasText: 'Как к вам обращаться' }).first().click();
  await page.keyboard.press('End');
  // Курсор — перед закрывающей кавычкой: метка ложится внутрь строки, JSON остаётся целым.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.type(HAND_EDIT, { delay: 50 });
  await expect(builder.statusBar).toContainText('1 несохранённый файл');

  gate.release();
  await panel.waitIdle();
}
