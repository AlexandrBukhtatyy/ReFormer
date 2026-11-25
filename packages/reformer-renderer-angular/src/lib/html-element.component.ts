/**
 * HTML-узел схемы без обёртки.
 *
 * У компонента Angular всегда есть хост-элемент, и тег узла (`div`, `section`, `p`) должен быть
 * именно им: лишний элемент вокруг ломает раскладку страницы (сетку, flex) и DOM-контракт формы.
 * Поэтому хостом компонента становится готовый элемент нужного тега, а содержимое узла проецируется
 * в него как есть.
 *
 * @module renderer-angular/html-element
 */

import {
  ChangeDetectionStrategy,
  Component,
  createComponent,
  type ComponentRef,
  type EnvironmentInjector,
  type Injector,
} from '@angular/core';

/** Компонент-носитель: хост — элемент узла, шаблон — его дети. */
@Component({
  selector: 'reformer-html',
  template: '<ng-content />',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HtmlElementComponent {}

/** Параметры создания HTML-узла. */
export interface HtmlElementOptions {
  /** Тег узла: `div`, `section`, `p`. */
  tag: string;
  /** Документ, в котором создаётся элемент. */
  document: Document;
  environmentInjector: EnvironmentInjector;
  /** Инжектор места вставки: через него детям видны провайдеры выше по дереву. */
  elementInjector?: Injector;
  /** Узлы DOM, которые становятся содержимым элемента. */
  children?: Node[];
}

/**
 * Создать элемент тега `tag` как хост компонента. Вид компонента (`ref.hostView`) вставляется в
 * контейнер представлений места вставки: `viewContainerRef.insert(ref.hostView)`.
 */
export function createHtmlElement(options: HtmlElementOptions): ComponentRef<HtmlElementComponent> {
  const element = options.document.createElement(options.tag);
  const ref = createComponent(HtmlElementComponent, {
    environmentInjector: options.environmentInjector,
    elementInjector: options.elementInjector,
    hostElement: element,
    projectableNodes: [options.children ?? []],
  });
  // Готовый хост Angular считает корнем приложения и помечает версией — узлу схемы она не нужна.
  element.removeAttribute('ng-version');
  return ref;
}
