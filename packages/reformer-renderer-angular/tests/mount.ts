/**
 * Монтирование компонента в тестах: настоящее приложение Angular без зоны, без TestBed.
 *
 * Перерисовку тест не вызывает: её планирует сам Angular по записи в сигнал. `settle()` ждёт, пока
 * запланированная перерисовка пройдёт, — как это делает страница в браузере.
 */
import {
  ErrorHandler,
  createComponent,
  provideZonelessChangeDetection,
  type ApplicationRef,
  type ComponentRef,
  type Provider,
  type Type,
} from '@angular/core';
import { createApplication } from '@angular/platform-browser';

export interface Mounted<T> {
  /** Хост-элемент смонтированного компонента. */
  root: HTMLElement;
  ref: ComponentRef<T>;
  app: ApplicationRef;
  /** Дождаться запланированной перерисовки; ошибка перерисовки бросается отсюда. */
  settle(): Promise<void>;
  unmount(): void;
}

const active = new Set<() => void>();

/**
 * @param component - Корневой компонент.
 * @param providers - Провайдеры приложения.
 * @param inputs - Входы компонента: ставятся до первой отрисовки.
 */
export async function mount<T>(
  component: Type<T>,
  providers: Provider[] = [],
  inputs: Readonly<Record<string, unknown>> = {}
): Promise<Mounted<T>> {
  // Ошибку перерисовки Angular отдаёт обработчику приложения, а не вызывающему коду.
  let failure: unknown;
  const app = await createApplication({
    providers: [
      provideZonelessChangeDetection(),
      {
        provide: ErrorHandler,
        useValue: {
          handleError(error: unknown): void {
            failure ??= error;
          },
        },
      },
      ...providers,
    ],
  });
  const root = document.createElement('div');
  document.body.appendChild(root);

  const settle = async (): Promise<void> => {
    await app.whenStable();
    if (failure !== undefined) throw failure;
  };
  const unmount = (): void => {
    if (!active.delete(unmount)) return;
    app.destroy();
    root.remove();
  };
  active.add(unmount);

  try {
    const ref = createComponent(component, {
      environmentInjector: app.injector,
      hostElement: root,
    });
    for (const [name, value] of Object.entries(inputs)) ref.setInput(name, value);
    app.attachView(ref.hostView);
    // Первая отрисовка — как у `bootstrap()`; дальше перерисовку планирует Angular.
    app.tick();
    await settle();
    return { root, ref, app, settle, unmount };
  } catch (error) {
    unmount();
    throw error;
  }
}

export function unmountAll(): void {
  for (const unmount of [...active]) unmount();
}

/** Элемент по селектору; без него тест падает с понятным текстом. */
export function get<E extends Element = HTMLElement>(root: ParentNode, selector: string): E {
  const element = root.querySelector<E>(selector);
  if (!element) throw new Error(`нет элемента ${selector}`);
  return element;
}

/** Все элементы по селектору — массивом. */
export function all<E extends Element = HTMLElement>(root: ParentNode, selector: string): E[] {
  return [...root.querySelectorAll<E>(selector)];
}
