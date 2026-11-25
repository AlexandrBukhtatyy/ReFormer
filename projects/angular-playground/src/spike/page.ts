/**
 * Пробная страница: проверяет цепочку сборки Angular CLI — dist ядра, нейтральный вход JSON-слоя,
 * собранный пакет рендерера, общий код форм из бенчмарка, — работу без зоны и виджеты Taiga UI на
 * состоянии формы (`taiga-probe.ts`).
 */
import {
  ChangeDetectionStrategy,
  Component,
  createComponent,
  provideZonelessChangeDetection,
  viewChild,
  type ComponentRef,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { defineRegistry } from '@reformer/renderer-json/neutral';
import { fromCoreSignal } from '@reformer/renderer-angular';
import { TuiRoot } from '@taiga-ui/core/components/root';
import { TUI_ANIMATIONS_SPEED } from '@taiga-ui/core/tokens';
import { provideTaiga } from '@taiga-ui/core/utils/miscellaneous';
import {
  createRegistrationForm,
  loadRegistrationInitial,
  registrationMessages,
  type RegistrationValues,
} from '../../../forms-benchmark/src/cross/registration';
import { TAIGA_ICONS } from '../kit/taiga-icons';
import { TaigaProbe, type ProbeField, type ProbeValues } from './taiga-probe';

/** Заглушка компонента: пробной странице нужен документ формы, а не её отрисовка. */
class Stub {}

const registry = defineRegistry((reg) => {
  for (const name of [
    'TextInput',
    'MaskedInput',
    'Checkbox',
    'CaptchaWidget',
    'Page',
    'Form',
    'Actions',
    'SubmitButton',
    'ResetButton',
  ]) {
    reg.component(name, Stub);
  }
});

let initial: RegistrationValues;

@Component({
  selector: 'spike-page',
  imports: [TaigaProbe, TuiRoot],
  template: `
    <tui-root>
      <main class="spike">
        <h1>Angular: пробная страница</h1>
        <label>
          Имя пользователя
          <input
            data-testid="input-username"
            [value]="username()"
            (input)="write($event)"
            (blur)="touch()"
          />
        </label>
        @if (error(); as code) {
          <span data-testid="error-username">{{ message(code) }}</span>
        }
        <output data-testid="value-username">{{ username() }}</output>
        <spike-taiga-probe />
      </main>
    </tui-root>
  `,
  styles: `
    .spike {
      display: grid;
      gap: 1rem;
      padding: 1.5rem;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class SpikePage {
  private readonly bundle = createRegistrationForm(registry, initial);
  private readonly field = this.bundle.form.username;
  private readonly stopValidation = this.bundle.validation?.controller.start();

  readonly probe = viewChild.required(TaigaProbe);

  readonly username = fromCoreSignal(() => this.field.value.value);
  readonly error = fromCoreSignal(() =>
    this.field.shouldShowError.value ? (this.field.issues.value[0]?.code ?? null) : null
  );

  write(event: Event): void {
    this.field.setValue((event.target as HTMLInputElement).value);
  }

  touch(): void {
    this.field.markAsTouched();
  }

  message(code: string): string {
    const text = (registrationMessages as Record<string, unknown>)[code];
    return typeof text === 'string' ? text : code;
  }

  /** Запись в форму мимо Angular — как её делает сценарий или поведение формы. */
  writeOutside(value: string): void {
    this.field.setValue(value);
  }

  dispose(): void {
    this.stopValidation?.();
    this.bundle.dispose();
  }
}

export async function start(container: HTMLElement): Promise<void> {
  initial = await loadRegistrationInitial();
  const app = await createApplication({
    providers: [
      provideZonelessChangeDetection(),
      // Масштаб шрифта Taiga UI следит за настройкой системы через скрытый iframe — странице проверки
      // он не нужен.
      provideTaiga({ fontScaling: false }),
      // Скорость 0 — длительность анимаций 0 мс: панель списка и текст ошибки появляются и уходят
      // сразу, сценарию нечего ждать.
      { provide: TUI_ANIMATIONS_SPEED, useValue: 0 },
      TAIGA_ICONS,
    ],
  });

  let ref: ComponentRef<SpikePage> | null = null;
  const unmount = (): void => {
    ref?.instance.dispose();
    ref?.destroy();
    ref = null;
  };
  // Монтирование синхронное: приложение создано заранее, компонент создаётся и рисуется на месте.
  const mount = (): void => {
    unmount();
    const host = container.appendChild(document.createElement('div'));
    ref = createComponent(SpikePage, { environmentInjector: app.injector, hostElement: host });
    app.attachView(ref.hostView);
    app.tick();
  };
  mount();

  Object.assign(window, {
    __spike: {
      mount,
      unmount,
      writeOutside: (value: string) => ref?.instance.writeOutside(value),
      stable: () => app.whenStable(),
      probe: {
        set: <K extends ProbeField>(field: K, value: ProbeValues[K]) =>
          ref?.instance.probe().set(field, value),
        disable: (field: ProbeField, disabled: boolean) =>
          ref?.instance.probe().disable(field, disabled),
        fail: (field: ProbeField, code: string | null) => ref?.instance.probe().fail(field, code),
        touched: (field: ProbeField) => ref?.instance.probe().touched(field),
      },
    },
  });
}
