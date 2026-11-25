/**
 * Общее для полей кита на Taiga UI: входы поля, testid, текст ошибки, зеркало поля.
 *
 * Контрол кита — самодостаточное поле: подпись и ошибку рисует он сам, обёртки поля у кита нет.
 * Для этого контрол объявляет статики ReFormer: `reformerLayout = 'inline-label'` — получить
 * `label` и `required`, и `reformerNeedsControl` — получить ноду поля, из которой берётся текст
 * показанной ошибки. Роли `field-`, `label-`, `input-` и `error-{testId}` контрол расставляет сам —
 * так же, как их ставят поле и контролы `@reformer/ui-kit`.
 */
import { DestroyRef, Directive, computed, inject, input, output, type OnInit } from '@angular/core';
import type { FormControl as AngularFormControl } from '@angular/forms';
import type { FormControl } from '@reformer/core';
import { fieldError } from '@reformer/renderer-angular';
import { mirrorControl } from './mirror';

/** Пункт списка или группы радиокнопок — как его задаёт схема формы. */
export interface Option {
  value: string | number | boolean;
  label: string;
  disabled?: boolean;
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
 * Рендерер отдаёт контролу `data-testid="input-{id}"`: `id` — явный `testId` из схемы либо путь
 * поля через дефис. Вход с этим именем контрол объявляет сам — иначе рендерер поставил бы атрибут на
 * хост, — и строит из `id` остальные роли.
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
  readonly required = input(false);
  readonly disabled = input(false);
  /** Подсказка поля из схемы: у полей Taiga ей места нет, вход объявлен, чтобы не лечь атрибутом. */
  readonly tooltip = input<string>();
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

  /** Подпись с пометкой обязательного поля. */
  protected readonly labelText = computed(() => {
    const label = this.label();
    return label && this.required() ? `${label} *` : (label ?? '');
  });

  /** Текст показанного замечания либо `undefined`. */
  protected readonly error = fieldError(this.control);

  protected readonly escape = escapeHtml;

  /** testid роли: `field-{id}`, `label-{id}`, … Без `id` атрибута нет. */
  protected testIdOf(role: string, suffix?: unknown): string | null {
    const id = this.id();
    if (id === undefined) return null;
    return suffix === undefined ? `${role}-${id}` : `${role}-${id}-${String(suffix)}`;
  }
}

/**
 * Контрол на зеркале поля — для виджетов Taiga, которым нужен `NgControl`. Значение и `disabled`
 * контрол берёт из зеркала: входа `value` у него нет, и рендерер значение не передаёт. Нода поля у
 * контрола одна на всё время жизни.
 */
@Directive()
export abstract class KitMirrorField<T> extends KitField implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  /** Зеркало ноды поля: создаётся, когда пришёл вход `control`, до первой отрисовки. */
  protected mirror!: AngularFormControl<T>;

  ngOnInit(): void {
    this.mirror = mirrorControl(this.control() as FormControl<T>, this.destroyRef);
  }
}
