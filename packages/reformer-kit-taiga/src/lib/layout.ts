/**
 * Контейнеры разметки ui-kit на Taiga UI: `Box`, `Card`, `Section`. Дети — содержимым
 * (`<ng-content />`).
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** `Box` — блок без оформления; класс узла из схемы (`className`) — классом хоста. */
@Component({
  selector: 'div[kitBox]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: '<ng-content />',
})
export class Box {
  readonly className = input<string>();
  protected readonly classes = computed(() => ['kit-box', this.className()].join(' ').trim());
}

/** `Card` — карточка с рамкой темы Taiga. */
@Component({
  selector: 'div[kitCard]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: '<ng-content />',
})
export class Card {
  readonly className = input<string>();
  protected readonly classes = computed(() =>
    ['kit-card', 'kit-stack', this.className()].join(' ').trim()
  );
}

type Heading = 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

/** `Section` — раздел формы с заголовком. */
@Component({
  selector: 'section[kitSection]',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'classes()' },
  template: `
    @if (title(); as text) {
      @switch (titleAs()) {
        @case ('h2') {
          <h2 [class]="headingClasses()">{{ text }}</h2>
        }
        @case ('h4') {
          <h4 [class]="headingClasses()">{{ text }}</h4>
        }
        @case ('h5') {
          <h5 [class]="headingClasses()">{{ text }}</h5>
        }
        @case ('h6') {
          <h6 [class]="headingClasses()">{{ text }}</h6>
        }
        @default {
          <h3 [class]="headingClasses()">{{ text }}</h3>
        }
      }
    }
    <ng-content />
  `,
})
export class Section {
  readonly className = input<string>();
  readonly title = input<string>();
  readonly titleAs = input<Heading>('h3');
  readonly titleClassName = input<string>();

  protected readonly classes = computed(() =>
    ['kit-section', 'kit-stack', this.className()].join(' ').trim()
  );
  protected readonly headingClasses = computed(() =>
    ['kit-section__title', this.titleClassName()].join(' ').trim()
  );
}
