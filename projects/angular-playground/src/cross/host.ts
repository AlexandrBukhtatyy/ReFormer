/**
 * Запуск страницы кросс-фреймворк проверки на Angular: приложение без зоны с Taiga UI и харнесс
 * `window.__bench`.
 *
 * Приложение создаётся один раз, страница монтируется синхронно: компонент создаётся и рисуется
 * на месте (`createComponent` + `attachView` + `tick()`). Так харнесс и меряет монтирование, и
 * перемонтирует страницу по команде сценария.
 */
import {
  createComponent,
  provideZonelessChangeDetection,
  type ComponentRef,
  type Type,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';
import { installBench, type FormId } from '../../../forms-benchmark/src/cross/page';
import { TAIGA_PROVIDERS } from '../kit/taiga';

export async function startCrossPage(
  form: FormId,
  container: HTMLElement,
  page: Type<unknown>
): Promise<void> {
  const app = await createApplication({
    providers: [provideZonelessChangeDetection(), ...TAIGA_PROVIDERS],
  });

  let ref: ComponentRef<unknown> | null = null;

  const unmount = (): void => {
    if (!ref) return;
    const host = ref.location.nativeElement as HTMLElement;
    ref.destroy();
    host.remove();
    ref = null;
  };

  const mount = (): void => {
    unmount();
    const host = container.appendChild(document.createElement('div'));
    ref = createComponent(page, { environmentInjector: app.injector, hostElement: host });
    app.attachView(ref.hostView);
    app.tick();
  };

  installBench(form, container, { mount, unmount });
}
