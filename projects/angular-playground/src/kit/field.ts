/**
 * Общее для полей кита на Taiga UI: входы поля, testid DOM-контракта и текст ошибки.
 *
 * Контрол кита — самодостаточное поле: подпись и ошибку рисует он сам, обёртки поля у кита нет.
 * Для этого контрол объявляет две статики ReFormer: `reformerLayout = 'inline-label'` — получить
 * `label`, и `reformerNeedsControl` — получить ноду поля, из которой берётся текст показанной
 * ошибки. Роли `field-`, `label-`, `input-` и `error-{путь}` контрол расставляет сам.
 */
import { Directive, computed, input, output } from '@angular/core';
import type { FormControl } from '@reformer/core';
import { fieldError } from '@reformer/renderer-angular';

/** Пункт списка или группы радиокнопок, как его задаёт документ формы. */
export interface Option {
  value: string;
  label: string;
}

const INPUT_PREFIX = 'input-';

/**
 * Текст для `tui-error`: он выводит строку как HTML, поэтому разметка в тексте экранируется — текст
 * в DOM совпадает с текстом замечания посимвольно.
 */
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;');
}

/**
 * Основа контрола кита. Хост контрола — корень поля: на нём роль `field-{id}`.
 *
 * Рендерер отдаёт контролу `data-testid="input-{id}"`: `id` — путь поля через дефис либо явный
 * `testId` из схемы. Вход с этим именем контрол объявляет сам — иначе рендерер поставил бы атрибут
 * на хост, — и строит из `id` остальные роли.
 */
@Directive({
  host: { '[attr.data-testid]': 'testIdOf("field")' },
})
export abstract class KitField {
  /** Подпись поля — контролу, а не обёртке. */
  static readonly reformerLayout = 'inline-label';
  /** Нода поля — источник текста ошибки. */
  static readonly reformerNeedsControl = true;

  readonly control = input.required<FormControl<unknown>>();
  readonly label = input<string>();
  readonly disabled = input(false);
  /** `input-{id}` от рендерера. */
  readonly testId = input<string | undefined>(undefined, { alias: 'data-testid' });
  /**
   * Уход фокуса с поля: рендерер помечает поле тронутым. Выход объявлен, чтобы рендерер не ставил
   * слушатель `focusout` на корень поля: фокус уходит и внутри поля, на кнопку или в панель списка.
   */
  readonly blur = output<void>();

  /** Идентификатор поля в testid. */
  protected readonly id = computed(() => {
    const testId = this.testId();
    return testId?.startsWith(INPUT_PREFIX) ? testId.slice(INPUT_PREFIX.length) : undefined;
  });

  /** Текст показанного замечания либо `undefined`. */
  protected readonly error = fieldError(this.control);

  protected readonly escape = escapeHtml;

  /** testid роли: `field-{id}`, `label-{id}`, … Без `id` атрибута нет. */
  protected testIdOf(role: string, suffix?: string): string | null {
    const id = this.id();
    if (id === undefined) return null;
    return suffix === undefined ? `${role}-${id}` : `${role}-${id}-${suffix}`;
  }
}
