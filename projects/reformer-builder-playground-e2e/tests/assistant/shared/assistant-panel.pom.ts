/**
 * Панель ассистента как страница: подключение канала, поле ввода, лента, действия шапки.
 *
 * Локаторы — по `data-testid` плагина там, где у элемента нет устойчивого доступного имени
 * (реплика, строка инструмента, рассуждение), и по ролям там, где оно есть (настройки канала).
 * Строки — русские: локаль закреплена конфигом playground.
 *
 * @module tests/assistant/shared/assistant-panel.pom
 */

import { expect, type Locator, type Page } from '@playwright/test';
import { MODEL_ID } from './model-mock';

/** Как ассистент правит форму — значение переключателя в настройках канала. */
export type EditMode = 'structured' | 'files';

const MODE_LABEL: Readonly<Record<EditMode, string>> = {
  structured: 'Операциями редактора',
  files: 'Напрямую в файлах формы',
};

/** Сколько ждать вкладку ассистента на рейле: плагины проекта поднимаются после открытия. */
const PLUGINS_TIMEOUT = 60_000;

export class AssistantPanel {
  /** Кнопка ассистента на правом рейле. */
  readonly railButton: Locator;
  readonly composer: Locator;
  readonly sendButton: Locator;
  readonly stopButton: Locator;
  /** Лента диалога. Её нет, пока диалог пуст: тогда на её месте подсказка. */
  readonly feed: Locator;
  readonly entries: Locator;
  readonly userEntries: Locator;
  readonly assistantEntries: Locator;
  /** Индикатор идущего хода в конце ленты. */
  readonly working: Locator;
  /** Замечание к ходу — красная плашка над полем ввода. */
  readonly errorAlert: Locator;
  /** Набор правок, ждущий решения. */
  readonly changePreview: Locator;
  readonly undoTurnButton: Locator;
  readonly newConversationButton: Locator;
  readonly settingsButton: Locator;
  /** Подпись над полем ввода: какую форму правит следующий ход. */
  readonly composerTarget: Locator;
  /** Подписи формы над репликами пользователя — у первой и там, где форма сменилась. */
  readonly entryTargets: Locator;

  constructor(readonly page: Page) {
    this.railButton = page
      .getByRole('navigation', { name: 'Панели справа' })
      .getByRole('button', { name: 'Ассистент' });
    this.composer = page.getByTestId('ai-composer');
    this.sendButton = page.getByTestId('ai-send');
    this.stopButton = page.getByTestId('ai-stop');
    this.feed = page.getByTestId('ai-feed');
    this.entries = page.getByTestId('ai-entry');
    this.userEntries = page.locator('[data-testid="ai-entry"][data-role="user"]');
    this.assistantEntries = page.locator('[data-testid="ai-entry"][data-role="assistant"]');
    this.working = page.getByTestId('ai-working');
    this.errorAlert = page.getByTestId('ai-error');
    this.changePreview = page.getByTestId('ai-change-preview');
    this.undoTurnButton = page.getByTestId('chat-undo-turn');
    this.newConversationButton = page.getByTestId('chat-new-conversation');
    this.settingsButton = page.getByTestId('chat-settings');
    this.composerTarget = page.getByTestId('ai-composer-target');
    this.entryTargets = page.getByTestId('ai-entry-target');
  }

  /** Подпись формы над репликой пользователя. */
  entryTarget(request: Locator): Locator {
    return request.getByTestId('ai-entry-target');
  }

  /** Карточка вопросов модели — последняя в ленте. */
  questionCard(): Locator {
    return this.page.getByTestId('ai-question').last();
  }

  /**
   * Вариант ответа в карточке: переключатель (одиночный выбор) или флажок (несколько). Имя — по
   * началу подписи: в доступное имя входит и пояснение варианта, а «Обязательное» без якоря
   * нашлось бы и в «Необязательное».
   */
  option(label: string, card: Locator = this.questionCard()): Locator {
    const name = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    return card.getByRole('radio', { name }).or(card.getByRole('checkbox', { name }));
  }

  /** «Ответить» в карточке вопросов. */
  submitAnswer(card: Locator = this.questionCard()): Locator {
    return card.getByTestId('ai-question-submit');
  }

  /** Открывает панель с рейла — дождавшись, пока плагин ассистента поднимется. */
  async open(): Promise<void> {
    await expect(this.railButton).toBeVisible({ timeout: PLUGINS_TIMEOUT });
    await this.railButton.click();
  }

  /**
   * Подключает локальный канал к подменённой модели: открывает панель, выбирает провайдера,
   * загружает список моделей, режим правки — и «Подключить».
   */
  async connect(options: { mode?: EditMode } = {}): Promise<void> {
    await this.open();
    await this.settingsButton.click();
    await this.page.getByRole('combobox', { name: 'Провайдер' }).click();
    await this.page.getByRole('option', { name: 'Локальный (OpenAI-совместимый)' }).click();
    await this.page.getByRole('button', { name: 'Загрузить список моделей' }).click();
    await expect(this.page.getByRole('combobox', { name: 'Модель' })).toHaveText(MODEL_ID);
    const mode = options.mode ?? 'structured';
    if (mode !== 'structured') {
      await this.page.getByRole('combobox', { name: 'Как ассистент правит форму' }).click();
      await this.page.getByRole('option', { name: MODE_LABEL[mode] }).click();
    }
    await this.page.getByRole('button', { name: 'Подключить' }).click();
    await expect(this.composer).toBeVisible();
  }

  /**
   * Отправляет реплику — Enter в поле ввода, как человек.
   *
   * По умолчанию ждёт, пока ход начнётся (в ленте появятся реплика и ответ под неё): ход
   * стартует после чтения настроек, и без этого ожидания «ход закончился» было бы видно ещё до
   * его начала. `turn: false` — для случаев, когда хода не будет (нет формы, нет канала).
   */
  async send(text: string, options: { turn?: boolean } = {}): Promise<void> {
    const before = await this.entries.count();
    await this.composer.fill(text);
    await this.composer.press('Enter');
    if (options.turn !== false) await expect(this.entries).toHaveCount(before + 2);
  }

  /** Ждёт конца хода: индикатор погас, вместо «Остановить» снова «Отправить». */
  async waitIdle(): Promise<void> {
    await expect(this.working).toBeHidden();
    await expect(this.sendButton).toBeVisible();
  }

  /** Отправляет реплику и ждёт конца хода. */
  async ask(text: string): Promise<void> {
    await this.send(text);
    await this.waitIdle();
  }

  /** Реплика ассистента по номеру хода, с нуля; `-1` — последняя. */
  answer(turn: number): Locator {
    return turn < 0 ? this.assistantEntries.last() : this.assistantEntries.nth(turn);
  }

  /** Реплика пользователя по номеру хода, с нуля; `-1` — последняя. */
  request(turn: number): Locator {
    return turn < 0 ? this.userEntries.last() : this.userEntries.nth(turn);
  }

  /** Текст реплики (без кнопок и рассуждения). */
  message(entry: Locator): Locator {
    return entry.getByTestId('ai-message');
  }

  /** Строки журнала инструментов реплики ассистента. */
  toolLines(entry: Locator): Locator {
    return entry.getByTestId('ai-tool-line');
  }

  /** Строки журнала, отмеченные как неудачные. */
  failedToolLines(entry: Locator): Locator {
    return entry.locator('[data-testid="ai-tool-line"][data-ok="false"]');
  }

  reasoningToggle(entry: Locator): Locator {
    return entry.getByTestId('ai-reasoning-toggle');
  }

  /** Блок рассуждения — виден, только когда развёрнут. */
  reasoning(entry: Locator): Locator {
    return entry.getByTestId('ai-reasoning');
  }

  /** Разворачивает рассуждение реплики. */
  async expandReasoning(entry: Locator): Promise<Locator> {
    await this.reasoningToggle(entry).click();
    const block = this.reasoning(entry);
    await expect(block).toBeVisible();
    return block;
  }

  /** «Восстановить» на реплике пользователя. */
  restoreButton(request: Locator): Locator {
    return request.getByRole('button', { name: 'Восстановить' });
  }

  /** Останавливает идущий ход. */
  async stop(): Promise<void> {
    await this.stopButton.click();
  }
}
